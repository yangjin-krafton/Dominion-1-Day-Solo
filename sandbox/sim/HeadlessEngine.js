// ============================================================
// sim/HeadlessEngine.js — src/core/ 직접 재사용 헤드리스 래퍼
//
// [규칙 동기화] src/core/ 를 직접 import → src 규칙 변경이 자동 반영
//
// 브라우저 의존 제거:
//   - SFX      → gs.onShuffle = null (무음)
//   - PIXI     → makeSimCard (평범한 JS 객체, frontFace 없음)
//   - card-effects/*.js (UI 핸들러) → 시뮬 전용 resolvePending() 구현
//   - pending* 키 구조: effects.js 가 설정하는 키 그대로 사용
// ============================================================

// ── src/core/ 직접 임포트 (규칙 동기화 핵심) ─────────────────
import {
  shuffle,
  drawCard,
  drawCards,
  playCard,
  gainCard,
  buyCard,
  endTurn,
  checkVictory,
  initSupply,
} from '../../src/core/TurnEngine.js';

import { calcVP, allCards } from '../../src/core/GameState.js';

import {
  seededRng,
  initMarketQueue,
  popMarketEvent,
  pushNextMarketEvent,
  applyMarketEvent,
  generateMarketEvent,
} from '../../src/core/MarketQueue.js';

import { executeCardEffect } from '../../src/core/CardEffect.js';

// ── src/config.js 상수 재사용 ────────────────────────────────
import { AREAS, BASIC_IDS, KINGDOM_POOL, START_DECK } from '../../src/config.js';

// ── 재export (외부에서 src/core 접근 가능) ────────────────────
export {
  shuffle, drawCard, drawCards, playCard, gainCard, buyCard,
  endTurn, checkVictory, initSupply,
  calcVP, allCards,
  seededRng, initMarketQueue, popMarketEvent, pushNextMarketEvent,
  applyMarketEvent, generateMarketEvent,
  executeCardEffect,
  AREAS, BASIC_IDS, KINGDOM_POOL, START_DECK,
};

// ── 시뮬 전용: 평범한 JS 카드 팩토리 ────────────────────────
let _uid = 0;

/**
 * 시뮬레이션용 카드 생성 (PIXI 없음)
 * TurnEngine 의 gainCard/buyCard 에 makeCardFn 으로 주입
 * frontFace/backFace 없음 → TurnEngine의 `if (card.frontFace)` 조건이 false → 안전
 */
export function makeSimCard(def) {
  return { uid: ++_uid, id: def.id, def };
}

// ── 헤드리스 게임 상태 생성 ──────────────────────────────────

/**
 * Node.js 시뮬레이션용 게임 상태 초기화
 * @param {object} opts
 * @param {Map<string,object>} opts.cardMap
 * @param {string[]}           opts.marketIds   - 시장 카드 ID 배열
 * @param {number}             [opts.seed]
 * @param {number}             [opts.targetVp]  - 목표 승점 (기본 18)
 */
export function createHeadlessState({ cardMap, marketIds, seed, targetVp = 18 }) {
  const usedSeed = seed ?? (Date.now() & 0xffffffff);
  const rng      = seededRng(usedSeed);

  // ── 공급 초기화 (src/core/TurnEngine.initSupply 그대로) ──
  const supply = initSupply(cardMap, marketIds, rng);

  // ── 시작 덱 생성 (src/config.START_DECK 기준) ─────────────
  const startDeck = [];
  for (const [id, count] of Object.entries(START_DECK)) {
    const def = cardMap.get(id);
    if (!def) continue;
    for (let i = 0; i < count; i++) startDeck.push(makeSimCard(def));
  }
  // Seeded 셔플 (src/core/TurnEngine.shuffle 은 in-place)
  for (let i = startDeck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [startDeck[i], startDeck[j]] = [startDeck[j], startDeck[i]];
  }

  const gs = {
    seed:     usedSeed,
    targetVp,
    turn:     1,
    phase:    'action',
    actions:  1,
    buys:     1,
    coins:    0,
    merchantBonus: 0,

    deck:    startDeck,
    hand:    [],
    play:    [],
    discard: [],
    trash:   [],

    supply,
    rng,

    // ── 오디오/UI 콜백 — 시뮬에서는 null ──────────────────
    onShuffle:      null,   // TurnEngine: gs.onShuffle?.()  → 무음
    onEndTurn:      null,
    cardsContainer: null,
    onScrollHand:   null,

    // ── pending 상태 (effects.js 가 설정하는 키 그대로) ────
    // card-effects/*.js 대신 시뮬 전용 resolvePending() 이 처리
    pendingDiscard:  null,  // cellar, poacher
    pendingTrash:    null,  // chapel, moneylender
    pendingGain:     null,  // workshop (type:'gain') + UI-only(bureaucrat/militia/witch)
    pendingPick:     null,  // harbinger, vassal, throne_room, sentry, library
    pendingTwoStep:  null,  // remodel, mine, artisan

    // ── 시장 연동 상태 ─────────────────────────────────────
    marketReduce:      0,
    marketIncrease:    0,
    marketRevealBonus: 0,
    witchActive:       false,
    witchCountdown:    0,

    log: [],
  };

  // 초기 5장 드로우 (src/core/TurnEngine.drawCards 그대로)
  drawCards(gs, 5);
  return gs;
}

// ── pending 감지 ─────────────────────────────────────────────

/** UI-only pendingGain 타입 (플레이어 선택 불필요 — 시장/애니메이션 트리거) */
const UI_ONLY_GAIN = new Set(['militia', 'bureaucrat', 'council_room', 'witch']);

/**
 * 현재 active pending 반환
 * @returns {{ key: string, data: object }|null}
 */
export function getActivePending(gs) {
  if (gs.pendingDiscard) return { key: 'pendingDiscard', data: gs.pendingDiscard };
  if (gs.pendingTrash)   return { key: 'pendingTrash',   data: gs.pendingTrash   };
  if (gs.pendingGain && !UI_ONLY_GAIN.has(gs.pendingGain.type))
    return { key: 'pendingGain', data: gs.pendingGain };
  if (gs.pendingPick)    return { key: 'pendingPick',    data: gs.pendingPick    };
  if (gs.pendingTwoStep) return { key: 'pendingTwoStep', data: gs.pendingTwoStep };
  return null;
}

/**
 * UI-only pendingGain 자동 클리어
 * (bureaucrat/militia/council_room/witch 는 effects.js 에서 시장 효과 이미 적용됨)
 */
export function clearUiPending(gs) {
  if (gs.pendingGain && UI_ONLY_GAIN.has(gs.pendingGain.type)) {
    gs.pendingGain = null;
  }
}

// ── pending 해결 (시뮬 전용, card-effects/*.js 대체) ─────────

/**
 * LLM 결정을 pending 상태에 적용
 * @param {object} gs
 * @param {object} resolution
 * @returns {{ ok: boolean, reason?: string, needsMore?: boolean }}
 */
export function resolvePending(gs, resolution) {
  // UI-only pending 먼저 정리
  clearUiPending(gs);

  const active = getActivePending(gs);
  if (!active) return { ok: false, reason: '처리할 pending 없음' };

  const { key, data } = active;
  const removeFromHand = (id) => {
    const idx = gs.hand.findIndex(c => c.id === id);
    return idx === -1 ? null : gs.hand.splice(idx, 1)[0];
  };

  // ── pendingDiscard (cellar, poacher) ─────────────────────
  if (key === 'pendingDiscard') {
    const targets = resolution.cards ?? [];
    if (data.exact != null && targets.length !== data.exact) {
      return { ok: false, reason: `정확히 ${data.exact}장 버려야 합니다 (${targets.length}장 선택)` };
    }
    for (const id of targets) {
      const card = removeFromHand(id);
      if (card) gs.discard.push(card);
    }
    if (data.drawAfter) drawCards(gs, targets.length); // cellar
    gs.pendingDiscard = null;
    return { ok: true };
  }

  // ── pendingTrash (chapel, moneylender) ───────────────────
  if (key === 'pendingTrash') {
    const targets = (resolution.cards ?? []).slice(0, data.maxCount ?? Infinity);
    for (const id of targets) {
      if (data.filter && id !== data.filter) continue;
      const card = removeFromHand(id);
      if (card) {
        gs.trash.push(card);
        if (data.bonus?.coins) gs.coins += data.bonus.coins; // moneylender
      }
    }
    gs.pendingTrash = null;
    return { ok: true };
  }

  // ── pendingGain (workshop, type:'gain') ──────────────────
  if (key === 'pendingGain') {
    const id   = resolution.card;
    const slot = gs.supply.get(id);
    if (!slot || slot.count <= 0) return { ok: false, reason: `재고 없음: ${id}` };
    if (data.maxCost != null && slot.def.cost > data.maxCost) {
      return { ok: false, reason: `비용 초과: ${slot.def.cost} > ${data.maxCost}` };
    }
    const result = gainCard(gs, slot.def, makeSimCard, data.dest ?? 'discard');
    gs.pendingGain = null;
    gs.log.push({ turn: gs.turn, event: 'gain', card: id });
    return result;
  }

  // ── pendingPick ──────────────────────────────────────────
  if (key === 'pendingPick') {
    return _resolvePick(gs, data, resolution);
  }

  // ── pendingTwoStep ───────────────────────────────────────
  if (key === 'pendingTwoStep') {
    return _resolveTwoStep(gs, data, resolution, removeFromHand);
  }

  return { ok: false, reason: `알 수 없는 pending: ${key}` };
}

function _resolvePick(gs, data, resolution) {
  switch (data.type) {

    case 'harbinger': {
      if (!resolution.card) { gs.pendingPick = null; return { ok: true }; }
      const idx = gs.discard.findIndex(c => c.id === resolution.card);
      if (idx === -1) return { ok: false, reason: `버림더미에 없음: ${resolution.card}` };
      gs.deck.push(gs.discard.splice(idx, 1)[0]);
      gs.pendingPick = null;
      return { ok: true };
    }

    case 'vassal': {
      const top = gs.deck.length > 0 ? gs.deck[gs.deck.length - 1] : null;
      if (!top) { gs.pendingPick = null; return { ok: true }; }
      if (top.def.type === 'Action' && resolution.play !== false) {
        gs.deck.pop();
        gs.play.push(top);
        if (top.def.effectCode) executeCardEffect(top.def, gs, { drawCards });
      } else {
        gs.deck.pop();
        gs.discard.push(top);
        gs.coins += 2;
      }
      gs.pendingPick = null;
      return { ok: true };
    }

    case 'throne_room': {
      const id  = resolution.card;
      const idx = gs.hand.findIndex(c => c.id === id);
      if (idx === -1) return { ok: false, reason: `손패에 없음: ${id}` };
      const card = gs.hand.splice(idx, 1)[0];
      gs.play.push(card);
      if (card.def.effectCode) {
        executeCardEffect(card.def, gs, { drawCards });
        if (!getActivePending(gs)) executeCardEffect(card.def, gs, { drawCards });
      }
      gs.pendingPick = null;
      return { ok: true };
    }

    case 'sentry': {
      const revealed = [];
      for (let i = 0; i < 2; i++) {
        if (gs.deck.length === 0) {
          if (gs.discard.length === 0) break;
          gs.deck    = [...gs.discard];
          gs.discard = [];
          gs.onShuffle?.();
          shuffle(gs.deck);
        }
        if (gs.deck.length === 0) break;
        revealed.push(gs.deck.pop());
      }
      const decided = new Set();
      for (const { card: cid, action } of (resolution.decisions ?? [])) {
        const card = revealed.find(c => c.id === cid && !decided.has(c.uid));
        if (!card) continue;
        decided.add(card.uid);
        if (action === 'trash')        gs.trash.push(card);
        else if (action === 'discard') gs.discard.push(card);
        else                           gs.deck.push(card);
      }
      for (const card of revealed) {
        if (!decided.has(card.uid)) gs.deck.push(card);
      }
      gs.pendingPick = null;
      return { ok: true };
    }

    case 'library': {
      const skipIds = new Set(resolution.skip ?? []);
      while (gs.hand.length < 7) {
        const card = drawCard(gs);
        if (!card) break;
        if (card.def.type === 'Action' && skipIds.has(card.id)) {
          gs.hand.pop();
          gs.discard.push(card);
        }
      }
      gs.pendingPick = null;
      return { ok: true };
    }

    default:
      gs.pendingPick = null;
      return { ok: true };
  }
}

function _resolveTwoStep(gs, data, resolution, removeFromHand) {
  if ((data.step ?? 1) === 1) {
    const card = removeFromHand(resolution.trash);
    if (!card) return { ok: false, reason: `손패에 없음: ${resolution.trash}` };
    gs.trash.push(card);
    gs.pendingTwoStep = { ...data, step: 2, trashed: card };
    return { ok: true, needsMore: true };
  }

  const gainId = resolution.gain;
  const slot   = gs.supply.get(gainId);
  if (!slot || slot.count <= 0) return { ok: false, reason: `재고 없음: ${gainId}` };

  let maxCost = Infinity;
  if (data.type === 'remodel') maxCost = data.trashed.def.cost + 2;
  if (data.type === 'mine')    maxCost = data.trashed.def.cost + 3;
  if (data.type === 'artisan') maxCost = 5;

  if (slot.def.cost > maxCost) {
    return { ok: false, reason: `비용 초과: ${slot.def.cost} > ${maxCost}` };
  }
  if (data.type === 'mine' && slot.def.type !== 'Treasure') {
    return { ok: false, reason: '광산: 보물 카드만 가능' };
  }

  const dest = data.type === 'mine' ? 'hand' : 'discard';
  gainCard(gs, slot.def, makeSimCard, dest);
  gs.log.push({ turn: gs.turn, event: 'gain', card: gainId });

  if (data.type === 'artisan' && resolution.top) {
    const idx = gs.hand.findIndex(c => c.id === resolution.top);
    if (idx !== -1) gs.deck.push(gs.hand.splice(idx, 1)[0]);
  }

  gs.pendingTwoStep = null;
  return { ok: true };
}

// ── 게임 상태 스냅샷 (LLM / 로그 용) ────────────────────────

export function snapshot(gs) {
  const supplySnap = {};
  for (const [id, { def, count }] of gs.supply) {
    supplySnap[id] = { name: def.name, cost: def.cost, count, type: def.type };
  }
  const handIds    = gs.hand.map(c => c.id);
  const handCounts = {};
  for (const id of handIds) handCounts[id] = (handCounts[id] ?? 0) + 1;

  const pending = getActivePending(gs);

  return {
    turn:        gs.turn,
    phase:       gs.phase ?? 'action',
    actions:     gs.actions,
    buys:        gs.buys,
    coins:       gs.coins,
    vp:          calcVP(gs),
    targetVp:    gs.targetVp,
    hand:        handIds,
    handCounts,
    deckSize:    gs.deck.length,
    discardSize: gs.discard.length,
    playArea:    gs.play.map(c => c.id),
    supply:      supplySnap,
    pending:     pending ? _summarizePending(pending) : null,
  };
}

function _summarizePending({ key, data }) {
  switch (key) {
    case 'pendingDiscard': return { type: 'discard', count: data.exact ?? null, filter: data.filter ?? null, drawAfter: !!data.drawAfter };
    case 'pendingTrash':   return { type: 'trash', maxCount: data.maxCount, filter: data.filter ?? null };
    case 'pendingGain':    return { type: 'gain', maxCost: data.maxCost, dest: data.dest };
    case 'pendingPick':    return { type: data.type, source: data.source ?? null };
    case 'pendingTwoStep': return { type: 'two_step', step: data.step ?? 1, stepType: data.type, trashed: data.trashed?.id ?? null };
    default: return { type: key };
  }
}
