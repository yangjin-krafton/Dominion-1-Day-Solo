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

// ─── 구매 ─────────────────────────────────────────────────────

/**
 * 공급에서 카드 구매
 * @param {object}   def        - CardDef
 * @param {Function} makeCardFn - (def) => Card  [main.js의 makeCard]
 * @returns {{ ok: boolean, card?: Card, reason?: string }}
 */
export function buyCard(gs, def, makeCardFn) {
  if (gs.buys   <= 0)      return { ok: false, reason: 'no_buys' };
  if (gs.coins  <  def.cost) return { ok: false, reason: 'insufficient_coins' };

  gs.buys--;
  gs.coins -= def.cost;

  const card  = makeCardFn(def);
  card.area   = AREAS.DISCARD;
  card.isFaceUp    = true;
  card.frontFace?.visible && (card.frontFace.visible = true);
  card.backFace?.visible  && (card.backFace.visible  = false);
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
 * 표준 공급 수량 초기화 (솔로 1인 기준)
 * @param {Map<string,object>} cardMap  - id → CardDef
 * @param {string[]} basicIds
 * @param {string[]} kingdomIds
 * @returns {Map<string, {def, count}>}
 */
export function initSupply(cardMap, basicIds, kingdomIds) {
  const COUNTS = {
    copper: 46, silver: 40, gold: 30,
    estate: 8,  duchy: 8,  province: 8, curse: 10,
  };
  const supply = new Map();
  for (const id of [...basicIds, ...kingdomIds]) {
    const def = cardMap.get(id);
    if (def) supply.set(id, { def, count: COUNTS[id] ?? 10 });
  }
  return supply;
}
