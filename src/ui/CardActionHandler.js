// ============================================================
// ui/CardActionHandler.js — 카드 플레이 · 구매 · 획득 · 버리기 핸들러
//
// 사용:
//   const { onPlayCard, onBuyCard } = createCardActionHandler({
//     gs, lUI, makeCard, sync, drawCardsVisual, onVictory,
//   })
// ============================================================

import { playCard, buyCard, gainCard, checkVictory } from '../core/TurnEngine.js';
import { notifyBlocked }          from './scene.js';
import { showGainCardOverlay }    from './GainCardOverlay.js';
import { showDiscardSelectOverlay } from './DiscardSelectOverlay.js';

/**
 * 카드 액션 핸들러 생성
 * @param {{
 *   gs: object,
 *   lUI: PIXI.Container,
 *   makeCard: function,
 *   sync: function,
 *   drawCardsVisual: function,
 *   onVictory: function,
 * }} ctx
 * @returns {{ onPlayCard: function, onBuyCard: function }}
 */
export function createCardActionHandler({ gs, lUI, makeCard, sync, drawCardsVisual, onVictory }) {

  /** 카드 획득 오버레이 표시 — workshop 등 gainCard 효과 공용 진입점 */
  function _handleGainCard(maxCost, dest) {
    let _ov = null;
    const close = () => { _ov?.close(); _ov = null; sync(); };

    _ov = showGainCardOverlay(
      lUI,
      gs.supply,
      maxCost,
      (def) => { gainCard(gs, def, makeCard, dest); close(); },
      close,
    );
  }

  /** 핸드에서 선택한 카드들을 버리고 같은 수만큼 드로우 */
  function _handleDiscardSelect(pd) {
    let _ov = null;
    const close = () => { _ov?.close(); _ov = null; sync(); };

    _ov = showDiscardSelectOverlay(
      lUI,
      [...gs.hand],   // 현재 손패 스냅샷 (원본 참조 유지)
      (selectedCards) => {
        for (const card of selectedCards) {
          const idx = gs.hand.indexOf(card);
          if (idx !== -1) {
            gs.hand.splice(idx, 1);
            card.area              = 'discard';
            card.isFaceUp          = true;
            card.frontFace.visible = true;
            card.backFace.visible  = false;
            gs.discard.push(card);
          }
        }
        const drawN = selectedCards.length;
        close();
        if (pd.drawAfter && drawN > 0) drawCardsVisual(drawN);
      },
      close,
    );
  }

  /** 카드 플레이 — Card 클래스에서 tap 시 호출 */
  function onPlayCard(card) {
    const result = playCard(gs, card);
    if (!result.ok) {
      if (result.reason === 'no_actions') notifyBlocked('action');
      return;
    }
    gs.phase = gs.actions > 0 ? 'action' : 'buy';
    sync();

    // 액션 효과로 드로우된 카드: 뒷면 상태로 핸드에 있으면 flip
    gs.hand.forEach((c, i) => {
      if (!c.isFaceUp) {
        c.isFaceUp          = false;
        c.frontFace.visible = false;
        c.backFace.visible  = true;
        setTimeout(() => c.flip(), 150 + i * 70);
      }
    });

    // 카드 획득 대기 효과 처리 (workshop 등)
    if (gs.pendingGain) {
      const { maxCost, dest = 'discard' } = gs.pendingGain;
      gs.pendingGain = null;
      _handleGainCard(maxCost, dest);
    }

    // 핸드 선택 버리기 효과 처리 (cellar 등)
    if (gs.pendingDiscard) {
      const pd = gs.pendingDiscard;
      gs.pendingDiscard = null;
      _handleDiscardSelect(pd);
    }
  }

  /** 시장에서 카드 구매 — Market 클래스에서 tap 시 호출 */
  function onBuyCard(def) {
    const result = buyCard(gs, def, makeCard);
    if (!result.ok) {
      if (result.reason === 'no_buys')             notifyBlocked('buy');
      else if (result.reason === 'out_of_stock')   notifyBlocked('buy');
      else if (result.reason === 'insufficient_coins') notifyBlocked('coin');
      return;
    }
    gs.phase = 'buy';
    sync();

    if (checkVictory(gs.supply) || gs.vp >= gs.vpTarget) onVictory();
  }

  return { onPlayCard, onBuyCard };
}
