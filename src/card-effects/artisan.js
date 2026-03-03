// ============================================================
// card-effects/artisan.js — 장인: supply ≤5 획득→손 + 손패 1장 덱위
// pendingTwoStep: { type: 'artisan' }
// ============================================================
import { gainCard }            from '../core/TurnEngine.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { putOnDeckTop }        from './_utils.js';

export function handleArtisan(_pd, ctx) {
  _step1(ctx);
}

function _step1(ctx) {
  const { gs, lUI, makeCard, sync, dispatchPending } = ctx;
  const done = () => { if (!dispatchPending()) sync(); };
  const items = [...gs.supply.values()].filter(({ def, count }) =>
    def.cost <= 5 && count > 0,
  );
  if (items.length === 0) { done(); return; }

  showCardSelectOverlay(lUI, {
    title:          '장인 〔1/2〕',
    effectDesc:     '선택한 카드를 공짜로 손에 넣습니다 (비용 5 이하)',
    subtitle:       '손에 가져올 카드를 탭해서 선택하세요',
    items,
    mode:           'single',
    showStockBadge:  true,
    allowDetail:    true,
    onConfirm: ([item]) => {
      gainCard(gs, item.def, makeCard, 'hand');
      _step2(ctx);
    },
    onCancel: done,
  });
}

function _step2(ctx) {
  const { gs, lUI, sync, dispatchPending } = ctx;
  const done = () => { if (!dispatchPending()) sync(); };

  if (gs.hand.length === 0) { done(); return; }

  showCardSelectOverlay(lUI, {
    title:      '장인 〔2/2〕',
    effectDesc: '선택한 카드가 덱 맨 위로 — 다음 턴에 바로 사용 가능합니다',
    subtitle:   '덱 위에 올릴 카드를 손패에서 선택하세요',
    items:      [...gs.hand],
    mode:       'single',
    allowDetail: true,
    onConfirm: ([card]) => { putOnDeckTop(gs, card); done(); },
    onCancel:  done,
  });
}
