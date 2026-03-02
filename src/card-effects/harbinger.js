// ============================================================
// card-effects/harbinger.js — 선구자: 버림더미 1장 → 덱 위
// pendingPick: { type: 'harbinger', source: 'discard' }
// ============================================================
import { AREAS }               from '../config.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';

export function handleHarbinger(_pd, { gs, lUI, sync }) {
  if (gs.discard.length === 0) { sync(); return; }

  showCardSelectOverlay(lUI, {
    title:      '선구자',
    effectDesc: '선택한 카드가 덱 맨 위로 → 다음 턴에 바로 손에 들어옵니다',
    subtitle:   '버림더미에서 덱 위에 올릴 카드를 선택하세요 (건너뛰기 가능)',
    items:      [...gs.discard],
    mode:       'single',
    allowDetail: true,
    cancelLabel: '건너뛰기 (아무것도 안 함)',
    onConfirm: ([card]) => {
      const idx = gs.discard.indexOf(card);
      if (idx !== -1) {
        gs.discard.splice(idx, 1);
        card.area = AREAS.DECK;
        gs.deck.push(card);
      }
      sync();
    },
    onCancel: sync,
  });
}
