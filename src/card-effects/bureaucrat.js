// ============================================================
// card-effects/bureaucrat.js — 관료: 은화 덱 위 획득 + 시장 정보 공개
//
// pendingGain: { type: 'bureaucrat' }
//
// 처리 흐름:
//   1. 공급에 silver가 있으면 1장 꺼내 덱 맨 위에 배치 (face-down)
//   2. gs.marketRevealBonus > 0 이면 ctx.timeline.revealUnlock() 파티클 연출
//   3. 연출 완료 후 sync()
// ============================================================
import { AREAS } from '../config.js';

export function handleBureaucrat(_pd, ctx) {
  const { gs, makeCard, sync } = ctx;

  // ── Silver 덱 위 획득 ───────────────────────────────────
  const silverSlot = gs.supply.get('silver');
  if (silverSlot && silverSlot.count > 0) {
    silverSlot.count--;
    const card = makeCard(silverSlot.def);
    // 덱에는 뒷면으로 들어감
    card.isFaceUp          = false;
    card.frontFace.visible = false;
    card.backFace.visible  = true;
    card.area              = AREAS.DECK;
    gs.deck.push(card);    // push = 맨 위 (drawCard 는 pop으로 꺼냄)
  }

  // ── 시장 공개 연출 ──────────────────────────────────────
  const bonus           = gs.marketRevealBonus ?? 0;
  gs.marketRevealBonus  = 0;   // 보너스 소비 (timeline에 직접 반영됨)

  const timeline = ctx.timeline;
  const queue    = ctx.marketQueueState?.queue ?? [];

  if (bonus > 0 && timeline) {
    timeline.revealUnlock(bonus, queue, () => sync());
  } else {
    sync();
  }
}
