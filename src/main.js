// ============================================================
// main.js — PixiJS 앱 · 게임 상태 · 액션 · 부트
// ============================================================
import { SCREEN_W as W, SCREEN_H as H, AREAS, DEF } from './config.js';
import { Card }                                       from './Card.js';
import { buildBackground, buildParticles, buildUI, updateUI } from './scene.js';
import { updateCardPositions }                        from './layout.js';

// ─── PixiJS 앱 초기화 ────────────────────────────────────────
const app = new PIXI.Application({
  width: W, height: H,
  backgroundColor: 0x0d0a18,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: true,
});
document.querySelector('#app').appendChild(app.view);

// ─── 렌더링 레이어 ───────────────────────────────────────────
const lBg    = new PIXI.Container();   // 배경
const lCards = new PIXI.Container();   // 카드 (sortableChildren)
const lFx    = new PIXI.Container();   // 파티클
const lUI    = new PIXI.Container();   // HUD / 버튼
app.stage.addChild(lBg, lCards, lFx, lUI);
lCards.sortableChildren = true;

// ─── 게임 상태 ───────────────────────────────────────────────
let _idSeq = 0;
const gs = {
  turn:    1,
  vp:      3,
  actions: 1,
  buys:    1,
  coins:   0,
  deck:    [],
  hand:    [],
  play:    [],
  discard: [],
  cardsContainer: lCards,
  onEndTurn: null,   // scene.js 버튼에서 호출
};

// ─── 카드 팩토리 ─────────────────────────────────────────────
function makeCard(def) {
  const c = new Card(def, _idSeq++, _playCard);
  lCards.addChild(c.container);
  return c;
}

// ─── 게임 액션 ───────────────────────────────────────────────

/** Fisher-Yates 셔플 */
function _shuffle() {
  const d = gs.deck;
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
}

/** 덱 최상단 카드 1장 드로우 */
function _drawCard() {
  if (gs.deck.length === 0) {
    if (gs.discard.length === 0) return;
    // 버림 더미 → 덱으로 (셔플)
    gs.deck   = [...gs.discard];
    gs.discard = [];
    _shuffle();
    updateCardPositions(gs);
    updateUI(gs);
    setTimeout(_drawCard, 420);
    return;
  }

  const card = gs.deck.pop();
  gs.hand.push(card);
  updateCardPositions(gs);
  updateUI(gs);
  setTimeout(() => card.flip(), 180);  // 드로우 후 뒤집기
}

/** n장 연속 드로우 (140ms 스태거) */
function _drawCards(n) {
  for (let i = 0; i < n; i++) {
    setTimeout(_drawCard, i * 140);
  }
}

/** 손패 카드 클릭 시 호출 */
function _playCard(card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return;

  gs.hand.splice(idx, 1);
  gs.play.push(card);
  card.setHovered(false);

  // 리소스 계산
  if (card.def.type === 'Action') {
    gs.actions = Math.max(0, gs.actions - 1);
  }
  if (card.def.type === 'Treasure') {
    const coinMap = { copper: 1, silver: 2, gold: 3 };
    gs.coins += coinMap[card.def.id] ?? 0;
  }

  updateCardPositions(gs);
  updateUI(gs);
}

/** 턴 종료 */
function _endTurn() {
  // 클린업: 손패 + 플레이 → 버림 더미
  gs.discard.push(...gs.play, ...gs.hand);
  gs.play = [];
  gs.hand = [];

  gs.turn++;
  gs.actions = 1;
  gs.buys    = 1;
  gs.coins   = 0;

  updateCardPositions(gs);
  updateUI(gs);

  setTimeout(() => _drawCards(5), 500);
}

gs.onEndTurn = _endTurn;

// ─── 초기화 ──────────────────────────────────────────────────
function _initGame() {
  // 초기 덱: Copper 7 + Estate 3
  for (let i = 0; i < 7; i++) gs.deck.push(makeCard(DEF.copper));
  for (let i = 0; i < 3; i++) gs.deck.push(makeCard(DEF.estate));

  _shuffle();
  updateCardPositions(gs);
  updateUI(gs);

  // 첫 5장 드로우 (600ms 딜레이 — 씬 빌드 완료 후)
  setTimeout(() => _drawCards(5), 600);
}

// ─── 게임 루프 ───────────────────────────────────────────────
const particles = buildParticles(lFx);
let lastTime    = performance.now();

app.ticker.add(() => {
  const now = performance.now();
  const dt  = Math.min((now - lastTime) / 1000, 0.1);
  lastTime  = now;

  particles.forEach(p => p.update(dt));

  // 전체 카드 업데이트
  [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard]
    .forEach(c => c.update(dt));
});

// ─── 부트 순서 ───────────────────────────────────────────────
buildBackground(lBg);
buildUI(lUI, gs);
_initGame();
