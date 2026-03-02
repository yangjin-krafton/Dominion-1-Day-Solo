// ============================================================
// card-effects/remodel.js — 개조: 1장 폐기 → 비용+2 이하 획득
// pendingTwoStep: { type: 'remodel' }
// ============================================================
import { gainCard }            from '../core/TurnEngine.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { trashCard }           from './_utils.js';

export function handleRemodel(_pd, ctx) {
  _step1(ctx);
}

function _step1({ gs, lUI, makeCard, sync }) {
  if (gs.hand.length === 0) { sync(); return; }

  showCardSelectOverlay(lUI, {
    title:      '개조 〔1/2〕',
    effectDesc: '폐기 후 → 그 카드보다 비용이 최대 2원 높은 카드를 얻습니다',
    subtitle:   '폐기할 카드를 선택하세요',
    items:      [...gs.hand],
    mode:       'single',
    allowDetail: true,
    onConfirm: ([card]) => {
      const trashCost = card.def.cost;
      trashCard(gs, card);
      _step2(trashCost, { gs, lUI, makeCard, sync });
    },
    onCancel: sync,
  });
}

function _step2(trashCost, { gs, lUI, makeCard, sync }) {
  const maxCost = trashCost + 2;
  const items = [...gs.supply.values()].filter(({ def, count }) =>
    def.cost <= maxCost && count > 0,
  );
  if (items.length === 0) { sync(); return; }

  showCardSelectOverlay(lUI, {
    title:          '개조 〔2/2〕',
    effectDesc:     `폐기 완료 → 비용 ${maxCost} 이하 카드를 버림더미에 얻습니다`,
    subtitle:       '획득할 카드를 탭해서 선택하세요',
    items,
    mode:           'single',
    showStockBadge:  true,
    allowDetail:    true,
    cancelLabel:    '건너뛰기 (획득 안 함)',
    onConfirm: ([item]) => { gainCard(gs, item.def, makeCard, 'discard'); sync(); },
    onCancel:  sync,
  });
}
