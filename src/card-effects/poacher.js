// ============================================================
// card-effects/poacher.js — 밀렵꾼: 빈 더미 수만큼 손패 버리기 (필수)
// pendingDiscard: { type: 'poacher', exact: N }
// ============================================================
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { discardCard }           from './_utils.js';

export function handlePoacher({ exact }, { gs, lUI, sync }) {
  if (!exact || exact === 0) { sync(); return; }

  showCardSelectOverlay(lUI, {
    title:      '밀렵꾼',
    effectDesc: `빈 공급처 더미 ${exact}개 — 페널티로 손패 ${exact}장을 버려야 합니다`,
    subtitle:   `버릴 카드 ${exact}장을 선택하세요 (필수)`,
    items:      [...gs.hand],
    mode:       'multi',
    minCount:   exact,
    maxCount:   exact,
    canConfirmEmpty: false,
    confirmLabel: (n) => n < exact ? `${n}/${exact}장 선택됨` : `${exact}장 버리기 (완료)`,
    onConfirm: (cards) => { cards.forEach((c) => discardCard(gs, c)); sync(); },
    onCancel:  sync,
  });
}
