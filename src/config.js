// ============================================================
// config.js — 전역 상수 · 팔레트 · 카드 정의
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
  // Card body jewel tones
  action:   0x1a0a2e,
  treasure: 0x1a1000,
  victory:  0x061a0e,
};

// 카드 타입별 강조색
export const ACCENT = {
  Action:   0x9933cc,
  Treasure: 0xd4a520,
  Victory:  0x228844,
};

export const AREAS = {
  DECK:    'deck',
  HAND:    'hand',
  PLAY:    'play',
  DISCARD: 'discard',
};

// 카드 정의 헬퍼
const d = (id, name, cost, type, desc, base) => ({ id, name, cost, type, desc, base });

export const DEF = {
  copper:   d('copper',   'Copper',      0, 'Treasure', '$1',                             C.treasure),
  silver:   d('silver',   'Silver',      3, 'Treasure', '$2',                             C.treasure),
  gold:     d('gold',     'Gold',        6, 'Treasure', '$3',                             C.treasure),
  estate:   d('estate',   'Estate',      2, 'Victory',  '1 VP',                           C.victory),
  duchy:    d('duchy',    'Duchy',       5, 'Victory',  '3 VP',                           C.victory),
  province: d('province', 'Province',    8, 'Victory',  '6 VP',                           C.victory),
  smithy:   d('smithy',   'Smithy',      4, 'Action',   '+3 Cards',                       C.action),
  village:  d('village',  'Village',     3, 'Action',   '+1 Card\n+2 Actions',            C.action),
  market:   d('market',   'Market',      5, 'Action',   '+1 Card\n+1 Action\n+1 Buy\n+$1',C.action),
  festival: d('festival', 'Festival',    5, 'Action',   '+2 Actions\n+1 Buy\n+$2',        C.action),
  lab:      d('lab',      'Laboratory',  5, 'Action',   '+2 Cards\n+1 Action',            C.action),
  witch:    d('witch',    'Witch',       5, 'Action',   '+2 Cards\n\nEach other player\ngains a Curse.', C.action),
};

// 오늘의 킹덤 10장 (추후 날짜 시드 기반으로 교체)
export const KINGDOM = [
  DEF.smithy, DEF.village, DEF.market, DEF.festival,
  DEF.lab,    DEF.witch,
];

export const BASIC_SUPPLY = [
  DEF.copper, DEF.silver, DEF.gold,
  DEF.estate, DEF.duchy,  DEF.province,
];
