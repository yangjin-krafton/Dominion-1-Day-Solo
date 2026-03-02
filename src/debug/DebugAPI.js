// ============================================================
// debug/DebugAPI.js — 콘솔 디버그 API (개발 전용)
//
// 사용:
//   initDebug({ cardMap, gs, makeCard, sync })
//
// 브라우저 콘솔에서:
//   Debug.help()  — 명령 목록 확인
// ============================================================

/**
 * window.Debug 객체를 초기화합니다.
 * @param {{ cardMap: Map, gs: object, makeCard: function, sync: function }} ctx
 */
export function initDebug({ cardMap, gs, makeCard, sync }) {
  window.Debug = {
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
      console.log(`[Debug] "${def.name_ko ?? def.name}" ×${n} 덱 추가 (덱 총 ${gs.deck.length}장)`);
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
      console.log(`[Debug] "${def.name_ko ?? def.name}" ×${n} 핸드 추가 (핸드 총 ${gs.hand.length}장)`);
    },

    /** 카드 ID · 이름 · 비용 전체 목록 출력 */
    listCards() {
      const rows = [...cardMap.entries()].map(([id, d]) => ({
        id,
        이름: d.name_ko ?? d.name ?? '',
        타입: d.type ?? '',
        비용: d.cost ?? 0,
      }));
      console.table(rows);
    },

    /** 코인 직접 세팅 */
    setCoins(n)   { gs.coins   = n; sync(); console.log(`[Debug] coins = ${n}`); },
    /** 행동 수 직접 세팅 */
    setActions(n) { gs.actions = n; sync(); console.log(`[Debug] actions = ${n}`); },
    /** 구매 수 직접 세팅 */
    setBuys(n)    { gs.buys    = n; sync(); console.log(`[Debug] buys = ${n}`); },

    /** 현재 게임 상태 요약 출력 */
    showState() {
      console.table({
        turn: gs.turn, phase: gs.phase,
        actions: gs.actions, buys: gs.buys, coins: gs.coins, vp: gs.vp,
        deck: gs.deck.length, hand: gs.hand.length,
        play: gs.play.length, discard: gs.discard.length,
      });
      console.log('hand:', gs.hand.map(c => c.def.name_ko ?? c.def.name));
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
        '[Debug] 명령 목록\n' +
        '  Debug.addCard(id, n=1)    — 덱 맨 위에 카드 n장 추가\n' +
        '  Debug.addToHand(id, n=1)  — 핸드에 카드 n장 즉시 추가\n' +
        '  Debug.listCards()         — 전체 카드 ID 테이블 출력\n' +
        '  Debug.setCoins(n)         — 코인 세팅\n' +
        '  Debug.setActions(n)       — 행동 세팅\n' +
        '  Debug.setBuys(n)          — 구매 세팅\n' +
        '  Debug.showState()         — 게임 상태 요약 출력\n' +
        '  Debug.drawAll()           — 덱 전체 핸드로 드로우\n' +
        '  Debug.help()              — 이 도움말'
      );
    },
  };

  console.log('%c[Debug] 디버그 API 준비 완료 — Debug.help() 로 명령 목록 확인', 'color:#7ecfff');
}
