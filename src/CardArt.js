// ============================================================
// CardArt.js — Art-Nouveau 카드 렌더링 함수 모음
// ============================================================
import { C, ACCENT, CARD_W as CW, CARD_H as CH } from './config.js';

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

// ─── 베지어 코너 덩굴 장식 ──────────────────────────────────
export function drawCornerFlourish(g, cx, cy, sx, sy, color, alpha = 0.75) {
  g.lineStyle(1.2, color, alpha);
  // 메인 1/4원 호
  g.moveTo(cx, cy + sy * 18);
  g.bezierCurveTo(cx, cy + sy * 7, cx + sx * 7, cy, cx + sx * 18, cy);
  // 내부 에코
  g.lineStyle(0.6, color, alpha * 0.4);
  g.moveTo(cx + sx * 2, cy + sy * 14);
  g.bezierCurveTo(cx + sx * 2, cy + sy * 7, cx + sx * 7, cy + sy * 2, cx + sx * 14, cy + sy * 2);
  // 잎 가지
  g.lineStyle(0.8, color, alpha * 0.6);
  g.moveTo(cx + sx * 18, cy);
  g.bezierCurveTo(cx + sx * 24, cy - sy * 3, cx + sx * 25, cy - sy * 7, cx + sx * 22, cy - sy * 5);
  g.moveTo(cx, cy + sy * 18);
  g.bezierCurveTo(cx - sx * 3, cy + sy * 24, cx - sx * 7, cy + sy * 25, cx - sx * 5, cy + sy * 22);
  // 코너 점
  g.lineStyle(0);
  g.beginFill(color, alpha * 0.8);
  g.drawCircle(cx + sx * 4, cy + sy * 4, 1.2);
  g.endFill();
}

// ─── 4코너에 장식 그리기 ────────────────────────────────────
function addFlourishes(container, color, alpha) {
  const fl = new PIXI.Graphics();
  drawCornerFlourish(fl,      3,      3,  1,  1, color, alpha);
  drawCornerFlourish(fl, CW - 3,      3, -1,  1, color, alpha);
  drawCornerFlourish(fl,      3, CH - 3,  1, -1, color, alpha);
  drawCornerFlourish(fl, CW - 3, CH - 3, -1, -1, color, alpha);
  container.addChild(fl);
}

// ─── 카드 앞면 컨테이너 빌드 ────────────────────────────────
export function buildFrontFace(def) {
  const face = new PIXI.Container();
  const g    = new PIXI.Graphics();
  const accent = ACCENT[def.type];

  // 그라디언트 바디 (12 밴드)
  const base = def.base;
  const br = (base >> 16) & 0xff, bg = (base >> 8) & 0xff, bb = base & 0xff;
  for (let i = 0; i < 12; i++) {
    const f  = 1 + (i / 12) * 0.38;
    const cr = Math.min(255, Math.round(br * f));
    const cg = Math.min(255, Math.round(bg * f));
    const cb = Math.min(255, Math.round(bb * f));
    g.beginFill((cr << 16) | (cg << 8) | cb);
    g.drawRect(0, i * (CH / 12), CW, CH / 12 + 1);
    g.endFill();
  }

  // 상단 타입 컬러 워시
  g.beginFill(accent, 0.1);
  g.drawRect(0, 0, CW, 28);
  g.endFill();

  // 골드 외곽선 (2겹)
  g.lineStyle(1.5, C.gold, 0.9);  g.drawRect(0, 0, CW, CH);
  g.lineStyle(0.6, C.goldDim, 0.5); g.drawRect(3, 3, CW - 6, CH - 6);

  // 타이틀 구분선 + 다이아몬드 중앙점
  const sepY = 28;
  g.lineStyle(0.8, C.gold, 0.7);
  g.moveTo(8, sepY); g.lineTo(CW / 2 - 5, sepY);
  g.moveTo(CW / 2 + 5, sepY); g.lineTo(CW - 8, sepY);
  g.lineStyle(0);
  g.beginFill(C.gold, 0.9);
  const dx = CW / 2, dy = sepY;
  g.drawPolygon([dx, dy - 3, dx + 3, dy, dx, dy + 3, dx - 3, dy]);
  g.endFill();

  // 하단 구분선
  g.lineStyle(0.7, C.gold, 0.35);
  g.moveTo(8, CH - 15); g.lineTo(CW - 8, CH - 15);

  face.addChild(g);
  addFlourishes(face, C.gold, 0.7);

  // 코스트 배지 (원형 메달)
  const badge = new PIXI.Graphics();
  badge.lineStyle(1.5, C.gold); badge.beginFill(C.dark, 0.9);
  badge.drawCircle(10, 10, 9); badge.endFill();
  badge.lineStyle(0.5, C.goldHi, 0.4); badge.drawCircle(10, 10, 7);
  face.addChild(badge);

  const costTxt = new PIXI.Text(String(def.cost), {
    fontFamily: 'Georgia, serif', fontSize: 10, fontWeight: 'bold', fill: C.gold,
  });
  costTxt.anchor.set(0.5); costTxt.x = 10; costTxt.y = 10;
  face.addChild(costTxt);

  // 카드 이름
  const nameTxt = new PIXI.Text(def.name, {
    fontFamily: 'Georgia, serif', fontSize: 10, fontWeight: 'bold',
    fill: C.cream, align: 'center',
  });
  nameTxt.anchor.set(0.5); nameTxt.x = CW / 2 + 5; nameTxt.y = 15;
  face.addChild(nameTxt);

  // 설명 텍스트
  const descTxt = new PIXI.Text(def.desc, {
    fontFamily: 'Georgia, serif', fontSize: 9,
    fill: C.cream, align: 'center',
    wordWrap: true, wordWrapWidth: CW - 10, lineHeight: 13,
  });
  descTxt.anchor.set(0.5);
  descTxt.x = CW / 2;
  descTxt.y = (28 + CH - 15) / 2 + 2;
  face.addChild(descTxt);

  // 타입 레이블 (하단)
  const typeTxt = new PIXI.Text(def.type.toUpperCase(), {
    fontFamily: 'Georgia, serif', fontSize: 7, fontStyle: 'italic',
    fill: accent, alpha: 0.85,
  });
  typeTxt.anchor.set(0.5); typeTxt.x = CW / 2; typeTxt.y = CH - 8;
  face.addChild(typeTxt);

  return face;
}

// ─── 카드 뒷면 컨테이너 빌드 ────────────────────────────────
export function buildBackFace() {
  const face = new PIXI.Container();
  const g    = new PIXI.Graphics();

  g.beginFill(0x0c0a1e); g.drawRect(0, 0, CW, CH); g.endFill();

  g.lineStyle(1.5, C.gold, 0.8);   g.drawRect(0, 0, CW, CH);
  g.lineStyle(0.6, C.goldDim, 0.5); g.drawRect(4, 4, CW - 8, CH - 8);

  // 중앙 다이아몬드 오너먼트
  const cx = CW / 2, cy = CH / 2, r = 15;
  g.lineStyle(1, C.gold, 0.6);
  g.moveTo(cx, cy - r); g.lineTo(cx + r, cy);
  g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath();
  g.lineStyle(0.5, C.gold, 0.3); g.drawCircle(cx, cy, r * 0.6);
  g.lineStyle(0); g.beginFill(C.gold, 0.6); g.drawCircle(cx, cy, 2); g.endFill();

  // 수평 장식선
  g.lineStyle(0.5, C.goldDim, 0.4);
  [cy - r - 6, cy + r + 6].forEach(y => { g.moveTo(8, y); g.lineTo(CW - 8, y); });

  face.addChild(g);
  addFlourishes(face, C.gold, 0.55);
  return face;
}
