// ============================================================
// sim/CardDataLoader.js — Node.js CSV 카드 데이터 로더
//
// src/data/cards.js 의 parseCSV/rowToCard 를 직접 재사용
// → cards.js 의 CardDef 스키마가 바뀌면 자동 동기화
// ============================================================

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// src/data/cards.js 의 파서 재사용 (CardDef 스키마 공유)
import { parseCSV, rowToCard } from '../../src/data/cards.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * CSV 파일에서 카드 데이터 로드 (Node.js readFileSync)
 * @param {string} [csvPath] - CSV 파일 경로 (기본: src/data/dominion_base_ko_cards.csv)
 * @returns {Map<string, CardDef>} id → CardDef
 */
export function loadCardMap(csvPath) {
  const csvFile = csvPath ?? resolve(
    __dirname, '../../src/data/dominion_base_ko_cards.csv'
  );

  const text = readFileSync(csvFile, 'utf-8');
  const rows = parseCSV(text);
  const map  = new Map();

  for (const row of rows) {
    if (row.id) map.set(row.id, rowToCard(row));
  }

  return map;
}

/**
 * 킹덤(Action) 카드 ID 목록
 * @param {Map<string,object>} cardMap
 */
export function getKingdomIds(cardMap) {
  return [...cardMap.values()]
    .filter(d => d.type === 'Action')
    .map(d => d.id);
}

/** 기본 공급 ID (재화 + 승점 + 저주) — src/config.js BASIC_IDS 와 동기화 */
export { BASIC_IDS as BASE_SUPPLY_IDS } from '../../src/config.js';
