// ============================================================
// card-effects/poacher.js — 밀렵꾼: 빈 더미 수만큼 손패 버리기 (필수)
// pendingDiscard: { type: 'poacher', exact: N }
// ============================================================
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { discardCard }           from './_utils.js';

export function handlePoacher({ exact }, { gs, lUI, sync, dispatchPending }) {
  const done = () => { if (!dispatchPending()) sync(); };

  if (!exact || exact === 0) { done(); return; }

  // 손패 카드가 부족하면 있는 만큼만 버림 (stuck 방지)
  const actual = Math.min(exact, gs.hand.length);
  if (actual === 0) { done(); return; }

  showCardSelectOverlay(lUI, {
    title:      '밀렵꾼',
    effectDesc: `빈 공급처 더미 ${exact}개 — 페널티로 손패 ${actual}장을 버려야 합니다`,
    subtitle:   `버릴 카드 ${actual}장을 선택하세요 (필수)`,
    items:      [...gs.hand],
    mode:       'multi',
    minCount:   actual,
    maxCount:   actual,
    canConfirmEmpty: false,
    confirmLabel: (n) => n < actual ? `${n}/${actual}장 선택됨` : `${actual}장 버리기 (완료)`,
    onConfirm: (cards) => { cards.forEach((c) => discardCard(gs, c)); done(); },
    onCancel:  done,
  });
}
