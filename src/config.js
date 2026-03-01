// ============================================================
// config.js — 전역 상수 · 팔레트 · 게임 설정
// ============================================================

export const SCREEN_W = 390;
export const SCREEN_H = 844;
// ── 카드 기본 크기 ───────────────────────────────────────────
export const CARD_W = 108;   // 기준 72 × 1.5
export const CARD_H = 162;   // 기준 108 × 1.5

// ── 표시 스케일 (모든 카드 크기를 여기서 일괄 관리) ──────────
/** 덱 · 버림더미 파일 표시 배율 */
export const STACK_SCALE  = 0.84;
/** 갤러리 그리드 표시 배율 */
export const GALLERY_SCALE = 0.77;
/** 상세 보기 카드 물리 너비(px) — 높이는 비율 자동 계산 */
export const DETAIL_W = 281;
export const DETAIL_H = Math.round(CARD_H * DETAIL_W / CARD_W); // ~421px

// Art-Nouveau 팔레트
export const C = {
  bg:       0x0d0a18,
  panel:    0x110d20,
  gold:     0xd4a520,
  goldHi:   0xffe066,
  goldDim:  0x7a5c0a,
  cream:    0xfff3d6,
  dimCream: 0xaa9966,
  shadow:   0x000008,
  dark:     0x07050f,
  // 카드 바디 주얼 톤 (타입별)
  action:   0x1a0a2e,
  treasure: 0x1a1000,
  victory:  0x061a0e,
  curse:    0x220a08,
};

// 카드 타입별 강조색
export const ACCENT = {
  Action:   0x9933cc,
  Treasure: 0xd4a520,
  Victory:  0x228844,
  Curse:    0xcc3311,
};

export const AREAS = {
  DECK:    'deck',
  HAND:    'hand',
  PLAY:    'play',
  DISCARD: 'discard',
};

// ── 게임 설정 ────────────────────────────────────────────────

/**
 * 오늘의 킹덤 카드 10장 ID
 * 추후 날짜 기반 시드로 자동 선택 예정
 * CSV에 있는 id 값을 그대로 사용
 */
export const KINGDOM_IDS = [
  'cellar', 'merchant', 'village', 'workshop',
  'militia', 'smithy', 'council_room', 'festival', 'laboratory', 'market',
];

/**
 * 기본 공급 카드 ID (항상 공급란에 존재)
 */
export const BASIC_IDS = [
  'copper', 'silver', 'gold',
  'estate', 'duchy',  'province', 'curse',
];

/**
 * 플레이어 초기 덱 구성  { cardId: 장수 }
 */
export const START_DECK = {
  copper: 7,
  estate: 3,
};
