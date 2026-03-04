// ============================================================
// debug/DebugAPI.js — 콘솔 디버그 API (개발 전용)
//
// 사용:
//   initDebug({ cardMap, gs, makeCard, sync })
//
// 브라우저 콘솔에서:
//   Debug.help()  — 명령 목록 확인
// ============================================================
import { clearAll, clearRecords, clearProfile, getProfile, getRecords } from '../core/Storage.js';

/**
 * window.Debug 객체를 초기화합니다.
 * @param {{ cardMap: Map, gs: object, makeCard: function, sync: function }} ctx
 */
export function initDebug({ cardMap, gs, makeCard, sync }) {
  window.Debug = {

    // ── 계정 / 데이터 ──────────────────────────────────────────

    /**
     * 전체 초기화 (프로필 + 기록 + 승리수) 후 새로고침
     * @example Debug.resetAll()
     */
    resetAll() {
      if (!confirm('[Debug] 프로필과 모든 기록을 초기화합니다. 계속하시겠습니까?')) return;
      clearAll();
      console.log('%c[Debug] 전체 초기화 완료 → 새로고침', 'color:#ff6666');
      location.reload();
    },

    /**
     * 게임 기록 + 승리수만 초기화 (프로필 이름은 유지) 후 새로고침
     * @example Debug.resetRecords()
     */
    resetRecords() {
      clearRecords();
      console.log('%c[Debug] 게임 기록 초기화 완료 → 새로고침', 'color:#ff9944');
      location.reload();
    },

    /**
     * 프로필만 삭제 (기록 유지) 후 새로고침
     * @example Debug.resetProfile()
     */
    resetProfile() {
      clearProfile();
      console.log('%c[Debug] 프로필 초기화 완료 → 새로고침', 'color:#ff9944');
      location.reload();
    },

    /** 저장된 프로필 + 기록 요약 출력 */
    showData() {
      const profile = getProfile();
      const records = getRecords();
      console.log('[Debug] 프로필:', profile);
      console.log(`[Debug] 게임 기록: 총 ${records.length}건`);
      if (records.length > 0) {
        const sorted = [...records].sort((a, b) => b.vp - a.vp);
        console.table(sorted.slice(0, 10).map((r, i) => ({
          순위: `#${i + 1}`, 날짜: r.date, 승점: r.vp, 턴: r.turns,
        })));
      }
    },

    // ── 게임 내 상태 조작 ──────────────────────────────────────

    /**
     * 덱 맨 위에 카드 추가
     * @example Debug.addCard('smithy')
     * @example Debug.addCard('gold', 3)
     */
    addCard(id, n = 1) {
      const def = cardMap.get(id);
      if (!def) {
        console.warn(`[Debug] 카드 없음: "${id}"`);
        console.log('[Debug] 사용 가능한 ID:', [...cardMap.keys()].join(', '));
        return;
      }
      for (let i = 0; i < n; i++) {
        const card = makeCard(def);
        card.area = 'deck';
        gs.deck.unshift(card);
      }
      sync();
      console.log(`[Debug] "${def.name}" ×${n} 덱 추가 (덱 총 ${gs.deck.length}장)`);
    },

    /**
     * 핸드에 카드 즉시 추가 (앞면)
     * @example Debug.addToHand('witch', 2)
     */
    addToHand(id, n = 1) {
      const def = cardMap.get(id);
      if (!def) {
        console.warn(`[Debug] 카드 없음: "${id}"`);
        return;
      }
      for (let i = 0; i < n; i++) {
        const card = makeCard(def);
        card.area              = 'hand';
        card.isFaceUp          = true;
        card.frontFace.visible = true;
        card.backFace.visible  = false;
        gs.hand.push(card);
      }
      sync();
      console.log(`[Debug] "${def.name}" ×${n} 핸드 추가 (핸드 총 ${gs.hand.length}장)`);
    },

    /** 카드 ID · 이름 · 비용 전체 목록 출력 */
    listCards() {
      const rows = [...cardMap.entries()].map(([id, d]) => ({
        id, 이름: d.name ?? '', 타입: d.type ?? '', 비용: d.cost ?? 0,
      }));
      console.table(rows);
    },

    /** 코인 직접 세팅 */
    setCoins(n)   { gs.coins   = n; sync(); console.log(`[Debug] coins = ${n}`); },
    /** 행동 수 직접 세팅 */
    setActions(n) { gs.actions = n; sync(); console.log(`[Debug] actions = ${n}`); },
    /** 구매 수 직접 세팅 */
    setBuys(n)    { gs.buys    = n; sync(); console.log(`[Debug] buys = ${n}`); },
    /** 승점 직접 세팅 */
    setVP(n)      { gs.vp      = n; sync(); console.log(`[Debug] vp = ${n}`); },
    /** 턴 직접 세팅 */
    setTurn(n)    { gs.turn    = n; sync(); console.log(`[Debug] turn = ${n}`); },
    /** 목표 승점 직접 세팅 */
    setTarget(n)  { gs.vpTarget = n; sync(); console.log(`[Debug] vpTarget = ${n}`); },

    /**
     * 즉시 게임 승리 (승점을 목표치로 설정 후 턴 종료)
     * @example Debug.winGame()
     */
    winGame() {
      gs.vp = gs.vpTarget;
      sync();
      gs.onEndTurn?.();
      console.log(`%c[Debug] 즉시 승리 트리거 (목표 승점 ${gs.vpTarget})`, 'color:#44ff88');
    },

    /** 현재 게임 상태 요약 출력 */
    showState() {
      console.table({
        turn: gs.turn, phase: gs.phase,
        actions: gs.actions, buys: gs.buys, coins: gs.coins,
        vp: gs.vp, vpTarget: gs.vpTarget,
        deck: gs.deck.length, hand: gs.hand.length,
        play: gs.play.length, discard: gs.discard.length,
      });
      console.log('hand:', gs.hand.map(c => c.def.name));
    },

    /** 덱 전체를 핸드로 드로우 */
    drawAll() {
      while (gs.deck.length > 0) {
        const card = gs.deck.shift();
        card.area              = 'hand';
        card.isFaceUp          = true;
        card.frontFace.visible = true;
        card.backFace.visible  = false;
        gs.hand.push(card);
      }
      sync();
      console.log(`[Debug] 덱 전체 드로우 → 핸드 ${gs.hand.length}장`);
    },

    /** 명령 목록 출력 */
    help() {
      console.log(
        '%c[Debug] 명령 목록\n\n' +
        '%c── 계정 / 데이터 ──────────────────────────\n' +
        '  Debug.resetAll()          — 전체 초기화 (프로필+기록) 후 새로고침\n' +
        '  Debug.resetRecords()      — 게임 기록만 초기화 후 새로고침\n' +
        '  Debug.resetProfile()      — 프로필만 삭제 후 새로고침\n' +
        '  Debug.showData()          — 저장된 프로필·기록 요약 출력\n\n' +
        '── 게임 상태 조작 ──────────────────────────\n' +
        '  Debug.addCard(id, n=1)    — 덱 맨 위에 카드 n장 추가\n' +
        '  Debug.addToHand(id, n=1)  — 핸드에 카드 n장 즉시 추가\n' +
        '  Debug.listCards()         — 전체 카드 ID 테이블 출력\n' +
        '  Debug.setCoins(n)         — 코인 세팅\n' +
        '  Debug.setActions(n)       — 행동 세팅\n' +
        '  Debug.setBuys(n)          — 구매 세팅\n' +
        '  Debug.setVP(n)            — 승점 세팅\n' +
        '  Debug.setTurn(n)          — 턴 세팅\n' +
        '  Debug.setTarget(n)        — 목표 승점 세팅\n' +
        '  Debug.winGame()           — 즉시 승리 트리거\n' +
        '  Debug.showState()         — 게임 상태 요약 출력\n' +
        '  Debug.drawAll()           — 덱 전체 핸드로 드로우',
        'color:#7ecfff;font-weight:bold',
        'color:#aaaaaa'
      );
    },
  };

  console.log('%c[Debug] 디버그 API 준비 완료 — Debug.help() 로 명령 목록 확인', 'color:#7ecfff');
}
