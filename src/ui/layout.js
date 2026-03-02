// ============================================================
// layout.js — 카드 영역별 위치 계산 (리뉴얼)
// ============================================================
import {
  AREAS,
  SCREEN_W as W,
  CARD_W   as CW,
  CARD_H   as CH,
  PILE_SCALE,
  ZONE,
  C,
} from '../config.js';

// ── 더미(Pile) 크기 & 5등분 컬럼 레이아웃 ───────────────────
// scene.js buildPileArea와 동일한 상수 (COL_M=4, COL_G=3)
const PW       = Math.round(CW * PILE_SCALE);
const PH       = Math.round(CH * PILE_SCALE);
const COL_M    = 4;
const COL_G    = 3;
const COL_W    = Math.floor((W - COL_M * 2 - COL_G * 4) / 5);  // 74px
const colX     = i => COL_M + i * (COL_W + COL_G);
const CARD_OFF = Math.floor((COL_W - PW) / 2);   // 5px (카드 중앙 정렬)

// 4개 더미 카드의 x 위치 (컬럼 0~3 내 중앙) — main.js에서도 import 가능
export const PILE_X  = [0, 1, 2, 3].map(i => colX(i) + CARD_OFF);  // 9, 86, 163, 240
export const PILE_Y  = ZONE.PILES_Y + 14;   // scene.js CARD_Y_OFF와 동일

// ── 핸드 상수 ────────────────────────────────────────────────
const HAND_START_Y  = ZONE.HAND_Y;
const HAND_SPACING  = CW + 8;              // 기본 그룹 간격
const HAND_MAX_VIS  = 4;                   // 한 번에 최대 표시 그룹 수
const ARROW_W       = 20;                  // 스크롤 방향 표시자 너비 (시각 전용)
const STACK_OFF     = 4;                   // 동일 카드 중첩 오프셋

// ─── 유틸: 카드 ID 기반 결정적 난수 (0~1) — 매 sync 지터 방지 ──────
// salt로 더미별 회전 분포를 분리
const _pileRand = (id, salt = 0) => ((id * 1337 + salt * 997) % 1000) / 1000;

// ─── 유틸: 중심 기준 회전 위치 보정 ────────────────────────────
// PixiJS pivot=(0,0)이라 기본은 좌상단 기준 회전.
// 카드 중심(PW/2, PH/2)이 화면 (cx, cy)에 고정된 채 회전하도록 container 위치를 보정.
// 수식: container.pos = center - R(rot) * (PW/2, PH/2)
const _centerRotPos = (cx, cy, rot) => {
  const hw = PW / 2, hh = PH / 2;
  const c = Math.cos(rot), s = Math.sin(rot);
  return { x: cx - hw * c + hh * s, y: cy - hw * s - hh * c };
};

// ─── 유틸: def.id 기준 그룹화 ────────────────────────────────
function _groupByDefId(cards) {
  const groups = [];
  const idx    = new Map();
  for (const card of cards) {
    const id = card.def.id;
    if (idx.has(id)) {
      groups[idx.get(id)].push(card);
    } else {
      idx.set(id, groups.length);
      groups.push([card]);
    }
  }
  return groups;
}

// ─── 핸드 스크롤 방향 표시자 빌드 (시각 전용, 인터랙션 없음) ─
/**
 * 드래그로 스크롤 가능함을 알리는 얇은 시각 표시자.
 * 실제 스크롤 제스처는 main.js의 stage-level 드래그 핸들러가 처리.
 * @param {PIXI.Container} layer
 * @returns {{ left: PIXI.Container, right: PIXI.Container }}
 */
export function buildHandArrows(layer) {
  function makeIndicator(dir, x) {
    const cont = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.beginFill(0x07050f, 0.6);
    bg.drawRect(0, 0, ARROW_W, CH);
    bg.endFill();
    cont.addChild(bg);

    const t = new PIXI.Text(dir === 'left' ? '‹' : '›', {
      fontSize: 16, fill: C.gold, fontWeight: 'bold',
    });
    t.anchor.set(0.5);
    t.x = ARROW_W / 2;
    t.y = CH / 2;
    cont.addChild(t);

    cont.x = x;
    cont.y = HAND_START_Y;
    cont.visible   = false;
    cont.eventMode = 'none';   // 시각 전용 — 이벤트 차단 없음
    layer.addChild(cont);
    return cont;
  }

  return {
    left:  makeIndicator('left',  0),
    right: makeIndicator('right', W - ARROW_W),
  };
}

// ─── 전체 카드 위치 업데이트 ─────────────────────────────────
/**
 * @param {object} gs - {deck, hand, play, discard, trash, cardsContainer,
 *                        handScroll, _handArrows}
 */
export function updateCardPositions(gs) {
  const { deck, hand, play, discard, trash = [] } = gs;

  // ══════════════════════════════════════════════════════════
  // 더미 영역 (3개 표시: 덱·버림·낸카드 / 추방은 화면 밖)
  // ══════════════════════════════════════════════════════════

  // ① 덱 (면 아래) — PILE 0 : 정렬된 중첩, 금색 테두리 살짝 노출
  deck.forEach((card, i) => {
    card.area = AREAS.DECK;
    card.setStackCount(0);   // 핸드에서 넘어온 배지 강제 숨김
    // 버림→덱 재활용 카드가 앞면 상태일 수 있으므로 강제 뒷면 보장
    if (card.isFaceUp) {
      card.isFaceUp          = false;
      card.frontFace.visible = false;
      card.backFace.visible  = true;
    }
    const off = Math.min(i * 0.8, 7);   // 균일 오프셋 → 뒤쪽 카드 테두리 노출
    card.moveTo(PILE_X[0] + off, PILE_Y + off, 0, PILE_SCALE);
    card.container.zIndex = i;
  });

  // ② 버림더미 (면 위) — PILE 1 : 불규칙 회전 중첩 (카드 중심 기준)
  discard.forEach((card, i) => {
    card.area = AREAS.DISCARD;
    card.setStackCount(0);
    const off = Math.min(i * 0.4, 4);
    const rot = (_pileRand(card.id, 1) - 0.5) * 0.55;
    const { x, y } = _centerRotPos(PILE_X[1] + off + PW / 2, PILE_Y + off + PH / 2, rot);
    card.moveTo(x, y, rot, PILE_SCALE);
    card.container.zIndex = 20 + i;
  });

  // ③ 낸카드더미 (플레이) — PILE 2 : 불규칙 회전 중첩 (카드 중심 기준)
  play.forEach((card, i) => {
    card.area = AREAS.PLAY;
    card.setStackCount(0);
    const off = Math.min(i * 0.4, 4);
    const rot = (_pileRand(card.id, 2) - 0.5) * 0.55;
    const { x, y } = _centerRotPos(PILE_X[2] + off + PW / 2, PILE_Y + off + PH / 2, rot);
    card.moveTo(x, y, rot, PILE_SCALE);
    card.container.zIndex = 40 + i;
  });

  // ④ 패기더미 — PILE 3 : 불규칙 회전 중첩 (카드 중심 기준)
  trash.forEach((card, i) => {
    card.area = AREAS.TRASH;
    card.setStackCount(0);
    const off = Math.min(i * 0.4, 4);
    const rot = (_pileRand(card.id, 3) - 0.5) * 0.55;
    const { x, y } = _centerRotPos(PILE_X[3] + off + PW / 2, PILE_Y + off + PH / 2, rot);
    card.moveTo(x, y, rot, PILE_SCALE);
    card.container.zIndex = 60 + i;
  });

  // ══════════════════════════════════════════════════════════
  // 핸드 카드 (그룹화 + 좌우 스크롤)
  // ══════════════════════════════════════════════════════════
  const handGroups   = _groupByDefId(hand);
  const totalGroups  = handGroups.length;
  const scrollOffset = Math.max(
    0,
    Math.min(gs.handScroll ?? 0, Math.max(0, totalGroups - HAND_MAX_VIS)),
  );
  gs.handScroll = scrollOffset;   // 범위 클램프 반영

  const needScroll  = totalGroups > HAND_MAX_VIS;
  const visGroups   = needScroll
    ? handGroups.slice(scrollOffset, scrollOffset + HAND_MAX_VIS)
    : handGroups;

  // 화살표 표시 갱신
  if (gs._handArrows) {
    gs._handArrows.left.visible  = needScroll && scrollOffset > 0;
    gs._handArrows.right.visible = needScroll && scrollOffset + HAND_MAX_VIS < totalGroups;
  }

  // 화면 밖 그룹 숨기기
  handGroups.forEach((group, gi) => {
    const inWindow = !needScroll
      || (gi >= scrollOffset && gi < scrollOffset + HAND_MAX_VIS);
    group.forEach(card => { card.container.visible = inWindow; });
  });

  // 보이는 그룹 배치
  const areaW  = needScroll ? (W - ARROW_W * 2 - 12) : (W - 16);
  const areaX  = needScroll ? (ARROW_W + 6)           : 8;
  const n      = visGroups.length;
  const spacing = n > 1
    ? Math.min(HAND_SPACING, (areaW - CW) / (n - 1))
    : 0;
  const totalW  = spacing * (n - 1) + CW;
  const startX  = areaX + (areaW - totalW) / 2;

  const dragOff = gs._handDragOffset ?? 0;

  visGroups.forEach((group, gIdx) => {
    const stackN = group.length;
    const baseX  = startX + gIdx * spacing;

    group.forEach((card, cIdx) => {
      const isTop = cIdx === stackN - 1;
      const off   = (stackN - 1 - cIdx) * STACK_OFF;

      card.area = AREAS.HAND;
      card.moveTo(baseX + off + dragOff, HAND_START_Y + off, 0, 1);
      card.container.zIndex    = 100 + gIdx * 20 + cIdx;
      card.container.eventMode = isTop ? 'static' : 'none';
      card.container.cursor    = isTop ? 'pointer' : 'default';
      card.setStackCount(isTop ? stackN : 0);
    });
  });

  gs.cardsContainer?.sortChildren();
}

// ─── 갤러리 레이아웃 (카드도감) ─────────────────────────────
const GALLERY_GAP_X   = 8;
const GALLERY_GAP_Y   = 12;
const GALLERY_MARGIN  = 10;
const GALLERY_START_Y = 70;
const GALLERY_SCALE_V = 0.77;

const _gCW    = Math.round(CW * GALLERY_SCALE_V);
const GALLERY_COLS = Math.floor(
  (W - GALLERY_MARGIN * 2 + GALLERY_GAP_X) / (_gCW + GALLERY_GAP_X),
);

export function layoutGallery(cards, container) {
  const cw = _gCW;
  const ch = Math.round(CH * GALLERY_SCALE_V);
  const totalW = GALLERY_COLS * cw + (GALLERY_COLS - 1) * GALLERY_GAP_X;
  const startX = Math.round((W - totalW) / 2);

  cards.forEach((card, i) => {
    const col = i % GALLERY_COLS;
    const row = Math.floor(i / GALLERY_COLS);
    const x   = startX + col * (cw + GALLERY_GAP_X);
    const y   = GALLERY_START_Y + row * (ch + GALLERY_GAP_Y);

    card.moveTo(x, y, 0, GALLERY_SCALE_V);
    card.container.x = x;
    card.container.y = y;
    card.container.scale.set(GALLERY_SCALE_V);
    card.container.zIndex = i;
  });

  container?.sortChildren();
}
