// ============================================================
// main.js — 부트 · PixiJS 앱 · 게임 흐름 연결
//  흐름: PROFILE_SETUP → HOME ↔ GAME → RESULT → HOME|GAME
// ============================================================

// ── config & core ──────────────────────────────────────────
import { SCREEN_W as W, SCREEN_H as H, KINGDOM_IDS, BASIC_IDS } from './config.js';
import { GameFlow, STATES }                from './core/GameFlow.js';
import * as Storage                        from './core/Storage.js';
import { drawCard, playCard, endTurn,
         shuffle, checkVictory, initSupply } from './core/TurnEngine.js';

// ── ui ─────────────────────────────────────────────────────
import { Card }                                   from './ui/Card.js';
import { buildBackground, buildParticles,
         buildUI, updateUI }                      from './ui/scene.js';
import { updateCardPositions }                     from './ui/layout.js';
import * as CardDetail                            from './ui/CardDetail.js';
import { ProfileScreen }                          from './ui/screens/ProfileScreen.js';
import { HomeScreen }                             from './ui/screens/HomeScreen.js';
import { ResultScreen }                           from './ui/screens/ResultScreen.js';

// ── data ───────────────────────────────────────────────────
import { loadCards, resolveCards } from './data/cards.js';

// ============================================================
// PixiJS 앱
// ============================================================
const app = new PIXI.Application({
  width: W, height: H, backgroundColor: 0x0d0a18,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true, antialias: true,
});
document.querySelector('#app').appendChild(app.view);

function fitToViewport() {
  app.view.style.transform =
    `scale(${Math.min(window.innerWidth / W, window.innerHeight / H)})`;
}
window.addEventListener('resize', fitToViewport);
fitToViewport();

// ── 레이어 ──────────────────────────────────────────────────
const lBg = new PIXI.Container(), lCards = new PIXI.Container();
const lFx = new PIXI.Container(), lUI    = new PIXI.Container();
app.stage.addChild(lBg, lCards, lFx, lUI);
lCards.sortableChildren = true;

// ============================================================
// 게임 상태
// ============================================================
let _cardMap      = new Map();
let _idSeq        = 0;
let _gameStart    = 0;     // 게임 시작 타임스탬프

const gs = {
  turn: 1, vp: 3, actions: 1, buys: 1, coins: 0,
  deck: [], hand: [], play: [], discard: [],
  supply: new Map(),
  cardsContainer: lCards,
  onEndTurn: null,
};

export function makeCard(def) {
  const c = new Card(def, _idSeq++, _onPlayCard);
  lCards.addChild(c.container);
  return c;
}

// ============================================================
// 비주얼 브리지 — TurnEngine 호출 후 화면 갱신
// ============================================================
function _sync() {
  updateCardPositions(gs);
  updateUI(gs);
}

function _drawCardVisual() {
  const card = drawCard(gs);
  if (!card) return;
  _sync();
  setTimeout(() => card.flip(), 180);
}

function _drawCardsVisual(n) {
  for (let i = 0; i < n; i++) setTimeout(_drawCardVisual, i * 140);
}

function _onPlayCard(card) {
  const result = playCard(gs, card);
  if (!result.ok) return;
  card.setHovered(false);
  _sync();
}

function _onEndTurn() {
  endTurn(gs);
  _sync();

  if (checkVictory(gs.supply)) {
    _finishGame();
    return;
  }
  setTimeout(() => _drawCardsVisual(5), 500);
}

gs.onEndTurn = _onEndTurn;

// ============================================================
// 화면 상태 머신
// ============================================================
const flow     = new GameFlow();
const profScr  = new ProfileScreen();
const homeScr  = new HomeScreen();
const resultScr = new ResultScreen();

flow
  .on(STATES.PROFILE_SETUP, () => {
    profScr.onSubmit = profile => {
      Storage.saveProfile(profile);
      flow.go(STATES.HOME);
    };
    profScr.show();
  })

  .on(STATES.HOME, () => {
    const profile  = Storage.getProfile();
    const records  = Storage.getRecords();
    const kingdomNames = KINGDOM_IDS.map(id =>
      _cardMap.get(id)?.name ?? id
    );
    homeScr.onStart = () => flow.go(STATES.GAME);
    homeScr.show({ profile, records, kingdomIds: KINGDOM_IDS, kingdomNames });
  })

  .on(STATES.GAME, () => {
    _startGame();
  })

  .on(STATES.RESULT, ({ record, ranking }) => {
    resultScr.onNextGame = () => flow.go(STATES.GAME);
    resultScr.onHome     = () => flow.go(STATES.HOME);
    resultScr.show({ record, ranking });
  });

// ============================================================
// 게임 시작 / 종료
// ============================================================
export function _startGame() {
  // 기존 카드 제거
  lCards.removeChildren();
  gs.deck = []; gs.hand = []; gs.play = []; gs.discard = [];
  _idSeq  = 0;
  gs.turn = 1; gs.vp = 3; gs.actions = 1; gs.buys = 1; gs.coins = 0;

  // 공급 초기화
  gs.supply = initSupply(_cardMap, BASIC_IDS, KINGDOM_IDS);

  // 초기 덱 생성 (Copper 7 + Estate 3)
  for (let i = 0; i < 7; i++) gs.deck.push(makeCard(_cardMap.get('copper')));
  for (let i = 0; i < 3; i++) gs.deck.push(makeCard(_cardMap.get('estate')));
  shuffle(gs.deck);

  _gameStart = Date.now();
  _sync();
  setTimeout(() => _drawCardsVisual(5), 600);
}

function _finishGame() {
  const durationSec = Math.round((Date.now() - _gameStart) / 1000);
  const allCards    = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  const totalVP     = allCards.reduce((s, c) => s + (c.def.points ?? 0), 0);

  const record  = Storage.addRecord({
    turns: gs.turn, vp: totalVP, durationSec,
    kingdom: KINGDOM_IDS,
  });
  const ranking = Storage.getRanking();
  flow.go(STATES.RESULT, { record, ranking });
}

// ============================================================
// 게임 루프
// ============================================================
const particles = buildParticles(lFx);
let lastTime    = performance.now();

app.ticker.add(() => {
  const now = performance.now();
  const dt  = Math.min((now - lastTime) / 1000, 0.1);
  lastTime  = now;
  particles.forEach(p => p.update(dt));
  [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard].forEach(c => c.update(dt));
});

// ============================================================
// 부트
// ============================================================
buildBackground(lBg);
buildUI(lUI, gs);
CardDetail.init(lUI);

(async () => {
  try {
    _cardMap = await loadCards('./data/dominion_base_ko_cards.csv');
    resolveCards(_cardMap, [...KINGDOM_IDS, ...BASIC_IDS]);

    // 최초 진입 상태 결정
    const profile = Storage.getProfile();
    flow.go(profile ? STATES.HOME : STATES.PROFILE_SETUP);

  } catch (err) {
    console.error('[main] 초기화 실패:', err);
  }
})();
