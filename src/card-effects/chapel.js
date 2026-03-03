// ============================================================
// card-effects/chapel.js — 예배당: 손패 최대 4장 폐기
// pendingTrash: { type: 'chapel', maxCount: 4 }
// ============================================================
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { trashCard }             from './_utils.js';

export function handleChapel({ maxCount = 4 }, { gs, lUI, sync, dispatchPending }) {
  const done = () => { if (!dispatchPending()) sync(); };

  showCardSelectOverlay(lUI, {
    title:      '예배당',
    effectDesc: '폐기된 카드는 덱에서 완전히 사라집니다',
    subtitle:   '폐기할 카드를 선택하세요 (최대 4장, 건너뛰기 가능)',
    items:      [...gs.hand],
    mode:       'multi',
    minCount:   0,
    maxCount,
    confirmLabel: (n) => n === 0 ? '건너뛰기 (0장)' : `${n}장 폐기`,
    onConfirm: (cards) => { cards.forEach((c) => trashCard(gs, c)); done(); },
    onCancel:  done,
  });
}
