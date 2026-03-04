// ============================================================
// sim/agents/PlayerAgent.js — LLM 기반 게임 플레이어 에이전트
//
// 역할:
//   - GameMasterAgent로부터 게임 상태 수신
//   - LLM에 전략적 행동 결정 요청
//   - 행동 JSON 파싱 & 반환
//   - 오류 시 재시도 (maxRetries)
//
// 모델 교체: new PlayerAgent(new LLMAdapter({ model: '...새 모델...' }))
// ============================================================

/** 도미니언 규칙 설명 (시스템 프롬프트) */
const DOMINION_RULES = `/no_think
당신은 도미니언(Dominion) 카드게임 플레이어 AI입니다.
중요: 반드시 JSON만 출력하세요. 설명/생각 과정 절대 금지.

## 게임 규칙
- 목표: 목표 승점에 먼저 도달하거나, Province 더미가 소진되거나, 3개 공급 더미가 소진되면 승리
- 매 턴: 행동 페이즈 → 구매 페이즈 → 클린업

## 턴 순서
1. 행동(Action) 카드를 손패에서 플레이 (행동 횟수만큼)
2. 재물(Treasure) 카드를 플레이해 코인 획득
3. 코인으로 공급에서 카드 구매
4. 턴 종료

## 카드 타입
- Treasure(재물): 동(1코인), 은(2코인), 금(3코인)
- Victory(승점): 사유지(1점), 공작령(3점), 주령(6점)
- Action(행동): 다양한 효과 (카드 드로우, 자원 증가 등)
- Curse(저주): -1점

## 전략 원칙
- 초반: 덱을 얇게 유지하며 은, 금 획득으로 코인 기반 확보
- 중반: 행동 카드로 시너지 구성
- 후반: 승점 카드 구매 (공작령, 주령 우선)
- 구매 우선순위: 주령(6코인) > 금(6코인) > 공작령(5코인) > 은(3코인)

## 응답 형식
반드시 JSON으로만 응답하세요. 텍스트 설명 금지.

일반 행동:
{"action": "play", "card": "카드_id", "reason": "이유"}
{"action": "buy", "card": "카드_id", "reason": "이유"}
{"action": "end_turn", "reason": "이유"}

Pending 해결 (resolve):
{"action": "resolve", "resolution": { ... }}

Pending 유형별 resolution:
- discard: {"cards": ["copper", "estate"]}
- trash:   {"cards": ["copper"]}
- gain:    {"card": "silver"}
- pick:    {"card": "copper"}   (harbinger, vassal 등)
- sentry:  {"decisions": [{"card": "copper", "action": "trash"}, {"card": "estate", "action": "discard"}]}
- library: {"skip": ["village"]}  (건너뛸 액션 카드 목록)
- two_step step1: {"trash": "copper"}
- two_step step2: {"gain": "silver"}
- two_step artisan step2: {"gain": "artisan", "top": "estate"}`;

/** 현재 게임 상태를 LLM용 프롬프트로 변환 */
function buildStatePrompt(state, availableActions, feedback) {
  const supplyBuyable = Object.entries(state.supply)
    .filter(([, s]) => s.count > 0 && s.cost <= state.coins)
    .map(([id, s]) => `  ${id}(${s.name}) - 비용:${s.cost}, 재고:${s.count}`)
    .join('\n') || '  없음';

  const supplyAll = Object.entries(state.supply)
    .filter(([, s]) => s.count > 0)
    .map(([id, s]) => `  ${id}(${s.name}) 비용:${s.cost} 재고:${s.count} [${s.type}]`)
    .join('\n');

  const handDesc = Object.entries(state.handCounts)
    .map(([id, cnt]) => `${id}×${cnt}`)
    .join(', ') || '없음';

  const actionsDesc = availableActions
    .map(a => {
      if (a.action === 'play')     return `  play "${a.card}" (${a.name})`;
      if (a.action === 'buy')      return `  buy "${a.card}" (${a.name}) 비용:${a.cost}`;
      if (a.action === 'end_turn') return `  end_turn`;
      if (a.action === 'resolve')  return `  resolve (pending: ${JSON.stringify(a.pending)})`;
      return `  ${JSON.stringify(a)}`;
    })
    .join('\n');

  const lines = [
    `=== 턴 ${state.turn} 상태 ===`,
    `승점: ${state.vp} / 목표: ${state.targetVp}`,
    `자원: 행동${state.actions} 구매${state.buys} 코인${state.coins}`,
    `손패: [${handDesc}]`,
    `플레이 영역: [${state.playArea.join(', ') || '없음'}]`,
    `덱:${state.deckSize}장 버림:${state.discardSize}장`,
    '',
    '=== 공급 (전체) ===',
    supplyAll,
    '',
    state.pending ? `=== PENDING (반드시 resolve 선택) ===\n${JSON.stringify(state.pending, null, 2)}` : '',
    '',
    '=== 현재 구매 가능 ===',
    supplyBuyable,
    '',
    '=== 가능한 행동 목록 ===',
    actionsDesc,
  ];

  if (feedback) {
    lines.push('', '=== GameMaster 피드백 ===', feedback);
  }

  // 재물 카드 플레이 힌트 (가장 흔한 실수 방지)
  const unplayedTreasures = availableActions.filter(
    a => a.action === 'play' && ['gold','silver','copper'].includes(a.card)
  );
  if (unplayedTreasures.length > 0 && !state.pending) {
    lines.push('', `⚠ 힌트: 재물 카드(${unplayedTreasures.map(a=>a.card).join(',')})를 먼저 플레이해야 코인이 생겨 구매 가능합니다.`);
  }

  lines.push('', '위 상태에서 최선의 행동 1개를 JSON으로 응답하세요.');
  return lines.filter(l => l !== null).join('\n');
}

export class PlayerAgent {
  /**
   * @param {import('../LLMAdapter.js').LLMAdapter} llmAdapter
   * @param {object} [opts]
   * @param {number} [opts.maxRetries=3]  - 유효하지 않은 응답 시 재시도 횟수
   * @param {boolean} [opts.verbose=false] - 상세 로그 출력
   */
  constructor(llmAdapter, { maxRetries = 3, verbose = false } = {}) {
    this.llm        = llmAdapter;
    this.maxRetries = maxRetries;
    this.verbose    = verbose;
    this.totalCalls = 0;
  }

  /**
   * 게임 상태를 받아 행동 결정
   * @param {object} state          - GameMasterAgent.getState()
   * @param {object[]} availableActions - GameMasterAgent.getAvailableActions()
   * @param {string} [feedback]     - 이전 행동 결과 피드백 (오류 시)
   * @returns {Promise<object>}     - 행동 객체 { action, card?, resolution?, reason? }
   */
  async decide(state, availableActions, feedback = null) {
    const userPrompt = buildStatePrompt(state, availableActions, feedback);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      this.totalCalls++;

      if (this.verbose) {
        console.log(`\n[PlayerAgent] 결정 요청 (시도 ${attempt}/${this.maxRetries})`);
        console.log('  상태:', JSON.stringify({ turn: state.turn, vp: state.vp, coins: state.coins, hand: state.hand }));
      }

      let raw;
      try {
        raw = await this.llm.chat(DOMINION_RULES, userPrompt);
      } catch (err) {
        console.error(`[PlayerAgent] LLM 오류: ${err.message}`);
        if (attempt === this.maxRetries) return this._fallback(state, availableActions);
        continue;
      }

      if (this.verbose) {
        console.log(`  LLM 응답: ${raw.slice(0, 200)}`);
      }

      const parsed = this._parse(raw);
      if (!parsed) {
        console.warn(`[PlayerAgent] JSON 파싱 실패 (시도 ${attempt}): ${raw.slice(0, 100)}`);
        continue;
      }

      const validated = this._validate(parsed, availableActions);
      if (!validated.ok) {
        console.warn(`[PlayerAgent] 유효성 검사 실패: ${validated.reason}`);
        // 재시도 시 에러 메시지를 피드백에 포함
        feedback = `이전 응답이 유효하지 않습니다: ${validated.reason}. 가능한 행동: ${availableActions.map(a => a.action + (a.card ? ` "${a.card}"` : '')).join(', ')}`;
        continue;
      }

      if (this.verbose) {
        console.log(`  결정: ${JSON.stringify(parsed)}`);
      }

      return parsed;
    }

    // 모든 재시도 실패 → 기본 전략으로 폴백
    console.warn('[PlayerAgent] 최대 재시도 초과 → 폴백 전략 사용');
    return this._fallback(state, availableActions);
  }

  // ── JSON 파싱 ──────────────────────────────────────────

  _parse(raw) {
    // 1) 모든 think 태그 제거 (<think>...</think> 및 단독 </think>)
    let text = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\/think>/gi, '')
      .replace(/<think>/gi, '')
      .trim();

    // 2) ```json ... ``` 코드블록 추출
    const codeBlock = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (codeBlock) {
      try { return JSON.parse(codeBlock[1]); } catch {}
    }

    // 3) 중첩 브레이스 추적으로 첫 완전한 JSON 객체 추출
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0, inStr = false, escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape)          { escape = false; continue; }
      if (ch === '\\' && inStr) { escape = true; continue; }
      if (ch === '"')      { inStr = !inStr; continue; }
      if (inStr)           continue;
      if (ch === '{')      depth++;
      else if (ch === '}') { depth--; if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch {}
      }}
    }
    return null;
  }

  // ── 유효성 검사 ───────────────────────────────────────

  _validate(parsed, availableActions) {
    if (!parsed.action) return { ok: false, reason: '"action" 필드 없음' };

    const validActionTypes = new Set(availableActions.map(a => a.action));

    if (!validActionTypes.has(parsed.action)) {
      return { ok: false, reason: `현재 불가능한 행동: "${parsed.action}"` };
    }

    if (parsed.action === 'play' || parsed.action === 'buy') {
      if (!parsed.card) return { ok: false, reason: '"card" 필드 없음' };
      const valid = availableActions.some(a => a.action === parsed.action && a.card === parsed.card);
      if (!valid) {
        return { ok: false, reason: `"${parsed.card}"는 현재 ${parsed.action} 불가` };
      }
    }

    if (parsed.action === 'resolve') {
      if (!parsed.resolution) return { ok: false, reason: '"resolution" 필드 없음' };
    }

    return { ok: true };
  }

  // ── 폴백: 규칙 기반 기본 전략 ─────────────────────────

  /**
   * LLM 실패 시 Big Money 기반 폴백
   * 1) 재물 카드 모두 플레이
   * 2) 가장 비싼 카드 구매 (승점 우선)
   * 3) 턴 종료
   */
  _fallback(state, availableActions) {
    // 재물 플레이
    const treasurePlay = availableActions.find(
      a => a.action === 'play' && ['gold', 'silver', 'copper'].includes(a.card)
    );
    if (treasurePlay) return { action: 'play', card: treasurePlay.card, reason: 'fallback:treasure' };

    // pending resolve
    const resolveAction = availableActions.find(a => a.action === 'resolve');
    if (resolveAction) {
      return this._fallbackResolve(state.pending);
    }

    // 구매: 승점 카드 우선, 없으면 가장 비싼 카드
    const buyPriority = ['province', 'duchy', 'gold', 'silver', 'estate'];
    for (const id of buyPriority) {
      const buyable = availableActions.find(a => a.action === 'buy' && a.card === id);
      if (buyable) return { action: 'buy', card: id, reason: 'fallback:priority' };
    }

    // 액션 카드 플레이
    const actionPlay = availableActions.find(a => a.action === 'play');
    if (actionPlay) return { action: 'play', card: actionPlay.card, reason: 'fallback:action' };

    // 어떤 구매든
    const anyBuy = availableActions.find(a => a.action === 'buy');
    if (anyBuy) return { action: 'buy', card: anyBuy.card, reason: 'fallback:any' };

    return { action: 'end_turn', reason: 'fallback:end' };
  }

  _fallbackResolve(pending) {
    if (!pending) return { action: 'end_turn', reason: 'fallback' };
    switch (pending.type) {
      case 'discard': return { action: 'resolve', resolution: { cards: [] } };
      case 'trash':   return { action: 'resolve', resolution: { cards: [] } };
      case 'gain':    return { action: 'resolve', resolution: { card: 'copper' } };
      case 'pick':    return { action: 'resolve', resolution: { card: pending.card ?? 'copper' } };
      case 'sentry':  return { action: 'resolve', resolution: { decisions: [] } };
      case 'library': return { action: 'resolve', resolution: { skip: [] } };
      case 'two_step':
        if (pending.step === 1) return { action: 'resolve', resolution: { trash: 'copper' } };
        return { action: 'resolve', resolution: { gain: 'silver' } };
      default:        return { action: 'resolve', resolution: {} };
    }
  }

  /** 통계 정보 */
  stats() {
    return { totalLLMCalls: this.totalCalls };
  }
}
