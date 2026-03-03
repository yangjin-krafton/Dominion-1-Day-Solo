// ============================================================
// card-effects/throne_room.js — 알현실: 손패 액션 1장을 2번 플레이
//
// 흐름:
//   1. 손패 액션 카드 선택 오버레이
//   2. 선택된 카드: Hand → Play 이동 (행동 소모 없음)
//   3. executeCardEffect 로 1차 효과 실행 (EFFECT_REGISTRY 경유)
//   4. gs.pendingThrone = { card } 로 2차 플레이 예약
//      (PENDING_KEYS 마지막에 배치 → 1차에서 생긴 pending 모두 처리 후 실행)
//   5. handleThroneRoomSecond: 2차 효과 실행 → dispatchPending or sync
//
// ※ Throne Room on Throne Room 은 pendingThrone 슬롯이 하나뿐이므로
//   2차 TR 의 카드 선택이 1차 pendingThrone 을 덮어씁니다 (알려진 한계).
// ============================================================
import { AREAS }                 from '../config.js';
import { drawCards }             from '../core/TurnEngine.js';
import { executeCardEffect }     from '../core/CardEffect.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';

export function handleThroneRoom(_pd, ctx) {
  const { gs, lUI, sync } = ctx;
  const actionCards = gs.hand.filter((c) => c.def.type === 'Action');
  if (actionCards.length === 0) { sync(); return; }

  showCardSelectOverlay(lUI, {
    title:      '알현실',
    effectDesc: '선택한 액션 카드의 효과를 이번 턴에 2번 발동합니다',
    subtitle:   '두 번 사용할 액션 카드를 선택하세요',
    items:      actionCards,
    mode:       'single',
    allowDetail: true,
    onConfirm: ([card]) => {
      // ① Hand → Play 이동 (행동 소모 없음)
      const idx = gs.hand.indexOf(card);
      if (idx !== -1) {
        gs.hand.splice(idx, 1);
        card.area = AREAS.PLAY;
        gs.play.push(card);
      }

      // ② 1차 효과 실행 (EFFECT_REGISTRY 경유 — 단순/복합 모두 지원)
      if (card.def.effectCode) {
        executeCardEffect(card.def, gs, { drawCards });
      }

      // ③ 2차 플레이 예약
      //    pendingThrone は PENDING_KEYS 마지막 → 1차 pending 이 모두 소화된 뒤 자동 실행
      gs.pendingThrone = { card };

      // ④ 1차 pending 처리 시작 (없으면 pendingThrone 직행)
      ctx.dispatchPending();
    },
    onCancel: sync,
  });
}

// ── 2차 플레이 핸들러 ──────────────────────────────────────────
// PENDING_KEYS의 'throne_room_second' 타입으로 디스패치됨
export function handleThroneRoomSecond({ card }, ctx) {
  const { gs, sync, dispatchPending } = ctx;

  // 2차 효과 실행
  if (card.def.effectCode) {
    executeCardEffect(card.def, gs, { drawCards });
  }

  // 2차 실행에서 생긴 pending 처리 (없으면 sync)
  if (!dispatchPending()) sync();
}
