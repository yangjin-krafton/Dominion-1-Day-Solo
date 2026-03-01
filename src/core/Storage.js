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
 * VP 기준 내림차순 랭킹 반환
 * @param {number} limit
 * @returns {{ id, date, vp, turns, durationSec }[]}
 */
export function getRanking(limit = 10) {
  return (_load().records ?? [])
    .sort((a, b) => b.vp - a.vp || a.turns - b.turns)
    .slice(0, limit);
}

/** 오늘 날짜(YYYY-MM-DD) 기록만 반환 */
export function getTodayRecords() {
  const today = new Date().toISOString().split('T')[0];
  return (_load().records ?? []).filter(r => r.date === today);
}

/** 전체 데이터 초기화 (개발/디버그용) */
export function clearAll() {
  localStorage.removeItem(KEY);
}
