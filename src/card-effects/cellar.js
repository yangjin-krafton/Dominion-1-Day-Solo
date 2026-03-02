// ============================================================
// card-effects/cellar.js — 저장고: 손패 선택 버리기 → 같은 수 드로우
// pendingDiscard: { type: 'cellar', drawAfter: true }
// ============================================================
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { discardCard }           from './_utils.js';

export function handleCellar(pd, { gs, lUI, sync, drawCardsVisual }) {
  showCardSelectOverlay(lUI, {
    title:      '저장고',
    effectDesc: '버린 카드 수만큼 덱에서 새 카드를 뽑습니다',
    subtitle:   '버릴 카드를 선택하세요 (0장 이상, 건너뛰기 가능)',
    items:      [...gs.hand],
    mode:       'multi',
    minCount:   0,
    confirmLabel: (n) => n === 0 ? '건너뛰기 (0장)' : `${n}장 버리고 ${n}장 뽑기`,
    onConfirm: (cards) => {
      cards.forEach((c) => discardCard(gs, c));
      const drawN = cards.length;
      sync();
      if (pd.drawAfter && drawN > 0) drawCardsVisual(drawN);
    },
    onCancel: sync,
  });
}
