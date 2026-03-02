// ============================================================
// ui/CardActionHandler.js — 카드 플레이 · 구매 · 효과 핸들러
//
// 사용:
//   const { onPlayCard, onBuyCard } = createCardActionHandler({
//     gs, lUI, makeCard, sync, drawCardsVisual, onVictory,
//   })
// ============================================================

import { playCard, buyCard, gainCard, drawCards, checkVictory } from '../core/TurnEngine.js';
import { AREAS }                    from '../config.js';
import { notifyBlocked }            from './scene.js';
import { showCardSelectOverlay } from './CardSelectOverlay.js';

// ── 유틸: 카드 폐기 (hand → trash) ──────────────────────────
function _trashCard(gs, card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return;
  gs.hand.splice(idx, 1);
  card.area              = AREAS.TRASH;
  card.isFaceUp          = true;
  card.frontFace.visible = true;
  card.backFace.visible  = false;
  gs.trash.push(card);
}

// ── 유틸: 카드 버리기 (hand → discard) ───────────────────────
function _discardCard(gs, card) {
  const idx = gs.hand.indexOf(card);
  if (idx === -1) return;
  gs.hand.splice(idx, 1);
  card.area              = AREAS.DISCARD;
  card.isFaceUp          = true;
  card.frontFace.visible = true;
  card.backFace.visible  = false;
  gs.discard.push(card);
}

/**
 * @param {{
 *   gs: object,
 *   lUI: PIXI.Container,
 *   makeCard: function,
 *   sync: function,
 *   drawCardsVisual: function,
 *   onVictory: function,
 * }} ctx
 */
export function createCardActionHandler({ gs, lUI, makeCard, sync, drawCardsVisual, onVictory }) {

  // ──────────────────────────────────────────────────────────
  // pendingGain — workshop, artisan step2 등
  // ──────────────────────────────────────────────────────────
  function _handleGainCard({ maxCost, dest = 'discard' }) {
    const items = [...gs.supply.values()].filter(({ def, count }) =>
      def.cost <= maxCost && count > 0,
    );
    showCardSelectOverlay(lUI, {
      title:         '카드 획득',
      subtitle:      `비용 ${maxCost} 이하 카드를 선택하세요`,
      items,
      mode:          'single',
      showStockBadge: true,
      allowDetail:   true,
      cancelLabel:   '취소 (아무것도 획득 안 함)',
      onConfirm: ([item]) => { gainCard(gs, item.def, makeCard, dest); sync(); },
      onCancel:  sync,
    });
  }

  // ──────────────────────────────────────────────────────────
  // pendingDiscard — cellar(drawAfter), poacher(exact N)
  // ──────────────────────────────────────────────────────────
  function _handleDiscardSelect(pd) {
    showCardSelectOverlay(lUI, {
      title:    '저장고',
      subtitle: '버릴 카드를 선택하세요 (0장 이상)',
      items:    [...gs.hand],
      mode:     'multi',
      minCount: 0,
      confirmLabel: (n) => n === 0 ? '건너뛰기 (0장)' : `${n}장 버리고 ${n}장 뽑기`,
      onConfirm: (selectedCards) => {
        for (const card of selectedCards) _discardCard(gs, card);
        const drawN = selectedCards.length;
        sync();
        if (pd.drawAfter && drawN > 0) drawCardsVisual(drawN);
      },
      onCancel: sync,
    });
  }

  // ──────────────────────────────────────────────────────────
  // pendingTrash — chapel(0~4장), moneylender(동전 1장 선택)
  // ──────────────────────────────────────────────────────────
  function _handleTrashSelect(pd) {
    const { type, maxCount = null, filter = null } = pd;

    const filterFn = filter === 'copper'
      ? (c) => c.def.id === 'copper'
      : null;

    const isOptional = (type === 'moneylender'); // 0장 허용

    showCardSelectOverlay(lUI, {
      title:       _trashTitles[type] ?? '카드 폐기',
      subtitle:    _trashSubtitles[type] ?? '폐기할 카드를 선택하세요',
      items:       [...gs.hand],
      mode:        'multi',
      maxCount,
      minCount:    isOptional ? 0 : 1,
      filter:      filterFn,
      confirmLabel: (n) => {
        if (type === 'chapel') return n === 0 ? '건너뛰기 (0장)' : `${n}장 폐기`;
        if (type === 'moneylender') return n === 0 ? '건너뛰기' : '동전 1장 폐기하고 코인 +3';
        return n === 0 ? '건너뛰기' : `${n}장 폐기`;
      },
      canConfirmEmpty: isOptional || (pd.maxCount !== undefined && pd.minCount === 0),
      onConfirm: (cards) => {
        for (const card of cards) _trashCard(gs, card);
        // moneylender: 동전 폐기 시 +3코인
        if (type === 'moneylender' && cards.length > 0) gs.coins += 3;
        sync();
      },
      onCancel: sync,
    });
  }

  const _trashTitles = {
    chapel:      '예배당',
    moneylender: '대금업자',
  };
  const _trashSubtitles = {
    chapel:      '폐기할 카드를 선택하세요 (최대 4장)',
    moneylender: '폐기할 동전 카드를 선택하세요 (선택사항)',
  };

  // ──────────────────────────────────────────────────────────
  // pendingDiscard (poacher 전용 — exact N장 버리기)
  // ──────────────────────────────────────────────────────────
  function _handlePoacherDiscard(pd) {
    const exact = pd.exact;
    if (exact === 0) { sync(); return; }

    showCardSelectOverlay(lUI, {
      title:    '밀렵꾼',
      subtitle: `빈 더미 ${exact}개 — 카드를 ${exact}장 버리세요`,
      items:    [...gs.hand],
      mode:     'multi',
      minCount: exact,
      maxCount: exact,
      canConfirmEmpty: false,
      confirmLabel: (n) => n < exact ? `${n}/${exact}장 선택` : `${exact}장 버리기`,
      onConfirm: (cards) => {
        for (const card of cards) _discardCard(gs, card);
        sync();
      },
      onCancel: sync,
    });
  }

  // ──────────────────────────────────────────────────────────
  // pendingPick — harbinger(버림더미→덱위), throne_room(액션 2회)
  // ──────────────────────────────────────────────────────────
  function _handlePickCard(pd) {
    const { type, source } = pd;

    const sourceItems = source === 'discard'
      ? [...gs.discard]
      : [...gs.hand].filter((c) => c.def.type === 'Action');

    if (sourceItems.length === 0) { sync(); return; }

    const cfg = _pickConfigs[type];

    showCardSelectOverlay(lUI, {
      title:       cfg.title,
      subtitle:    cfg.subtitle,
      items:       sourceItems,
      mode:        'single',
      cancelLabel: cfg.cancelLabel,
      allowDetail: true,
      onConfirm: ([card]) => _handlePickConfirm(pd, card),
      onCancel:  sync,
    });
  }

  const _pickConfigs = {
    harbinger: {
      title:       '선구자',
      subtitle:    '덱 위에 놓을 카드를 선택하세요',
      cancelLabel: '건너뛰기 (아무것도 안 함)',
    },
    throne_room: {
      title:       '알현실',
      subtitle:    '두 번 사용할 액션 카드를 선택하세요',
      cancelLabel: null,
    },
  };

  function _handlePickConfirm(pd, card) {
    if (pd.type === 'harbinger') {
      // 버림더미에서 덱 위로
      const idx = gs.discard.indexOf(card);
      if (idx !== -1) {
        gs.discard.splice(idx, 1);
        card.area = AREAS.DECK;
        gs.deck.push(card);   // push = 덱 맨 위 (pop으로 꺼냄)
      }
      sync();
    } else if (pd.type === 'throne_room') {
      // 선택된 액션 카드 효과 추가 1회 실행 (단순 토큰만: draw/action/buy/coin)
      const tokens = (card.def.effectCode ?? '').split('|').map(s => s.trim());
      for (const token of tokens) {
        const [key, val] = token.split(':');
        const n = val ? parseInt(val, 10) : 1;
        if (key === 'draw')   drawCards(gs, n);
        if (key === 'action') gs.actions += n;
        if (key === 'buy')    gs.buys    += n;
        if (key === 'coin')   gs.coins   += n;
      }
      sync();
    }
  }

  // ──────────────────────────────────────────────────────────
  // pendingTwoStep — remodel, mine, artisan
  // ──────────────────────────────────────────────────────────
  function _handleTwoStep(pd) {
    const { type } = pd;

    if (type === 'remodel') _handleRemodelStep1();
    else if (type === 'mine')    _handleMineStep1();
    else if (type === 'artisan') _handleArtisanStep1();
  }

  // ── Remodel: step1 = 손패 1장 폐기 → step2 = supply에서 획득 ──
  function _handleRemodelStep1() {
    if (gs.hand.length === 0) { sync(); return; }

    showCardSelectOverlay(lUI, {
      title:    '개조',
      subtitle: '폐기할 카드를 선택하세요',
      items:    [...gs.hand],
      mode:     'single',
      allowDetail: true,
      onConfirm: ([card]) => {
        const trashCost = card.def.cost;
        _trashCard(gs, card);
        _handleRemodelStep2(trashCost);
      },
      onCancel: sync,
    });
  }

  function _handleRemodelStep2(trashCost) {
    const maxCost = trashCost + 2;
    const items = [...gs.supply.values()].filter(({ def, count }) =>
      def.cost <= maxCost && count > 0,
    );
    if (items.length === 0) { sync(); return; }

    showCardSelectOverlay(lUI, {
      title:         '개조',
      subtitle:      `비용 ${maxCost} 이하 카드를 획득하세요`,
      items,
      mode:          'single',
      showStockBadge: true,
      allowDetail:   true,
      cancelLabel:   '건너뛰기 (획득 안 함)',
      onConfirm: ([item]) => { gainCard(gs, item.def, makeCard, 'discard'); sync(); },
      onCancel: sync,
    });
  }

  // ── Mine: step1 = 보물 카드 폐기 → step2 = 보물 카드 획득(손으로) ──
  function _handleMineStep1() {
    const treasures = gs.hand.filter((c) => c.def.type === 'Treasure');
    if (treasures.length === 0) { sync(); return; }

    showCardSelectOverlay(lUI, {
      title:    '광산',
      subtitle: '폐기할 보물 카드를 선택하세요',
      items:    treasures,
      mode:     'single',
      allowDetail: true,
      cancelLabel: '건너뛰기',
      onConfirm: ([card]) => {
        const trashCost = card.def.cost;
        _trashCard(gs, card);
        _handleMineStep2(trashCost);
      },
      onCancel: sync,
    });
  }

  function _handleMineStep2(trashCost) {
    const maxCost = trashCost + 3;
    const items = [...gs.supply.values()].filter(({ def, count }) =>
      def.type === 'Treasure' && def.cost <= maxCost && count > 0,
    );
    if (items.length === 0) { sync(); return; }

    showCardSelectOverlay(lUI, {
      title:         '광산',
      subtitle:      `비용 ${maxCost} 이하 보물 카드를 손으로 가져오세요`,
      items,
      mode:          'single',
      showStockBadge: true,
      allowDetail:   true,
      onConfirm: ([item]) => { gainCard(gs, item.def, makeCard, 'hand'); sync(); },
      onCancel: sync,
    });
  }

  // ── Artisan: step1 = supply ≤5 획득→손 → step2 = 손패 1장 덱위 ──
  function _handleArtisanStep1() {
    const items = [...gs.supply.values()].filter(({ def, count }) =>
      def.cost <= 5 && count > 0,
    );
    if (items.length === 0) { sync(); return; }

    showCardSelectOverlay(lUI, {
      title:         '장인',
      subtitle:      '비용 5 이하 카드를 손으로 가져오세요',
      items,
      mode:          'single',
      showStockBadge: true,
      allowDetail:   true,
      onConfirm: ([item]) => {
        gainCard(gs, item.def, makeCard, 'hand');
        _handleArtisanStep2();
      },
      onCancel: sync,
    });
  }

  function _handleArtisanStep2() {
    if (gs.hand.length === 0) { sync(); return; }

    showCardSelectOverlay(lUI, {
      title:    '장인',
      subtitle: '덱 위에 놓을 카드를 선택하세요',
      items:    [...gs.hand],
      mode:     'single',
      allowDetail: true,
      onConfirm: ([card]) => {
        const idx = gs.hand.indexOf(card);
        if (idx !== -1) {
          gs.hand.splice(idx, 1);
          card.area = AREAS.DECK;
          gs.deck.push(card);   // push = 맨 위
        }
        sync();
      },
      onCancel: sync,
    });
  }

  // ──────────────────────────────────────────────────────────
  // onPlayCard — 카드 플레이 + pending 효과 처리
  // ──────────────────────────────────────────────────────────
  function onPlayCard(card) {
    const result = playCard(gs, card);
    if (!result.ok) {
      if (result.reason === 'no_actions') notifyBlocked('action');
      return;
    }
    gs.phase = gs.actions > 0 ? 'action' : 'buy';
    sync();

    // 액션으로 드로우된 카드 flip
    gs.hand.forEach((c, i) => {
      if (!c.isFaceUp) {
        c.frontFace.visible = false;
        c.backFace.visible  = true;
        setTimeout(() => c.flip(), 150 + i * 70);
      }
    });

    // pending 효과 처리 (한 번에 하나만 처리)
    if (gs.pendingGain) {
      const pd = gs.pendingGain;
      gs.pendingGain = null;
      _handleGainCard(pd);
      return;
    }
    if (gs.pendingDiscard) {
      const pd = gs.pendingDiscard;
      gs.pendingDiscard = null;
      if (pd.type === 'poacher') _handlePoacherDiscard(pd);
      else                       _handleDiscardSelect(pd);
      return;
    }
    if (gs.pendingTrash) {
      const pd = gs.pendingTrash;
      gs.pendingTrash = null;
      _handleTrashSelect(pd);
      return;
    }
    if (gs.pendingPick) {
      const pd = gs.pendingPick;
      gs.pendingPick = null;
      _handlePickCard(pd);
      return;
    }
    if (gs.pendingTwoStep) {
      const pd = gs.pendingTwoStep;
      gs.pendingTwoStep = null;
      _handleTwoStep(pd);
      return;
    }
  }

  // ──────────────────────────────────────────────────────────
  // onBuyCard — 시장에서 카드 구매
  // ──────────────────────────────────────────────────────────
  function onBuyCard(def) {
    const result = buyCard(gs, def, makeCard);
    if (!result.ok) {
      if (result.reason === 'no_buys')             notifyBlocked('buy');
      else if (result.reason === 'out_of_stock')   notifyBlocked('buy');
      else if (result.reason === 'insufficient_coins') notifyBlocked('coin');
      return;
    }
    gs.phase = 'buy';
    sync();

    if (checkVictory(gs.supply) || gs.vp >= gs.vpTarget) onVictory();
  }

  return { onPlayCard, onBuyCard };
}
