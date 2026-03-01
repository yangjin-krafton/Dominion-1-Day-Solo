// ============================================================
// core/GameState.js — 게임 상태 팩토리 & 순수 변이 헬퍼
// PixiJS 의존 없음 — 순수 데이터 계층
// ============================================================
import { AREAS } from '../config.js';

/**
 * 빈 게임 상태 객체 생성
 * main.js에서 생성 후 UI 콜백을 주입
 */
export function createGameState() {
  return {
    // ── 게임 진행 ────────────────────────────────────────────
    turn:    1,
    vp:      3,
    actions: 1,
    buys:    1,
    coins:   0,

    // ── 카드 영역 ────────────────────────────────────────────
    deck:    [],
    hand:    [],
    play:    [],
    discard: [],
    trash:   [],

    // ── 공급 (id → { def, count }) ──────────────────────────
    supply: new Map(),

    // ── UI 연결 콜백 (main.js에서 주입) ─────────────────────
    /** @type {PIXI.Container|null} */
    cardsContainer: null,
    /** 게임 종료 턴 콜백 */
    onEndTurn: null,
  };
}

/** 턴 자원 초기화 */
export function resetResources(gs) {
  gs.actions = 1;
  gs.buys    = 1;
  gs.coins   = 0;
}

/** VP 합산 (덱 전체 기준) */
export function calcVP(gs) {
  const all = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  let vp = 0;
  for (const c of all) {
    if (c.def.type === 'Victory') vp += c.def.points;
    if (c.def.type === 'Curse')   vp += c.def.points; // 음수
    // Gardens: 10장당 1VP
    if (c.def.id === 'gardens')   vp += Math.floor(all.length / 10) - c.def.points;
  }
  return vp;
}

/** 전체 카드 배열 반환 (update loop용) */
export function allCards(gs) {
  return [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
}
