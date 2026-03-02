// ============================================================
// core/MarketQueue.js — 시장 변동 이벤트 롤링 큐
//
// 구조:
//   게임 시작: initMarketQueue(supply, seed) → 큐 4개 생성
//   턴 종료 :
//     1. popMarketEvent(state)          → T+1 꺼내기
//     2. applyMarketEvent(event, supply) → 공급에 적용
//     3. pushNextMarketEvent(state, supply) → T+4 추가 (적용 후 상태 기반)
// ============================================================

/** Mulberry32 seeded PRNG — 같은 시드 → 같은 시퀀스 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 이벤트 타입 가중치 (vanish 3 : drain 1 : surge 1)
const TYPE_POOL = ['vanish', 'vanish', 'vanish', 'drain', 'surge'];

/**
 * 현재 공급 상태를 보고 다음 이벤트 1개 동적 생성
 * @param {Map<string,{def,count}>} supply
 * @param {function} rng
 * @returns {object} event
 */
export function generateMarketEvent(supply, rng) {
  const available = [...supply.entries()].filter(([, v]) => v.count > 0);
  if (available.length === 0) return { type: 'skip' };

  const type = TYPE_POOL[Math.floor(rng() * TYPE_POOL.length)];

  if (type === 'vanish') {
    // 재고 비례 가중 선택 (재고 많은 카드일수록 선택 확률 높음)
    const total = available.reduce((s, [, v]) => s + v.count, 0);
    let r = rng() * total;
    let target = available[available.length - 1];
    for (const entry of available) {
      r -= entry[1].count;
      if (r <= 0) { target = entry; break; }
    }
    const [id, { def, count }] = target;
    const n = rng() < 0.4 ? 2 : 1;
    return {
      type:     'vanish',
      cardId:   id,
      cardType: def.type,
      cardName: def.name_ko ?? def.name ?? id,
      count:    Math.min(n, count),
    };
  }

  if (type === 'drain') {
    // 가장 재고 합계 많은 타입 그룹에서 1장 제거
    const typeSum = {};
    for (const [, v] of available) {
      typeSum[v.def.type] = (typeSum[v.def.type] ?? 0) + v.count;
    }
    const topType = Object.entries(typeSum).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '행동';
    return { type: 'drain', cardType: topType, cardId: null, count: 1 };
  }

  if (type === 'surge') {
    const idx = Math.floor(rng() * available.length);
    const [id, { def }] = available[idx];
    return {
      type:     'surge',
      cardId:   id,
      cardType: def.type,
      cardName: def.name_ko ?? def.name ?? id,
      count:    0,
    };
  }

  return { type: 'skip' };
}

/**
 * 게임 시작: 시드 기반으로 초기 큐 4개 생성
 * @param {Map} supply
 * @param {number} seed  - 게임 시작 시 고정된 시드
 * @returns {{ queue: object[], rng: function }}
 */
export function initMarketQueue(supply, seed) {
  const rng   = mulberry32(seed);
  const queue = [];
  for (let i = 0; i < 4; i++) queue.push(generateMarketEvent(supply, rng));
  return { queue, rng };
}

/**
 * 턴 종료 Step1: 큐 앞에서 T+1 이벤트 꺼내기
 * @returns {object} executed event
 */
export function popMarketEvent(queueState) {
  return queueState.queue.shift();
}

/**
 * 턴 종료 Step3: 공급 적용 후 상태 기반으로 새 T+4 이벤트 생성 후 큐에 추가
 * @param {Map} supply  - applyMarketEvent 호출 이후 상태
 * @returns {object} newEvent
 */
export function pushNextMarketEvent(queueState, supply) {
  const newEvent = generateMarketEvent(supply, queueState.rng);
  queueState.queue.push(newEvent);
  return newEvent;
}

/**
 * 이벤트를 공급(supply)에 실제 적용
 * drain 이벤트는 event.resolvedCardId에 실제 영향 카드 ID를 기록함
 * @param {object} event
 * @param {Map} supply
 */
export function applyMarketEvent(event, supply) {
  if (!event) return;

  if (event.type === 'vanish' && event.cardId) {
    const slot = supply.get(event.cardId);
    if (slot) slot.count = Math.max(0, slot.count - event.count);
  }

  if (event.type === 'drain') {
    // 해당 타입에서 재고 가장 많은 카드 1장 제거
    let best = null;
    for (const [id, v] of supply) {
      if (v.def.type === event.cardType && v.count > 0) {
        if (!best || v.count > best[1].count) best = [id, v];
      }
    }
    if (best) {
      best[1].count = Math.max(0, best[1].count - 1);
      event.resolvedCardId = best[0];   // 실제 제거된 카드 ID 기록
    }
  }

  // 'surge': 비용 변동은 별도 시스템 (현재는 예고 표시만)
  // 'skip' : 아무 효과 없음
}
