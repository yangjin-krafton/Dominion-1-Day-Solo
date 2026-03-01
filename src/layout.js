// ============================================================
// layout.js — 카드 영역별 위치 계산
// ============================================================
import {
  AREAS,
  SCREEN_W as W, SCREEN_H as H,
  CARD_W as CW, CARD_H as CH,
  STACK_SCALE, GALLERY_SCALE,      // config에서 일괄 관리
} from './config.js';

// ── 고정 위치 상수 ──────────────────────────────────────────
const DECK_X    = 34;
const DECK_Y    = 82;
const DISCARD_X = W - 34 - Math.round(CW * STACK_SCALE);
const DISCARD_Y = 82;

const PLAY_Y      = Math.round(H * 0.47 - CH / 2);  // ~342
const PLAY_SPACE  = CW + 8;

const HAND_Y      = H - 52 - 8 - CH;                // ~676
const HAND_BOW    = 3;     // 부채꼴 호 굴곡 (px/step)
const HAND_ANGLE  = 0.04;  // 부채꼴 기울기 (rad/step)

/**
 * 전체 카드 위치 업데이트 (매 드로우·플레이·종료 후 호출)
 * @param {object} gs - gameState { deck, hand, play, discard, cardsContainer }
 */
export function updateCardPositions(gs) {
  const { deck, hand, play, discard } = gs;

  // ── 덱 파일 (왼쪽 상단) ──────────────────────────────────
  deck.forEach((card, i) => {
    card.area = AREAS.DECK;
    const off = Math.min(i * 0.3, 4);
    card.moveTo(DECK_X + off, DECK_Y + off, 0, STACK_SCALE);
    card.container.zIndex = i;
  });

  // ── 버림 더미 (오른쪽 상단) ──────────────────────────────
  discard.forEach((card, i) => {
    card.area = AREAS.DISCARD;
    const off = Math.min(i * 0.3, 4);
    const rot = (Math.random() - 0.5) * 0.1;
    card.moveTo(DISCARD_X + off, DISCARD_Y + off, rot, STACK_SCALE);
    card.container.zIndex = 20 + i;
  });

  // ── 플레이 영역 (화면 중앙) ──────────────────────────────
  const playTotalW  = play.length * PLAY_SPACE - 8;
  const playStartX  = (W - playTotalW) / 2;
  play.forEach((card, i) => {
    card.area = AREAS.PLAY;
    card.moveTo(playStartX + i * PLAY_SPACE, PLAY_Y, 0, 1);
    card.container.zIndex = 50 + i;
  });

  // ── 손패 (하단 부채꼴) ───────────────────────────────────
  const spacing    = Math.min(CW + 8, (W - 40) / Math.max(1, hand.length));
  const totalHandW = spacing * (hand.length - 1);
  const handStartX = (W - totalHandW) / 2 - CW / 2;
  const mid        = (hand.length - 1) / 2;

  hand.forEach((card, i) => {
    card.area = AREAS.HAND;
    const angle = (i - mid) * HAND_ANGLE;
    const bow   = Math.abs(i - mid) * HAND_BOW;
    card.moveTo(
      handStartX + i * spacing,
      HAND_Y + bow,
      angle,
      card.hovered ? 1.15 : 1,
    );
    card.container.zIndex = 100 + i;
  });

  gs.cardsContainer?.sortChildren();
}

// ─── 갤러리 레이아웃 ─────────────────────────────────────────
// GALLERY_SCALE은 config.js에서 import — 여기서는 사용만 함
const GALLERY_GAP_X   = 8;
const GALLERY_GAP_Y   = 12;
const GALLERY_MARGIN  = 10;
const GALLERY_START_Y = 62;

// 화면 너비에서 최대 배치 가능 열 수 자동 계산
const _gCW    = Math.round(CW * GALLERY_SCALE);
const GALLERY_COLS = Math.floor(
  (W - GALLERY_MARGIN * 2 + GALLERY_GAP_X) / (_gCW + GALLERY_GAP_X)
); // 390px 기준 → 4열

/**
 * 카드 배열을 그리드로 배치 (비주얼 테스트용)
 * @param {Card[]} cards
 * @param {PIXI.Container} container
 */
export function layoutGallery(cards, container) {
  const cw = _gCW;
  const ch = Math.round(CH * GALLERY_SCALE);
  const totalW = GALLERY_COLS * cw + (GALLERY_COLS - 1) * GALLERY_GAP_X;
  const startX = Math.round((W - totalW) / 2);

  cards.forEach((card, i) => {
    const col = i % GALLERY_COLS;
    const row = Math.floor(i / GALLERY_COLS);
    const x   = startX + col * (cw + GALLERY_GAP_X);
    const y   = GALLERY_START_Y + row * (ch + GALLERY_GAP_Y);

    card.moveTo(x, y, 0, GALLERY_SCALE);
    card.container.x = x;
    card.container.y = y;
    card.container.scale.set(GALLERY_SCALE);
    card.container.zIndex = i;
  });

  container?.sortChildren();
}
