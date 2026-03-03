// ============================================================
// card-effects/mine.js — 광산: 보물 폐기 → 비용+3 보물 획득(손으로)
// pendingTwoStep: { type: 'mine' }
// ============================================================
import { gainCard }            from '../core/TurnEngine.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { trashCard }           from './_utils.js';

export function handleMine(_pd, ctx) {
  _step1(ctx);
}

function _step1(ctx) {
  const { gs, lUI, sync, dispatchPending } = ctx;
  const done = () => { if (!dispatchPending()) sync(); };
  const treasures = gs.hand.filter((c) => c.def.type === 'Treasure');
  if (treasures.length === 0) { done(); return; }

  showCardSelectOverlay(lUI, {
    title:      '광산 〔1/2〕',
    effectDesc: '폐기 후 → 더 비싼 보물 카드를 바로 손에 넣습니다 (비용 +3까지)',
    subtitle:   '폐기할 보물 카드를 선택하세요 (건너뛰기 가능)',
    items:      treasures,
    mode:       'single',
    allowDetail: true,
    cancelLabel: '건너뛰기',
    onConfirm: ([card]) => {
      const trashCost = card.def.cost;
      trashCard(gs, card);
      _step2(trashCost, ctx);
    },
    onCancel: done,
  });
}

function _step2(trashCost, ctx) {
  const { gs, lUI, makeCard, sync, dispatchPending } = ctx;
  const done = () => { if (!dispatchPending()) sync(); };
  const maxCost = trashCost + 3;
  const items = [...gs.supply.values()].filter(({ def, count }) =>
    def.type === 'Treasure' && def.cost <= maxCost && count > 0,
  );
  if (items.length === 0) { done(); return; }

  showCardSelectOverlay(lUI, {
    title:          '광산 〔2/2〕',
    effectDesc:     `폐기 완료 → 비용 ${maxCost} 이하 보물 카드가 바로 손에 들어옵니다`,
    subtitle:       '손에 넣을 보물 카드를 탭해서 선택하세요',
    items,
    mode:           'single',
    showStockBadge:  true,
    allowDetail:    true,
    onConfirm: ([item]) => { gainCard(gs, item.def, makeCard, 'hand'); done(); },
    onCancel:  done,
  });
}
