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
  return (gs, n, engine, card) => {
    console.log(`[TODO] ${name}: 아직 구현되지 않은 효과입니다.`);
  };
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

  // ── 복잡 효과 (인터랙션 필요 — 추후 구현) ─────────────────
  //  구현 시: _stub() 를 실제 함수로 교체
  ['cellar',      _stub('Cellar:    버리고 뽑기')],
  ['chapel',      _stub('Chapel:    최대 4장 폐기')],
  ['harbinger',   _stub('Harbinger: 버림더미→덱 위')],
  ['merchant',    _stub('Merchant:  첫 Silver +1 코인')],
  ['vassal',      _stub('Vassal:    덱 위 액션 플레이')],
  ['workshop',    _stub('Workshop:  비용 4↓ 획득')],
  ['bureaucrat',  _stub('Bureaucrat: Silver 획득, 공격')],
  ['militia',     _stub('Militia:   손패 3장 공격')],
  ['moneylender', _stub('Moneylender: 동전 폐기→+3코인')],
  ['poacher',     _stub('Poacher:   빈 더미 수만큼 버리기')],
  ['remodel',     _stub('Remodel:   폐기→비용+2 획득')],
  ['throne_room', _stub('Throne Room: 액션 2회 플레이')],
  ['bandit',      _stub('Bandit:    Gold 획득, 보물 폐기 공격')],
  ['library',     _stub('Library:   손패 7장까지 뽑기')],
  ['mine',        _stub('Mine:      보물→비용+3 보물 획득')],
  ['sentry',      _stub('Sentry:    덱 위 2장 처리')],
  ['artisan',     _stub('Artisan:   비용 5↓ 획득 + 덱 위 올리기')],
]);
