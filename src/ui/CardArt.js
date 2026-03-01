// ============================================================
// CardArt.js — Art-Nouveau 카드 렌더링 함수 모음
// 모든 픽셀값은 F = CW/72 비례 계수로 자동 스케일됨
// ============================================================
import { C, ACCENT, CARD_W as CW, CARD_H as CH } from '../config.js';

// ─── 스케일 계수 (CW 기준 72px 대비 배율) ───────────────────
const F = CW / 72;

// ─── 그라디언트 유틸리티 ─────────────────────────────────────

/** 두 색상 선형 보간 (t: 0→1) */
export function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16)
       | (Math.round(ag + (bg - ag) * t) << 8)
       |  Math.round(ab + (bb - ab) * t);
}

/**
 * 3색 그라디언트 바디 렌더링 (상단→중간→하단, 12밴드)
 * 색상 추가·교체 시 이 함수만 수정.
 */
export function drawGradientBody(g, def) {
  const top = def.gradTop ?? def.base;
  const mid = def.gradMid ?? def.base;
  const bot = def.gradBot ?? def.base;

  for (let i = 0; i < 12; i++) {
    const t   = i / 11;
    const col = t <= 0.5
      ? lerpColor(top, mid, t * 2)
      : lerpColor(mid, bot, (t - 0.5) * 2);
    g.beginFill(col);
    g.drawRect(0, i * (CH / 12), CW, CH / 12 + 1);
    g.endFill();
  }
}

// ─── 수평 잎사귀 장식선 ──────────────────────────────────────
export function drawOrnamentLine(parent, y, alpha = 0.35) {
  const g = new PIXI.Graphics();
  g.lineStyle(0.8, C.gold, alpha);
  g.moveTo(0, y); g.lineTo(390, y);
  for (let x = 16; x < 390; x += 24) {
    g.moveTo(x, y);
    g.bezierCurveTo(x - 5, y - 6, x - 2, y - 10, x, y - 8);
    g.bezierCurveTo(x + 2, y - 10, x + 5, y - 6, x, y);
  }
  parent.addChild(g);
}

// ─── 베지어 코너 덩굴 장식 (F 스케일 적용) ──────────────────
export function drawCornerFlourish(g, cx, cy, sx, sy, color, alpha = 0.75) {
  g.lineStyle(1.2 * F, color, alpha);
  g.moveTo(cx, cy + sy * 18 * F);
  g.bezierCurveTo(cx, cy + sy * 7 * F, cx + sx * 7 * F, cy, cx + sx * 18 * F, cy);

  g.lineStyle(0.6 * F, color, alpha * 0.4);
  g.moveTo(cx + sx * 2 * F, cy + sy * 14 * F);
  g.bezierCurveTo(
    cx + sx * 2 * F, cy + sy * 7 * F,
    cx + sx * 7 * F, cy + sy * 2 * F,
    cx + sx * 14 * F, cy + sy * 2 * F,
  );

  g.lineStyle(0.8 * F, color, alpha * 0.6);
  g.moveTo(cx + sx * 18 * F, cy);
  g.bezierCurveTo(
    cx + sx * 24 * F, cy - sy * 3 * F,
    cx + sx * 25 * F, cy - sy * 7 * F,
    cx + sx * 22 * F, cy - sy * 5 * F,
  );
  g.moveTo(cx, cy + sy * 18 * F);
  g.bezierCurveTo(
    cx - sx * 3 * F, cy + sy * 24 * F,
    cx - sx * 7 * F, cy + sy * 25 * F,
    cx - sx * 5 * F, cy + sy * 22 * F,
  );

  g.lineStyle(0);
  g.beginFill(color, alpha * 0.8);
  g.drawCircle(cx + sx * 4 * F, cy + sy * 4 * F, 1.2 * F);
  g.endFill();
}

// ─── 4코너에 장식 그리기 ────────────────────────────────────
function addFlourishes(container, color, alpha) {
  const m = Math.round(3 * F);   // 코너 여백
  const fl = new PIXI.Graphics();
  drawCornerFlourish(fl,      m,      m,  1,  1, color, alpha);
  drawCornerFlourish(fl, CW - m,      m, -1,  1, color, alpha);
  drawCornerFlourish(fl,      m, CH - m,  1, -1, color, alpha);
  drawCornerFlourish(fl, CW - m, CH - m, -1, -1, color, alpha);
  container.addChild(fl);
}

// ─── 카드 앞면 컨테이너 빌드 ────────────────────────────────
export function buildFrontFace(def) {
  const face   = new PIXI.Container();
  const g      = new PIXI.Graphics();
  const accent = ACCENT[def.type];

  // 비례 치수 계산
  const BDR  = Math.round(3 * F);              // 내부 테두리 인셋
  const BAND = Math.round(28 * F);             // 상단 타이틀 밴드 높이
  const BSEP = Math.round(15 * F);             // 하단 구분선 ~ 하단 거리
  const BR   = Math.round(9 * F);              // 코스트 배지 반지름
  const BCX  = Math.round(10 * F);             // 코스트 배지 중심 x/y
  const DP   = Math.round(3 * F);              // 다이아몬드 포인트 크기

  // 폰트 크기 (비례)
  const FS_NAME = Math.max(8,  Math.round(10 * F));
  const FS_DESC = Math.max(7,  Math.round(9  * F));
  const FS_COST = Math.max(8,  Math.round(10 * F));
  const FS_TYPE = Math.max(5,  Math.round(6  * F));

  // 그라디언트 바디
  drawGradientBody(g, def);

  // 상단 타입 컬러 워시
  g.beginFill(accent, 0.1);
  g.drawRect(0, 0, CW, BAND);
  g.endFill();

  // 골드 외곽선 (2겹)
  g.lineStyle(1.5 * F, C.gold, 0.9);    g.drawRect(0, 0, CW, CH);
  g.lineStyle(0.6 * F, C.goldDim, 0.5); g.drawRect(BDR, BDR, CW - BDR*2, CH - BDR*2);

  // 타이틀 구분선 + 다이아몬드
  const sepY = BAND;
  const mX   = Math.round(8 * F);
  g.lineStyle(0.8 * F, C.gold, 0.7);
  g.moveTo(mX, sepY); g.lineTo(CW / 2 - DP * 2, sepY);
  g.moveTo(CW / 2 + DP * 2, sepY); g.lineTo(CW - mX, sepY);
  g.lineStyle(0);
  g.beginFill(C.gold, 0.9);
  g.drawPolygon([CW/2, sepY-DP, CW/2+DP, sepY, CW/2, sepY+DP, CW/2-DP, sepY]);
  g.endFill();

  // 하단 구분선
  g.lineStyle(0.7 * F, C.gold, 0.35);
  g.moveTo(mX, CH - BSEP); g.lineTo(CW - mX, CH - BSEP);

  face.addChild(g);
  addFlourishes(face, C.gold, 0.7);

  // 코스트 배지
  const badge = new PIXI.Graphics();
  badge.lineStyle(1.5 * F, C.gold); badge.beginFill(C.dark, 0.9);
  badge.drawCircle(BCX, BCX, BR); badge.endFill();
  badge.lineStyle(0.5 * F, C.goldHi, 0.4); badge.drawCircle(BCX, BCX, Math.round(BR * 0.78));
  face.addChild(badge);

  const costTxt = new PIXI.Text(String(def.cost), {
    fontFamily: 'Georgia, serif', fontSize: FS_COST, fontWeight: 'bold', fill: C.gold,
  });
  costTxt.anchor.set(0.5); costTxt.x = BCX; costTxt.y = BCX;
  face.addChild(costTxt);

  // 카드 이름
  const nameTxt = new PIXI.Text(def.name, {
    fontFamily: 'Georgia, serif', fontSize: FS_NAME, fontWeight: 'bold',
    fill: C.cream, align: 'center',
  });
  nameTxt.anchor.set(0.5);
  nameTxt.x = CW / 2 + Math.round(5 * F);
  nameTxt.y = Math.round(15 * F);
  face.addChild(nameTxt);

  // 설명 텍스트 — 카드 앞면에서는 summary(요약) 사용, 없으면 전문 폴백
  const descTxt = new PIXI.Text(def.summary || def.desc, {
    fontFamily: 'Georgia, serif', fontSize: FS_DESC,
    fill: C.cream, align: 'center',
    wordWrap: true, wordWrapWidth: CW - mX * 2, lineHeight: Math.round(FS_DESC * 1.45),
  });
  descTxt.anchor.set(0.5);
  descTxt.x = CW / 2;
  descTxt.y = (BAND + CH - BSEP) / 2 + Math.round(2 * F);
  face.addChild(descTxt);

  // 타입 레이블
  const typeLabel = (def.rawType ?? def.type).replace(/-/g, ' · ');
  const typeTxt = new PIXI.Text(typeLabel.toUpperCase(), {
    fontFamily: 'Georgia, serif', fontSize: FS_TYPE, fontStyle: 'italic',
    fill: accent, alpha: 0.85,
  });
  typeTxt.anchor.set(0.5);
  typeTxt.x = CW / 2;
  typeTxt.y = CH - Math.round(8 * F);
  face.addChild(typeTxt);

  return face;
}

// ─── 카드 뒷면 컨테이너 빌드 ────────────────────────────────
export function buildBackFace() {
  const face = new PIXI.Container();
  const g    = new PIXI.Graphics();

  g.beginFill(0x0c0a1e); g.drawRect(0, 0, CW, CH); g.endFill();

  const BDR = Math.round(4 * F);
  g.lineStyle(1.5 * F, C.gold,    0.8); g.drawRect(0, 0, CW, CH);
  g.lineStyle(0.6 * F, C.goldDim, 0.5); g.drawRect(BDR, BDR, CW - BDR*2, CH - BDR*2);

  // 중앙 다이아몬드
  const cx = CW / 2, cy = CH / 2, r = Math.round(15 * F);
  g.lineStyle(F, C.gold, 0.6);
  g.moveTo(cx, cy - r); g.lineTo(cx + r, cy);
  g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath();
  g.lineStyle(0.5 * F, C.gold, 0.3); g.drawCircle(cx, cy, r * 0.6);
  g.lineStyle(0); g.beginFill(C.gold, 0.6); g.drawCircle(cx, cy, 2 * F); g.endFill();

  // 수평 장식선
  const mX = Math.round(8 * F);
  g.lineStyle(0.5 * F, C.goldDim, 0.4);
  [cy - r - 6 * F, cy + r + 6 * F].forEach(y => {
    g.moveTo(mX, y); g.lineTo(CW - mX, y);
  });

  face.addChild(g);
  addFlourishes(face, C.gold, 0.55);
  return face;
}
