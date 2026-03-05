// ============================================================
// sim/SimRunner.js — 두 에이전트 오케스트레이션 루프
//
// 흐름:
//   createHeadlessState (실제 게임과 동일한 초기화)
//     → GameMaster.getState() → PlayerAgent.decide()
//     → GameMaster.applyAction() → 반복 → 게임 종료
//     → SimStorage.save()
// ============================================================

import { createHeadlessState } from './HeadlessEngine.js';
import { GameMasterAgent }     from './agents/GameMasterAgent.js';
import { PlayerAgent }         from './agents/PlayerAgent.js';
import { loadCardMap }         from './CardDataLoader.js';

/**
 * 최대 행동 수 안전장치 (절대 방어선)
 * GameMasterAgent.checkGameHealth() 가 30턴 제한으로 먼저 잡음
 */
const MAX_ACTIONS_PER_GAME = 500;

export class SimRunner {
  /**
   * @param {object} opts
   * @param {import('./LLMAdapter.js').LLMAdapter} opts.llmAdapter
   * @param {number}   [opts.gameSeed]          - 게임 시드 (미지정 시 랜덤)
   * @param {number}   [opts.wins=0]            - 누적 승리수 (언락 필터용)
   * @param {number|null} [opts.vpTargetOverride] - 목표 승점 직접 지정 (null: seeded 10~20)
   * @param {number}   [opts.maxTurns=30]       - 최대 턴수 제한 (테스트용: 10)
   * @param {boolean}  [opts.verbose]
   * @param {import('./SimStorage.js').SimStorage} [opts.storage]
   */
  constructor({
    llmAdapter,
    gameSeed = null,
    wins     = 0,
    vpTargetOverride = null,
    maxTurns = 30,
    verbose  = false,
    storage  = null,
  }) {
    this.llmAdapter       = llmAdapter;
    this.gameSeed         = gameSeed;
    this.wins             = wins;
    this.vpTargetOverride = vpTargetOverride;
    this.maxTurns         = maxTurns;
    this.verbose          = verbose;
    this.storage          = storage;
  }

  /**
   * 게임 1회 실행
   * @returns {Promise<object>} 최종 게임 결과
   */
  async run() {
    const cardMap = loadCardMap();

    // ── 실제 게임과 동일한 초기화 ─────────────────────────────
    const gs = createHeadlessState({
      cardMap,
      gameSeed:         this.gameSeed,
      wins:             this.wins,
      vpTargetOverride: this.vpTargetOverride,
    });

    const gameMaster = new GameMasterAgent(gs, { maxTurns: this.maxTurns });
    const player     = new PlayerAgent(this.llmAdapter, { verbose: this.verbose });
    const startTime  = Date.now();

    const info = this.llmAdapter.info();
    if (this.verbose) {
      console.log('\n' + '═'.repeat(60));
      console.log('  도미니언 LLM 시뮬레이션 시작');
      console.log(`  플레이어: ${info.displayName}`);
      console.log(`  모델:     ${info.model}`);
      console.log(`  시드: ${gs.gameSeed}`);
      console.log(`  목표 승점: ${gs.vpTarget}`);
      console.log(`  시장(12): [${gs.marketIds?.join(', ')}]`);
      console.log('═'.repeat(60));
    } else {
      console.log(`[시뮬] ${info.displayName} 시작 (seed:${gs.gameSeed} / vpTarget:${gs.vpTarget})`);
    }

    let actionCount = 0;
    let lastFeedback = null;
    let victory = null;

    // ── 메인 루프 ─────────────────────────────────────────────
    while (actionCount < MAX_ACTIONS_PER_GAME) {
      const state    = gameMaster.getState();
      const possible = gameMaster.getAvailableActions();

      if (this.verbose) {
        console.log(`\n[턴 ${state.turn}] 승점:${state.vp}/${state.targetVp} | 행동${state.actions} 구매${state.buys} 코인${state.coins}`);
        console.log(`  손패: [${state.hand.join(', ')}]`);
      }

      let action;
      try {
        action = await player.decide(state, possible, lastFeedback);
      } catch (err) {
        console.error('[SimRunner] PlayerAgent 오류:', err.message);
        action = { action: 'end_turn', reason: 'error_fallback' };
      }

      if (this.verbose) {
        console.log(`  → Player: ${action.action}${action.card ? ` "${action.card}"` : ''}`);
        if (action.reason) console.log(`     이유: ${action.reason}`);
      }

      const result = gameMaster.applyAction(action);
      actionCount++;

      if (!result.ok) {
        lastFeedback = result.feedback;
        if (this.verbose) console.log(`  ✗ GameMaster 거부: ${result.error}`);
        continue;
      }

      lastFeedback = result.feedback;
      if (this.verbose && result.feedback) console.log(`  ${result.feedback}`);

      if (result.victory) { victory = result.victory; break; }
    }

    const durationMs  = Date.now() - startTime;
    const finalResult = gameMaster.getFinalResult();
    const adapterInfo = this.llmAdapter.info();

    const gameResult = {
      ...finalResult,
      gameSeed:    gs.gameSeed,
      vpTarget:    gs.vpTarget,
      model:       adapterInfo.model,
      persona:     adapterInfo.persona,
      displayName: adapterInfo.displayName,
      victory:     victory ?? { won: false, reason: 'action_limit_exceeded' },
      durationMs,
      durationSec: Math.round(durationMs / 1000),
      llmCalls:    player.stats().totalLLMCalls,
      market:      gs.marketIds  ?? [],      // 시장 12슬롯 (basic+kingdom)
      kingdom:     gs.kingdomIds ?? [],      // 킹덤(액션) 카드만
    };

    this._printResult(gameResult);
    if (this.storage) await this.storage.save(gameResult);

    return gameResult;
  }

  _printResult(r) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${r.displayName} 게임 종료`);
    console.log(`  결과: ${r.victory.won ? '✓ 승리' : '✗ 미완'} (${r.victory.reason})`);
    console.log(`  턴수: ${r.turns} | 승점: ${r.vp} / ${r.vpTarget}`);
    console.log(`  구매: ${r.totalBuys}회 | 카드플레이: ${r.totalPlays}회`);
    console.log(`  LLM 호출: ${r.llmCalls}회 | 소요: ${r.durationSec}초`);
    console.log(`  시장(12): [${(r.market ?? r.kingdom ?? []).join(', ')}]`);
    console.log('═'.repeat(60));
  }
}
