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
import { CARD_W } from '../config.js';
import { SFX } from '../asset/audio/sfx.js';

// pending 필드 → type 키 추출 규칙
// pendingGain은 type 필드가 없으므로 'gain'으로 고정
const PENDING_KEYS = [
  { field: 'pendingGain',    typeOf: (pd) => pd.type ?? 'gain' },
  { field: 'pendingDiscard', typeOf: (pd) => pd.type },
  { field: 'pendingTrash',   typeOf: (pd) => pd.type },
  { field: 'pendingPick',    typeOf: (pd) => pd.type },
  { field: 'pendingTwoStep', typeOf: (pd) => pd.type },
];

// ── Merchant 보너스 팝업 ──────────────────────────────────────
/**
 * Silver 플레이 시 Merchant 보너스 발동 → 카드 위에 "+N" 부유 텍스트 표시
 * @param {PIXI.Container} lUI   - UI 레이어 (lCards와 좌표계 공유)
 * @param {Card}           card  - 플레이된 Silver 카드
 * @param {number}         amount - 보너스 코인 수
 */
function _showMerchantBurst(lUI, card, amount) {
  const label = new PIXI.Text(`+${amount}`, {
    fontFamily: 'Georgia, serif',
    fontSize: 17,
    fontWeight: 'bold',
    fill: 0xffe09a,
    stroke: 0x6b3300,
    strokeThickness: 3,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 3,
    dropShadowDistance: 1,
  });
  label.anchor.set(0.5, 1);
  label.x = card.container.x + CARD_W * 0.5;
  label.y = card.container.y;
  lUI.addChild(label);

  const startY    = label.y;
  const endY      = startY - 48;
  const startTime = Date.now();
  const duration  = 900; // ms

  (function animate() {
    const t = Math.min((Date.now() - startTime) / duration, 1);
    label.y     = startY + (endY - startY) * t;
    label.alpha = 1 - t * t;
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      lUI.removeChild(label);
      label.destroy();
    }
  })();
}

export function createCardActionHandler({
  gs, lUI, makeCard, sync, drawCardsVisual, onVictory,
  getTimeline, getMarketQueueState,
}) {

  /** 현재 컨텍스트 객체 (모든 핸들러에 전달) */
  function _ctx() {
    return {
      gs, lUI, makeCard, sync, drawCardsVisual, dispatchPending: _tryDispatch,
      timeline:         getTimeline?.(),
      marketQueueState: getMarketQueueState?.(),
    };
  }

  /** pending 상태를 레지스트리로 디스패치 */
  function _dispatch(type, pd) {
    const handler = EFFECT_HANDLERS.get(type);
    if (handler) {
      handler(pd, _ctx());
    } else {
      console.warn(`[CardActionHandler] 미등록 핸들러: "${type}"`);
      sync();
    }
  }

  /**
   * gs.pending* 필드를 순회하여 첫 번째 pending 효과를 처리
   * @returns {boolean} pending 효과가 발견되어 디스패치됐으면 true
   */
  function _tryDispatch() {
    for (const { field, typeOf } of PENDING_KEYS) {
      if (gs[field]) {
        const pd = gs[field];
        gs[field] = null;
        _dispatch(typeOf(pd), pd);
        return true;
      }
    }
    return false;
  }

  /** 카드 플레이 */
  function onPlayCard(card) {
    // Merchant 트리거 감지: playCard() 전후 merchantBonus 비교
    const merchantBonusBefore = gs.merchantBonus ?? 0;

    const result = playCard(gs, card);
    if (!result.ok) {
      SFX.error();
      if (result.reason === 'no_actions') notifyBlocked('action');
      return;
    }
    SFX.playCard();
    gs.phase = gs.actions > 0 ? 'action' : 'buy';
    sync();

    // Silver 플레이 시 칩 1개가 소모됐으면 "+1" 팝업 표시
    if (merchantBonusBefore > (gs.merchantBonus ?? 0)) {
      _showMerchantBurst(lUI, card, 1);
    }

    // 드로우된 카드 flip 애니메이션
    gs.hand.forEach((c, i) => {
      if (!c.isFaceUp) {
        c.frontFace.visible = false;
        c.backFace.visible  = true;
        setTimeout(() => c.flip(), 150 + i * 70);
      }
    });

    // pending 효과 순차 처리 (첫 번째 발견 즉시 처리 후 return)
    _tryDispatch();
  }

  /** 시장에서 카드 구매 */
  function onBuyCard(def) {
    const result = buyCard(gs, def, makeCard);
    if (!result.ok) {
      SFX.error();
      if (result.reason === 'no_buys')             notifyBlocked('buy');
      else if (result.reason === 'out_of_stock')   notifyBlocked('buy');
      else if (result.reason === 'insufficient_coins') notifyBlocked('coin');
      return;
    }
    SFX.buyCard();
    gs.phase = 'buy';
    sync();

    if (checkVictory(gs.supply) || gs.vp >= gs.vpTarget) onVictory();
  }

  return { onPlayCard, onBuyCard };
}
