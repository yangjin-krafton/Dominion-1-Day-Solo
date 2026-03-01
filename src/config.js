// ============================================================
// config.js — 전역 상수 · 팔레트 · 게임 설정
// ============================================================

export const SCREEN_W = 390;
export const SCREEN_H = 844;

// ── 카드 기본 크기 ─────────────────────────────────────────────
// 시장 4열×3행이 화면(390px) 좌우를 꽉 채우는 크기:
//   4×CW + 3×GAP(6) + 2×MARGIN(6) = 390  →  CW=90, CH=CW×1.5=135
export const CARD_W = 90;
export const CARD_H = 135;

// ── 표시 스케일 ──────────────────────────────────────────────
/** 시장·핸드 카드 = CARD_W×CARD_H 풀사이즈 (1.0) */
export const MARKET_SCALE  = 1.0;
/** 더미 영역(덱·버림·낸카드) 표시 배율  → 63×95px */
export const PILE_SCALE    = 0.70;
/** 갤러리 그리드 표시 배율 */
export const GALLERY_SCALE = 0.77;
/** 상세 보기 카드 물리 너비(px) */
export const DETAIL_W = 300;
export const DETAIL_H = Math.round(CARD_H * DETAIL_W / CARD_W);  // 450px

// ── 레이아웃 존 Y 경계 ───────────────────────────────────────
// ──────────────────────────────────────────────────────────────
//  레이아웃 구조:
//  [상단바] → [시장 4×3] → [더미+턴종료버튼] → (여유공간)
//             → [페이즈라벨] → [스탯바] → [핸드카드] → [하단바]
//  - 턴종료 버튼이 더미 영역 우측에 통합
//  - 스탯바·핸드카드는 화면 최하단에 붙어서 함께 배치
export const ZONE = {
  TOP_H:    60,   // 상단바 높이          →   0– 60
  MARKET_Y: 62,   // 시장 섹션 시작       →  62–505
  STAT_Y:   514,  // 스탯 카운트 바 시작  → 514–572  (2행 레이아웃)
  STAT_H:   58,   // 행1(기본스탯) + 행2(이펙트태그) 2행
  HAND_Y:   578,  // 핸드 카드 (STAT 끝 572 + 6px 여백)  → 578–713
  PILES_Y:  724,  // 더미+턴종료 버튼(최하단)  → 724–844  (HAND 끝 709 + 15px 여백)
  PILES_H:  120,
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
