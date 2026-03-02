// ============================================================
// card-effects/_utils.js — 카드 조작 공통 유틸리티
// ============================================================
import { AREAS } from '../config.js';

/** 손패 → 폐기더미 */
export function trashCard(gs, card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return;
  gs.hand.splice(idx, 1);
  card.area              = AREAS.TRASH;
  card.isFaceUp          = true;
  card.frontFace.visible = true;
  card.backFace.visible  = false;
  gs.trash.push(card);
}

/** 손패 → 버림더미 */
export function discardCard(gs, card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return;
  gs.hand.splice(idx, 1);
  card.area              = AREAS.DISCARD;
  card.isFaceUp          = true;
  card.frontFace.visible = true;
  card.backFace.visible  = false;
  gs.discard.push(card);
}

/** 손패 카드를 덱 맨 위로 */
export function putOnDeckTop(gs, card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return;
  gs.hand.splice(idx, 1);
  card.area = AREAS.DECK;
  gs.deck.push(card);  // Array.push = 맨 위 (pop으로 꺼냄)
}
