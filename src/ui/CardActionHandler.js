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
import { CARD_W, AREAS }   from '../config.js';
import { SFX }             from '../asset/audio/sfx.js';

// pending 필드 → type 키 추출 규칙
// pendingGain은 type 필드가 없으므로 'gain'으로 고정
const PENDING_KEYS = [
  { field: 'pendingGain',    typeOf: (pd) => pd.type ?? 'gain' },
  { field: 'pendingDiscard', typeOf: (pd) => pd.type },
  { field: 'pendingTrash',   typeOf: (pd) => pd.type },
  { field: 'pendingPick',    typeOf: (pd) => pd.type },
  { field: 'pendingTwoStep', typeOf: (pd) => pd.type },
  // 알현실 2차 플레이 — 반드시 마지막: 다른 모든 pending 처리 후 실행
  { field: 'pendingThrone',  typeOf: () => 'throne_room_second' },
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
    // 드로우 전 손패 크기 기록 (playCard 내부에서 drawCards 로 추가된 카드 추적)
    const nHandBefore = gs.hand.length;

    const result = playCard(gs, card);
    if (!result.ok) {
      SFX.error();
      if (result.reason === 'no_actions') notifyBlocked('action');
      return;
    }
    SFX.playCardVariant(card.def);
    gs.phase = gs.actions > 0 ? 'action' : 'buy';

    // Silver 플레이 시 칩 1개가 소모됐으면 "+1" 팝업 표시
    if (merchantBonusBefore > (gs.merchantBonus ?? 0)) {
      _showMerchantBurst(lUI, card, 1);
    }

    // 새로 드로우된 카드 추출
    // playCard() 내부에서 플레이한 카드(1장)가 먼저 손패에서 제거된 후 드로우되므로
    // 드로우 카드의 시작 인덱스는 nHandBefore - 1
    const drawn = gs.hand.splice(nHandBefore - 1);

    if (drawn.length === 0) {
      // 드로우 없음: 즉시 sync + pending 처리
      sync();
      _tryDispatch();
      return;
    }

    // 드로우된 카드를 임시로 덱 area 로 설정 → sync() 레이아웃에서 제외
    drawn.forEach(c => { c.area = AREAS.DECK; });
    sync(); // 낸 카드 / 스탯 등 나머지 UI 업데이트

    // 한 장씩 손패로 투입 — 일반 드로우와 동일한 140ms 스태거 + flip 모션
    drawn.forEach((c, i) => {
      setTimeout(() => {
        c.area = AREAS.HAND;
        gs.hand.push(c);
        // 뒷면 강제 → flip 애니메이션 준비
        c.isFaceUp          = false;
        c.frontFace.visible = false;
        c.backFace.visible  = true;
        SFX.drawCard();
        sync(); // 덱 위치 → 손패 위치로 lerp 시작
        setTimeout(() => c.flip(0.3, sync), 180);

        // 마지막 카드 이후 pending 처리
        if (i === drawn.length - 1) {
          setTimeout(_tryDispatch, 10);
        }
      }, i * 140);
    });
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
    SFX.buyCardVariant(def);
    gs.phase = 'buy';
    sync();

    if (checkVictory(gs.supply) || gs.vp >= gs.vpTarget) onVictory();
  }

  return { onPlayCard, onBuyCard };
}
