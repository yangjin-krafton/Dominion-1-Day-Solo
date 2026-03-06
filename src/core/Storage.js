// ============================================================
// core/Storage.js — localStorage 기반 영구 데이터 관리
// 키: 'dominion1d_v1'
// 스키마:
//   profile: { name, createdAt, totalGames }
//   records: [{ id, date, turns, vp, durationSec, kingdom }]
// ============================================================

const KEY = 'dominion1d_v1';

function _load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function _save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// ─── 프로필 ──────────────────────────────────────────────────

/** 저장된 프로필 반환, 없으면 null */
export function getProfile() {
  return _load().profile ?? null;
}

/** 프로필 저장 */
export function saveProfile(profile) {
  const d = _load();
  d.profile = { ...profile, totalGames: 0 };
  _save(d);
}

/** 프로필 총 게임 수 +1 */
export function incrementGames() {
  const d = _load();
  if (d.profile) d.profile.totalGames = (d.profile.totalGames ?? 0) + 1;
  _save(d);
}

// ─── 도감 언락 ────────────────────────────────────────────────

/**
 * 총 승리 횟수 반환 (= 현재 언락된 최대 unlock_order)
 * unlock_order 0 카드는 항상 언락, 1~N은 wins >= N 이면 언락
 */
export function getWins() {
  return _load().wins ?? 0;
}

/** 승리 시 호출 — wins++ 저장 */
export function addWin() {
  const d = _load();
  d.wins = (d.wins ?? 0) + 1;
  _save(d);
  return d.wins;
}

// ─── 게임 기록 ────────────────────────────────────────────────

/** 전체 게임 기록 반환 (최신순) */
export function getRecords() {
  const records = _load().records ?? [];
  return [...records].sort((a, b) => b.id - a.id);  // 최신순
}

/**
 * 새 게임 기록 추가
 * @param {{ turns, vp, durationSec, kingdom: string[] }} record
 */
export function addRecord(record) {
  const d = _load();
  const full = {
    ...record,
    id:   Date.now(),
    date: new Date().toISOString().split('T')[0],
  };
  d.records = [...(d.records ?? []), full];
  // 최대 200개 유지
  if (d.records.length > 200) d.records = d.records.slice(-200);
  if (d.profile) d.profile.totalGames = (d.profile.totalGames ?? 0) + 1;
  _save(d);
  return full;
}

/**
 * 통합 점수 계산: 턴 효율 + 시간 효율
 *   턴 점수 : max(0, 30 - turns) × 10   →  0~290
 *   시간 점수: max(0, 300 - durationSec) →  0~300
 *   합산 점수 = 턴 점수 + 시간 점수 (높을수록 좋음, 동점 허용)
 */
export function calcScore(record) {
  const turnScore = Math.max(0, 30 - (record.turns ?? 30)) * 10;
  const timeScore = Math.max(0, 300 - (record.durationSec ?? 300));
  return turnScore + timeScore;
}

/**
 * 통합 점수 기준 내림차순 랭킹 반환
 * @param {number} limit
 */
export function getRanking(limit = 10) {
  return (_load().records ?? [])
    .map(r => ({ ...r, score: calcScore(r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 특정 킹덤 세팅의 Top N 랭킹 반환
 * @param {string[]} kingdomIds  현재 게임의 킹덤 카드 ID 목록
 * @param {number}   limit
 */
export function getSetupRanking(kingdomIds, limit = 5) {
  const key = [...kingdomIds].sort().join(',');
  return (_load().records ?? [])
    .filter(r => r.kingdom?.length && [...r.kingdom].sort().join(',') === key)
    .map(r => ({ ...r, score: calcScore(r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 오늘 날짜(YYYY-MM-DD) 기록만 반환 */
export function getTodayRecords() {
  const today = new Date().toISOString().split('T')[0];
  return (_load().records ?? []).filter(r => r.date === today);
}

/** 전체 데이터 초기화 (프로필 + 기록 + 승리수) */
export function clearAll() {
  localStorage.removeItem(KEY);
}

/** 게임 기록 + 승리수만 초기화 (프로필 이름 유지) */
export function clearRecords() {
  const d = _load();
  delete d.records;
  delete d.wins;
  _save(d);
}

/** 프로필만 초기화 (기록 유지) */
export function clearProfile() {
  const d = _load();
  delete d.profile;
  _save(d);
}
