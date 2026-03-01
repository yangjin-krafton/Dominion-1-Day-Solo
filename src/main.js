// ============================================================
// main.js — 부트 · PixiJS 앱 · 비주얼 브리지
// 게임 로직: core/TurnEngine.js
// 카드 데이터: data/cards.js + data/effects.js
// 비주얼: ui/*.js
// ============================================================
import { SCREEN_W as W, SCREEN_H as H, KINGDOM_IDS, BASIC_IDS } from './config.js';
import { Card }                                  from './ui/Card.js';
import { buildBackground, buildParticles, buildUI, updateUI } from './ui/scene.js';
import { updateCardPositions, layoutGallery }    from './ui/layout.js';
import * as CardDetail                           from './ui/CardDetail.js';
import { loadCards, resolveCards }               from './data/cards.js';
import { drawCard, playCard, endTurn, shuffle } from './core/TurnEngine.js';

// ─── PixiJS 앱 ───────────────────────────────────────────────
const app = new PIXI.Application({
  width: W, height: H,
  backgroundColor: 0x0d0a18,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: true,
});
document.querySelector('#app').appendChild(app.view);

// ─── 뷰포트 스케일 (비율 유지) ──────────────────────────────
function fitToViewport() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  app.view.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitToViewport);
fitToViewport();

// ─── 렌더링 레이어 ───────────────────────────────────────────
const lBg    = new PIXI.Container();
const lCards = new PIXI.Container();
const lFx    = new PIXI.Container();
const lUI    = new PIXI.Container();
app.stage.addChild(lBg, lCards, lFx, lUI);
lCards.sortableChildren = true;

// ─── 게임 상태 ───────────────────────────────────────────────
let _idSeq   = 0;
let _cardMap = new Map();

const gs = {
  turn: 1, vp: 3, actions: 1, buys: 1, coins: 0,
  deck: [], hand: [], play: [], discard: [],
  cardsContainer: lCards,
  onEndTurn: null,
};

// ─── 카드 팩토리 (ui Card + gs 연결) ─────────────────────────
export function makeCard(def) {
  const c = new Card(def, _idSeq++, _onPlayCard);
  lCards.addChild(c.container);
  return c;
}

// ─── 비주얼 브리지 함수 ──────────────────────────────────────
// TurnEngine의 순수 로직 호출 후 시각 갱신

function _sync() {
  updateCardPositions(gs);
  updateUI(gs);
}

/** 1장 드로우 + 뒤집기 애니메이션 */
function _drawCardVisual() {
  const card = drawCard(gs);
  if (!card) return;
  _sync();
  setTimeout(() => card.flip(), 180);
}

/** n장 연속 드로우 (140ms 스태거) */
function _drawCardsVisual(n) {
  for (let i = 0; i < n; i++) setTimeout(_drawCardVisual, i * 140);
}

/** 손패 카드 클릭 콜백 */
function _onPlayCard(card) {
  const result = playCard(gs, card);
  if (!result.ok) return;
  card.setHovered(false);
  _sync();
  // TurnEngine이 Action 효과로 drawCards를 호출했을 경우
  // 드로우된 카드를 뒤집어야 함 → 추후 이벤트 시스템으로 연결
}

/** 턴 종료 */
function _endTurnVisual() {
  endTurn(gs);
  _sync();
  setTimeout(() => _drawCardsVisual(5), 500);
}

gs.onEndTurn = _endTurnVisual;

// ─── 초기화 ──────────────────────────────────────────────────

/** 갤러리 모드: CSV 전체 카드 비주얼 테스트 */
function _initGallery() {
  [..._cardMap.values()].forEach(def => {
    const c = makeCard(def);
    c.area = 'gallery';
    c.isFaceUp = true;
    c.frontFace.visible = true;
    c.backFace.visible  = false;
    gs.play.push(c);
  });
  layoutGallery(gs.play, lCards);
  updateUI(gs);
}

/** 게임 모드: 초기 덱 생성 후 5장 드로우 */
export function initGame(startDeckConfig = { copper: 7, estate: 3 }) {
  gs.deck = []; gs.hand = []; gs.play = []; gs.discard = [];
  for (const [id, count] of Object.entries(startDeckConfig)) {
    const def = _cardMap.get(id);
    if (!def) { console.warn(`initGame: 카드 없음 "${id}"`); continue; }
    for (let i = 0; i < count; i++) gs.deck.push(makeCard(def));
  }
  shuffle(gs.deck);
  _sync();
  setTimeout(() => _drawCardsVisual(5), 600);
}

// ─── 게임 루프 ───────────────────────────────────────────────
const particles = buildParticles(lFx);
let lastTime    = performance.now();

app.ticker.add(() => {
  const now = performance.now();
  const dt  = Math.min((now - lastTime) / 1000, 0.1);
  lastTime  = now;

  particles.forEach(p => p.update(dt));
  [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard].forEach(c => c.update(dt));
});

// ─── 부트 ────────────────────────────────────────────────────
buildBackground(lBg);
buildUI(lUI, gs);
CardDetail.init(lUI);

(async () => {
  try {
    _cardMap = await loadCards('./data/dominion_base_ko_cards.csv');
    resolveCards(_cardMap, [...KINGDOM_IDS, ...BASIC_IDS]);
    _initGallery();          // ← 비주얼 테스트: 전체 카드 갤러리
    // initGame();            // ← 실제 게임 시작 시 이 줄로 교체
  } catch (err) {
    console.error('[main] 카드 데이터 로드 실패:', err);
  }
})();
