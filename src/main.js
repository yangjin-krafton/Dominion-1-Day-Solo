// ============================================================
// main.js — 부트 · PixiJS 앱 · 게임 흐름 연결
//  흐름: PROFILE_SETUP → HOME ↔ GAME → RESULT → HOME|GAME
// ============================================================

// ── config & core ──────────────────────────────────────────
import { SCREEN_W as W, SCREEN_H as H, KINGDOM_POOL, BASIC_IDS } from './config.js';
import { buildMarketSetup } from './core/MarketSetup.js';
import { GameFlow, STATES }                from './core/GameFlow.js';
import * as Storage                        from './core/Storage.js';
import { drawCard, playCard, endTurn,
         shuffle, checkVictory, initSupply,
         buyCard, gainCard }               from './core/TurnEngine.js';

// ── ui ─────────────────────────────────────────────────────
import { Card }                                from './ui/Card.js';
import { buildBackground, buildPileStaticBg,
         buildUI, updateUI, applyProfile,
         notifyBlocked }                       from './ui/scene.js';
import { updateCardPositions,
         buildHandArrows,
         PILE_X, PILE_Y }                      from './ui/layout.js';
import * as CardDetail                         from './ui/CardDetail.js';
import { showGainCardOverlay }                 from './ui/GainCardOverlay.js';
import { showDiscardSelectOverlay }            from './ui/DiscardSelectOverlay.js';
import { Market }                              from './ui/Market.js';
import { MarketTimeline }                      from './ui/MarketTimeline.js';
import { initMarketQueue, popMarketEvent,
         pushNextMarketEvent, applyMarketEvent } from './core/MarketQueue.js';
import { ProfileScreen }                       from './ui/screens/ProfileScreen.js';
import { HomeScreen }                          from './ui/screens/HomeScreen.js';
import { ResultScreen }                        from './ui/screens/ResultScreen.js';

// ── data ───────────────────────────────────────────────────
import { loadCards, resolveCards } from './data/cards.js';

// ============================================================
// PixiJS 앱
// ============================================================
// resolution = DPR × CSS스케일 → canvas 버퍼가 물리 픽셀과 1:1 매칭되어 PC에서도 선명
const _dpr      = window.devicePixelRatio || 1;
const _fitScale = Math.min(window.innerWidth / W, window.innerHeight / H);
const app = new PIXI.Application({
  width: W, height: H, backgroundColor: 0x0d0a18,
  resolution: _dpr * _fitScale,
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
let _nextSetup         = null;   // 다음 게임 랜덤 시장 구성 (buildMarketSetup 결과)
let _activeKingdomIds  = [];     // 현재 게임에 사용 중인 킹덤 카드 IDs
let _marketQueueState  = null;   // { queue, rng } — 시장 이벤트 롤링 큐
let _timeline          = null;   // MarketTimeline 인스턴스

const gs = {
  turn: 1, vp: 0, vpTarget: 15, actions: 1, buys: 1, coins: 0,
  phase: 'action',
  deck: [], hand: [], play: [], discard: [], trash: [],
  supply: new Map(),
  pendingGain:    null,   // { maxCost, dest } — 카드 획득 대기 (workshop 등)
  pendingDiscard: null,   // { type, drawAfter } — 핸드 선택 버리기 대기 (cellar 등)
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
  // 현재 보유 승점 실시간 계산 (덱+손패+낸카드+버림더미)
  const allCards = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  gs.vp = allCards.reduce((s, c) => s + (c.def.points ?? 0), 0);

  updateCardPositions(gs);
  updateUI(gs);
  _market?.refresh(gs.supply);
  _market?.setAffordable(gs.coins, gs.buys);

  // 행동 0일때 핸드의 액션 카드 dim (alpha 낮춤)
  const noActions = gs.actions === 0;
  gs.hand.forEach(card => {
    const isDimTarget = noActions && card.isFaceUp && card.def.type === 'Action';
    card.container.alpha = isDimTarget ? 0.38 : 1;
  });
  // 핸드 밖 카드는 항상 alpha 복원
  [...gs.deck, ...gs.play, ...gs.discard, ...gs.trash]
    .forEach(card => { card.container.alpha = 1; });
}

// ── 재셔플 애니메이션 ──────────────────────────────────────
let _reshuffling = false;

/**
 * 버림더미 카드들을 뒷면으로 뒤집고 덱 위치로 이동시키는 모션
 * @param {function} onDone 애니메이션 완료 후 콜백
 */
function _reshuffleAnim(onDone) {
  // 버림더미 카드 모두 뒷면으로 즉시 전환
  for (const card of gs.discard) {
    card.isFaceUp          = false;
    card.frontFace.visible = false;
    card.backFace.visible  = true;
  }
  // 카드마다 살짝 지연하며 덱 위치로 이동 (스태거 효과)
  gs.discard.forEach((card, i) => {
    setTimeout(() => {
      const jitter = (Math.random() - 0.5) * 0.14;
      card.moveTo(PILE_X[0], PILE_Y, jitter, card.container.scale.y);
    }, i * 18);
  });
  // lerp 수렴 대기 후 콜백
  setTimeout(onDone, 380);
}

function _drawCardVisual() {
  if (_reshuffling) {
    // 재셔플 진행 중: 잠시 후 재시도
    setTimeout(_drawCardVisual, 80);
    return;
  }

  if (gs.deck.length === 0 && gs.discard.length > 0) {
    // 덱 소진 → 재셔플 모션 후 드로우
    _reshuffling = true;
    _reshuffleAnim(() => {
      _reshuffling = false;
      _doSingleDraw();
    });
  } else {
    _doSingleDraw();
  }
}

function _doSingleDraw() {
  const card = drawCard(gs);
  if (!card) return;
  // 버림→덱 재활용 카드: 앞면 상태일 경우 뒷면 강제 리셋
  if (card.isFaceUp) {
    card.isFaceUp          = false;
    card.frontFace.visible = false;
    card.backFace.visible  = true;
  }
  _sync();
  setTimeout(() => card.flip(), 180);
}

function _drawCardsVisual(n) {
  for (let i = 0; i < n; i++) setTimeout(_drawCardVisual, i * 140);
}

function _onPlayCard(card) {
  const result = playCard(gs, card);
  if (!result.ok) {
    if (result.reason === 'no_actions') notifyBlocked('action');
    return;
  }
  gs.phase = gs.actions > 0 ? 'action' : 'buy';
  _sync();

  // 액션 효과로 드로우된 카드: 뒷면 상태로 핸드에 있으면 flip
  gs.hand.forEach((c, i) => {
    if (!c.isFaceUp) {
      c.isFaceUp          = false;
      c.frontFace.visible = false;
      c.backFace.visible  = true;
      setTimeout(() => c.flip(), 150 + i * 70);
    }
  });

  // 카드 획득 대기 효과 처리 (workshop 등)
  if (gs.pendingGain) {
    const { maxCost, dest = 'discard' } = gs.pendingGain;
    gs.pendingGain = null;
    _handleGainCard(maxCost, dest);
  }

  // 핸드 선택 버리기 효과 처리 (cellar 등)
  if (gs.pendingDiscard) {
    const pd = gs.pendingDiscard;
    gs.pendingDiscard = null;
    _handleDiscardSelect(pd);
  }
}

/** 핸드에서 선택한 카드들을 버리고 같은 수만큼 드로우 */
function _handleDiscardSelect(pd) {
  let _ov = null;

  const close = () => { _ov?.close(); _ov = null; _sync(); };

  _ov = showDiscardSelectOverlay(
    lUI,
    [...gs.hand],          // 현재 손패 스냅샷 (원본 참조 유지)
    (selectedCards) => {
      // 선택한 카드들을 손패에서 제거 → 버림더미로
      for (const card of selectedCards) {
        const idx = gs.hand.indexOf(card);
        if (idx !== -1) {
          gs.hand.splice(idx, 1);
          card.area          = 'discard';
          card.isFaceUp      = true;
          card.frontFace.visible = true;
          card.backFace.visible  = false;
          gs.discard.push(card);
        }
      }
      const drawN = selectedCards.length;
      close();
      // 버린 수만큼 드로우
      if (pd.drawAfter && drawN > 0) {
        _drawCardsVisual(drawN);
      }
    },
    close,
  );
}

/** 카드 획득 오버레이 표시 — workshop 등 gainCard 효과 공용 진입점 */
function _handleGainCard(maxCost, dest) {
  let _ov = null;

  const close = () => {
    _ov?.close();
    _ov = null;
    _sync();
  };

  _ov = showGainCardOverlay(
    lUI,
    gs.supply,
    maxCost,
    (def) => {
      // 카드 획득 → 버림더미(또는 핸드)
      gainCard(gs, def, makeCard, dest);
      close();
    },
    close,
  );
}

function _onBuyCard(def) {
  const result = buyCard(gs, def, makeCard);
  if (!result.ok) {
    if (result.reason === 'no_buys')            notifyBlocked('buy');
    else if (result.reason === 'out_of_stock')  notifyBlocked('buy');
    else if (result.reason === 'insufficient_coins') notifyBlocked('coin');
    return;
  }
  gs.phase = 'buy';
  _sync();

  if (checkVictory(gs.supply) || gs.vp >= gs.vpTarget) {
    _finishGame();
  }
}

function _onEndTurn() {
  endTurn(gs);
  gs.handScroll = 0;
  gs.phase      = 'action';
  _sync();

  if (checkVictory(gs.supply) || gs.vp >= gs.vpTarget) {
    _finishGame();
    return;
  }

  // ── 시장 이벤트 처리 ─────────────────────────────────
  if (_marketQueueState && _timeline) {
    // Step1: T+1 이벤트 꺼내기
    const executed = popMarketEvent(_marketQueueState);

    // Step2: 공급에 적용 (drain이면 resolvedCardId 기록됨)
    applyMarketEvent(executed, gs.supply);

    // Step3: 새 T+4 이벤트 생성 (적용 후 시장 상태 기반)
    pushNextMarketEvent(_marketQueueState, gs.supply);

    // Step4: 연출 — 타임라인 스크롤 + 영향 카드 플래시 동시 실행
    const flashId = executed.cardId ?? executed.resolvedCardId ?? null;
    if (flashId) {
      _market?.vanishFlash(flashId, () => {
        _market?.refresh(gs.supply);
        _market?.setAffordable(gs.coins, gs.buys);
      });
    }

    _timeline.scroll(_marketQueueState.queue, () => {
      // 플래시가 없었던 경우 여기서 공급 갱신
      if (!flashId) {
        _market?.refresh(gs.supply);
        _market?.setAffordable(gs.coins, gs.buys);
      }
    });
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
    // 다음 게임 시장 구성 미리 생성 (홈 화면에 킹덤 미리보기 표시)
    _nextSetup = buildMarketSetup(_cardMap);
    const kingdomNames = _nextSetup.kingdomIds.map(id =>
      _cardMap.get(id)?.name ?? id,
    );
    homeScr.onStart = () => flow.go(STATES.GAME);
    homeScr.show({ profile, records, kingdomIds: _nextSetup.kingdomIds, kingdomNames });
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
  // 목표 승점 랜덤 배정 (10~20)
  gs.vpTarget = 10 + Math.floor(Math.random() * 11);
  gs.phase           = 'action';
  gs.pendingGain     = null;
  gs.pendingDiscard  = null;

  // 공급 초기화 — HOME에서 미리 생성된 구성 사용 (없으면 신규 생성)
  const setup       = _nextSetup ?? buildMarketSetup(_cardMap);
  _nextSetup        = null;
  _activeKingdomIds = setup.kingdomIds;
  gs.supply         = initSupply(_cardMap, setup.marketIds);

  // 초기 덱 (Copper 7 + Estate 3)
  for (let i = 0; i < 7; i++) gs.deck.push(makeCard(_cardMap.get('copper')));
  for (let i = 0; i < 3; i++) gs.deck.push(makeCard(_cardMap.get('estate')));
  shuffle(gs.deck);

  // 시장 세팅 (basic + kingdom 순서로 공급 맵 순서대로 배치)
  _market?.destroy();
  _market = new Market(lUI, _onBuyCard);
  _market.setSupply(gs.supply);

  // 시장 이벤트 큐 초기화 (게임 시작 시 시드 고정)
  gs.marketSeed = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  _marketQueueState = initMarketQueue(gs.supply, gs.marketSeed);
  _timeline?.destroy();
  _timeline = new MarketTimeline(lUI, _marketQueueState.queue);

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
    kingdom: _activeKingdomIds,
  });
  const ranking = Storage.getRanking();
  flow.go(STATES.RESULT, { record, ranking });
}

// ============================================================
// 게임 루프
// ============================================================
let lastTime = performance.now();

app.ticker.add(() => {
  const now = performance.now();
  const dt  = Math.min((now - lastTime) / 1000, 0.1);
  lastTime  = now;
  [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard, ...gs.trash]
    .forEach(c => c.update(dt));
  _market?.update(dt);
});

// ============================================================
// 부트
// ============================================================
buildBackground(lBg);
buildPileStaticBg(lBg);

// 프로필 로드 후 buildUI 호출 (applyProfile로 갱신 가능)
const _initProfile = Storage.getProfile();
buildUI(lUI, gs, _initProfile);

// 핸드 스크롤 화살표 (UI 레이어에 배치)
gs._handArrows = buildHandArrows(lUI, gs);

CardDetail.init(lUI);

(async () => {
  try {
    _cardMap = await loadCards('./data/dominion_base_ko_cards.csv');
    resolveCards(_cardMap, [...KINGDOM_POOL, ...BASIC_IDS]);

    // 최초 진입 상태 결정
    const profile = Storage.getProfile();
    if (profile) applyProfile(profile);
    flow.go(profile ? STATES.HOME : STATES.PROFILE_SETUP);

  } catch (err) {
    console.error('[main] 초기화 실패:', err);
  }
})();
