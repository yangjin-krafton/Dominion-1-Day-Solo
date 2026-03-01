// ============================================================
// main.js — PixiJS 앱 · 게임 상태 · 액션 · 부트
// ============================================================
import { SCREEN_W as W, SCREEN_H as H, KINGDOM_IDS, BASIC_IDS } from './config.js';
import { Card }                                from './Card.js';
import { buildBackground, buildParticles, buildUI, updateUI } from './scene.js';
import { updateCardPositions, layoutGallery }  from './layout.js';
import { loadCards, resolveCards }             from './data/cards.js';

// ─── PixiJS 앱 초기화 ────────────────────────────────────────
const app = new PIXI.Application({
  width: W, height: H,
  backgroundColor: 0x0d0a18,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: true,
});
document.querySelector('#app').appendChild(app.view);

// ─── 뷰포트 스케일 (비율 유지, 브라우저 창에 맞춤) ──────────
function fitToViewport() {
  const scale = Math.min(
    window.innerWidth  / W,
    window.innerHeight / H,
  );
  app.view.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitToViewport);
fitToViewport();

// ─── 렌더링 레이어 ───────────────────────────────────────────
const lBg    = new PIXI.Container();   // 배경
const lCards = new PIXI.Container();   // 카드
const lFx    = new PIXI.Container();   // 파티클
const lUI    = new PIXI.Container();   // HUD / 버튼
app.stage.addChild(lBg, lCards, lFx, lUI);
lCards.sortableChildren = true;

// ─── 게임 상태 ───────────────────────────────────────────────
let _idSeq  = 0;
let _cardMap = new Map();   // id → CardDef (loadCards 후 채워짐)

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
  onEndTurn: null,
};

// ─── 카드 팩토리 ─────────────────────────────────────────────
function makeCard(def) {
  const c = new Card(def, _idSeq++, _playCard);
  lCards.addChild(c.container);
  return c;
}

// ─── 게임 액션 ───────────────────────────────────────────────

function _shuffle() {
  const d = gs.deck;
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
}

function _drawCard() {
  if (gs.deck.length === 0) {
    if (gs.discard.length === 0) return;
    gs.deck    = [...gs.discard];
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
  setTimeout(() => card.flip(), 180);
}

function _drawCards(n) {
  for (let i = 0; i < n; i++) setTimeout(_drawCard, i * 140);
}

function _playCard(card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return;

  gs.hand.splice(idx, 1);
  gs.play.push(card);
  card.setHovered(false);

  if (card.def.type === 'Action')   gs.actions = Math.max(0, gs.actions - 1);
  if (card.def.type === 'Treasure') gs.coins  += card.def.coins ?? 0;

  updateCardPositions(gs);
  updateUI(gs);
}

function _endTurn() {
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

// ─── 초기화 (카드맵 로드 후 호출) ───────────────────────────
function _initGame() {
  // CSV의 모든 카드를 1장씩 갤러리 그리드로 표시 (비주얼 테스트)
  [..._cardMap.values()].forEach(def => {
    const c = makeCard(def);
    c.area        = 'gallery';
    c.isFaceUp    = true;
    c.frontFace.visible = true;
    c.backFace.visible  = false;
    gs.play.push(c);
  });

  layoutGallery(gs.play, lCards);
  updateUI(gs);
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

// ─── 부트 (씬 빌드 → CSV 로드 → 게임 시작) ──────────────────
buildBackground(lBg);
buildUI(lUI, gs);

(async () => {
  try {
    // ★ 확장판 추가 시: loadCards(['./data/base.csv', './data/intrigue.csv'])
    _cardMap = await loadCards('./data/dominion_base_ko_cards.csv');

    // 킹덤 / 기본 카드 검증 (없는 ID는 warn)
    resolveCards(_cardMap, [...KINGDOM_IDS, ...BASIC_IDS]);

    _initGame();
  } catch (err) {
    console.error('[main] 카드 데이터 로드 실패:', err);
    // TODO: 로드 실패 UI
  }
})();
