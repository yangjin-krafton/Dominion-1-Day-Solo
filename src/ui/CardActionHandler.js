// ============================================================
// ui/CardActionHandler.js — 카드 플레이·구매 오케스트레이터
//
// 역할: 카드 플레이 후 gs.pending* 감지 → 레지스트리로 위임
// 카드별 효과 로직은 src/card-effects/*.js 에 분리
//
// 사용:
//   const { onPlayCard, onBuyCard } = createCardActionHandler({
//     gs, lUI, makeCard, sync, drawCardsVisual, onVictory,
//   })
// ============================================================

import { playCard, buyCard, checkVictory } from '../core/TurnEngine.js';
import { notifyBlocked }   from './scene.js';
import { EFFECT_HANDLERS } from '../card-effects/index.js';

// pending 필드 → type 키 추출 규칙
// pendingGain은 type 필드가 없으므로 'gain'으로 고정
const PENDING_KEYS = [
  { field: 'pendingGain',    typeOf: (pd) => pd.type ?? 'gain' },
  { field: 'pendingDiscard', typeOf: (pd) => pd.type },
  { field: 'pendingTrash',   typeOf: (pd) => pd.type },
  { field: 'pendingPick',    typeOf: (pd) => pd.type },
  { field: 'pendingTwoStep', typeOf: (pd) => pd.type },
];

export function createCardActionHandler({ gs, lUI, makeCard, sync, drawCardsVisual, onVictory }) {

  /** pending 상태를 레지스트리로 디스패치 */
  function _dispatch(type, pd) {
    const handler = EFFECT_HANDLERS.get(type);
    if (handler) {
      handler(pd, { gs, lUI, makeCard, sync, drawCardsVisual });
    } else {
      console.warn(`[CardActionHandler] 미등록 핸들러: "${type}"`);
      sync();
    }
  }

  /** 카드 플레이 */
  function onPlayCard(card) {
    const result = playCard(gs, card);
    if (!result.ok) {
      if (result.reason === 'no_actions') notifyBlocked('action');
      return;
    }
    gs.phase = gs.actions > 0 ? 'action' : 'buy';
    sync();

    // 드로우된 카드 flip 애니메이션
    gs.hand.forEach((c, i) => {
      if (!c.isFaceUp) {
        c.frontFace.visible = false;
        c.backFace.visible  = true;
        setTimeout(() => c.flip(), 150 + i * 70);
      }
    });

    // pending 효과 순차 처리 (첫 번째 발견 즉시 처리 후 return)
    for (const { field, typeOf } of PENDING_KEYS) {
      if (gs[field]) {
        const pd = gs[field];
        gs[field] = null;
        _dispatch(typeOf(pd), pd);
        return;
      }
    }
  }

  /** 시장에서 카드 구매 */
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
