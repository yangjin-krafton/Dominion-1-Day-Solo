// ============================================================
// card-effects/gain.js — 카드 획득 (workshop, artisan 등 공용)
// pendingGain: { type: 'gain', maxCost, dest }
// ============================================================
import { gainCard }            from '../core/TurnEngine.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';

export function handleGain({ maxCost, dest = 'discard' }, { gs, lUI, makeCard, sync }) {
  const items = [...gs.supply.values()].filter(({ def, count }) =>
    def.cost <= maxCost && count > 0,
  );

  showCardSelectOverlay(lUI, {
    title:          '카드 획득',
    effectDesc:     `비용 ${maxCost} 이하 카드 1장을 공짜로 얻습니다`,
    subtitle:       '획득할 카드를 탭해서 선택하세요',
    items,
    mode:           'single',
    showStockBadge:  true,
    allowDetail:    true,
    cancelLabel:    '건너뛰기 (아무것도 획득 안 함)',
    onConfirm: ([item]) => { gainCard(gs, item.def, makeCard, dest); sync(); },
    onCancel:  sync,
  });
}
