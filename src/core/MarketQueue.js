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

/**
 * Mulberry32 seeded PRNG — 같은 시드 → 항상 같은 난수 시퀀스
 * 다른 모듈에서 시드 RNG가 필요할 때 이 함수를 import해 사용.
 */
export function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 이벤트 타입: vanish(재고 카드 차감)만 사용
const TYPE_POOL = ['vanish'];

/**
 * 현재 공급 상태를 보고 다음 이벤트 1개 동적 생성
 * @param {Map<string,{def,count}>} supply
 * @param {function} rng
 * @returns {object} event
 */
// 저주 카드는 시장 이벤트 대상에서 제외 — 대신 'curse_player' 이벤트로 처리
const EXCLUDED_FROM_EVENTS = new Set(['curse']);

export function generateMarketEvent(supply, rng) {
  // 저주를 제외한 재고 있는 카드 목록
  const available = [...supply.entries()].filter(
    ([id, v]) => v.count > 0 && !EXCLUDED_FROM_EVENTS.has(id),
  );

  // 저주 공급이 남아 있으면 낮은 확률로 'curse_player' 이벤트 발생
  const curseCount = supply.get('curse')?.count ?? 0;
  if (curseCount > 0 && rng() < 0.18) {
    return { type: 'curse_player', cardId: 'curse', cardType: '저주', cardName: '저주', count: 1 };
  }

  if (available.length === 0) return { type: 'skip' };

  const type = TYPE_POOL[Math.floor(rng() * TYPE_POOL.length)];

  if (type === 'vanish') {
    // 재고 비례 가중 선택 (저주 제외)
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

  return { type: 'skip' };
}

/**
 * 게임 시작: 시드 기반으로 초기 큐 4개 생성
 * @param {Map} supply
 * @param {number} seed  - 게임 시작 시 고정된 시드
 * @returns {{ queue: object[], rng: function }}
 */
export function initMarketQueue(supply, seed) {
  const rng   = seededRng(seed);
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
 * @param {object} event
 * @param {Map} supply
 */
export function applyMarketEvent(event, supply) {
  if (!event) return;

  if (event.type === 'vanish' && event.cardId) {
    const slot = supply.get(event.cardId);
    if (slot) slot.count = Math.max(0, slot.count - event.count);
  }
  // 'skip' / 'curse_player': 별도 처리 또는 효과 없음
}
