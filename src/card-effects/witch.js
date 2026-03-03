// ============================================================
// card-effects/witch.js — 마녀: 시장 저주 발동 타임라인 연출
//
// pendingGain: { type: 'witch' }   (witch_market_blank 토큰이 설정)
//
// 처리 흐름:
//   1. gs.witchActive = true, gs.witchCountdown = 3 (effects.js에서 설정됨)
//   2. queue[1] (T+2 → 다음 턴) 을 즉시 마녀 저주 skip 으로 교체
//      → 타임라인에 즉각 보라색 '마녀 저주' 슬롯 표시
//   3. revealUnlock 연출 (새 큐 상태 반영)
//   4. 이후 매 턴 종료 시 main.js _onEndTurn 에서 카운트다운 감소
//      → 0이 되면 T+4 이벤트를 마녀 저주 skip 으로 강제 삽입 (3 리셋)
// ============================================================

export function handleWitch(_pd, ctx) {
  const { sync, dispatchPending } = ctx;
  const done     = () => { if (!dispatchPending()) sync(); };
  const timeline = ctx.timeline;
  const queue    = ctx.marketQueueState?.queue ?? [];

  // 다음 턴(T+2 = queue[1])에 마녀 저주 skip 즉시 삽입
  // → 타임라인 연출이 새 큐 상태(보라색 저주 슬롯)를 바로 반영
  if (queue.length > 1) {
    queue[1] = { type: 'skip', witchCurse: true };
  }

  if (timeline) {
    timeline.revealUnlock(0, queue, done, '마녀  시장 저주 발동 (이번 턴 + 3턴마다 빈 턴)');
  } else {
    done();
  }
}
