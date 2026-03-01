// ============================================================
// scene.js — 배경 · 금먼지 파티클 · UI 패널
// ============================================================
import { C, SCREEN_W as W, SCREEN_H as H } from '../config.js';
import { drawOrnamentLine } from './CardArt.js';

// ─── 배경 ────────────────────────────────────────────────────
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16)
       | (Math.round(ag + (bg - ag) * t) << 8)
       |  Math.round(ab + (bb - ab) * t);
}

export function buildBackground(layer) {
  const g = new PIXI.Graphics();

  // 그라디언트 (16단 레이어)
  for (let i = 0; i < 16; i++) {
    g.beginFill(lerpColor(0x0d0a18, 0x120e22, i / 16));
    g.drawRect(0, H / 16 * i, W, H / 16 + 1);
    g.endFill();
  }

  // 다이아몬드 래티스 패턴
  const step = 28;
  g.lineStyle(0.5, C.goldDim, 0.2);
  for (let row = -1; row < H / step + 2; row++) {
    for (let col = -1; col < W / step + 2; col++) {
      const cx = col * step + (row % 2 === 0 ? 0 : step / 2);
      const cy = row * step;
      g.moveTo(cx, cy - step / 2); g.lineTo(cx + step / 2, cy);
      g.lineTo(cx, cy + step / 2); g.lineTo(cx - step / 2, cy);
      g.closePath();
    }
  }
  layer.addChild(g);

  // 중앙 방사형 글로우
  const radial = new PIXI.Graphics();
  radial.beginFill(C.gold, 0.03);
  radial.drawCircle(W / 2, H * 0.42, 210);
  radial.endFill();
  radial.filters = [new PIXI.filters.BlurFilter(44)];
  layer.addChild(radial);
}

// ─── 금먼지 파티클 ────────────────────────────────────────────
export class GoldMote {
  constructor(layer) {
    this.gfx = new PIXI.Graphics();
    layer.addChild(this.gfx);
    this._reset(true);
  }

  _reset(init = false) {
    this.x     = Math.random() * W;
    this.y     = init ? Math.random() * H : H + 5;
    this.vy    = -(8 + Math.random() * 18);
    this.vx    = (Math.random() - 0.5) * 5;
    this.life  = 1.0;
    this.decay = 0.002 + Math.random() * 0.004;
    this.r     = 1 + Math.random() * 1.4;
    this.color = Math.random() < 0.6 ? C.gold : C.goldHi;
  }

  update(dt) {
    this.life -= this.decay;
    this.x    += this.vx * dt;
    this.y    += this.vy * dt;
    if (this.life <= 0 || this.y < -10) {
      this._reset();
    } else {
      this.gfx.clear();
      this.gfx.beginFill(this.color, this.life * 0.65);
      this.gfx.drawCircle(this.x, this.y, this.r);
      this.gfx.endFill();
    }
  }
}

export function buildParticles(layer, count = 44) {
  return Array.from({ length: count }, () => new GoldMote(layer));
}

// ─── UI 패널 ─────────────────────────────────────────────────
// 텍스트 업데이트를 위한 refs
const refs = {};

function makeText(str, size, color, opts = {}) {
  return new PIXI.Text(str, {
    fontFamily: 'Georgia, serif',
    fontSize: size,
    fill: color,
    ...opts,
  });
}

export function buildUI(layer, gs) {
  // ── 상단 HUD ────────────────────────────────────────────
  const topBg = new PIXI.Graphics();
  topBg.beginFill(0x0a0814, 0.94); topBg.drawRect(0, 0, W, 54); topBg.endFill();
  topBg.lineStyle(1, C.gold, 0.5); topBg.moveTo(0, 54); topBg.lineTo(W, 54);
  layer.addChild(topBg);
  drawOrnamentLine(layer, 54, 0.28);

  const titleTxt = makeText('Dominion', 20, C.gold, { fontStyle: 'italic', fontWeight: 'bold' });
  titleTxt.x = 14; titleTxt.y = 13;
  layer.addChild(titleTxt);

  refs.hudRight = makeText('', 10, C.dimCream);
  refs.hudRight.anchor.set(1, 0.5);
  refs.hudRight.x = W - 12; refs.hudRight.y = 28;
  layer.addChild(refs.hudRight);

  // ── 에리어 레이블 ──────────────────────────────────────
  [
    ['— Deck / Discard —', 68,        C.dimCream],
    ['— In Play —',        H * 0.44 - 16, C.dimCream],
    ['— Hand —',           H - 52 - 118 - 14, C.dimCream],
  ].forEach(([label, y, col]) => {
    const t = makeText(label, 9, col, { fontStyle: 'italic' });
    t.anchor.set(0.5, 0); t.x = W / 2; t.y = y;
    layer.addChild(t);
  });

  // ── 리소스 바 ──────────────────────────────────────────
  const resY = 282;
  const resBg = new PIXI.Graphics();
  resBg.beginFill(0x0a0814, 0.88); resBg.drawRect(8, resY, W - 16, 42); resBg.endFill();
  resBg.lineStyle(1, C.gold, 0.3);  resBg.drawRect(8, resY, W - 16, 42);
  layer.addChild(resBg);
  drawOrnamentLine(layer, resY, 0.18);
  drawOrnamentLine(layer, resY + 42, 0.18);

  refs.resTxt = makeText('', 11, C.cream);
  refs.resTxt.anchor.set(0.5, 0.5);
  refs.resTxt.x = W / 2; refs.resTxt.y = resY + 21;
  layer.addChild(refs.resTxt);

  // ── 턴 종료 버튼 ──────────────────────────────────────
  const btnY = H - 52 - 50;
  const btnW = W - 32;
  const btn  = new PIXI.Container();

  const btnBg = new PIXI.Graphics();
  btnBg.beginFill(0x1a1030); btnBg.drawRect(0, 0, btnW, 42); btnBg.endFill();
  btnBg.lineStyle(1.5, C.gold, 0.8); btnBg.drawRect(0, 0, btnW, 42);
  btn.addChild(btnBg);

  // 버튼 코너 악센트
  [[0, 0], [btnW, 0], [0, 42], [btnW, 42]].forEach(([bx, by]) => {
    btnBg.lineStyle(0);
    btnBg.beginFill(C.goldDim, 0.8);
    btnBg.drawRect(bx - 2, by - 2, 4, 4);
    btnBg.endFill();
  });

  const btnTxt = makeText('턴 종료', 16, C.gold, { fontWeight: 'bold' });
  btnTxt.anchor.set(0.5); btnTxt.x = btnW / 2; btnTxt.y = 21;
  btn.addChild(btnTxt);

  btn.x = 16; btn.y = btnY;
  btn.eventMode = 'static'; btn.cursor = 'pointer';
  btn.on('pointerover',  () => { btnBg.tint = 0xddbbff; });
  btn.on('pointerout',   () => { btnBg.tint = 0xffffff; });
  btn.on('pointerdown',  () => btn.scale.set(0.96));
  btn.on('pointerup',    () => { btn.scale.set(1); gs.onEndTurn?.(); });
  btn.on('pointerupoutside', () => btn.scale.set(1));
  layer.addChild(btn);

  // ── 하단 상태 바 ──────────────────────────────────────
  const botBg = new PIXI.Graphics();
  botBg.beginFill(0x0a0814, 0.94); botBg.drawRect(0, H - 52, W, 52); botBg.endFill();
  botBg.lineStyle(1, C.gold, 0.3); botBg.moveTo(0, H - 52); botBg.lineTo(W, H - 52);
  layer.addChild(botBg);
  drawOrnamentLine(layer, H - 52, 0.16);

  refs.statusTxt = makeText('', 10, C.dimCream);
  refs.statusTxt.anchor.set(0.5, 0.5);
  refs.statusTxt.x = W / 2; refs.statusTxt.y = H - 26;
  layer.addChild(refs.statusTxt);

  updateUI(gs);
}

/** 게임 상태 변경 시 UI 텍스트 갱신 */
export function updateUI(gs) {
  if (refs.hudRight) {
    refs.hudRight.text = `VP ✦ ${gs.vp}   Turn ✦ ${gs.turn}`;
  }
  if (refs.resTxt) {
    refs.resTxt.text = `Actions: ${gs.actions}   Buys: ${gs.buys}   Coins: ${gs.coins}`;
  }
  if (refs.statusTxt) {
    refs.statusTxt.text =
      `Deck: ${gs.deck.length}   Discard: ${gs.discard.length}   Hand: ${gs.hand.length}`;
  }
}
