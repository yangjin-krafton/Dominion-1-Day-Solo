// ============================================================
// core/GameFlow.js — 화면 상태 머신
//
// 상태:  PROFILE_SETUP → HOME ↔ GAME → RESULT → HOME|GAME
//
// 사용법:
//   const flow = new GameFlow();
//   flow.on('HOME',  data => showHomeScreen(data))
//       .on('GAME',  data => startGame(data))
//       .on('RESULT', data => showResult(data));
//   flow.go('HOME');
// ============================================================

export const STATES = Object.freeze({
  PROFILE_SETUP: 'PROFILE_SETUP',
  HOME:          'HOME',
  GAME:          'GAME',
  RESULT:        'RESULT',
});

export class GameFlow {
  constructor() {
    this.state    = null;
    this._prevState = null;
    this._handlers  = new Map();
  }

  /**
   * 특정 상태 진입 시 실행할 핸들러 등록
   * @param {string}   state - STATES 중 하나
   * @param {Function} fn    - (data: object) => void
   */
  on(state, fn) {
    this._handlers.set(state, fn);
    return this;   // 체이닝 지원
  }

  /**
   * 상태 전환
   * @param {string} state  - 목표 상태
   * @param {object} [data] - 상태에 전달할 데이터
   */
  go(state, data = {}) {
    this._prevState = this.state;
    this.state      = state;
    console.log(`[GameFlow] ${this._prevState ?? 'INIT'} → ${state}`, data);

    const fn = this._handlers.get(state);
    if (fn) fn(data);
    else    console.warn(`[GameFlow] 핸들러 없음: "${state}"`);
  }

  /** 이전 상태로 돌아가기 */
  back(data = {}) {
    if (this._prevState) this.go(this._prevState, data);
  }
}
