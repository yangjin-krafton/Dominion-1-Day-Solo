// ============================================================
// card-effects/vassal.js — 신하: 덱 위 카드 flip → 버림이동 → 사용선택
//
// pendingPick: { type: 'vassal' }
//
// 처리 흐름:
//   1. 덱 위 카드를 꺼냄 (덱 비면 먼저 셔플)
//   2. 현재 위치(덱 더미)에서 flip 애니메이션 (~330ms)
//   3. 버림더미 위치로 moveTo 슬라이드 (~380ms)
//   4. 비액션 카드 → sync 종료
//   5. 액션 카드 → CardSelectOverlay "사용 / 버림더미에 남기기" 선택
//   6. 사용 선택: 버림더미 → play 이동 + 효과 실행 (행동 소모 없음)
//   7. 연쇄 pending 효과 있으면 dispatchPending(), 없으면 sync()
// ============================================================
import { AREAS, PILE_SCALE }        from '../config.js';
import { drawCards, shuffle }        from '../core/TurnEngine.js';
import { executeCardEffect }         from '../core/CardEffect.js';
import { showCardSelectOverlay }     from '../ui/CardSelectOverlay.js';
import { PILE_X, PILE_Y }           from '../ui/layout.js';

const FLIP_MS  = 340;  // flip 애니메이션 완료 대기 (duration=0.3s + 여유)
const SLIDE_MS = 400;  // moveTo lerp 안착 대기

export function handleVassal(_pd, ctx) {
  const { gs, lUI, sync } = ctx;

  // ── 덱 위 카드 준비 (빈 덱 → 버림더미 셔플 재생성) ──────
  if (gs.deck.length === 0) {
    if (gs.discard.length === 0) { sync(); return; }
    gs.deck    = [...gs.discard];
    gs.discard = [];
    shuffle(gs.deck);
    gs.deck.forEach(c => { c.area = AREAS.DECK; });
  }
  if (gs.deck.length === 0) { sync(); return; }

  // ── 덱에서 꺼냄 (gs.discard 에는 아직 미포함) ──────────
  const card = gs.deck.pop();
  card.container.zIndex = 200;   // 더미 스택 위로 부상

  // ── ① 뒤집기: 덱 위치에서 앞면 공개 ────────────────────
  card.flip();

  // ── ② flip 완료 후: 버림더미로 슬라이드 ─────────────────
  setTimeout(() => {
    card.area = AREAS.DISCARD;
    gs.discard.push(card);
    card.moveTo(PILE_X[1], PILE_Y, 0, PILE_SCALE);

    // ── ③ 이동 완료 후: 분기 처리 ────────────────────────
    setTimeout(() => {

      // 비액션 카드: 버려진 채로 종료
      if (card.def.type !== 'Action') {
        sync();
        return;
      }

      // 액션 카드: 사용 여부 선택 오버레이
      showCardSelectOverlay(lUI, {
        title:        '신하',
        effectDesc:   `「${card.def.name}」이(가) 공개되었습니다`,
        subtitle:     '행동 소모 없이 사용하거나, 버림더미에 남길 수 있습니다',
        items:        [card],
        mode:         'single',
        maxCardW:     160,
        confirmLabel: '사용하기',
        cancelLabel:  '버림더미에 남기기',
        allowDetail:  true,
        onConfirm: ([picked]) => {
          // 버림더미 → play 영역 이동
          const idx = gs.discard.indexOf(picked);
          if (idx !== -1) {
            gs.discard.splice(idx, 1);
            picked.area = AREAS.PLAY;
            gs.play.push(picked);
          }
          // 효과 실행 (행동 소모 없음 — gs.actions 차감 생략)
          if (picked.def.effectCode) {
            executeCardEffect(picked.def, gs, { drawCards });
          }
          // 연쇄 pending 효과(cellar·mine 등) 처리; 없으면 직접 sync
          if (!ctx.dispatchPending()) sync();
        },
        onCancel: sync,
      });

    }, SLIDE_MS);
  }, FLIP_MS);
}
