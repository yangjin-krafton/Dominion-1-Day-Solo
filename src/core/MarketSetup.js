// ============================================================
// core/MarketSetup.js — 게임 시작 시 랜덤 시장 구성 생성
//
// 규칙:
//  · 시장 슬롯 = 12장 고정
//  · basic (재화·승점, 저주 제외): 4~6장 랜덤
//  · kingdom (액션): 나머지 슬롯, 비용 다양성 확보
//  · 저주는 시장에 표시하지 않음 (공급에는 별도 추가)
// ============================================================
import { BASIC_POOL, KINGDOM_POOL } from '../config.js';

const MARKET_SIZE = 12;

/**
 * 랜덤 시장 구성 생성
 * @param {Map<string, import('../data/cards.js').CardDef>} cardMap
 * @returns {{ marketIds: string[], kingdomIds: string[] }}
 *   marketIds  : 시장 12슬롯 순서 (basic → kingdom)
 *   kingdomIds : 선택된 킹덤 카드 ID만 (기록·홈 표시용)
 */
export function buildMarketSetup(cardMap) {
  // ── 1. 기본 재화·승점: 4~6장 랜덤 ─────────────────────────
  const basicCount = 4 + Math.floor(Math.random() * 3);  // 4 | 5 | 6
  const basicIds   = _shuffle([...BASIC_POOL]).slice(0, basicCount);

  // ── 2. 킹덤 카드: 나머지 슬롯, 비용 다양성 확보 ────────────
  const kingdomCount = MARKET_SIZE - basicCount;          // 6 | 7 | 8
  const pool         = KINGDOM_POOL.filter(id => cardMap.has(id));
  const kingdomIds   = _selectDiverse(cardMap, pool, kingdomCount);

  return { marketIds: [...basicIds, ...kingdomIds], kingdomIds };
}

// ── 내부 유틸 ─────────────────────────────────────────────────

/**
 * 비용 다양성을 고려한 킹덤 카드 선택
 * Pass 1: 비용 tier(2/3/4/5/6)별로 최소 1장씩 고름
 * Pass 2: 남은 자리 랜덤 채우기
 */
function _selectDiverse(cardMap, pool, count) {
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
    const candidates = _shuffle(byCost.get(tier).filter(id => !used.has(id)));
    if (candidates.length > 0) {
      result.push(candidates[0]);
      used.add(candidates[0]);
    }
  }

  // Pass 2: 부족한 자리 나머지 풀에서 랜덤 채우기
  const remaining = _shuffle(pool.filter(id => !used.has(id)));
  while (result.length < count && remaining.length > 0) {
    result.push(remaining.pop());
  }

  return result;
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
