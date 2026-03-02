// ============================================================
// core/TurnEngine.js — 순수 게임 로직 엔진
// PixiJS 의존 없음. 상태 변이만 담당.
// 시각 업데이트는 콜백(gs.onUpdate)으로 main.js에 위임.
// ============================================================
import { AREAS } from '../config.js';
import { executeCardEffect } from './CardEffect.js';

// ─── 유틸 ─────────────────────────────────────────────────────
/** Fisher-Yates 셔플 (in-place) */
export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// ─── 드로우 ───────────────────────────────────────────────────

/**
 * 덱 최상단 1장 손패로 드로우
 * 덱이 비면 버림더미를 셔플해서 재사용
 * @returns {Card|null}
 */
export function drawCard(gs) {
  if (gs.deck.length === 0) {
    if (gs.discard.length === 0) return null;
    gs.deck    = [...gs.discard];
    gs.discard = [];
    shuffle(gs.deck);
    // 덱 재생성 시 카드 area 복원
    gs.deck.forEach(c => { c.area = AREAS.DECK; });
  }
  if (gs.deck.length === 0) return null;

  const card = gs.deck.pop();
  card.area  = AREAS.HAND;
  gs.hand.push(card);
  return card;
}

/**
 * n장 연속 드로우 → 드로우된 카드 배열 반환
 */
export function drawCards(gs, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    const c = drawCard(gs);
    if (c) drawn.push(c); else break;
  }
  return drawn;
}

// ─── 플레이 ───────────────────────────────────────────────────

/**
 * 손패에서 카드 1장 플레이
 * - Action: 행동 소모 + effectCode 실행
 * - Treasure: 코인 추가
 * @returns {{ ok: boolean, reason?: string }}
 */
export function playCard(gs, card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return { ok: false, reason: 'not_in_hand' };

  // 액션 카드는 행동 횟수가 남아 있어야 함
  if (card.def.type === 'Action' && gs.actions <= 0) {
    return { ok: false, reason: 'no_actions' };
  }

  gs.hand.splice(idx, 1);
  gs.play.push(card);
  card.area = AREAS.PLAY;

  if (card.def.type === 'Action') {
    gs.actions = Math.max(0, gs.actions - 1);
    // 효과 실행 — engine 객체로 drawCards 등을 주입
    if (card.def.effectCode) {
      executeCardEffect(card.def, gs, { drawCards });
    }
  }

  if (card.def.type === 'Treasure') {
    gs.coins += card.def.coins ?? 0;
  }

  return { ok: true };
}

// ─── 카드 획득 (비용 무관) ────────────────────────────────────

/**
 * 공급에서 카드를 무료로 획득 (workshop 등)
 * @param {object}   gs
 * @param {object}   def        - CardDef
 * @param {Function} makeCardFn - (def) => Card
 * @param {'discard'|'hand'} dest - 획득 후 도착 더미 (기본: discard)
 * @returns {{ ok: boolean, card?: Card, reason?: string }}
 */
export function gainCard(gs, def, makeCardFn, dest = 'discard') {
  const slot = gs.supply?.get(def.id);
  if (!slot || slot.count <= 0) return { ok: false, reason: 'out_of_stock' };
  slot.count--;

  const card = makeCardFn(def);
  card.isFaceUp          = true;
  card.frontFace.visible = true;
  card.backFace.visible  = false;

  if (dest === 'hand') {
    card.area = AREAS.HAND;
    gs.hand.push(card);
  } else {
    card.area = AREAS.DISCARD;
    gs.discard.push(card);
  }

  return { ok: true, card };
}

// ─── 구매 ─────────────────────────────────────────────────────

/**
 * 공급에서 카드 구매
 * @param {object}   def        - CardDef
 * @param {Function} makeCardFn - (def) => Card  [main.js의 makeCard]
 * @returns {{ ok: boolean, card?: Card, reason?: string }}
 */
export function buyCard(gs, def, makeCardFn) {
  if (gs.buys <= 0)         return { ok: false, reason: 'no_buys' };
  if (gs.coins < def.cost)  return { ok: false, reason: 'insufficient_coins' };

  // 공급 재고 확인 & 차감
  const slot = gs.supply?.get(def.id);
  if (slot && slot.count <= 0) return { ok: false, reason: 'out_of_stock' };
  if (slot) slot.count--;

  gs.buys--;
  gs.coins -= def.cost;

  const card = makeCardFn(def);
  card.area              = AREAS.DISCARD;
  card.isFaceUp          = true;
  card.frontFace.visible = true;
  card.backFace.visible  = false;
  gs.discard.push(card);

  return { ok: true, card };
}

// ─── 턴 종료 ──────────────────────────────────────────────────

/**
 * 클린업 페이즈: 플레이 + 손패 → 버림더미, 자원 리셋
 */
export function endTurn(gs) {
  for (const c of [...gs.play, ...gs.hand]) {
    c.area = AREAS.DISCARD;
  }
  gs.discard.push(...gs.play, ...gs.hand);
  gs.play    = [];
  gs.hand    = [];
  gs.turn++;
  gs.actions = 1;
  gs.buys    = 1;
  gs.coins   = 0;
}

// ─── 승리 조건 ────────────────────────────────────────────────

/**
 * 표준 Dominion 승리 조건 확인
 *  1) Province 더미 소진
 *  2) 3개 이상 공급 더미 소진
 * @param {Map<string, {def, count}>} supply
 * @returns {boolean}
 */
export function checkVictory(supply) {
  if (!supply?.size) return false;
  let emptyCount = 0;
  for (const [id, { count }] of supply) {
    if (count <= 0) {
      if (id === 'province') return true;
      emptyCount++;
      if (emptyCount >= 3) return true;
    }
  }
  return false;
}

/**
 * 공급 수량 초기화 — 솔로 1인, 시드 기반 랜덤 범위 배분
 *
 * @param {Map<string,object>} cardMap  - id → CardDef
 * @param {string[]} marketIds          - 시장 12슬롯 카드 ID 배열
 * @param {function} rng                - seededRng() 결과 (없으면 Math.random)
 * @returns {Map<string, {def, count}>}
 *
 * 수량 범위 설계 (솔로 기준):
 *  - 기본 재화/승점: 적당히 넉넉하되 고갈 가능한 수준
 *  - 킹덤 카드: 5~10장 (시장 이벤트 압박이 체감되는 수량)
 *  - 저주: 시장에 없어도 공급에 항상 존재
 */
export function initSupply(cardMap, marketIds, rng = null) {
  const _r = rng ?? Math.random;

  // 카드별 [최소, 최대] 수량 범위
  const RANGES = {
    copper:   [32, 44],
    silver:   [18, 28],
    gold:     [10, 18],
    estate:   [ 4,  7],
    duchy:    [ 3,  6],
    province: [ 4,  7],   // 적게 → 게임 압박 증가
    curse:    [ 5,  9],
  };
  const KINGDOM_RANGE = [5, 10];   // 킹덤 카드 공용 범위

  const randBetween = (min, max) => min + Math.floor(_r() * (max - min + 1));

  const supply = new Map();
  for (const id of marketIds) {
    const def = cardMap.get(id);
    if (!def) continue;
    const [min, max] = RANGES[id] ?? KINGDOM_RANGE;
    supply.set(id, { def, count: randBetween(min, max) });
  }

  // 저주: 시장에 없어도 공급에 항상 추가
  if (!supply.has('curse')) {
    const def = cardMap.get('curse');
    if (def) {
      const [min, max] = RANGES.curse;
      supply.set('curse', { def, count: randBetween(min, max) });
    }
  }
  return supply;
}
