// ============================================================
// sim/SimRunner.js — 두 에이전트 오케스트레이션 루프
//
// 흐름:
//   GameMaster.getState()
//     → PlayerAgent.decide()
//     → GameMaster.applyAction()
//     → 반복 → 게임 종료
//     → SimStorage.save()
// ============================================================

import { createHeadlessState } from './HeadlessEngine.js';
import { GameMasterAgent }     from './agents/GameMasterAgent.js';
import { PlayerAgent }         from './agents/PlayerAgent.js';
import { loadCardMap, BASE_SUPPLY_IDS, getKingdomIds } from './CardDataLoader.js';

/** 최대 행동 수 안전장치 (무한 루프 방지) */
const MAX_ACTIONS_PER_GAME = 2000;

export class SimRunner {
  /**
   * @param {object} opts
   * @param {import('./LLMAdapter.js').LLMAdapter} opts.llmAdapter   - PlayerAgent용 LLM
   * @param {string[]} [opts.kingdomIds]     - 킹덤 카드 ID 6장 (미지정 시 무작위)
   * @param {number}   [opts.seed]           - 게임 시드
   * @param {number}   [opts.targetVp]       - 목표 승점 (기본 18)
   * @param {boolean}  [opts.verbose]        - 상세 로그
   * @param {import('./SimStorage.js').SimStorage} [opts.storage]
   */
  constructor({
    llmAdapter,
    kingdomIds,
    seed,
    targetVp = 18,
    verbose  = false,
    storage  = null,
  }) {
    this.llmAdapter  = llmAdapter;
    this.kingdomIds  = kingdomIds;
    this.seed        = seed;
    this.targetVp    = targetVp;
    this.verbose     = verbose;
    this.storage     = storage;
  }

  /**
   * 게임 1회 실행
   * @returns {Promise<object>} 최종 게임 결과
   */
  async run() {
    // 카드 데이터 로드
    const cardMap = loadCardMap();
    const allKingdom = getKingdomIds(cardMap);

    // 킹덤 카드 선택 (미지정 시 랜덤 6장)
    let selectedKingdom = this.kingdomIds;
    if (!selectedKingdom || selectedKingdom.length === 0) {
      const shuffled = [...allKingdom].sort(() => Math.random() - 0.5);
      selectedKingdom = shuffled.slice(0, 6);
    }
    const marketIds = [...BASE_SUPPLY_IDS, ...selectedKingdom];

    // 게임 상태 초기화
    const gs = createHeadlessState({
      cardMap,
      marketIds,
      seed:     this.seed,
      targetVp: this.targetVp,
    });

    // 에이전트 생성
    const gameMaster = new GameMasterAgent(gs);
    const player     = new PlayerAgent(this.llmAdapter, { verbose: this.verbose });

    const startTime = Date.now();

    const info = this.llmAdapter.info();
    if (this.verbose) {
      console.log('\n' + '═'.repeat(60));
      console.log('  도미니언 LLM 시뮬레이션 시작');
      console.log(`  플레이어: ${info.displayName}`);
      console.log(`  모델:     ${info.model}`);
      console.log(`  킹덤: [${selectedKingdom.join(', ')}]`);
      console.log(`  시드: ${gs.seed}`);
      console.log('═'.repeat(60));
    } else {
      console.log(`[시뮬] ${info.displayName} 게임 시작 (seed:${gs.seed})`);
    }

    let actionCount = 0;
    let lastFeedback = null;
    let victory = null;

    // ── 메인 루프 ─────────────────────────────────────────
    while (actionCount < MAX_ACTIONS_PER_GAME) {
      const state    = gameMaster.getState();
      const possible = gameMaster.getAvailableActions();

      if (this.verbose) {
        console.log(`\n[턴 ${state.turn}] 승점:${state.vp}/${state.targetVp} | 행동${state.actions} 구매${state.buys} 코인${state.coins}`);
        console.log(`  손패: [${state.hand.join(', ')}]`);
      }

      // PlayerAgent → 행동 결정
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

      // GameMasterAgent → 검증 & 적용
      const result = gameMaster.applyAction(action);
      actionCount++;

      if (!result.ok) {
        lastFeedback = result.feedback;
        if (this.verbose) console.log(`  ✗ GameMaster 거부: ${result.error}`);
        continue;
      }

      lastFeedback = result.feedback;

      if (this.verbose && result.feedback) {
        console.log(`  ${result.feedback}`);
      }

      // 승리 확인
      if (result.victory) {
        victory = result.victory;
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    // 최종 결과 수집
    const finalResult = gameMaster.getFinalResult();
    const adapterInfo = this.llmAdapter.info();
    const gameResult  = {
      ...finalResult,
      model:       adapterInfo.model,
      persona:     adapterInfo.persona,
      displayName: adapterInfo.displayName,
      victory:     victory ?? { won: false, reason: 'max_actions_reached' },
      durationMs,
      durationSec: Math.round(durationMs / 1000),
      llmCalls:    player.stats().totalLLMCalls,
      kingdom:     selectedKingdom,
    };

    // 결과 출력
    this._printResult(gameResult);

    // 저장소에 저장
    if (this.storage) {
      await this.storage.save(gameResult);
    }

    return gameResult;
  }

  _printResult(r) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${r.displayName} 게임 종료`);
    console.log(`  결과: ${r.victory.won ? '✓ 승리' : '✗ 미완'} (${r.victory.reason})`);
    console.log(`  턴수: ${r.turns} | 승점: ${r.vp} / ${r.targetVp}`);
    console.log(`  구매: ${r.totalBuys}회 | 카드플레이: ${r.totalPlays}회`);
    console.log(`  LLM 호출: ${r.llmCalls}회 | 소요: ${r.durationSec}초`);
    console.log(`  킹덤: [${r.kingdom.join(', ')}]`);
    console.log('═'.repeat(60));
  }
}
