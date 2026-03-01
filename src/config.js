// ============================================================
// config.js — 전역 상수 · 팔레트 · 게임 설정
// ============================================================

export const SCREEN_W = 390;
export const SCREEN_H = 844;
export const CARD_W   = 72;
export const CARD_H   = 108;

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
