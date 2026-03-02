// ============================================================
// card-effects/throne_room.js — 알현실: 손패 액션 1장을 2번 플레이
// pendingPick: { type: 'throne_room', source: 'hand' }
//
// ※ 단순 토큰(draw/action/buy/coin)만 2회 실행 지원
//   복잡 체인(chapel, cellar 등) 이중 발동은 추후 구현
// ============================================================
import { drawCards }           from '../core/TurnEngine.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';

export function handleThroneRoom(_pd, { gs, lUI, sync }) {
  const actionCards = gs.hand.filter((c) => c.def.type === 'Action');
  if (actionCards.length === 0) { sync(); return; }

  showCardSelectOverlay(lUI, {
    title:      '알현실',
    effectDesc: '선택한 액션 카드의 효과를 이번 턴에 2번 발동합니다',
    subtitle:   '두 번 사용할 액션 카드를 선택하세요',
    items:      actionCards,
    mode:       'single',
    allowDetail: true,
    onConfirm: ([card]) => {
      // 단순 토큰 재실행 (draw/action/buy/coin)
      const tokens = (card.def.effectCode ?? '').split('|').map((s) => s.trim());
      for (const token of tokens) {
        const [key, val] = token.split(':');
        const n = val ? parseInt(val, 10) : 1;
        if (key === 'draw')   drawCards(gs, n);
        if (key === 'action') gs.actions += n;
        if (key === 'buy')    gs.buys    += n;
        if (key === 'coin')   gs.coins   += n;
      }
      sync();
    },
    onCancel: sync,
  });
}
