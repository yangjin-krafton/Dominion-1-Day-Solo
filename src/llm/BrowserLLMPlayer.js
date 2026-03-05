// ============================================================
// llm/BrowserLLMPlayer.js — 인게임 LLM 자동 플레이어 (브라우저)
//
// 콘솔 명령어:
//   window.dominion.llm.start()           LLM 플레이 시작
//   window.dominion.llm.stop()            중지
//   window.dominion.llm.setModel('...')   모델 변경
//   window.dominion.llm.setUrl('...')     LM Studio URL 변경
//   window.dominion.llm.setDelay(800)     행동 간격 ms
//   window.dominion.llm.status()          현재 상태 확인
//
// 동작 원리:
//   1. gs 상태를 읽어 LLM 에게 행동 결정 요청
//   2. 결정된 행동을 실제 게임 함수(onPlayCard, onBuyCard, onEndTurn)로 실행
//   3. Pending 상태(cellar, chapel 등)는 LLM 또는 폴백으로 자동 해결
//   4. UI는 그대로 동작 — 플레이어가 실시간 시청 가능
// ============================================================

import { AREAS } from '../config.js';
import { drawCards, shuffle } from '../core/TurnEngine.js';
import { executeCardEffect } from '../core/CardEffect.js';
import { getStrategy, getRecentLogs } from './MemoryManager.js';

// ── 규칙 MD 로드 ────────────────────────────────────────────

let _rulesText = '';
fetch(new URL('./rules.md', import.meta.url))
  .then(r => r.text())
  .then(t => { _rulesText = t; console.log('[LLM] rules.md 로드 완료 (%d chars)', t.length); })
  .catch(e => console.warn('[LLM] rules.md 로드 실패:', e.message));

// ── 시스템 프롬프트 조립 ─────────────────────────────────────
// rules.md   = 게임 규칙 + 카드 정보 + 응답 형식 (고정)
// strategy.md = 전략 (localStorage, 매 게임 후 LLM이 자동 갱신)
// recentLogs  = 최근 3게임 리뷰

function getSystemPrompt() {
  const strategy = getStrategy();
  const recentLogs = getRecentLogs(3);
  const recentReviews = recentLogs
    .filter(l => l.review)
    .map(l => `[${l.timestamp}] ${l.won ? 'WIN' : 'LOSS'} ${l.vp}VP/${l.vpTarget} ${l.turns}T\n${l.review}`)
    .join('\n---\n');

  return `/no_think
${_rulesText}

## Your Accumulated Strategy
${strategy}

${recentReviews ? `## Recent Game Reviews\n${recentReviews}` : ''}`;
}

// ── 스냅샷 헬퍼 ───────────────────────────────────────────

function buildSnapshot(gs) {
  const supplySnap = {};
  for (const [id, { def, count }] of gs.supply) {
    supplySnap[id] = { name: def.name, cost: def.cost, count, type: def.type, desc: def.summary || def.desc || '' };
  }
  const handIds = gs.hand.map(c => c.def.id);
  const handCounts = {};
  for (const id of handIds) handCounts[id] = (handCounts[id] ?? 0) + 1;

  return {
    turn:        gs.turn,
    actions:     gs.actions,
    buys:        gs.buys,
    coins:       gs.coins,
    vp:          gs.vp ?? 0,
    targetVp:    gs.vpTarget ?? gs.targetVp ?? 18,
    hand:        handIds,
    handCounts,
    deckSize:    gs.deck.length,
    discardSize: gs.discard.length,
    supply:      supplySnap,
  };
}

function buildPrompt(gs, availableActions, pending, gamePlan = '') {
  const snap = buildSnapshot(gs);
  const supplyAll = Object.entries(snap.supply)
    .filter(([, s]) => s.count > 0)
    .map(([id, s]) => `  ${id}(${s.name}) 비용:${s.cost} 재고:${s.count} [${s.type}]${s.desc ? ' — ' + s.desc : ''}`)
    .join('\n');

  const handDesc = Object.entries(snap.handCounts)
    .map(([id, cnt]) => `${id}×${cnt}`).join(', ') || '없음';

  const actionsDesc = availableActions
    .map(a => {
      if (a.action === 'play') return `  play "${a.card}" (${a.name})`;
      if (a.action === 'buy')  return `  buy "${a.card}" (${a.name}) 비용:${a.cost}`;
      if (a.action === 'end_turn') return `  end_turn`;
      if (a.action === 'resolve') return `  resolve (pending: ${JSON.stringify(a.pending)})`;
      return `  ${JSON.stringify(a)}`;
    }).join('\n');

  // 전체 덱 구성 (보유 카드 요약 — 중복 구매 방지에 활용)
  const allCards = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  const ownedCounts = {};
  for (const c of allCards) ownedCounts[c.def.id] = (ownedCounts[c.def.id] ?? 0) + 1;
  const ownedDesc = Object.entries(ownedCounts)
    .sort(([,a],[,b]) => b - a)
    .map(([id, cnt]) => `${id}×${cnt}`).join(', ');

  const lines = [
    `=== Turn ${snap.turn} ===`,
    `VP: ${snap.vp}/${snap.targetVp} | Actions:${snap.actions} Buys:${snap.buys} Coins:${snap.coins}`,
    `Hand: [${handDesc}] | Deck:${snap.deckSize} Discard:${snap.discardSize}`,
    `My deck: [${ownedDesc}] (${allCards.length} total)`,
    '',
    '=== Supply ===',
    supplyAll,
    '',
    pending ? `=== PENDING (must resolve) ===\n${JSON.stringify(pending, null, 2)}` : '',
    gamePlan ? `\n=== THIS GAME PLAN (follow this) ===\n${gamePlan}` : '',
    '',
    '=== Available Actions ===',
    actionsDesc,
    '',
    'Choose the best action. Output JSON only.',
  ];
  return lines.filter(l => l !== null && l !== undefined).join('\n');
}

// ── JSON 파서 ─────────────────────────────────────────────

function parseJSON(raw) {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/think>/gi, '')
    .replace(/<think>/gi, '')
    .trim();

  // ```json ... ``` 블록
  const codeBlock = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]); } catch {}
  }

  // 중첩 브레이스 추적
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape)               { escape = false; continue; }
    if (ch === '\\' && inStr) { escape = true; continue; }
    if (ch === '"')           { inStr = !inStr; continue; }
    if (inStr)                continue;
    if (ch === '{')           depth++;
    else if (ch === '}')      { depth--; if (depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch {}
    }}
  }
  return null;
}

// ── 메인 클래스 ───────────────────────────────────────────

export class BrowserLLMPlayer {
  constructor({ baseURL, model, gs, onPlayCard, onBuyCard, onEndTurn, sync, makeCard }) {
    this.baseURL    = baseURL;
    this.model      = model;
    this.gs         = gs;
    this.onPlayCard = onPlayCard;
    this.onBuyCard  = onBuyCard;
    this.onEndTurn  = onEndTurn;
    this.sync       = sync;
    this.makeCard   = makeCard;

    this._running    = false;
    this._autoPlay   = false;  // 연속 자동 플레이 모드 (게임 종료 → 메모리 → 다음 게임)
    this.delay       = 600;    // ms — 행동 간격 (시각적 감상용)
    this.calls       = 0;
    this._retryCount = 0;
    this.actionLog   = [];     // 턴별 행동 기록 (장기 메모리용)
    this._onGameEnd  = null;   // 게임 종료 → 다음 게임 시작 콜백
    this._gamePlan   = '';     // 게임 시작 시 LLM이 생성한 단기 전략 캐시
  }

  // ── 공개 API ────────────────────────────────────────────

  start(opts = {}) {
    if (typeof opts === 'string') opts = { baseURL: opts };
    const { baseURL, model, delay } = opts;
    if (baseURL) this.baseURL = baseURL;
    if (model)   this.model   = model;
    if (delay)   this.delay   = delay;

    if (this._running) {
      console.log('[LLM] 이미 실행 중. stop() 후 다시 시작하세요.');
      return;
    }
    this._running = true;

    // CardActionHandler._tryDispatch 훅: pending 상태를 LLM이 처리
    this.gs.llmResolver = (field, pd) => this._resolvePending(field, pd);

    console.log(`%c[LLM] 🎮 LLM 플레이 시작`, 'color:#ffd700;font-weight:bold');
    console.log(`  모델: ${this.model}`);
    console.log(`  URL:  ${this.baseURL}`);
    console.log(`  속도: ${this.delay}ms/행동`);

    // 게임 시작 시 시장 분석 + 단기 전략 계획 생성
    this._generateGamePlan().then(() => this._loop());
  }

  stop() {
    this._running = false;
    this.gs.llmResolver = null;
    console.log('%c[LLM] 🛑 LLM 플레이 중지', 'color:#ff6666;font-weight:bold');
  }

  status() {
    return {
      running: this._running,
      model:   this.model,
      url:     this.baseURL,
      delay:   this.delay,
      calls:   this.calls,
      turn:    this.gs.turn,
      vp:      this.gs.vp,
    };
  }

  // ── 메인 루프 ──────────────────────────────────────────

  async _loop() {
    while (this._running) {
      try {
        await this._step();
      } catch (e) {
        console.error('[LLM] 루프 오류:', e);
      }
      await this._sleep(this.delay);
    }
  }

  async _step() {
    const gs = this.gs;

    // ── 승리/종료 감지 ────────────────────────────────────
    if (this._checkGameOver()) {
      if (this._autoPlay) {
        console.log(`%c[LLM] 게임 종료 감지 — 메모리 처리 후 다음 게임 자동 시작`, 'color:#44ff88;font-weight:bold');
        this._running = false;
        this.gs.llmResolver = null;
        // _onGameEnd 콜백이 메모리 처리 + 다음 게임 시작을 담당
        if (this._onGameEnd) this._onGameEnd();
      } else {
        console.log(`%c[LLM] 게임 종료 감지 — 자동 정지`, 'color:#44ff88;font-weight:bold');
        this.stop();
      }
      return;
    }

    // pending 상태면 skip (llmResolver가 처리)
    const pending = this._getActivePending();
    if (pending) return;

    // ── 재물카드 자동 플레이 (액션카드가 없고 행동도 0일 때만) ──
    // 액션카드가 손에 있으면 재물과 상호작용할 수 있으므로 LLM 판단 필요
    // (moneylender: 동전 폐기, mine: 재물 업그레이드, cellar: 재물 버리기 등)
    const hasAction = gs.hand.some(c => c.def.type === 'Action');
    if (!hasAction || gs.actions <= 0) {
      const treasure = gs.hand.find(c => c.def.type === 'Treasure');
      if (treasure) {
        console.log(`%c[LLM 턴${gs.turn}] auto-play "${treasure.def.id}"`, 'color:#aaddaa');
        this.actionLog.push({
          turn: gs.turn, action: 'play',
          card: treasure.def.id, reason: 'auto:treasure',
        });
        this.onPlayCard(treasure);
        return;
      }
    }

    // ── LLM에게 판단 요청 (액션/재물/구매/종료) ──────────────
    const actions = this._getAvailableActions();
    if (actions.length === 0) return;

    // 의미 있는 선택지가 없으면 LLM 호출 불필요
    const meaningful = actions.filter(a =>
      a.action === 'play' ||
      (a.action === 'buy' && a.card !== 'curse') ||
      a.action === 'resolve'
    );
    if (meaningful.length === 0) {
      console.log(`%c[LLM 턴${gs.turn}] auto end_turn (no meaningful options)`, 'color:#aaddaa');
      this.actionLog.push({ turn: gs.turn, action: 'end_turn', card: null, reason: 'auto:no_options' });
      this.onEndTurn();
      return;
    }

    const prompt   = buildPrompt(gs, actions, null, this._gamePlan);
    let decision;

    try {
      decision = await this._callLLM(prompt);
    } catch (e) {
      console.warn('[LLM] API 오류:', e.message, '→ 폴백');
      decision = this._fallback(actions);
    }

    if (!decision) {
      this._retryCount++;
      if (this._retryCount > 5) {
        console.warn('[LLM] 응답 파싱 실패 반복 → 폴백');
        decision = this._fallback(actions);
        this._retryCount = 0;
      }
      return;
    }
    this._retryCount = 0;

    // 유효성 검사
    const valid = this._validate(decision, actions);
    if (!valid) {
      console.warn(`[LLM] 유효하지 않은 행동: ${JSON.stringify(decision)}`);
      decision = this._fallback(actions);
    }

    console.log(`%c[LLM 턴${gs.turn}] ${decision.action}${decision.card ? ' "'+decision.card+'"' : ''}`, 'color:#88ddff');
    if (decision.reason) console.log(`  이유: ${decision.reason}`);

    // 행동 로그 기록
    this.actionLog.push({
      turn: gs.turn, action: decision.action,
      card: decision.card ?? null, reason: decision.reason ?? '',
    });

    await this._execute(decision, actions);
  }

  // ── 행동 실행 ──────────────────────────────────────────

  async _execute(decision, actions) {
    const gs = this.gs;

    switch (decision.action) {
      case 'play': {
        const card = gs.hand.find(c => c.def.id === decision.card);
        if (!card) { console.warn(`[LLM] 손패에 없음: ${decision.card}`); return; }
        this.onPlayCard(card);
        break;
      }
      case 'buy': {
        const slot = gs.supply.get(decision.card);
        if (!slot) { console.warn(`[LLM] 공급에 없음: ${decision.card}`); return; }
        this.onBuyCard(slot.def);
        break;
      }
      case 'end_turn': {
        this.onEndTurn();
        break;
      }
      case 'resolve': {
        // pending을 직접 resolve (llmResolver 우회)
        const pending = this._getActivePending();
        if (pending) {
          this._applyResolution(pending.field, pending.pd, decision.resolution ?? {});
          this.sync();
        }
        break;
      }
    }
  }

  // ── Pending 해결 (CardActionHandler 훅) ─────────────────

  /** CardActionHandler._tryDispatch 에서 호출됨 */
  async _resolvePending(field, pd) {
    if (!this._running) return;
    const gs = this.gs;
    const type = pd.type ?? field.replace('pending', '').toLowerCase();

    // ── pendingThrone (알현실 2차): 즉시 실행 ──────────────────
    if (field === 'pendingThrone') {
      console.log(`%c[LLM] auto throne_room 2nd: ${pd.card?.def?.id}`, 'color:#aaddaa');
      if (pd.card?.def?.effectCode) {
        executeCardEffect(pd.card.def, gs, { drawCards });
      }
      this.sync();
      return;
    }

    // ── 시장 연출 카드: LLM 판단 불필요, 즉시 처리 ──────────
    if (['militia', 'bureaucrat', 'council_room', 'witch'].includes(type)) {
      console.log(`%c[LLM] auto-resolve market effect: ${type}`, 'color:#aaddaa');
      // bureaucrat: silver를 덱 위에 획득
      if (type === 'bureaucrat') {
        const silverSlot = gs.supply.get('silver');
        if (silverSlot && silverSlot.count > 0) {
          silverSlot.count--;
          const card = this.makeCard(silverSlot.def);
          card.area = AREAS.DECK;
          card.isFaceUp = false;
          gs.deck.push(card);
        }
        gs.marketRevealBonus = 0;
      }
      // militia: marketReduce already set by effect token, clear for turn-end
      if (type === 'militia') gs.marketReduce = 0;
      // council_room: marketIncrease already set
      if (type === 'council_room') gs.marketIncrease = 0;
      this.sync();
      return;
    }

    await this._sleep(this.delay);

    // ── LLM에게 판단 요청이 필요한 pending ──────────────────
    const summary = this._summarizePending(field, pd);
    const actions = [{ action: 'resolve', pending: summary }];
    const prompt  = buildPrompt(gs, actions, summary, this._gamePlan);

    let resolution;
    try {
      const decision = await this._callLLM(prompt);
      resolution = decision?.resolution ?? {};
    } catch {
      resolution = {};
    }

    console.log(`%c[LLM] pending(${type}) 해결: ${JSON.stringify(resolution)}`, 'color:#ffaa55');
    this._applyResolution(field, pd, resolution);
    this.sync();
  }

  _summarizePending(field, pd) {
    const gs = this.gs;
    switch (field) {
      case 'pendingDiscard': {
        const handIds = gs.hand.map(c => c.def.id);
        return { type: pd.type ?? 'discard', count: pd.exact ?? null, drawAfter: !!pd.drawAfter, hand: handIds };
      }
      case 'pendingTrash': {
        const handIds = gs.hand.filter(c => !pd.filter || c.def.id === pd.filter).map(c => c.def.id);
        return { type: pd.type ?? 'trash', maxCount: pd.maxCount, filter: pd.filter ?? null, eligible: handIds };
      }
      case 'pendingGain': {
        const options = [...gs.supply.entries()]
          .filter(([, v]) => v.count > 0 && v.def.cost <= (pd.maxCost ?? Infinity))
          .map(([id, v]) => `${id}(cost:${v.def.cost})`);
        return { type: pd.type ?? 'gain', maxCost: pd.maxCost, dest: pd.dest, options };
      }
      case 'pendingPick': {
        if (pd.type === 'harbinger') {
          return { type: 'harbinger', discardIds: gs.discard.map(c => c.def.id) };
        }
        if (pd.type === 'vassal') {
          return { type: 'vassal', info: 'auto-resolved' };
        }
        if (pd.type === 'throne_room') {
          const actionIds = gs.hand.filter(c => c.def.type === 'Action').map(c => c.def.id);
          return { type: 'throne_room', actions: actionIds };
        }
        if (pd.type === 'library') {
          return { type: 'library', info: 'auto-resolved' };
        }
        if (pd.type === 'sentry') {
          return { type: 'sentry', info: 'auto-resolved' };
        }
        return { type: pd.type };
      }
      case 'pendingTwoStep': {
        if ((pd.step ?? 1) === 1) {
          const eligible = pd.type === 'mine'
            ? gs.hand.filter(c => c.def.type === 'Treasure').map(c => c.def.id)
            : pd.type === 'artisan'
              ? [] // artisan step1 is gain, not trash
              : gs.hand.map(c => c.def.id);
          return { type: pd.type, step: 1, eligible };
        } else {
          const maxCost = pd.type === 'mine' ? (pd.trashed?.def?.cost ?? 0) + 3
                        : pd.type === 'remodel' ? (pd.trashed?.def?.cost ?? 0) + 2
                        : 5;
          const filter = pd.type === 'mine' ? 'Treasure' : null;
          const options = [...gs.supply.entries()]
            .filter(([, v]) => v.count > 0 && v.def.cost <= maxCost && (!filter || v.def.type === filter))
            .map(([id, v]) => `${id}(cost:${v.def.cost})`);
          return { type: pd.type, step: 2, trashed: pd.trashed?.def?.id, maxCost, options };
        }
      }
      default: return { type: field };
    }
  }

  /** pending 상태를 직접 게임 상태에 적용 (UI 오버레이 없이) */
  _applyResolution(field, pd, resolution) {
    const gs = this.gs;

    const removeFromHand = (id) => {
      const idx = gs.hand.findIndex(c => c.def.id === id);
      if (idx === -1) return null;
      return gs.hand.splice(idx, 1)[0];
    };

    const setCardArea = (card, area) => {
      card.area = area;
      card.isFaceUp = true;
      if (card.frontFace) { card.frontFace.visible = true; card.backFace.visible = false; }
    };

    switch (field) {
      case 'pendingDiscard': {
        // cellar, poacher
        let targets = resolution.cards ?? [];

        // cellar 폴백: LLM이 빈 배열 → 약한 카드 자동 선택 (curse, estate, copper 순)
        if (targets.length === 0 && pd.drawAfter && gs.hand.length > 0) {
          const WEAK = ['curse', 'estate', 'copper'];
          targets = gs.hand
            .filter(c => WEAK.includes(c.def.id))
            .map(c => c.def.id);
        }

        const count = pd.exact ?? targets.length; // poacher: exact N required
        let discarded = 0;
        for (const id of targets) {
          if (pd.exact && discarded >= pd.exact) break;
          const card = removeFromHand(id);
          if (card) { setCardArea(card, AREAS.DISCARD); gs.discard.push(card); discarded++; }
        }
        // poacher: if not enough selected, force discard from hand
        if (pd.exact && discarded < pd.exact) {
          while (discarded < pd.exact && gs.hand.length > 0) {
            const card = gs.hand.shift();
            setCardArea(card, AREAS.DISCARD); gs.discard.push(card); discarded++;
          }
        }
        if (pd.drawAfter && discarded > 0) drawCards(gs, discarded); // cellar
        break;
      }

      case 'pendingTrash': {
        // chapel, moneylender — LLM이 cards/trash 중 아무 키나 쓸 수 있음
        let trashTargets = resolution.cards ?? resolution.trash ?? [];
        if (!Array.isArray(trashTargets)) trashTargets = [trashTargets];

        // chapel 안전장치: Silver/Gold 절대 폐기 금지
        if (pd.type === 'chapel') {
          trashTargets = trashTargets.filter(id => id !== 'silver' && id !== 'gold');
        }

        // chapel 폴백: LLM이 빈 배열 → curse, estate만 자동 폐기
        // copper는 최소 3장 보존 (코인 생성 수단 고갈 방지)
        if (trashTargets.length === 0 && pd.type === 'chapel' && gs.hand.length > 0) {
          const allCards = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
          const copperCount = allCards.filter(c => c.def.id === 'copper').length;
          const SAFE = ['curse', 'estate'];
          if (copperCount > 3) SAFE.push('copper'); // copper 3장 이상일 때만 폐기 허용
          trashTargets = gs.hand
            .filter(c => SAFE.includes(c.def.id))
            .map(c => c.def.id)
            .slice(0, pd.maxCount ?? 4);
        }
        const targets = trashTargets.slice(0, pd.maxCount ?? Infinity);
        for (const id of targets) {
          if (pd.filter && id !== pd.filter) continue;
          const card = removeFromHand(id);
          if (card) {
            setCardArea(card, AREAS.TRASH); gs.trash.push(card);
            // moneylender: +3 coins when trashing copper
            if (pd.type === 'moneylender') gs.coins += 3;
          }
        }
        break;
      }

      case 'pendingGain': {
        // workshop, gain (general)
        const id = resolution.card ?? this._bestGain(pd.maxCost);
        const slot = gs.supply.get(id);
        if (slot && slot.count > 0 && slot.def.cost <= (pd.maxCost ?? Infinity)) {
          slot.count--;
          const card = this.makeCard(slot.def);
          const dest = pd.dest === 'hand' ? AREAS.HAND : AREAS.DISCARD;
          setCardArea(card, dest);
          if (dest === AREAS.HAND) gs.hand.push(card);
          else gs.discard.push(card);
        }
        break;
      }

      case 'pendingPick': {
        if (pd.type === 'harbinger') {
          const id = resolution.card;
          if (id) {
            const idx = gs.discard.findIndex(c => c.def.id === id);
            if (idx !== -1) {
              const card = gs.discard.splice(idx, 1)[0];
              card.area = AREAS.DECK; gs.deck.push(card);
            }
          }
        } else if (pd.type === 'vassal') {
          this._resolveVassal();
        } else if (pd.type === 'throne_room') {
          this._resolveThroneRoom(resolution);
        } else if (pd.type === 'library') {
          this._resolveLibrary();
        } else if (pd.type === 'sentry') {
          this._resolveSentry(resolution);
        }
        break;
      }

      case 'pendingTwoStep': {
        if (pd.type === 'artisan') {
          this._resolveArtisan(pd, resolution);
        } else if ((pd.step ?? 1) === 1) {
          // remodel/mine step 1: trash
          const eligible = pd.type === 'mine'
            ? gs.hand.filter(c => c.def.type === 'Treasure')
            : gs.hand;
          const trashId = resolution.trash ?? eligible[0]?.def?.id;
          const card = trashId ? removeFromHand(trashId) : null;
          if (card) {
            setCardArea(card, AREAS.TRASH); gs.trash.push(card);
            gs.pendingTwoStep = { ...pd, step: 2, trashed: card };
          }
        } else {
          // remodel/mine step 2: gain
          const maxCost = (pd.trashed?.def?.cost ?? 0) + (pd.type === 'mine' ? 3 : 2);
          const gainId = resolution.gain ?? this._bestGain(maxCost, pd.type === 'mine' ? 'Treasure' : null);
          const slot = gs.supply.get(gainId);
          if (slot && slot.count > 0 && slot.def.cost <= maxCost) {
            slot.count--;
            const gained = this.makeCard(slot.def);
            const dest = pd.type === 'mine' ? AREAS.HAND : AREAS.DISCARD;
            setCardArea(gained, dest);
            if (dest === AREAS.HAND) gs.hand.push(gained);
            else gs.discard.push(gained);
          }
        }
        break;
      }
    }
  }

  // ── 복잡한 pending 개별 처리 ─────────────────────────────

  /** Vassal: 덱 위 1장 공개 → 액션이면 자동 플레이 */
  _resolveVassal() {
    const gs = this.gs;
    if (gs.deck.length === 0) {
      if (gs.discard.length === 0) return;
      gs.deck = [...gs.discard]; gs.discard = []; shuffle(gs.deck);
      gs.deck.forEach(c => { c.area = AREAS.DECK; });
    }
    if (gs.deck.length === 0) return;
    const card = gs.deck.pop();
    card.isFaceUp = true;
    if (card.frontFace) { card.frontFace.visible = true; card.backFace.visible = false; }
    if (card.def.type === 'Action') {
      // 액션이면 자동 플레이 (행동 소모 없음)
      card.area = AREAS.PLAY; gs.play.push(card);
      if (card.def.effectCode) executeCardEffect(card.def, gs, { drawCards });
      console.log(`%c[LLM] vassal auto-play: ${card.def.id}`, 'color:#aaddaa');
    } else {
      card.area = AREAS.DISCARD; gs.discard.push(card);
    }
  }

  /** Throne Room: 액션 카드 선택 → 2회 실행 */
  _resolveThroneRoom(resolution) {
    const gs = this.gs;
    const actionCards = gs.hand.filter(c => c.def.type === 'Action');
    if (actionCards.length === 0) return;
    const targetId = resolution.card ?? actionCards[0].def.id;
    const idx = gs.hand.findIndex(c => c.def.type === 'Action' && c.def.id === targetId);
    if (idx === -1) return;
    const card = gs.hand.splice(idx, 1)[0];
    card.area = AREAS.PLAY; gs.play.push(card);
    // 1차 + 2차 효과 실행
    if (card.def.effectCode) {
      executeCardEffect(card.def, gs, { drawCards });
      executeCardEffect(card.def, gs, { drawCards });
    }
    console.log(`%c[LLM] throne_room: ${card.def.id} x2`, 'color:#aaddaa');
  }

  /** Library: 손패 7장까지 뽑기 (액션 skip) */
  _resolveLibrary() {
    const gs = this.gs;
    const skipped = [];
    while (gs.hand.length < 7) {
      if (gs.deck.length === 0) {
        if (gs.discard.length === 0) break;
        gs.deck = [...gs.discard]; gs.discard = []; shuffle(gs.deck);
        gs.deck.forEach(c => { c.area = AREAS.DECK; });
      }
      if (gs.deck.length === 0) break;
      const card = gs.deck.pop();
      card.isFaceUp = true;
      if (card.frontFace) { card.frontFace.visible = true; card.backFace.visible = false; }
      if (card.def.type === 'Action') {
        // 액션 카드 skip (간단한 폴백: 모두 skip)
        skipped.push(card);
      } else {
        card.area = AREAS.HAND; gs.hand.push(card);
      }
    }
    // skipped 카드 → 버림더미
    for (const c of skipped) { c.area = AREAS.DISCARD; gs.discard.push(c); }
  }

  /** Sentry: 덱 위 2장 → 폐기/버리기/덱위 복귀 (LLM 판단 or 폴백) */
  _resolveSentry(resolution) {
    const gs = this.gs;
    const revealed = [];
    for (let i = 0; i < 2; i++) {
      if (gs.deck.length === 0) {
        if (gs.discard.length === 0) break;
        gs.deck = [...gs.discard]; gs.discard = []; shuffle(gs.deck);
        gs.deck.forEach(c => { c.area = AREAS.DECK; });
      }
      if (gs.deck.length === 0) break;
      revealed.push(gs.deck.pop());
    }
    if (revealed.length === 0) return;

    // LLM이 decisions 배열을 줬으면 사용, 아니면 폴백
    const decisions = resolution.decisions ?? [];
    for (let i = 0; i < revealed.length; i++) {
      const card = revealed[i];
      const dec = decisions[i] ?? 'keep'; // 'trash', 'discard', 'keep'
      card.isFaceUp = true;
      if (card.frontFace) { card.frontFace.visible = true; card.backFace.visible = false; }
      if (dec === 'trash') {
        // 저주/사유지 같은 약한 카드 폐기
        card.area = AREAS.TRASH; gs.trash.push(card);
      } else if (dec === 'discard') {
        card.area = AREAS.DISCARD; gs.discard.push(card);
      } else {
        // keep: 덱 위로 복귀
        card.area = AREAS.DECK; gs.deck.push(card);
      }
    }
    console.log(`%c[LLM] sentry: ${revealed.map((c,i) => `${c.def.id}→${decisions[i]??'keep'}`).join(', ')}`, 'color:#aaddaa');
  }

  /** Artisan: step1 gain→hand, step2 hand→deck top */
  _resolveArtisan(pd, resolution) {
    const gs = this.gs;
    if ((pd.step ?? 1) === 1) {
      // step 1: gain card cost<=5 to hand
      const gainId = resolution.gain ?? resolution.card ?? this._bestGain(5);
      const slot = gs.supply.get(gainId);
      if (slot && slot.count > 0 && slot.def.cost <= 5) {
        slot.count--;
        const card = this.makeCard(slot.def);
        card.area = AREAS.HAND; card.isFaceUp = true;
        if (card.frontFace) { card.frontFace.visible = true; card.backFace.visible = false; }
        gs.hand.push(card);
      }
      // step 2: put 1 card from hand on top of deck
      gs.pendingTwoStep = { ...pd, step: 2 };
    } else {
      // step 2: hand → deck top
      const putId = resolution.card ?? resolution.put ?? gs.hand[0]?.def?.id;
      if (putId) {
        const idx = gs.hand.findIndex(c => c.def.id === putId);
        if (idx !== -1) {
          const card = gs.hand.splice(idx, 1)[0];
          card.area = AREAS.DECK; gs.deck.push(card);
        }
      }
    }
  }

  // ── 유효 행동 목록 ─────────────────────────────────────

  _getActivePending() {
    const gs = this.gs;
    const KEYS = ['pendingGain','pendingDiscard','pendingTrash','pendingPick','pendingTwoStep','pendingThrone'];
    for (const field of KEYS) {
      if (gs[field]) return { field, pd: gs[field] };
    }
    return null;
  }

  _getAvailableActions() {
    const gs = this.gs;
    const actions = [];

    const pending = this._getActivePending();
    if (pending) {
      actions.push({ action: 'resolve', pending: this._summarizePending(pending.field, pending.pd) });
      return actions;
    }

    if (gs.actions > 0) {
      for (const card of gs.hand) {
        if (card.def.type === 'Action') {
          actions.push({ action: 'play', card: card.def.id, name: card.def.name });
        }
      }
    }
    // 재물카드: 액션카드가 손에 있을 때만 LLM 선택지에 포함
    // (없으면 _step()에서 자동 플레이)
    const hasAction = gs.hand.some(c => c.def.type === 'Action') && gs.actions > 0;
    if (hasAction) {
      for (const card of gs.hand) {
        if (card.def.type === 'Treasure') {
          if (!actions.some(a => a.action === 'play' && a.card === card.def.id)) {
            actions.push({ action: 'play', card: card.def.id, name: card.def.name });
          }
        }
      }
    }
    if (gs.buys > 0) {
      for (const [id, { def, count }] of gs.supply) {
        if (count > 0 && gs.coins >= def.cost) {
          actions.push({ action: 'buy', card: id, name: def.name, cost: def.cost });
        }
      }
    }
    actions.push({ action: 'end_turn' });
    return actions;
  }

  // ── LLM API 호출 ──────────────────────────────────────

  async _callLLM(userPrompt) {
    this.calls++;
    const body = {
      model:       this.model,
      temperature: 0.3,
      max_tokens:  400,
      messages: [
        { role: 'system',    content: getSystemPrompt() },
        { role: 'user',      content: userPrompt },
        { role: 'assistant', content: '{' },
      ],
      response_format: { type: 'text' },
    };

    const res = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data    = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content && content !== '') throw new Error('응답 없음');

    return parseJSON('{' + content);
  }

  // ── 유틸 ──────────────────────────────────────────────

  _validate(decision, actions) {
    if (!decision?.action) return false;
    const validTypes = new Set(actions.map(a => a.action));
    if (!validTypes.has(decision.action)) return false;
    if ((decision.action === 'play' || decision.action === 'buy') && !decision.card) return false;
    if (decision.action === 'play' || decision.action === 'buy') {
      return actions.some(a => a.action === decision.action && a.card === decision.card);
    }
    return true;
  }

  _fallback(actions) {
    // Big Money 폴백 (재물은 자동 플레이됨)
    const resolve = actions.find(a => a.action === 'resolve');
    if (resolve) return { action: 'resolve', resolution: {}, reason: 'fallback:resolve' };

    const gs = this.gs;
    const vpRemaining = (gs.vpTarget ?? 20) - (gs.vp ?? 0);

    // 구매 우선순위: Province > Gold > Duchy > Silver (Estate는 VP 거의 달성 시에만)
    const priority = ['province', 'gold', 'duchy', 'silver'];
    if (vpRemaining <= 3) priority.push('estate'); // 승리 직전에만 Estate 허용
    for (const id of priority) {
      const b = actions.find(a => a.action === 'buy' && a.card === id);
      if (b) return { action: 'buy', card: id, reason: 'fallback:priority' };
    }

    // 액션 카드 플레이
    const anyPlay = actions.find(a => a.action === 'play');
    if (anyPlay) return { action: 'play', card: anyPlay.card, reason: 'fallback:action' };

    // 나머지 구매 (Estate/Curse 제외)
    const safeBuy = actions.find(a => a.action === 'buy' && a.card !== 'estate' && a.card !== 'curse');
    if (safeBuy) return { action: 'buy', card: safeBuy.card, reason: 'fallback:any' };

    return { action: 'end_turn', reason: 'fallback:end' };
  }

  /** 최대 비용 이하에서 가장 비싼 카드 선택 (폴백용) */
  _bestGain(maxCost = Infinity, typeFilter = null) {
    let best = null, bestCost = -1;
    for (const [id, { def, count }] of this.gs.supply) {
      if (count > 0 && def.cost <= maxCost && def.cost > bestCost) {
        if (typeFilter && def.type !== typeFilter) continue;
        best = id; bestCost = def.cost;
      }
    }
    return best ?? 'copper';
  }

  /** 게임 종료 조건 확인 (VP 도달 / Province 소진 / 3더미 소진) */
  _checkGameOver() {
    const gs = this.gs;
    if (gs.vp >= (gs.vpTarget ?? Infinity)) return true;
    if (!gs.supply?.size) return false;
    let emptyCount = 0;
    for (const [id, { count }] of gs.supply) {
      if (count <= 0) {
        if (id === 'province') return true;
        emptyCount++;
        if (emptyCount >= 3) return true;
      }
    }
    return false;
  }

  /** 게임 시작 시 시장 분석 + 단기 전략 계획 생성 */
  async _generateGamePlan() {
    const gs = this.gs;
    this._gamePlan = '';

    // 시장 카드 목록
    const marketCards = [...gs.supply.entries()]
      .filter(([, v]) => v.count > 0)
      .map(([id, v]) => `${id}(${v.def.name}) cost:${v.def.cost} stock:${v.count} [${v.def.type}] — ${v.def.summary || v.def.desc || ''}`)
      .join('\n');

    const prompt = `You are starting a new Dominion solo game.

## Game Setup
- Target VP: ${gs.vpTarget}
- Starting deck: 7 Copper + 3 Estate

## Available Market Cards (12 slots)
${marketCards}

## Task
Analyze the available kingdom cards and create a game plan. Output in this format:

### Win Condition Analysis
(How to reach ${gs.vpTarget} VP fastest — how many Provinces/Duchies needed)

### Priority Buy Order
(Turn 1-4 buys, Turn 5-10 buys, Turn 10+ buys — specific to THIS market)

### Key Synergies
(Which cards work well together in this specific market)

### Cards to Avoid
(Cards that are weak or traps in this specific market setup)

### Warnings
(Market event risks, supply pile concerns)

Write concisely in Korean. Max 500 chars.`;

    try {
      const res = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local' },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.4,
          max_tokens: 800,
          messages: [
            { role: 'system', content: getSystemPrompt() },
            { role: 'user',   content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await res.json();
        this._gamePlan = data?.choices?.[0]?.message?.content ?? '';
        console.log(`%c[LLM] 게임 전략 계획 생성 완료`, 'color:#88ff88;font-weight:bold');
        console.log(this._gamePlan);
      }
    } catch (e) {
      console.warn('[LLM] 게임 계획 생성 실패:', e.message);
      this._gamePlan = '';
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
