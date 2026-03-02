// ============================================================
// card-effects/militia.js — 민병대: 시장 이벤트 피해 약화 타임라인 연출
//
// pendingGain: { type: 'militia' }   (market_reduce 토큰이 설정)
//
// 처리 흐름:
//   1. gs.marketReduce 를 여기서 즉시 소비 → queue[0] 수량 직접 감소
//      (turn-end 중복 감소 방지 + 타임라인 표시 즉시 반영)
//   2. 수정된 queue 를 revealUnlock 에 전달 → 캡슐 텍스트가 새 수량으로 갱신
//   3. 연출 완료 후 sync()
// ============================================================

export function handleMilitia(_pd, ctx) {
  const { gs, sync } = ctx;
  const timeline = ctx.timeline;
  const queue    = ctx.marketQueueState?.queue ?? [];

  // ── queue[0] 수량 즉시 감소 (timeline 표시 반영 + _onEndTurn 이중감소 방지) ──
  const reduce    = gs.marketReduce ?? 0;
  gs.marketReduce = 0;   // 소비 — _onEndTurn 에서는 0이므로 아무것도 하지 않음

  if (reduce > 0 && queue.length > 0) {
    const t1 = queue[0];
    if (t1.type === 'vanish') {
      t1.count = Math.max(0, (t1.count ?? 0) - reduce);
      if (t1.count === 0) {
        t1.type   = 'skip';   // 완전 무력화 → "변동 없음" 표시
        t1.cardId = null;     // turn-end flash 애니메이션 방지
      }
    } else if (t1.type === 'drain') {
      t1.type   = 'skip';
      t1.cardId = null;
    }
  }

  if (timeline) {
    // 수정된 queue 를 전달 → revealUnlock 내부 refresh(queue) 에서 새 수량 표시
    timeline.revealUnlock(0, queue, () => sync(), '民兵  시장 이벤트 약화');
  } else {
    sync();
  }
}
