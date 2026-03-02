// ============================================================
// card-effects/moneylender.js — 대금업자: 동전 1장 폐기 → 코인 +3
// pendingTrash: { type: 'moneylender', filter: 'copper', maxCount: 1 }
// ============================================================
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { trashCard }             from './_utils.js';

export function handleMoneylender(_pd, { gs, lUI, sync }) {
  showCardSelectOverlay(lUI, {
    title:      '대금업자',
    effectDesc: '동전 카드를 폐기하면 이번 턴 코인 +3을 받습니다',
    subtitle:   '손패에서 동전 카드만 표시됩니다 (선택사항)',
    items:      [...gs.hand],
    mode:       'multi',
    maxCount:   1,
    minCount:   0,
    filter:     (c) => c.def.id === 'copper',
    confirmLabel: (n) => n === 0 ? '건너뛰기' : '동전 1장 폐기하고 코인 +3',
    onConfirm: (cards) => {
      cards.forEach((c) => trashCard(gs, c));
      if (cards.length > 0) gs.coins += 3;
      sync();
    },
    onCancel: sync,
  });
}
