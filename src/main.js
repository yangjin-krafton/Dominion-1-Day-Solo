// ============================================================
// main.js — 부트 · PixiJS 앱 · 게임 흐름 연결
//  흐름: PROFILE_SETUP → HOME ↔ GAME → RESULT → HOME|GAME
// ============================================================

// ── config & core ──────────────────────────────────────────
import { SCREEN_W as W, SCREEN_H as H, CARD_H as CH, ZONE, KINGDOM_POOL, BASIC_IDS } from './config.js';
import { buildMarketSetup } from './core/MarketSetup.js';
import { GameFlow, STATES }                from './core/GameFlow.js';
import * as Storage                        from './core/Storage.js';
import { endTurn, shuffle,
         checkVictory, initSupply }        from './core/TurnEngine.js';

// ── ui ─────────────────────────────────────────────────────
import { Card }                                from './ui/Card.js';
import { buildBackground, buildPileStaticBg,
         buildUI, updateUI, applyProfile }     from './ui/scene.js';
import { updateCardPositions,
         buildHandArrows }                      from './ui/layout.js';
import * as CardDetail                         from './ui/CardDetail.js';
import { Market }                              from './ui/Market.js';
import { MarketTimeline }                      from './ui/MarketTimeline.js';
import { seededRng, generateMarketEvent,
         popMarketEvent,
         pushNextMarketEvent, applyMarketEvent } from './core/MarketQueue.js';
import { ProfileScreen }                       from './ui/screens/ProfileScreen.js';
import { HomeScreen }                          from './ui/screens/HomeScreen.js';
import { ResultScreen }                        from './ui/screens/ResultScreen.js';

// ── data ───────────────────────────────────────────────────
import { loadCards, resolveCards } from './data/cards.js';

// ── motion & handlers ──────────────────────────────────────
import { createCardMotion }        from './ui/CardMotion.js';
import { createCardActionHandler } from './ui/CardActionHandler.js';

// ── debug ──────────────────────────────────────────────────
import { initDebug } from './debug/DebugAPI.js';

// ── audio ──────────────────────────────────────────────────
import { SFX } from './asset/audio/sfx.js';

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
  pendingGain:    null,   // { maxCost, dest }       — 카드 획득 대기 (workshop 등)
  pendingDiscard: null,   // { type, drawAfter|exact } — 버리기 대기 (cellar, poacher)
  pendingTrash:   null,   // { type, maxCount, filter } — 폐기 대기 (chapel, moneylender)
  pendingPick:    null,   // { type, source }          — 단일 선택 대기 (harbinger, throne_room)
  pendingTwoStep: null,   // { type }                  — 2단계 효과 대기 (remodel, mine, artisan)
  handScroll: 0,
  _handDragOffset: 0,
  _handArrows: null,
  cardsContainer: lCards,
  onEndTurn:    null,
  onScrollHand: null,
  onOpenRanking:  () => console.log('[UI] 랭킹창 (준비 중)'),
  onOpenCatalog:  () => console.log('[UI] 도감창 (준비 중)'),
  onOpenVolume:   () => console.log('[UI] 음량설정 (준비 중)'),
};

// _onPlayCard는 createCardActionHandler 호출 후 설정 (늦은 바인딩)
let _onPlayCard = null;

export function makeCard(def) {
  const c = new Card(def, _idSeq++, (card) => _onPlayCard?.(card));
  lCards.addChild(c.container);
  return c;
}

// ============================================================
// 비주얼 브리지
// ============================================================
function _sync() {
  // 현재 보유 승점 실시간 계산 (덱+손패+낸카드+버림더미)
  const prevVP   = gs.vp;
  const allCards = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  gs.vp = allCards.reduce((s, c) => s + (c.def.points ?? 0), 0);
  // 정원(Gardens): 보유 카드 10장당 +1점 (내림)
  const gardensCount = allCards.filter(c => c.def.id === 'gardens').length;
  if (gardensCount > 0) gs.vp += gardensCount * Math.floor(allCards.length / 10);

  updateCardPositions(gs);
  updateUI(gs);
  _market?.refresh(gs.supply);
  _market?.setAffordable(gs.coins, gs.buys);

  // 핸드 카드 사용 가능 여부에 따라 dim 처리 (검정 오버레이, alpha 미사용)
  gs.hand.forEach(card => {
    if (!card.isFaceUp) { card.setDim(false); return; }
    const type = card.def.type;
    let dim;
    if (type === 'Treasure') {
      dim = false;                      // 보물: 항상 사용 가능
    } else if (type === 'Action') {
      dim = gs.actions <= 0;            // 행동: 행동 소진 시 사용 불가
    } else {
      dim = true;                       // Victory / Curse: 핸드에서 사용 불가
    }
    card.setDim(dim);
  });
  // 핸드 밖 카드는 항상 dim 해제
  [...gs.deck, ...gs.play, ...gs.discard, ...gs.trash]
    .forEach(card => card.setDim(false));

  // Merchant 보너스 대기 중: 핸드의 Silver 카드에 "+1" 버프 배지 표시 (칩이 남아있을 때만)
  const mb = gs.merchantBonus ?? 0;
  const silverBuff = mb > 0 ? '+1' : null;
  gs.hand.forEach(card => {
    if (card.def.id === 'silver') card.setBuffBadge(silverBuff);
  });

  // 해자(Moat)가 핸드에 있으면 타임라인에 지속 아이스 이펙트
  const hasMoatInHand = gs.hand.some(c => c.def.id === 'moat');
  _timeline?.setFrozen(hasMoatInHand);
}

// ── 카드 모션 & 액션 핸들러 연결 ──────────────────────────
const { drawCardsVisual: _drawCardsVisual } = createCardMotion({ gs, sync: _sync });
const { onPlayCard, onBuyCard: _onBuyCard } = createCardActionHandler({
  gs, lUI, makeCard, sync: _sync,
  drawCardsVisual:     _drawCardsVisual,
  onVictory:           _finishGame,
  getTimeline:         () => _timeline,
  getMarketQueueState: () => _marketQueueState,
});
_onPlayCard = onPlayCard;

let _isEndingTurn = false;

function _onEndTurn() {
  if (_isEndingTurn) return;
  _isEndingTurn = true;
  SFX.endTurn();

  // 해자(Moat) 확인 — endTurn()이 손패를 버림더미로 보내기 전에 체크
  const hasMoat = gs.hand.some(c => c.def.id === 'moat');

  endTurn(gs);
  gs.handScroll = 0;
  gs.phase      = 'action';
  _sync();

  if (checkVictory(gs.supply) || gs.vp >= gs.vpTarget) {
    _isEndingTurn = false;
    _finishGame();
    return;
  }

  // ── 시장 이벤트 처리 ─────────────────────────────────
  if (_marketQueueState && _timeline) {
    _market?.clearWarning();

    if (hasMoat) {
      // ── 해자 차단: 이벤트 효과 없이 큐만 전진 ────────
      popMarketEvent(_marketQueueState);                   // T+1 소멸 (공급 적용 없음)
      pushNextMarketEvent(_marketQueueState, gs.supply);   // T+4 추가

      // 타임라인 얼림 연출 (scroll 대신 freeze)
      _timeline.freeze(_marketQueueState.queue, () => {
        const newT1 = _marketQueueState.queue[0];
        _market?.setWarningCard(newT1?.cardId ?? null);
      });

    } else {
      // ── 일반 시장 이벤트 처리 ─────────────────────────
      // Step1: T+1 이벤트 꺼내기
      const executed = popMarketEvent(_marketQueueState);

      // Step2-pre: 민병대(Militia) 시장 피해 감소 적용
      const reduce = gs.marketReduce ?? 0;
      gs.marketReduce = 0;
      if (reduce > 0) {
        if (executed.type === 'vanish') {
          executed.count = Math.max(0, (executed.count ?? 0) - reduce);
        } else if (executed.type === 'drain') {
          executed.type = 'skip';   // drain(1장 제거)을 완전히 무력화
        }
      }

      // Step2: 공급에 적용 (drain이면 resolvedCardId 기록됨)
      //        curse_player이면 플레이어 버림더미에 저주 추가
      if (executed.type === 'curse_player') {
        const curseDef = gs.supply.get('curse')?.def ?? _cardMap?.get('curse');
        if (curseDef) {
          const curseCard = makeCard(curseDef);
          curseCard.area          = 'discard';
          curseCard.isFaceUp      = true;
          curseCard.frontFace.visible = true;
          curseCard.backFace.visible  = false;
          gs.discard.push(curseCard);
          _sync();
        }
      } else {
        applyMarketEvent(executed, gs.supply);
      }

      // Step3: 새 T+4 이벤트 생성 (적용 후 시장 상태 기반)
      pushNextMarketEvent(_marketQueueState, gs.supply);

      // Step4: 연출 — 쉐이킹 + 타임라인 스크롤 + 플래시 동시 실행
      const flashId = executed.cardId ?? executed.resolvedCardId ?? null;
      if (flashId) _market?.shakeCard(flashId);

      if (flashId && executed.type !== 'curse_player') {
        _market?.vanishFlash(flashId, () => {
          _market?.refresh(gs.supply);
          _market?.setAffordable(gs.coins, gs.buys);
        });
      }

      _timeline.scroll(_marketQueueState.queue, () => {
        if (!flashId || executed.type === 'curse_player') {
          _market?.refresh(gs.supply);
          _market?.setAffordable(gs.coins, gs.buys);
        }
        const newT1 = _marketQueueState.queue[0];
        _market?.setWarningCard(newT1?.cardId ?? null);
      });
    }
  }

  setTimeout(() => {
    _drawCardsVisual(5);
    setTimeout(() => { _isEndingTurn = false; }, 800);
  }, 500);
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
  gs._handDragOffset = 0;
  _idSeq = 0;
  gs.turn = 1; gs.vp = 0; gs.actions = 1; gs.buys = 1; gs.coins = 0;
  gs.merchantBonus     = 0;
  gs.marketReduce      = 0;
  gs.marketRevealBonus = 0;
  // ── 게임 시드 확정 (모든 랜덤의 원천) ──────────────────────
  // 같은 gameSeed → 시장 구성·공급 수량·이벤트 큐 모두 동일 재현
  gs.gameSeed = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;

  // 서브 시드: gameSeed를 XOR 변형해 독립 시퀀스 생성
  const rngSetup  = seededRng(gs.gameSeed);                       // 시장 카드 선택
  const rngSupply = seededRng((gs.gameSeed ^ 0x9e3779b9) >>> 0);  // 공급 수량
  const rngEvents = seededRng((gs.gameSeed ^ 0x6c62272e) >>> 0);  // 시장 이벤트

  // 목표 승점 (rngSetup 시퀀스 사용)
  gs.vpTarget = 10 + Math.floor(rngSetup() * 11);   // 10~20
  gs.phase           = 'action';
  gs.pendingGain     = null;
  gs.pendingDiscard  = null;

  // 공급 초기화 — HOME에서 미리 생성된 구성 사용 (없으면 seeded 신규 생성)
  const setup       = _nextSetup ?? buildMarketSetup(_cardMap, rngSetup);
  _nextSetup        = null;
  _activeKingdomIds = setup.kingdomIds;
  gs.supply         = initSupply(_cardMap, setup.marketIds, rngSupply);

  // 초기 덱 (Copper 7 + Estate 3)
  for (let i = 0; i < 7; i++) gs.deck.push(makeCard(_cardMap.get('copper')));
  for (let i = 0; i < 3; i++) gs.deck.push(makeCard(_cardMap.get('estate')));
  shuffle(gs.deck);

  // 시장 세팅 (basic + kingdom 순서로 공급 맵 순서대로 배치)
  _market?.destroy();
  _market = new Market(lUI, _onBuyCard);
  _market.setSupply(gs.supply);

  // 시장 이벤트 큐 초기화 (rngEvents 서브시드 사용)
  gs.marketSeed = (gs.gameSeed ^ 0x6c62272e) >>> 0;
  const initQueue = [];
  for (let i = 0; i < 4; i++) {
    initQueue.push(generateMarketEvent(gs.supply, rngEvents));
  }
  _marketQueueState = { queue: initQueue, rng: rngEvents };
  _timeline?.destroy();
  _timeline = new MarketTimeline(lUI, _marketQueueState.queue);

  // 게임 시작 시 T+1 이벤트 대상 카드에 경고 이펙트 표시
  const firstT1 = initQueue[0];
  _market.setWarningCard(firstT1?.cardId ?? null);

  _gameStart = Date.now();
  _sync();
  setTimeout(() => _drawCardsVisual(5), 600);
}

function _finishGame() {
  const durationSec = Math.round((Date.now() - _gameStart) / 1000);
  const allCards    = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  let   totalVP     = allCards.reduce((s, c) => s + (c.def.points ?? 0), 0);
  // 정원(Gardens): 보유 카드 10장당 +1점 (내림)
  const gardensCount = allCards.filter(c => c.def.id === 'gardens').length;
  if (gardensCount > 0) totalVP += gardensCount * Math.floor(allCards.length / 10);

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

// 핸드 스크롤 방향 표시자 (시각 전용)
gs._handArrows = buildHandArrows(lUI);

CardDetail.init(lUI);

// ── 핸드 드래그 스크롤 (연속 캐러셀 + 그룹 스냅) ─────────────
// ‣ pointermove: 손가락 따라 카드 즉시 이동 (lerp 우회)
// ‣ pointerup:   가장 가까운 그룹 경계로 스냅 후 lerp 애니메이션
// ‣ Card.js 8px+ 이동 시 _timer=null → onPlay 미호출 (카드 실수 플레이 없음)
{
  const DEAD_ZONE = 5;  // 이 미만 이동은 탭으로 간주 (px)

  let _hdStartX = 0, _hdActive = false;

  app.stage.eventMode = 'static';

  app.stage.on('pointerdown', (e) => {
    if (e.global.y >= ZONE.HAND_Y && e.global.y <= ZONE.HAND_Y + CH) {
      _hdActive = true;
      _hdStartX = e.global.x;
      gs._handDragOffset = 0;
    }
  });

  app.stage.on('pointermove', (e) => {
    if (!_hdActive) return;
    const dx = e.global.x - _hdStartX;
    if (Math.abs(dx) < DEAD_ZONE) return;

    gs._handDragOffset = dx;
    // 카드 위치 즉시 반영 (lerp 우회 — 손가락 추적)
    updateCardPositions(gs);
    gs.hand.forEach(c => { c.container.x = c.targetX; });
    gs.cardsContainer?.sortChildren();
  });

  const _hdFinish = (e) => {
    if (!_hdActive) return;
    const dx = e.global.x - _hdStartX;
    gs._handDragOffset = 0;

    // 그룹 간격 재산출 (layout.js와 동일 공식)
    const nGroups = new Set(gs.hand.map(c => c.def.id)).size;
    const sp = nGroups > 1
      ? Math.min(98, (W - 16 - 90) / Math.min(nGroups - 1, 3))
      : 0;

    if (sp > 0) {
      // 드래그 적용 후 가장 가까운 그룹 경계로 스냅
      gs.handScroll = Math.round(((gs.handScroll ?? 0) + dx) / sp) * sp;
      // 범위 클램프는 updateCardPositions에서 처리
    }

    // _sync() → updateCardPositions(dragOff=0) → targetX 갱신 → lerp 스냅 애니메이션
    gs.onScrollHand?.();
    _hdActive = false;
  };

  app.stage.on('pointerup',        _hdFinish);
  app.stage.on('pointerupoutside', _hdFinish);
}

(async () => {
  try {
    _cardMap = await loadCards('./data/dominion_base_ko_cards.csv');
    resolveCards(_cardMap, [...KINGDOM_POOL, ...BASIC_IDS]);

    // 최초 진입 상태 결정
    const profile = Storage.getProfile();
    if (profile) applyProfile(profile);
    flow.go(profile ? STATES.HOME : STATES.PROFILE_SETUP);

    // ── 콘솔 디버그 API ──────────────────────────────────────
    initDebug({ cardMap: _cardMap, gs, makeCard, sync: _sync });

  } catch (err) {
    console.error('[main] 초기화 실패:', err);
  }
})();
