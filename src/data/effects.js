// ============================================================
// data/effects.js — 카드 효과 토큰 레지스트리
//
// ★ 새 효과 추가 방법
//   1. CSV effect_code 에 토큰 추가 (e.g. "draw:2|my_effect")
//   2. 아래 EFFECT_REGISTRY 에 동일 키로 핸들러 함수 등록
//
// 핸들러 시그니처: (gs: GameState, n: number, engine: EngineAPI) => void
//   gs     — 현재 게임 상태
//   n      — 토큰의 숫자 인자 (e.g. draw:3 → n=3)
//   engine — { drawCards, gainCard, ... } (TurnEngine에서 주입)
// ============================================================

// ─── 미구현 효과 스텁 헬퍼 ────────────────────────────────────
function _stub(name) {
  return () => {
    console.log(`[TODO] ${name}: 아직 구현되지 않은 효과입니다.`);
  };
}

// ─── 빈 supply 더미 수 계산 ──────────────────────────────────
function _countEmptyPiles(supply) {
  let n = 0;
  for (const { count } of supply.values()) if (count === 0) n++;
  return n;
}

// ─── 효과 레지스트리 ─────────────────────────────────────────
export const EFFECT_REGISTRY = new Map([

  // ── 기본 자원 효과 (즉시 적용) ──────────────────────────────
  ['draw',    (gs, n, eng) => eng.drawCards(gs, n)],
  ['action',  (gs, n)      => { gs.actions += n; }],
  ['buy',     (gs, n)      => { gs.buys    += n; }],
  ['coin',    (gs, n)      => { gs.coins   += n; }],

  // ── 다른 플레이어 대상 효과 (솔로 모드: 무시) ─────────────
  ['draw_others',  () => { /* solo: skip */ }],
  ['curse_others', () => { /* solo: skip */ }],

  // ── 시장 연동 효과 (MarketEventQueue 에서 처리) ────────────
  ['market_reduce',     _stub('market_reduce')],
  ['market_reveal',     _stub('market_reveal')],
  ['moat_market_delay', _stub('moat_market_delay')],
  ['witch_market_blank',_stub('witch_market_blank')],
  ['bandit_gold',       _stub('bandit_gold')],
  ['bureaucrat_silver', _stub('bureaucrat_silver')],

  // ── 오버레이 대기 효과 ─────────────────────────────────────
  //    onPlayCard() 에서 gs.pending* 를 감지 → CardActionHandler 오버레이 표시

  // 저장고: 손패 선택 버리기 → 같은 수 드로우
  ['cellar', (gs) => {
    gs.pendingDiscard = { type: 'cellar', drawAfter: true };
  }],

  // 예배당: 손패 최대 4장 폐기
  ['chapel', (gs) => {
    gs.pendingTrash = { type: 'chapel', maxCount: 4 };
  }],

  // 선구자: 버림더미 → 덱 위로 1장
  ['harbinger', (gs) => {
    if (gs.discard.length > 0)
      gs.pendingPick = { type: 'harbinger', source: 'discard' };
  }],

  // 상인: 이번 턴 첫 은화 플레이 시 +1코인 (간이: 손패 은화 확인)
  ['merchant', _stub('Merchant: 첫 Silver +1코인')],

  // 신하: 덱 위 공개 → 액션이면 플레이 (추후 구현)
  ['vassal', _stub('Vassal: 덱 위 액션 플레이')],

  // 작업장: 비용 4 이하 카드 획득
  ['workshop', (gs) => {
    gs.pendingGain = { type: 'gain', maxCost: 4, dest: 'discard' };
  }],

  // 대금업자: 동전 1장 폐기 → +3코인
  ['moneylender', (gs) => {
    const hasCoppers = gs.hand.some((c) => c.def.id === 'copper');
    if (hasCoppers)
      gs.pendingTrash = { type: 'moneylender', filter: 'copper', maxCount: 1 };
  }],

  // 밀렵꾼: 카드+1 행동+1 코인+1 후 빈 더미 수만큼 버리기
  // (draw:1|action:1|coin:1 토큰이 먼저 실행된 뒤 이 토큰이 pending 세팅)
  ['poacher', (gs) => {
    const n = _countEmptyPiles(gs.supply);
    if (n > 0) gs.pendingDiscard = { type: 'poacher', exact: n };
  }],

  // 개조: 1장 폐기 → 비용+2 이하 획득
  ['remodel', (gs) => {
    if (gs.hand.length > 0) gs.pendingTwoStep = { type: 'remodel' };
  }],

  // 알현실: 액션 1장을 두 번 플레이
  ['throne_room', (gs) => {
    const hasAction = gs.hand.some((c) => c.def.type === 'Action');
    if (hasAction) gs.pendingPick = { type: 'throne_room', source: 'hand' };
  }],

  // 광산: 보물 폐기 → 비용+3 보물 획득(손으로)
  ['mine', (gs) => {
    const hasTreasure = gs.hand.some((c) => c.def.type === 'Treasure');
    if (hasTreasure) gs.pendingTwoStep = { type: 'mine' };
  }],

  // 보초병: 덱 위 2장 처리 (추후 CardRevealOverlay 구현)
  ['sentry', _stub('Sentry: 덱 위 2장 폐기/버리기/유지')],

  // 도서관: 손패 7장까지 (추후 구현)
  ['library', _stub('Library: 손패 7장까지 뽑기')],

  // 장인: 비용 5 이하 획득→손 + 손패 1장 덱위
  ['artisan', (gs) => {
    gs.pendingTwoStep = { type: 'artisan' };
  }],

  // pendingGain 사용 시 type: 'gain' 필드 포함 필수
  // gs.pendingGain = { type: 'gain', maxCost: N, dest: 'discard'|'hand' }
]);
