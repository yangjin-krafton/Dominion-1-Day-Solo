// ============================================================
// main.js — 부트 · PixiJS 앱 · 게임 흐름 연결
//  흐름: PROFILE_SETUP → HOME ↔ GAME → RESULT → HOME|GAME
// ============================================================

// ── config & core ──────────────────────────────────────────
import { SCREEN_W as W, SCREEN_H as H, CARD_H as CH, CARD_W as CW, PILE_SCALE, ZONE, KINGDOM_POOL, BASIC_IDS } from './config.js';
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
         buildHandArrows,
         PILE_X, PILE_Y }                       from './ui/layout.js';
import * as CardDetail                         from './ui/CardDetail.js';
import { Market }                              from './ui/Market.js';
import { MarketTimeline }                      from './ui/MarketTimeline.js';
import { seededRng, generateMarketEvent,
         popMarketEvent,
         pushNextMarketEvent, applyMarketEvent } from './core/MarketQueue.js';
import { ProfileScreen }                       from './ui/screens/ProfileScreen.js';
import { HomeScreen }                          from './ui/screens/HomeScreen.js';
import { ResultScreen }                        from './ui/screens/ResultScreen.js';
import { RankingPanel }                        from './ui/screens/RankingPanel.js';
import * as CatalogOverlay                     from './ui/CatalogOverlay.js';
import * as VictoryCelebration                 from './ui/VictoryCelebration.js';

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
const _dpr = window.devicePixelRatio || 1;
// visualViewport: 모바일 주소창 show/hide 에도 정확한 가시 영역 높이 반환
const _vpw = () => window.visualViewport?.width  ?? window.innerWidth;
const _vph = () => window.visualViewport?.height ?? window.innerHeight;
const _fitScale = Math.min(_vpw() / W, _vph() / H);
const app = new PIXI.Application({
  width: W, height: H, backgroundColor: 0x0d0a18,
  resolution: _dpr * _fitScale,
  autoDensity: true, antialias: true,
});
document.querySelector('#app').appendChild(app.view);

function fitToViewport() {
  app.view.style.transform = `scale(${Math.min(_vpw() / W, _vph() / H)})`;
}
window.addEventListener('resize', fitToViewport);
// 모바일 주소창 show/hide 시 window.resize 대신 visualViewport.resize 가 발화됨
window.visualViewport?.addEventListener('resize', fitToViewport);
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
const _rankingPanel = new RankingPanel();
let _nextSetup         = null;   // 다음 게임 랜덤 시장 구성 (buildMarketSetup 결과)
let _activeKingdomIds  = [];     // 현재 게임에 사용 중인 킹덤 카드 IDs
let _initialSupplyData = [];     // 게임 시작 시 공급량 스냅샷 [{name, initCount}]
let _previewVpTarget   = 0;      // HomeScreen 표시용 사전 확정 목표 승점
let _previewGameSeed   = 0;      // HomeScreen 표시용 사전 확정 게임 시드
let _marketQueueState  = null;   // { queue, rng } — 시장 이벤트 롤링 큐
let _timeline          = null;   // MarketTimeline 인스턴스
let _pileWarnOv        = null;   // 더미 경고 눈 아이콘 Sprite (curse_player T+1)
let _pileWarnTime      = 0;      // 깜빡임 누적 시간

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
  pendingThrone:  null,   // { card }                  — 알현실 2차 플레이 대기 (모든 pending 처리 후 실행)
  witchActive:    false,  // 마녀 효과 활성 여부 (한번 활성화되면 영구)
  witchCountdown: 0,      // 다음 skip 삽입까지 남은 턴 수 (3→2→1→0→skip, 리셋 3)
  handScroll: 0,
  _handDragOffset: 0,
  _handArrows: null,
  cardsContainer: lCards,
  onEndTurn:    null,
  onScrollHand: null,
  onOpenRanking:  () => _rankingPanel.show(Storage.getRanking(10)),
  onOpenCatalog:  () => CatalogOverlay.show(_cardMap),
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
// 더미 경고 (curse_player T+1 예고 — 버림더미 위 눈 아이콘)
// ============================================================
const _PW = Math.round(CW * PILE_SCALE);
const _PH = Math.round(CW * 1.5 * PILE_SCALE);  // CARD_H = CW * 1.5

function _setPileWarning() {
  _clearPileWarning();
  const eye    = PIXI.Sprite.from('./asset/eye_effect.png');
  const sz     = Math.round(_PW * 0.50);
  eye.width    = sz;
  eye.height   = sz;
  eye.anchor.set(0.5);
  eye.x        = PILE_X[1] + _PW / 2;   // 버림더미(col 1) 중앙
  eye.y        = PILE_Y  + _PH / 2;
  eye.alpha    = 0.85;
  lUI.addChild(eye);
  _pileWarnOv   = eye;
  _pileWarnTime = 0;
}

function _clearPileWarning() {
  if (_pileWarnOv?.parent) {
    _pileWarnOv.parent.removeChild(_pileWarnOv);
    _pileWarnOv.destroy();
  }
  _pileWarnOv = null;
}

function _pileWarnUpdate(dt) {
  if (!_pileWarnOv?.parent) return;
  _pileWarnTime += dt;
  const s = Math.sin(_pileWarnTime * Math.PI * 0.7);
  _pileWarnOv.alpha = s * s;
}

// T+1 이벤트에 따라 경고 표시 위치 결정
function _applyT1Warning(newT1) {
  if (newT1?.type === 'curse_player') {
    _setPileWarning();
  } else {
    _market?.setWarningCard(newT1?.cardId ?? null);
  }
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
  onVictory:           () => _finishGame(true),
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
    _finishGame(true);
    return;
  }

  // ── 마녀 skip 주입 헬퍼 ─────────────────────────────
  // witchActive 일 때 3턴마다 pushNextMarketEvent 대신 skip 삽입
  const _pushOrWitchSkip = (qState, supply) => {
    if (gs.witchActive) {
      gs.witchCountdown--;
      if (gs.witchCountdown <= 0) {
        gs.witchCountdown = 3;
        const skip = { type: 'skip', witchCurse: true };
        qState.queue.push(skip);
        return skip;
      }
    }
    return pushNextMarketEvent(qState, supply);
  };

  // ── 시장 이벤트 처리 ─────────────────────────────────
  if (_marketQueueState && _timeline) {
    _market?.clearWarning();
    _clearPileWarning();

    if (hasMoat) {
      // ── 해자 차단: 이벤트 효과 없이 큐만 전진 ────────
      popMarketEvent(_marketQueueState);                      // T+1 소멸 (공급 적용 없음)
      _pushOrWitchSkip(_marketQueueState, gs.supply);         // T+4 추가 (마녀 skip 포함)

      // 타임라인 얼림 연출 (scroll 대신 freeze)
      _timeline.freeze(_marketQueueState.queue, () => {
        const newT1 = _marketQueueState.queue[0];
        _applyT1Warning(newT1);
      });

    } else {
      // ── 일반 시장 이벤트 처리 ─────────────────────────
      // Step1: T+1 이벤트 꺼내기
      const executed = popMarketEvent(_marketQueueState);

      // Step2-pre: 민병대(Militia) 시장 피해 감소 적용
      const reduce = gs.marketReduce ?? 0;
      gs.marketReduce = 0;
      if (reduce > 0 && executed.type === 'vanish') {
        executed.count = Math.max(0, (executed.count ?? 0) - reduce);
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

      // Step3: 새 T+4 이벤트 생성 (마녀 활성 시 3턴마다 skip 강제 삽입)
      _pushOrWitchSkip(_marketQueueState, gs.supply);

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
        _applyT1Warning(newT1);
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
gs.onShuffle    = () => SFX.shuffle();

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
    // 다음 게임 시장 구성 미리 생성 (홈 화면에 킹덤 미리보기 표시)
    _nextSetup = buildMarketSetup(_cardMap, null, Storage.getWins());
    const kingdomNames = _nextSetup.kingdomIds.map(id =>
      _cardMap.get(id)?.name ?? id,
    );
    // 오늘의 시장 12장 — mini-card 그리드용
    const todayMarketCards = _nextSetup.marketIds.map(id => {
      const def = _cardMap.get(id);
      return { name: def.name, type: def.type, cost: def.cost,
               gradTop: def.gradTop, gradMid: def.gradMid, gradBot: def.gradBot,
               initCount: null };
    });
    // 게임 시드 + 목표 승점 사전 확정 (HomeScreen 표시 + _startGame 재사용)
    _previewGameSeed = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
    _previewVpTarget = 10 + Math.floor(Math.random() * 11);
    homeScr.onStart = () => flow.go(STATES.GAME);
    homeScr.show({ kingdomNames, todayMarketCards,
                   vpTarget: _previewVpTarget, gameSeed: _previewGameSeed });
  })

  .on(STATES.GAME, () => { _startGame(); })

  .on(STATES.RESULT, ({ record, ranking, newUnlock }) => {
    resultScr.onNextGame = () => flow.go(STATES.GAME);
    resultScr.onHome     = () => flow.go(STATES.HOME);

    const _showResult = () => resultScr.show({ record, ranking });

    console.log('[RESULT] newUnlock:', newUnlock?.id ?? 'null', '| wins:', Storage.getWins());
    VictoryCelebration.show(() => {
      console.log('[RESULT] VictoryCelebration 완료 → catalog:', !!newUnlock);
      if (newUnlock) {
        CatalogOverlay.showWithUnlock(_cardMap, newUnlock.id, _showResult);
      } else {
        _showResult();
      }
    });
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
  // HomeScreen에서 사전 확정된 시드 사용 (없으면 신규 생성)
  gs.gameSeed = _previewGameSeed > 0 ? _previewGameSeed
    : (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  _previewGameSeed = 0;

  // 서브 시드: gameSeed를 XOR 변형해 독립 시퀀스 생성
  const rngSetup  = seededRng(gs.gameSeed);                       // 시장 카드 선택
  const rngSupply = seededRng((gs.gameSeed ^ 0x9e3779b9) >>> 0);  // 공급 수량
  const rngEvents = seededRng((gs.gameSeed ^ 0x6c62272e) >>> 0);  // 시장 이벤트

  // 목표 승점: HomeScreen에서 사전 확정된 값 우선 사용, 없으면 seeded 계산
  if (_previewVpTarget > 0) {
    gs.vpTarget      = _previewVpTarget;
    _previewVpTarget = 0;
  } else {
    gs.vpTarget = 10 + Math.floor(rngSetup() * 11);   // 10~20
  }
  gs.phase           = 'action';
  gs.pendingGain     = null;
  gs.pendingDiscard  = null;

  // 공급 초기화 — HOME에서 미리 생성된 구성 사용 (없으면 seeded 신규 생성)
  const setup       = _nextSetup ?? buildMarketSetup(_cardMap, rngSetup, Storage.getWins());
  _nextSetup        = null;
  _activeKingdomIds  = setup.kingdomIds;
  gs.supply          = initSupply(_cardMap, setup.marketIds, rngSupply);
  // 초기 공급량 스냅샷 (랭킹 mini-card 표시용) — supply는 게임 중 감소하므로 시작 시 저장
  _initialSupplyData = [...gs.supply.entries()]
    .map(([, { def, count }]) => ({
      name:      def.name,
      type:      def.type,
      cost:      def.cost,
      gradTop:   def.gradTop,
      gradMid:   def.gradMid,
      gradBot:   def.gradBot,
      initCount: count,
    }));

  // 초기 덱 (Copper 7 + Estate 3)
  for (let i = 0; i < 7; i++) gs.deck.push(makeCard(_cardMap.get('copper')));
  for (let i = 0; i < 3; i++) gs.deck.push(makeCard(_cardMap.get('estate')));
  shuffle(gs.deck);

  // 시장 세팅 (basic + kingdom 순서로 공급 맵 순서대로 배치)
  _market?.destroy();
  _clearPileWarning();
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

  // 게임 시작 시 T+1 이벤트 대상에 경고 이펙트 표시
  const firstT1 = initQueue[0];
  _applyT1Warning(firstT1);

  _gameStart = Date.now();
  _sync();
  setTimeout(() => _drawCardsVisual(5), 600);
}

function _finishGame(won = false) {
  const durationSec = Math.round((Date.now() - _gameStart) / 1000);
  const allCards    = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  let   totalVP     = allCards.reduce((s, c) => s + (c.def.points ?? 0), 0);
  // 정원(Gardens): 보유 카드 10장당 +1점 (내림)
  const gardensCount = allCards.filter(c => c.def.id === 'gardens').length;
  if (gardensCount > 0) totalVP += gardensCount * Math.floor(allCards.length / 10);

  let newUnlock = null;
  if (won) {
    const newWins = Storage.addWin();
    newUnlock = [..._cardMap.values()].find(d => d.unlockOrder === newWins) ?? null;
    console.log('[Unlock] wins:', newWins, '→', newUnlock ? `${newUnlock.id}(order:${newUnlock.unlockOrder})` : 'null (모두 해금됨 또는 CSV 캐시 문제)');
  }

  const record  = Storage.addRecord({
    turns: gs.turn, vp: totalVP, durationSec,
    kingdom:     _activeKingdomIds,
    vpTarget:    gs.vpTarget,
    marketCards: _initialSupplyData,
  });
  const ranking = Storage.getRanking();
  flow.go(STATES.RESULT, { record, ranking, newUnlock });
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
  _pileWarnUpdate(dt);
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
CatalogOverlay.init(lUI);
VictoryCelebration.init(lUI);

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
    _cardMap = await loadCards('./data/dominion_base_ko_cards.csv?v=2');
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
