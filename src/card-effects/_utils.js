// ============================================================
// card-effects/_utils.js — 카드 조작 공통 유틸리티
// ============================================================
import { AREAS }     from '../config.js';
import { drawCards } from '../core/TurnEngine.js';
import { SFX }       from '../asset/audio/sfx.js';

/**
 * executeCardEffect 에 주입하는 engine 객체 생성.
 * drawCards 를 래핑하여 상태는 즉시 반영하고,
 * 드로우 카드는 일반 드로우와 동일한 flip 모션을 적용한다.
 *
 * @param {{ sync: function }} ctx - CardActionHandler ctx
 */
export function makeEffectEngine(ctx) {
  return {
    drawCards: (gs, n) => {
      const drawn = drawCards(gs, n);
      drawn.forEach((c, i) => {
        // 덱에서 온 카드는 뒷면 상태 → flip 애니메이션을 위해 명시적 유지
        c.isFaceUp          = false;
        c.frontFace.visible = false;
        c.backFace.visible  = true;
        // 일반 드로우와 동일: 140ms 스태거 → sync → 180ms 후 flip
        setTimeout(() => {
          SFX.drawCard();
          ctx.sync();
          setTimeout(() => c.flip(0.3, ctx.sync), 180);
        }, i * 140);
      });
      return drawn;
    },
  };
}

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
