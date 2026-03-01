// ============================================================
// main.js — 부트 · PixiJS 앱 · 게임 흐름 연결
//  흐름: PROFILE_SETUP → HOME ↔ GAME → RESULT → HOME|GAME
// ============================================================

// ── config & core ──────────────────────────────────────────
import { SCREEN_W as W, SCREEN_H as H, KINGDOM_IDS, BASIC_IDS } from './config.js';
import { GameFlow, STATES }                from './core/GameFlow.js';
import * as Storage                        from './core/Storage.js';
import { drawCard, playCard, endTurn,
         shuffle, checkVictory, initSupply,
         buyCard }                         from './core/TurnEngine.js';

// ── ui ─────────────────────────────────────────────────────
import { Card }                                from './ui/Card.js';
import { buildBackground, buildParticles,
         buildUI, updateUI, applyProfile }     from './ui/scene.js';
import { updateCardPositions,
         buildHandArrows }                     from './ui/layout.js';
import * as CardDetail                         from './ui/CardDetail.js';
import { Market }                              from './ui/Market.js';
import { ProfileScreen }                       from './ui/screens/ProfileScreen.js';
import { HomeScreen }                          from './ui/screens/HomeScreen.js';
import { ResultScreen }                        from './ui/screens/ResultScreen.js';

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
const lBg    = new PIXI.Container();
const lCards = new PIXI.Container();
const lFx    = new PIXI.Container();
const lUI    = new PIXI.Container();
app.stage.addChild(lBg, lCards, lFx, lUI);
lCards.sortableChildren = true;

// ============================================================
// 게임 상태
// ============================================================
let _cardMap   = new Map();
let _idSeq     = 0;
let _gameStart = 0;
let _market    = null;   // Market 인스턴스

const gs = {
  turn: 1, vp: 0, actions: 1, buys: 1, coins: 0,
  phase: 'action',
  deck: [], hand: [], play: [], discard: [], trash: [],
  supply: new Map(),
  handScroll: 0,
  _handArrows: null,
  cardsContainer: lCards,
  onEndTurn:    null,
  onScrollHand: null,
  onOpenRanking:  () => console.log('[UI] 랭킹창 (준비 중)'),
  onOpenCatalog:  () => console.log('[UI] 도감창 (준비 중)'),
  onOpenVolume:   () => console.log('[UI] 음량설정 (준비 중)'),
};

export function makeCard(def) {
  const c = new Card(def, _idSeq++, _onPlayCard);
  lCards.addChild(c.container);
  return c;
}

// ============================================================
// 비주얼 브리지
// ============================================================
function _sync() {
  updateCardPositions(gs);
  updateUI(gs);
  _market?.refresh(gs.supply);
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
  gs.phase = gs.actions > 0 ? 'action' : 'buy';
  _sync();
}

function _onBuyCard(def) {
  const result = buyCard(gs, def, makeCard);
  if (!result.ok) {
    console.log('[Buy] 실패:', result.reason);
    return;
  }
  gs.phase = 'buy';
  _sync();

  if (checkVictory(gs.supply)) {
    _finishGame();
  }
}

function _onEndTurn() {
  endTurn(gs);
  gs.handScroll = 0;
  gs.phase      = 'action';
  _sync();

  if (checkVictory(gs.supply)) {
    _finishGame();
    return;
  }
  setTimeout(() => _drawCardsVisual(5), 500);
}

gs.onEndTurn    = _onEndTurn;
gs.onScrollHand = () => _sync();

// ============================================================
// 화면 상태 머신
// ============================================================
const flow      = new GameFlow();
const profScr   = new ProfileScreen();
const homeScr   = new HomeScreen();
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
      _cardMap.get(id)?.name ?? id,
    );
    homeScr.onStart = () => flow.go(STATES.GAME);
    homeScr.show({ profile, records, kingdomIds: KINGDOM_IDS, kingdomNames });
  })

  .on(STATES.GAME, () => { _startGame(); })

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
  gs.deck = []; gs.hand = []; gs.play = []; gs.discard = []; gs.trash = [];
  gs.handScroll = 0;
  _idSeq = 0;
  gs.turn = 1; gs.vp = 0; gs.actions = 1; gs.buys = 1; gs.coins = 0;
  gs.phase = 'action';

  // 공급 초기화
  gs.supply = initSupply(_cardMap, BASIC_IDS, KINGDOM_IDS);

  // 초기 덱 (Copper 7 + Estate 3)
  for (let i = 0; i < 7; i++) gs.deck.push(makeCard(_cardMap.get('copper')));
  for (let i = 0; i < 3; i++) gs.deck.push(makeCard(_cardMap.get('estate')));
  shuffle(gs.deck);

  // 시장 세팅 (basic + kingdom 순서로 공급 맵 순서대로 배치)
  _market?.destroy();
  _market = new Market(lUI, _onBuyCard);
  _market.setSupply(gs.supply);

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
  [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard, ...gs.trash]
    .forEach(c => c.update(dt));
});

// ============================================================
// 부트
// ============================================================
buildBackground(lBg);

// 프로필 로드 후 buildUI 호출 (applyProfile로 갱신 가능)
const _initProfile = Storage.getProfile();
buildUI(lUI, gs, _initProfile);

// 핸드 스크롤 화살표 (UI 레이어에 배치)
gs._handArrows = buildHandArrows(lUI, gs);

CardDetail.init(lUI);

(async () => {
  try {
    _cardMap = await loadCards('./data/dominion_base_ko_cards.csv');
    resolveCards(_cardMap, [...KINGDOM_IDS, ...BASIC_IDS]);

    // 최초 진입 상태 결정
    const profile = Storage.getProfile();
    if (profile) applyProfile(profile);
    flow.go(profile ? STATES.HOME : STATES.PROFILE_SETUP);

  } catch (err) {
    console.error('[main] 초기화 실패:', err);
  }
})();
