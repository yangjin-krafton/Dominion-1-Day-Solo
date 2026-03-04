// ============================================================
// core/MarketSetup.js — 게임 시작 시 랜덤 시장 구성 생성
//
// 규칙:
//  · 시장 슬롯 = 12장 고정
//  · basic (재화·승점, 저주 제외): 4~6장 랜덤
//  · kingdom (액션): 나머지 슬롯, 비용 다양성 확보
//  · 저주는 시장에 표시하지 않음 (공급에는 별도 추가)
//  · rng 파라미터로 seededRng를 받으면 완전 재현 가능
// ============================================================
import { KINGDOM_POOL } from '../config.js';

const MARKET_SIZE = 12;

// 승점 카드 3종은 항상 시장에 포함 (목표 승점 도달 보장)
const VP_BASICS       = ['estate', 'duchy', 'province'];
const TREASURE_BASICS = ['copper', 'silver', 'gold'];

/**
 * 랜덤 시장 구성 생성
 * @param {Map<string, import('../data/cards.js').CardDef>} cardMap
 * @param {function|null} rng   seededRng(seed) 결과물 또는 null (null이면 Math.random 사용)
 * @param {number}        wins  유저 총 승리 횟수 (언락 필터링용, 기본 0)
 * @returns {{ marketIds: string[], kingdomIds: string[] }}
 *   marketIds  : 시장 12슬롯 순서 (basic → kingdom)
 *   kingdomIds : 선택된 킹덤 카드 ID만 (기록·홈 표시용)
 */
export function buildMarketSetup(cardMap, rng = null, wins = 0) {
  const _r = rng ?? (() => Math.random());

  // ── 1. 기본 재화·승점 ─────────────────────────────────────
  // 승점 3종(estate·duchy·province)은 항상 포함 → 목표 승점 도달 보장
  // 나머지 슬롯(1~3)은 재화(copper·silver·gold) 랜덤 선택
  const basicCount    = 4 + Math.floor(_r() * 3);           // 4 | 5 | 6
  const treasureCount = basicCount - VP_BASICS.length;       // 1 | 2 | 3
  const treasureIds   = _shuffle([...TREASURE_BASICS], _r).slice(0, treasureCount);
  const basicIds      = [...VP_BASICS, ...treasureIds];

  // ── 2. 킹덤 카드: 언락된 카드만, 나머지 슬롯, 비용 다양성 확보 ─
  const kingdomCount = MARKET_SIZE - basicCount;          // 6 | 7 | 8
  const pool = KINGDOM_POOL.filter(id => {
    const def = cardMap.get(id);
    if (!def) return false;
    return def.unlockOrder === 0 || wins >= def.unlockOrder;
  });
  const kingdomIds   = _selectDiverse(cardMap, pool, kingdomCount, _r);

  // ── 3. 정렬: 재물 → 승점 → 행동, 같은 타입 내 비용 오름차순 ─
  const TYPE_ORDER = { Treasure: 0, Victory: 1, Action: 2, Curse: 3 };
  const marketIds = [...basicIds, ...kingdomIds].sort((a, b) => {
    const da = cardMap.get(a), db = cardMap.get(b);
    const ta = TYPE_ORDER[da.type] ?? 9;
    const tb = TYPE_ORDER[db.type] ?? 9;
    return ta !== tb ? ta - tb : da.cost - db.cost;
  });

  return { marketIds, kingdomIds };
}

// ── 내부 유틸 ─────────────────────────────────────────────────

/**
 * 비용 다양성을 고려한 킹덤 카드 선택
 * Pass 1: 비용 tier(2/3/4/5/6)별로 최소 1장씩 고름
 * Pass 2: 남은 자리 랜덤 채우기
 */
function _selectDiverse(cardMap, pool, count, rng) {
  // 비용별 그룹화
  const byCost = new Map();
  for (const id of pool) {
    const cost = cardMap.get(id).cost;
    if (!byCost.has(cost)) byCost.set(cost, []);
    byCost.get(cost).push(id);
  }

  const result = [];
  const used   = new Set();

  // Pass 1: 각 비용 tier에서 1장씩 (저렴→비싼 순)
  const tiers = [...byCost.keys()].sort((a, b) => a - b);
  for (const tier of tiers) {
    if (result.length >= count) break;
    const candidates = _shuffle(byCost.get(tier).filter(id => !used.has(id)), rng);
    if (candidates.length > 0) {
      result.push(candidates[0]);
      used.add(candidates[0]);
    }
  }

  // Pass 2: 부족한 자리 나머지 풀에서 랜덤 채우기
  const remaining = _shuffle(pool.filter(id => !used.has(id)), rng);
  while (result.length < count && remaining.length > 0) {
    result.push(remaining.pop());
  }

  return result;
}

/** Fisher-Yates 셔플 (새 배열 반환, rng 주입 가능) */
function _shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
