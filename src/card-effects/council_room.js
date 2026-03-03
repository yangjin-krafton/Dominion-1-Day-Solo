// ============================================================
// card-effects/council_room.js — 회의실: 시장 이벤트 소멸 수량 증가 연출
//
// pendingGain: { type: 'council_room' }   (market_increase 토큰이 설정)
//
// 처리 흐름:
//   1. gs.marketIncrease 를 소비 → queue[0] 의 vanish count 직접 증가
//   2. 수정된 queue 를 revealUnlock 에 전달 → 캡슐 텍스트 즉시 갱신
//   3. 연출 완료 후 sync()
// ============================================================

export function handleCouncilRoom(_pd, ctx) {
  const { gs, sync, dispatchPending } = ctx;
  const done     = () => { if (!dispatchPending()) sync(); };
  const timeline = ctx.timeline;
  const queue    = ctx.marketQueueState?.queue ?? [];

  // ── queue[0] 소멸 수량 즉시 증가 ─────────────────────────────
  const increase    = gs.marketIncrease ?? 0;
  gs.marketIncrease = 0;  // 소비 — _onEndTurn 에서 이중 적용 방지

  if (increase > 0 && queue.length > 0) {
    const t1 = queue[0];
    if (t1.type === 'vanish') {
      t1.count = (t1.count ?? 0) + increase;
    }
    // 'skip' / 'drain' 타입은 건드리지 않음 (소멸할 이벤트가 없는 상태)
  }

  if (timeline) {
    timeline.revealUnlock(0, queue, done, '회의실  시장 이벤트 강화');
  } else {
    done();
  }
}
