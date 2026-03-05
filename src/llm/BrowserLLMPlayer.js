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
import { drawCards } from '../core/TurnEngine.js';
import { getStrategy, getRecentLogs } from './MemoryManager.js';

// ── 규칙 MD 로드 ────────────────────────────────────────────

let _rulesText = '';
fetch(new URL('./rules.md', import.meta.url))
  .then(r => r.text())
  .then(t => { _rulesText = t; console.log('[LLM] rules.md 로드 완료 (%d chars)', t.length); })
  .catch(e => console.warn('[LLM] rules.md 로드 실패:', e.message));

// ── 프롬프트 상수 ──────────────────────────────────────────

const RESPONSE_FORMAT = `
## Response Format (JSON only, no explanation)
{"action": "play", "card": "card_id", "reason": "reason"}
{"action": "buy",  "card": "card_id", "reason": "reason"}
{"action": "end_turn", "reason": "reason"}

Pending resolve:
{"action": "resolve", "resolution": {"cards": ["copper"]}}       // discard/trash
{"action": "resolve", "resolution": {"card": "silver"}}          // gain/pick
{"action": "resolve", "resolution": {"decisions": [...]}}        // sentry
{"action": "resolve", "resolution": {"skip": []}}                // library
{"action": "resolve", "resolution": {"trash": "copper"}}         // two_step step1
{"action": "resolve", "resolution": {"gain": "silver"}}          // two_step step2`;

function getSystemPrompt() {
  const strategy = getStrategy();
  const recentLogs = getRecentLogs(3);
  const recentReviews = recentLogs
    .filter(l => l.review)
    .map(l => `[${l.timestamp}] ${l.won ? 'WIN' : 'LOSS'} ${l.vp}VP/${l.vpTarget} ${l.turns}T\n${l.review}`)
    .join('\n---\n');

  return `/no_think
You are a Dominion card game AI player.
IMPORTANT: Output ONLY JSON. No explanation, no thinking.

${_rulesText}

## Your Accumulated Strategy (from past games)
${strategy}

${recentReviews ? `## Recent Game Reviews\n${recentReviews}` : ''}

${RESPONSE_FORMAT}`;
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

function buildPrompt(gs, availableActions, pending) {
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

  const lines = [
    `=== Turn ${snap.turn} ===`,
    `VP: ${snap.vp}/${snap.targetVp} | Actions:${snap.actions} Buys:${snap.buys} Coins:${snap.coins}`,
    `Hand: [${handDesc}] | Deck:${snap.deckSize} Discard:${snap.discardSize}`,
    `(Treasure cards are auto-played. Coins shown above include all treasures.)`,
    '',
    '=== Supply ===',
    supplyAll,
    '',
    pending ? `=== PENDING (must resolve) ===\n${JSON.stringify(pending, null, 2)}` : '',
    '',
    '=== 가능한 행동 ===',
    actionsDesc,
    '',
    '최선의 행동 1개를 JSON으로 응답하세요.',
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
    this.delay       = 600;   // ms — 행동 간격 (시각적 감상용)
    this.calls       = 0;
    this._retryCount = 0;
    this.actionLog   = [];    // 턴별 행동 기록 (장기 메모리용)
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
    this._loop();
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

    // pending 상태면 skip (llmResolver가 처리)
    const pending = this._getActivePending();
    if (pending) return;

    // ── 재물카드 자동 플레이 (LLM 호출 불필요) ─────────────
    // 도미니언에서 재물을 안 내는 것이 유리한 경우는 거의 없음
    const treasure = gs.hand.find(c => c.def.type === 'Treasure');
    if (treasure) {
      console.log(`%c[LLM 턴${gs.turn}] auto-play "${treasure.def.id}"`, 'color:#aaddaa');
      this.actionLog.push({
        turn: gs.turn, action: 'play',
        card: treasure.def.id, reason: 'auto:treasure',
      });
      this.onPlayCard(treasure);
      return; // 다음 _step에서 나머지 재물 또는 구매 진행
    }

    // ── 액션/구매/종료만 LLM에게 판단 요청 ──────────────────
    const actions = this._getAvailableActions();
    if (actions.length === 0) return;

    // 선택지가 end_turn뿐이면 LLM 호출 불필요
    if (actions.length === 1 && actions[0].action === 'end_turn') {
      console.log(`%c[LLM 턴${gs.turn}] auto end_turn (no options)`, 'color:#aaddaa');
      this.actionLog.push({ turn: gs.turn, action: 'end_turn', card: null, reason: 'auto:no_options' });
      this.onEndTurn();
      return;
    }

    const prompt   = buildPrompt(gs, actions, null);
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

    // 잠시 대기 후 LLM에게 결정 요청
    await this._sleep(this.delay);

    const pending = { field, pd, type: pd.type ?? field.replace('pending', '').toLowerCase() };
    const actions = [{ action: 'resolve', pending: this._summarizePending(field, pd) }];
    const prompt  = buildPrompt(this.gs, actions, this._summarizePending(field, pd));

    let resolution;
    try {
      const decision = await this._callLLM(prompt);
      resolution = decision?.resolution ?? {};
    } catch {
      resolution = {};
    }

    console.log(`%c[LLM] pending(${field}) 해결: ${JSON.stringify(resolution)}`, 'color:#ffaa55');
    this._applyResolution(field, pd, resolution);
    this.sync();
  }

  _summarizePending(field, pd) {
    switch (field) {
      case 'pendingDiscard': return { type: 'discard', count: pd.exact ?? null, filter: pd.filter ?? null, drawAfter: !!pd.drawAfter };
      case 'pendingTrash':   return { type: 'trash', maxCount: pd.maxCount, filter: pd.filter ?? null };
      case 'pendingGain':    return { type: 'gain', maxCost: pd.maxCost, dest: pd.dest };
      case 'pendingPick':    return { type: pd.type, source: pd.source ?? null };
      case 'pendingTwoStep': return { type: 'two_step', step: pd.step ?? 1, stepType: pd.type, trashed: pd.trashed?.def?.id ?? null };
      default: return { type: field };
    }
  }

  /** pending 상태를 직접 게임 상태에 적용 (UI 오버레이 없이) */
  _applyResolution(field, pd, resolution) {
    const gs = this.gs;

    const removeFromHand = (id) => {
      const idx = gs.hand.findIndex(c => c.def.id === id);
      if (idx === -1) return null;
      const card = gs.hand.splice(idx, 1)[0];
      return card;
    };

    switch (field) {
      case 'pendingDiscard': {
        const targets = resolution.cards ?? [];
        for (const id of targets) {
          const card = removeFromHand(id);
          if (card) {
            card.area = AREAS.DISCARD;
            gs.discard.push(card);
          }
        }
        if (pd.drawAfter) drawCards(gs, targets.length); // cellar
        break;
      }

      case 'pendingTrash': {
        const targets = (resolution.cards ?? []).slice(0, pd.maxCount ?? Infinity);
        for (const id of targets) {
          if (pd.filter && id !== pd.filter) continue;
          const card = removeFromHand(id);
          if (card) {
            card.area = AREAS.TRASH;
            gs.trash.push(card);
            if (pd.bonus?.coins) gs.coins += pd.bonus.coins;
          }
        }
        break;
      }

      case 'pendingGain': {
        const id   = resolution.card ?? this._cheapest(pd.maxCost);
        const slot = gs.supply.get(id);
        if (slot && slot.count > 0 && slot.def.cost <= (pd.maxCost ?? Infinity)) {
          slot.count--;
          const card = this.makeCard(slot.def);
          card.area      = pd.dest === 'hand' ? AREAS.HAND : AREAS.DISCARD;
          card.isFaceUp  = true;
          if (card.frontFace) { card.frontFace.visible = true; card.backFace.visible = false; }
          if (pd.dest === 'hand') gs.hand.push(card);
          else                   gs.discard.push(card);
        }
        break;
      }

      case 'pendingPick': {
        if (pd.type === 'harbinger') {
          const id  = resolution.card;
          const idx = gs.discard.findIndex(c => c.def.id === id);
          if (idx !== -1) {
            const card = gs.discard.splice(idx, 1)[0];
            card.area = AREAS.DECK;
            gs.deck.push(card);
          }
        }
        // 다른 pick 타입(vassal, throne_room 등)은 복잡하므로 UI 핸들러에 위임
        break;
      }

      case 'pendingTwoStep': {
        if ((pd.step ?? 1) === 1) {
          // step 1: trash
          const card = removeFromHand(resolution.trash ?? this._firstFromHand());
          if (card) {
            card.area = AREAS.TRASH;
            gs.trash.push(card);
            // step 2 pending 설정
            gs.pendingTwoStep = { ...pd, step: 2, trashed: card };
          }
        } else {
          // step 2: gain
          const gainId = resolution.gain ?? this._cheapest(pd.trashed?.def?.cost + (pd.type === 'mine' ? 3 : 2));
          const slot   = gs.supply.get(gainId);
          if (slot && slot.count > 0) {
            slot.count--;
            const gained = this.makeCard(slot.def);
            const dest   = pd.type === 'mine' ? AREAS.HAND : AREAS.DISCARD;
            gained.area  = dest;
            gained.isFaceUp = true;
            if (gained.frontFace) { gained.frontFace.visible = true; gained.backFace.visible = false; }
            if (dest === AREAS.HAND) gs.hand.push(gained);
            else                     gs.discard.push(gained);
          }
        }
        break;
      }
    }
  }

  // ── 유효 행동 목록 ─────────────────────────────────────

  _getActivePending() {
    const gs = this.gs;
    const KEYS = ['pendingGain','pendingDiscard','pendingTrash','pendingPick','pendingTwoStep'];
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
    // 재물카드는 _step()에서 자동 플레이 — LLM 선택지에서 제외
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

    const priority = ['province','duchy','gold','silver','estate'];
    for (const id of priority) {
      const b = actions.find(a => a.action === 'buy' && a.card === id);
      if (b) return { action: 'buy', card: id, reason: 'fallback:priority' };
    }
    const anyBuy = actions.find(a => a.action === 'buy');
    if (anyBuy) return { action: 'buy', card: anyBuy.card, reason: 'fallback:any' };

    const anyPlay = actions.find(a => a.action === 'play');
    if (anyPlay) return { action: 'play', card: anyPlay.card, reason: 'fallback:action' };

    return { action: 'end_turn', reason: 'fallback:end' };
  }

  _cheapest(maxCost = Infinity) {
    let best = null, bestCost = Infinity;
    for (const [id, { def, count }] of this.gs.supply) {
      if (count > 0 && def.cost <= maxCost && def.cost < bestCost) {
        best = id; bestCost = def.cost;
      }
    }
    return best ?? 'copper';
  }

  _firstFromHand() {
    return this.gs.hand[0]?.def?.id ?? 'copper';
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
