// ============================================================
// config.js — 전역 상수 · 팔레트 · 게임 설정
// ============================================================

export const SCREEN_W = 390;
export const SCREEN_H = 844;

// ── 카드 기본 크기 (Art-Nouveau 설계 기준 72px, F=1.0) ───────
// * 108→72 축소: 화면에 4열×5행 시장 + 핸드 영역 확보
export const CARD_W = 72;
export const CARD_H = 108;

// ── 표시 스케일 ──────────────────────────────────────────────
/** 시장 그리드 카드 표시 배율  → 63×95px (4열×3행 기준) */
export const MARKET_SCALE  = 0.88;
/** 더미 영역(덱·버림·낸카드·추방) 표시 배율  → 36×54px */
export const PILE_SCALE    = 0.50;
/** 갤러리 그리드 표시 배율 */
export const GALLERY_SCALE = 0.77;
/** 상세 보기 카드 물리 너비(px) */
export const DETAIL_W = 240;
export const DETAIL_H = Math.round(CARD_H * DETAIL_W / CARD_W);  // 360px

// ── 레이아웃 존 Y 경계 ───────────────────────────────────────
// 시장 4열×3행 기준 레이아웃
// MARKET_SCALE=0.88 → 카드 63×95px, 3행: 3×95+2×5=295px, 섹션: 62~392
export const ZONE = {
  TOP_H:    60,   // 상단바 높이          →   0– 60
  MARKET_Y: 62,   // 시장 섹션 시작       →  62–392
  STAT_Y:   394,  // 스탯 카운트 바 시작  → 394–434
  STAT_H:   40,
  PILES_Y:  436,  // 더미 영역 시작       → 436–536
  PILES_H:  100,
  HAND_Y:   538,  // 핸드 카드 시작       → 538–646
  BTN_Y:    652,  // 턴 종료 버튼 시작    → 652–694
  PHASE_Y:  698,  // 페이즈 라벨          → 698–720
  BOTTOM_Y: 792,  // 하단 상태바          → 792–844
};

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
  TRASH:   'trash',
  SUPPLY:  'supply',
};

// ── 게임 설정 ────────────────────────────────────────────────
export const KINGDOM_IDS = [
  'cellar', 'merchant', 'village', 'workshop',
  'militia', 'smithy', 'council_room', 'festival', 'laboratory', 'market',
];

export const BASIC_IDS = [
  'copper', 'silver', 'gold',
  'estate', 'duchy',  'province', 'curse',
];

export const START_DECK = {
  copper: 7,
  estate: 3,
};
