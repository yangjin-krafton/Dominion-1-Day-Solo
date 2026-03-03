// ============================================================
// ui/CardMotion.js — 카드 드로우 · 재셔플 모션
//
// 사용:
//   const { drawCardsVisual } = createCardMotion({ gs, sync })
// ============================================================

import { drawCard } from '../core/TurnEngine.js';
import { PILE_X, PILE_Y } from './layout.js';
import { SFX } from '../asset/audio/sfx.js';

/**
 * 카드 드로우 · 재셔플 모션 컨트롤러 생성
 * @param {{ gs: object, sync: function }} ctx
 * @returns {{ drawCardsVisual: function(n: number): void }}
 */
export function createCardMotion({ gs, sync }) {
  let _reshuffling = false;

  /** 버림더미 카드 전체를 뒷면으로 뒤집고 덱 위치로 이동 */
  function _reshuffleAnim(onDone) {
    for (const card of gs.discard) {
      card.isFaceUp          = false;
      card.frontFace.visible = false;
      card.backFace.visible  = true;
    }
    gs.discard.forEach((card, i) => {
      setTimeout(() => {
        const jitter = (Math.random() - 0.5) * 0.14;
        card.moveTo(PILE_X[0], PILE_Y, jitter, card.container.scale.y);
      }, i * 18);
    });
    // lerp 수렴 대기 후 콜백
    setTimeout(onDone, 380);
  }

  /** 카드 1장 실제 드로우 + flip 모션 */
  function _doSingleDraw() {
    const card = drawCard(gs);
    if (!card) return;
    SFX.drawCard();
    // 버림→덱 재활용 카드: 앞면 상태일 경우 뒷면 강제 리셋
    if (card.isFaceUp) {
      card.isFaceUp          = false;
      card.frontFace.visible = false;
      card.backFace.visible  = true;
    }
    sync();
    setTimeout(() => card.flip(0.3, sync), 180);
  }

  /** 카드 1장 드로우 (덱 소진 시 재셔플 모션 포함) */
  function _drawCardVisual() {
    if (_reshuffling) {
      setTimeout(_drawCardVisual, 80);
      return;
    }
    if (gs.deck.length === 0 && gs.discard.length > 0) {
      _reshuffling = true;
      _reshuffleAnim(() => {
        _reshuffling = false;
        _doSingleDraw();
      });
    } else {
      _doSingleDraw();
    }
  }

  /** 카드 n장 순차 드로우 (스태거 딜레이 140ms) */
  function drawCardsVisual(n) {
    for (let i = 0; i < n; i++) setTimeout(_drawCardVisual, i * 140);
  }

  return { drawCardsVisual };
}
