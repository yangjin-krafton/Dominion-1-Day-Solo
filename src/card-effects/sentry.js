// ============================================================
// card-effects/sentry.js — 보초병: 덱 위 2장 공개 → 버리기/폐기/덱위 복귀
//
// pendingPick: { type: 'sentry' }
//
// 처리 흐름 (draw:1|action:1 토큰 실행 후):
//   1. 덱 맨 위 최대 2장 꺼냄 (revealed[])
//   2. 〔1/3〕 폐기 선택   — multi, 건너뛰기 가능
//   3. 〔2/3〕 버리기 선택 — multi, 건너뛰기 가능 (남은 카드 중)
//   4. 〔3/3〕 덱 위 순서  — 남은 카드가 2장일 때만 (맨 위에 올릴 1장 선택)
//   5. 남은 카드 → 덱 위에 복귀 (선택 순서대로)
// ============================================================
import { AREAS }                 from '../config.js';
import { shuffle }               from '../core/TurnEngine.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { SFX }                   from '../asset/audio/sfx.js';

export function handleSentry(_pd, ctx) {
  const { gs, lUI, sync, dispatchPending } = ctx;
  const done = () => { if (!dispatchPending()) sync(); };

  // ── 덱 위 최대 2장 꺼내기 (필요 시 셔플) ─────────────────
  const revealed = [];
  for (let i = 0; i < 2; i++) {
    if (gs.deck.length === 0) {
      if (gs.discard.length === 0) break;
      gs.deck    = [...gs.discard];
      gs.discard = [];
      SFX.shuffle();
      shuffle(gs.deck);
      gs.deck.forEach(c => { c.area = AREAS.DECK; });
    }
    if (gs.deck.length === 0) break;
    revealed.push(gs.deck.pop());
  }

  if (revealed.length === 0) { done(); return; }

  // ── 헬퍼: 카드 → 폐기더미 ────────────────────────────────
  function _toTrash(c) {
    c.area              = AREAS.TRASH;
    c.isFaceUp          = true;
    c.frontFace.visible = true;
    c.backFace.visible  = false;
    gs.trash.push(c);
  }

  // ── 헬퍼: 카드 → 버림더미 ────────────────────────────────
  function _toDiscard(c) {
    c.area              = AREAS.DISCARD;
    c.isFaceUp          = true;
    c.frontFace.visible = true;
    c.backFace.visible  = false;
    gs.discard.push(c);
  }

  // ── 헬퍼: 카드 → 덱 위 ───────────────────────────────────
  function _toDeck(c) {
    c.area              = AREAS.DECK;
    c.isFaceUp          = false;
    c.frontFace.visible = false;
    c.backFace.visible  = true;
    gs.deck.push(c);  // push = 맨 위 (pop으로 꺼냄)
  }

  // ── 〔3/3〕 덱 위 순서 결정 ───────────────────────────────
  function _stageOrder(remaining) {
    if (remaining.length === 0) { sync(); done(); return; }

    if (remaining.length === 1) {
      _toDeck(remaining[0]);
      sync();
      done();
      return;
    }

    // 2장 남은 경우: 맨 위에 올릴 카드 1장 선택
    showCardSelectOverlay(lUI, {
      title:       '보초병 〔3/3〕',
      effectDesc:  '남은 카드를 원하는 순서로 덱 위에 다시 놓습니다',
      subtitle:    '덱 맨 위(다음에 드로우될)에 올릴 카드를 탭하세요',
      items:       remaining,
      mode:        'single',
      maxCardW:    160,
      allowDetail: true,
      onConfirm: ([topCard]) => {
        const bottomCard = remaining.find(c => c !== topCard);
        // 아래 카드를 먼저 push → 위 카드 push (pop하면 위 카드가 먼저 나옴)
        _toDeck(bottomCard);
        _toDeck(topCard);
        sync();
        done();
      },
    });
  }

  // ── 〔2/3〕 버리기 선택 ───────────────────────────────────
  function _stageDiscard(remaining) {
    if (remaining.length === 0) { done(); return; }

    showCardSelectOverlay(lUI, {
      title:       '보초병 〔2/3〕',
      effectDesc:  '버린 카드는 버림더미로 — 나중에 덱에 섞입니다',
      subtitle:    '버릴 카드를 선택하세요 (없으면 건너뛰기)',
      items:       remaining,
      mode:        'multi',
      minCount:    0,
      confirmLabel:(n) => n > 0 ? `${n}장 버리기` : '버리지 않고 다음 →',
      allowDetail: true,
      onConfirm: (selected) => {
        selected.forEach(_toDiscard);
        const afterDiscard = remaining.filter(c => !selected.includes(c));
        _stageOrder(afterDiscard);
      },
    });
  }

  // ── 〔1/3〕 폐기 선택 ─────────────────────────────────────
  showCardSelectOverlay(lUI, {
    title:       '보초병 〔1/3〕',
    effectDesc:  `덱 위 ${revealed.length}장 공개 — 폐기된 카드는 게임에서 완전히 제거됩니다`,
    subtitle:    '폐기할 카드를 선택하세요 (없으면 건너뛰기)',
    items:       revealed,
    mode:        'multi',
    minCount:    0,
    confirmLabel:(n) => n > 0 ? `${n}장 폐기하기` : '폐기 없이 다음 →',
    allowDetail: true,
    onConfirm: (selected) => {
      selected.forEach(_toTrash);
      const afterTrash = revealed.filter(c => !selected.includes(c));
      _stageDiscard(afterTrash);
    },
  });
}
