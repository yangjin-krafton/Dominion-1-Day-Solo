// ============================================================
// sim/agents/GameMasterAgent.js — 게임 진행 검수 에이전트
//
// 역할:
//   - 게임 규칙 집행자 (rule enforcer)
//   - PlayerAgent 요청 행동의 유효성 검증
//   - 게임 상태 업데이트 및 승리 조건 판단
//   - 행동 결과 피드백 제공
//
// LLM 미사용 (순수 코드 기반) → 빠르고 결정론적
// 필요 시 opts.useLLM = true 로 LLM 기반 심판으로 전환 가능
// ============================================================

import {
  playCard, buyCard, endTurn, checkVictory, calcVP,
  resolvePending, getActivePending, clearUiPending, snapshot,
  makeSimCard,
} from '../HeadlessEngine.js';

/** 행동 타입 */
export const ACTION = Object.freeze({
  PLAY:    'play',
  BUY:     'buy',
  END_TURN: 'end_turn',
  RESOLVE: 'resolve',
});

export class GameMasterAgent {
  /**
   * @param {object} gs - HeadlessEngine 게임 상태
   */
  constructor(gs) {
    this.gs     = gs;
    this.turnHistory = [];   // 턴별 요약 기록
    this._turnActions = [];  // 현재 턴 행동 목록
  }

  // ── 게임 상태 조회 ───────────────────────────────────────

  /** PlayerAgent에 전달할 게임 상태 스냅샷 */
  getState() {
    return snapshot(this.gs);
  }

  /** 현재 유효한 행동 목록 반환 (PlayerAgent 힌트용) */
  getAvailableActions() {
    const gs = this.gs;
    const actions = [];

    // UI-only pending 먼저 정리
    clearUiPending(gs);

    // pending이 있으면 resolve만 가능
    const pending = getActivePending(gs);
    if (pending) {
      actions.push({ action: ACTION.RESOLVE, pending: this.getState().pending });
      return actions;
    }

    // 액션 페이즈: 손패의 액션 카드 플레이
    if (gs.actions > 0) {
      for (const card of gs.hand) {
        if (card.def.type === 'Action') {
          actions.push({ action: ACTION.PLAY, card: card.id, name: card.def.name });
        }
      }
    }

    // 재물 카드는 항상 플레이 가능 (중복 방지)
    for (const card of gs.hand) {
      if (card.def.type === 'Treasure') {
        if (!actions.some(a => a.action === ACTION.PLAY && a.card === card.id)) {
          actions.push({ action: ACTION.PLAY, card: card.id, name: card.def.name });
        }
      }
    }

    // 구매 가능 카드
    if (gs.buys > 0) {
      for (const [id, { def, count }] of gs.supply) {
        if (count > 0 && gs.coins >= def.cost) {
          actions.push({ action: ACTION.BUY, card: id, name: def.name, cost: def.cost });
        }
      }
    }

    // 턴 종료 (항상 가능)
    actions.push({ action: ACTION.END_TURN });

    return actions;
  }

  // ── 행동 검증 & 적용 ─────────────────────────────────────

  /**
   * PlayerAgent의 행동 요청 처리
   * @param {object} action - PlayerAgent가 결정한 행동
   * @returns {object} result - { ok, state, victory?, error?, feedback? }
   */
  applyAction(action) {
    const gs = this.gs;

    // pending 상태에서 resolve 외 행동 차단
    clearUiPending(gs);
    const activePending = getActivePending(gs);
    if (activePending && action.action !== ACTION.RESOLVE) {
      return this._reject(
        `pending 해결 필요: ${activePending.data.type} (action="${action.action}" 불가)`,
        action
      );
    }

    let result;
    switch (action.action) {
      case ACTION.PLAY: {
        // TurnEngine.playCard 는 카드 객체를 받음 → ID로 손패에서 찾기
        const card = gs.hand.find(c => c.id === action.card);
        if (!card) return this._reject(`손패에 없는 카드: "${action.card}"`, action);
        result = playCard(gs, card);
        gs.log.push({ turn: gs.turn, event: 'play', card: action.card });
        break;
      }

      case ACTION.BUY: {
        // TurnEngine.buyCard 는 def + makeCardFn을 받음
        const slot = gs.supply.get(action.card);
        if (!slot) return this._reject(`공급에 없음: "${action.card}"`, action);
        result = buyCard(gs, slot.def, makeSimCard);
        if (result.ok) gs.log.push({ turn: gs.turn, event: 'buy', card: action.card });
        break;
      }

      case ACTION.END_TURN: {
        // 재물 카드 자동 플레이 옵션 (플레이어가 안 했을 경우)
        // → 시뮬에서는 명시적으로 플레이하도록 강제
        endTurn(gs);
        this._recordTurn();
        result = { ok: true };
        break;
      }

      case ACTION.RESOLVE:
        result = resolvePending(gs, action.resolution ?? {});
        break;

      default:
        return this._reject(`알 수 없는 행동: "${action.action}"`, action);
    }

    if (!result.ok) {
      return this._reject(result.reason, action);
    }

    this._turnActions.push(action);

    // 승리 조건 확인
    const victory = checkVictory(gs);
    const state   = this.getState();

    return {
      ok:      true,
      state,
      victory: victory.won ? { ...victory, vp: calcVP(gs) } : null,
      feedback: this._buildFeedback(action, result, state),
    };
  }

  // ── 내부 헬퍼 ───────────────────────────────────────────

  _reject(reason, action) {
    return {
      ok:       false,
      error:    reason,
      action,
      state:    this.getState(),
      feedback: `[GameMaster] 행동 거부: ${reason}. 다시 선택해주세요.`,
    };
  }

  _buildFeedback(action, result, state) {
    const parts = [];
    switch (action.action) {
      case ACTION.PLAY:
        parts.push(`✓ "${action.card}" 플레이 완료`);
        parts.push(`  → 현재: 행동${state.actions} 구매${state.buys} 코인${state.coins}`);
        if (state.pending) parts.push(`  → pending 발생: ${state.pending.type}`);
        break;
      case ACTION.BUY:
        parts.push(`✓ "${action.card}" 구매 완료 (남은 구매: ${state.buys})`);
        break;
      case ACTION.END_TURN:
        parts.push(`✓ 턴 ${state.turn - 1} 종료 → 턴 ${state.turn} 시작`);
        parts.push(`  → 손패: [${state.hand.join(', ')}]`);
        break;
      case ACTION.RESOLVE:
        parts.push(`✓ pending(${this.gs.log.slice(-1)[0]?.event ?? ''}) 해결 완료`);
        break;
    }
    return parts.join('\n');
  }

  _recordTurn() {
    this.turnHistory.push({
      turn:    this.gs.turn - 1,
      actions: [...this._turnActions],
      vp:      calcVP(this.gs),
    });
    this._turnActions = [];
  }

  // ── 게임 요약 ───────────────────────────────────────────

  /** 게임 종료 시 최종 결과 반환 */
  getFinalResult() {
    const gs = this.gs;
    return {
      seed:       gs.seed,
      turns:      gs.turn,
      vp:         calcVP(gs),
      targetVp:   gs.targetVp,
      totalBuys:  gs.log.filter(l => l.event === 'buy').length,
      totalPlays: gs.log.filter(l => l.event === 'play').length,
      kingdom:    [...gs.supply.keys()].filter(id =>
        !['copper','silver','gold','estate','duchy','province','curse'].includes(id)
      ),
      turnHistory: this.turnHistory,
      actionLog:   gs.log,
    };
  }
}
