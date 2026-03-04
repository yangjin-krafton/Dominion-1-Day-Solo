// ============================================================
// data/cards.js — 카드 CSV 로더 · 파서 · 유틸리티
//
// ★ 카드 추가 방법
//   1. 같은 세트: dominion_base_ko_cards.csv 에 행 추가
//   2. 새 확장판: CSV 파일 추가 후 loadCards(['...base...', '...expansion...'])
// ============================================================
import { C } from '../config.js';

// ── 타입 정규화 (CSV rawType → 게임 내부 type) ─────────────
const TYPE_NORMALIZE = {
  '재물':     'Treasure',
  '승점':     'Victory',
  '행동':     'Action',
  '행동-공격': 'Action',
  '행동-반응': 'Action',
  '저주':     'Curse',
};

// 타입별 카드 바디 기본색
const TYPE_BASE = {
  Action:   C.action,
  Treasure: C.treasure,
  Victory:  C.victory,
  Curse:    C.curse,
};

// ── CSV 파서 ─────────────────────────────────────────────────
function parseLine(line) {
  const fields = [];
  let field = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"')              inQuote = !inQuote;
    else if (ch === ',' && !inQuote) { fields.push(field); field = ''; }
    else                         field += ch;
  }
  fields.push(field);
  return fields;
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
    return row;
  });
}

// ── hex 문자열 → 정수 색상값 ────────────────────────────────
function parseHex(str) {
  const n = parseInt((str ?? '').replace('#', ''), 16);
  return isNaN(n) ? null : n;
}

// ── 행 → CardDef 변환 ────────────────────────────────────────
function rowToCard(row) {
  const rawType = row.type ?? 'Action';
  const type    = TYPE_NORMALIZE[rawType] ?? 'Action';
  const base    = TYPE_BASE[type] ?? C.action;

  // Treasure 카드의 코인 값 — effectCode의 "coin:N" 토큰에서 추출
  // CSV effect_ko가 "+N원" 형식이라 정규식 매칭 불가 → effectCode가 신뢰 소스
  let coins = 0;
  if (type === 'Treasure') {
    const coinPart = (row.effect_code ?? '')
      .split('|')
      .map(s => s.trim())
      .find(s => s.startsWith('coin:'));
    if (coinPart) coins = parseInt(coinPart.split(':')[1], 10) || 0;
  }

  // CSV 그라디언트 컬러 파싱 (없으면 base 폴백)
  const gradTop = parseHex(row.color_top) ?? base;
  const gradMid = parseHex(row.color_mid) ?? base;
  const gradBot = parseHex(row.color_bot) ?? base;

  return {
    id:         row.id,
    name:       row.name_ko,
    nameEn:     row.name_en,
    set:        row.set,
    type,
    rawType,
    cost:       parseInt(row.cost,   10) || 0,
    points:     parseInt(row.points, 10) || 0,
    coins,
    desc:       row.effect_ko         ?? '',   // 상세 보기 전문
    summary:    row.effect_ko_summary ?? '',   // 카드 앞면 요약
    effectCode: row.effect_code       ?? '',   // effects.js 레지스트리 토큰
    base,
    gradTop,
    gradMid,
    gradBot,
  };
}

// ── 내부 파서 export (Node.js/시뮬레이션 환경에서 재사용 가능) ──
// CardDataLoader.js 가 readFileSync 로 CSV 텍스트를 읽은 뒤 직접 호출
export { parseCSV, rowToCard };

// ── 공개 API ─────────────────────────────────────────────────

/**
 * CSV 파일(들)을 fetch로 로드 → id : CardDef Map 반환
 * @param {string|string[]} urls  단일 URL 또는 URL 배열 (확장판 추가 시)
 * @returns {Promise<Map<string, CardDef>>}
 */
export async function loadCards(urls = './data/dominion_base_ko_cards.csv') {
  const list = Array.isArray(urls) ? urls : [urls];
  const map  = new Map();

  for (const url of list) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`카드 데이터 로드 실패: ${url} (${res.status})`);
    const rows = parseCSV(await res.text());
    rows.forEach(row => { if (row.id) map.set(row.id, rowToCard(row)); });
  }

  return map;
}

/**
 * ID 배열 → CardDef 배열
 * map에 없는 ID는 콘솔 경고 후 skip
 * @param {Map<string, CardDef>} cardMap
 * @param {string[]} ids
 * @returns {CardDef[]}
 */
export function resolveCards(cardMap, ids) {
  return ids.flatMap(id => {
    const def = cardMap.get(id);
    if (!def) { console.warn(`[cards] 등록되지 않은 카드 ID: "${id}"`); return []; }
    return [def];
  });
}

/**
 * 세트 이름으로 카드 필터 (예: 'Base', 'Intrigue')
 * @param {Map<string, CardDef>} cardMap
 * @param {string} setName
 * @returns {CardDef[]}
 */
export function filterBySet(cardMap, setName) {
  return [...cardMap.values()].filter(c => c.set === setName);
}

/**
 * 타입으로 카드 필터 (정규화 type 기준: 'Action' | 'Treasure' | 'Victory' | 'Curse')
 * @param {Map<string, CardDef>} cardMap
 * @param {string} type
 * @returns {CardDef[]}
 */
export function filterByType(cardMap, type) {
  return [...cardMap.values()].filter(c => c.type === type);
}
