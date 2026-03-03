// ============================================================
// card-effects/library.js — 도서관: 손패 7장까지 뽑기 (액션 제외 가능)
//
// pendingPick: { type: 'library' }
//
// 처리 흐름:
//   손패 < 7장이고 덱에 카드가 있는 동안 반복:
//     덱 맨 위 카드 공개
//       비액션 → 바로 손패로 드로우 모션 후 다음 스텝
//       액션   → 오버레이 "손에 들기 / 제외" 선택
//   제외한 카드는 뽑기 종료 후 전부 버림더미로
// ============================================================
import { AREAS }                 from '../config.js';
import { shuffle }               from '../core/TurnEngine.js';
import { showCardSelectOverlay } from '../ui/CardSelectOverlay.js';
import { SFX }                   from '../asset/audio/sfx.js';

const FLIP_MS  = 350;  // flip 애니메이션(0.3s) + 여유
const AFTER_MS = 480;  // flip 완료 후 다음 스텝 대기

export function handleLibrary(_pd, ctx) {
  const { gs, lUI, sync, dispatchPending } = ctx;
  const setAside = [];   // 제외(skip) 선택한 액션 카드 임시 보관

  // ── 뽑기 루프 종료 ───────────────────────────────────────
  function _finish() {
    // 제외 카드 → 버림더미 (원상복구 + 상태 반영)
    for (const c of setAside) {
      c.alpha                = 1;
      c.area                 = AREAS.DISCARD;
      c.isFaceUp             = true;
      c.frontFace.visible    = true;
      c.backFace.visible     = false;
      gs.discard.push(c);
    }
    if (!dispatchPending()) sync();
  }

  // ── 1스텝: 카드 1장 처리 ─────────────────────────────────
  function _step() {
    // 종료 조건: 손패 7장 이상
    if (gs.hand.length >= 7) { _finish(); return; }

    // 덱이 비면 버림더미 셔플 (set-aside 카드는 포함하지 않음)
    if (gs.deck.length === 0) {
      if (gs.discard.length === 0) { _finish(); return; }
      gs.deck    = [...gs.discard];
      gs.discard = [];
      SFX.shuffle();
      shuffle(gs.deck);
      gs.deck.forEach(c => { c.area = AREAS.DECK; });
    }
    if (gs.deck.length === 0) { _finish(); return; }

    const card = gs.deck.pop();
    // card.area 는 여전히 AREAS.DECK — 덱 더미 위치에 시각적으로 유지됨

    // ── 비액션 카드: 일반 드로우 모션 ────────────────────────
    if (card.def.type !== 'Action') {
      gs.hand.push(card);
      card.area              = AREAS.HAND;
      card.isFaceUp          = false;
      card.frontFace.visible = false;
      card.backFace.visible  = true;
      SFX.drawCard();
      sync();  // 덱 위치 → 손패 위치 lerp 시작
      setTimeout(() => {
        card.flip(0.3, sync);
        setTimeout(_step, AFTER_MS);
      }, 180);
      return;
    }

    // ── 액션 카드: 덱 위치에서 앞면 공개 → 오버레이 선택 ────
    SFX.drawCard();
    card.flip();  // 덱 더미 위치에서 뒤집기 (0.3s)
    sync();

    setTimeout(() => {
      showCardSelectOverlay(lUI, {
        title:       '도서관',
        effectDesc:  `액션 카드 「${card.def.name}」이(가) 공개되었습니다`,
        subtitle:    '손에 넣거나, 제외(뽑기 후 버림)할 수 있습니다',
        items:       [card],
        mode:        'single',
        maxCardW:    160,
        confirmLabel:'손에 들기',
        cancelLabel: '제외하기 (뽑기 후 버림)',
        allowDetail: true,

        onConfirm: () => {
          // 손패로 이동 + 뒤집기 모션
          gs.hand.push(card);
          card.area              = AREAS.HAND;
          card.isFaceUp          = false;
          card.frontFace.visible = false;
          card.backFace.visible  = true;
          sync();  // 현재 위치(덱) → 손패 lerp
          setTimeout(() => {
            card.flip(0.3, sync);
            setTimeout(_step, AFTER_MS);
          }, 180);
        },

        onCancel: () => {
          // 제외: 숨겨두고 _finish 에서 버림더미로
          card.alpha = 0;
          setAside.push(card);
          _step();
        },
      });
    }, FLIP_MS);
  }

  _step();
}
