// ============================================================
// ART NOUVEAU — PixiJS visual sandbox
// Techniques: bezierCurveTo ornaments, layered gradients,
//             gold dust particles, warm BlurFilter glow
// ============================================================

const W = 390, H = 844;
const CW = 86, CH = 126;

const C = {
  bg:       0x0d0a18,
  bgMid:    0x120e22,
  gold:     0xd4a520,
  goldHi:   0xffe066,
  goldDim:  0x7a5c0a,
  cream:    0xfff3d6,
  dimCream: 0xaa9966,
  shadow:   0x000008,

  // Card base colors by type (rich jewel tones)
  action:   0x1a0a2e,   // deep violet
  treasure: 0x1a1000,   // deep amber-black
  victory:  0x061a0e,   // deep forest
};

const TYPE_ACCENT = {
  Action:   0x9933cc,  // violet
  Treasure: 0xd4a520,  // gold
  Victory:  0x228844,  // emerald
};

const CARD_DEFS = [
  { name: 'Smithy',        cost: 4, type: 'Action',   desc: '+3 Cards', base: C.action },
  { name: 'Village',       cost: 3, type: 'Action',   desc: '+1 Card\n+2 Actions', base: C.action },
  { name: 'Market',        cost: 5, type: 'Action',   desc: '+1 Card\n+1 Action\n+1 Buy\n+$1', base: C.action },
  { name: 'Council Room',  cost: 5, type: 'Action',   desc: '+4 Cards\n+1 Buy\n\nEach other player draws a card.', base: C.action },
  { name: 'Copper',        cost: 0, type: 'Treasure', desc: '$1', base: C.treasure },
  { name: 'Silver',        cost: 3, type: 'Treasure', desc: '$2', base: C.treasure },
  { name: 'Gold',          cost: 6, type: 'Treasure', desc: '$3', base: C.treasure },
];

// ============================================================
// PixiJS app
// ============================================================
const app = new PIXI.Application({
  width: W, height: H,
  backgroundColor: C.bg,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: true,
});
document.querySelector('#game-container').appendChild(app.view);

const layerBg    = new PIXI.Container();
const layerCards = new PIXI.Container();
const layerFx    = new PIXI.Container();
const layerUI    = new PIXI.Container();
app.stage.addChild(layerBg, layerCards, layerFx, layerUI);
layerCards.sortableChildren = true;

// ============================================================
// Background: geometric Art Nouveau tiling pattern
// ============================================================
function buildBackground() {
  const g = new PIXI.Graphics();

  // Base gradient simulation (layered rects)
  for (let i = 0; i < 20; i++) {
    const ratio = i / 20;
    const r = Math.round(0x0d + (0x0a - 0x0d) * ratio);
    const gv = Math.round(0x0a + (0x08 - 0x0a) * ratio);
    const b = Math.round(0x18 + (0x10 - 0x18) * ratio);
    g.beginFill((r << 16) | (gv << 8) | b);
    g.drawRect(0, H / 20 * i, W, H / 20);
    g.endFill();
  }

  // Repeating diamond lattice
  const spacing = 28;
  g.lineStyle(0.5, C.goldDim, 0.25);
  for (let row = -1; row < H / spacing + 2; row++) {
    for (let col = -1; col < W / spacing + 2; col++) {
      const cx = col * spacing + (row % 2 === 0 ? 0 : spacing / 2);
      const cy = row * spacing;
      g.moveTo(cx, cy - spacing / 2);
      g.lineTo(cx + spacing / 2, cy);
      g.lineTo(cx, cy + spacing / 2);
      g.lineTo(cx - spacing / 2, cy);
      g.closePath();
    }
  }

  layerBg.addChild(g);

  // Central medallion glow (soft radial suggestion)
  const radial = new PIXI.Graphics();
  radial.beginFill(C.gold, 0.04);
  radial.drawCircle(W / 2, H * 0.42, 200);
  radial.endFill();
  radial.filters = [new PIXI.filters.BlurFilter(40)];
  layerBg.addChild(radial);

  // Top & bottom ornamental borders
  drawHorizontalOrnament(layerBg, 0, W, 52, C.gold, 0.5);
  drawHorizontalOrnament(layerBg, 0, W, H - 52, C.gold, 0.3);
}

function drawHorizontalOrnament(parent, x1, x2, y, color, alpha) {
  const g = new PIXI.Graphics();
  g.lineStyle(1, color, alpha);
  g.moveTo(x1, y); g.lineTo(x2, y);

  // Repeating leaf motifs along line
  const step = 24;
  for (let x = x1 + step / 2; x < x2; x += step) {
    g.moveTo(x, y);
    g.bezierCurveTo(x - 5, y - 6, x - 2, y - 10, x, y - 8);
    g.bezierCurveTo(x + 2, y - 10, x + 5, y - 6, x, y);
  }
  parent.addChild(g);
}

// ============================================================
// Gold dust particles
// ============================================================
const goldDust = [];

class GoldMote {
  constructor() {
    this.reset(true);
    this.gfx = new PIXI.Graphics();
    layerFx.addChild(this.gfx);
  }
  reset(init = false) {
    this.x = Math.random() * W;
    this.y = init ? Math.random() * H : H + 5;
    this.vy = -(8 + Math.random() * 18);
    this.vx = (Math.random() - 0.5) * 6;
    this.life = 1.0;
    this.decay = 0.002 + Math.random() * 0.004;
    this.r = 1 + Math.random() * 1.5;
    this.color = Math.random() < 0.6 ? C.gold : C.goldHi;
  }
  update(dt) {
    this.life -= this.decay;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.life <= 0 || this.y < -10) this.reset();
    else {
      this.gfx.clear();
      this.gfx.beginFill(this.color, this.life * 0.7);
      this.gfx.drawCircle(this.x, this.y, this.r);
      this.gfx.endFill();
    }
  }
}

function buildGoldDust() {
  for (let i = 0; i < 50; i++) goldDust.push(new GoldMote());
}

// ============================================================
// Art Nouveau corner flourish helper
// ============================================================
function drawCornerFlourish(g, cx, cy, sx, sy, color, alpha) {
  g.lineStyle(1.2, color, alpha);

  // Main quarter-arc border
  g.moveTo(cx, cy + sy * 20);
  g.bezierCurveTo(cx, cy + sy * 8, cx + sx * 8, cy, cx + sx * 20, cy);

  // Inner arc echo
  g.lineStyle(0.6, color, alpha * 0.5);
  g.moveTo(cx + sx * 2, cy + sy * 16);
  g.bezierCurveTo(cx + sx * 2, cy + sy * 8, cx + sx * 8, cy + sy * 2, cx + sx * 16, cy + sy * 2);

  // Leaf sprig at corner tip
  g.lineStyle(0.8, color, alpha * 0.7);
  g.moveTo(cx + sx * 20, cy);
  g.bezierCurveTo(cx + sx * 26, cy - sy * 3, cx + sx * 28, cy - sy * 8, cx + sx * 24, cy - sy * 6);
  g.moveTo(cx, cy + sy * 20);
  g.bezierCurveTo(cx - sx * 3, cy + sy * 26, cx - sx * 8, cy + sy * 28, cx - sx * 6, cy + sy * 24);

  // Small dot at corner
  g.lineStyle(0);
  g.beginFill(color, alpha * 0.8);
  g.drawCircle(cx + sx * 4, cy + sy * 4, 1.5);
  g.endFill();
}

// ============================================================
// Art Nouveau Card
// ============================================================
class ArtNouveauCard {
  constructor(def, idx) {
    this.def = def;
    this.idx = idx;
    this.accent = TYPE_ACCENT[def.type];
    this.container = new PIXI.Container();

    this.targetX = 0; this.targetY = 0; this.targetRot = 0;
    this.hovered = false;
    this.glowPhase = Math.random() * Math.PI * 2;

    this._build();
    this._interact();
  }

  _build() {
    // Warm bloom behind card (hidden until hover)
    this.bloom = new PIXI.Graphics();
    this.bloom.beginFill(this.accent, 0.3);
    this.bloom.drawRect(-10, -10, CW + 20, CH + 20);
    this.bloom.endFill();
    this.bloom.filters = [new PIXI.filters.BlurFilter(18)];
    this.bloom.alpha = 0;
    this.container.addChild(this.bloom);

    const g = new PIXI.Graphics();

    // Drop shadow
    g.beginFill(C.shadow, 0.6);
    g.drawRect(4, 4, CW, CH);
    g.endFill();

    // Card body (simulated gradient with layered rects)
    const baseR = (this.def.base >> 16) & 0xff;
    const baseG = (this.def.base >> 8)  & 0xff;
    const baseB =  this.def.base & 0xff;
    for (let i = 0; i < 12; i++) {
      const ratio = i / 12;
      const factor = 1 + ratio * 0.3;
      const cr = Math.min(255, Math.round(baseR * factor));
      const cg = Math.min(255, Math.round(baseG * factor));
      const cb = Math.min(255, Math.round(baseB * factor));
      g.beginFill((cr << 16) | (cg << 8) | cb);
      g.drawRect(0, i * (CH / 12), CW, CH / 12 + 1);
      g.endFill();
    }

    // Top color wash
    g.beginFill(this.accent, 0.08);
    g.drawRect(0, 0, CW, 32);
    g.endFill();

    // Outer gold border
    g.lineStyle(1.5, C.gold, 0.9);
    g.drawRect(0, 0, CW, CH);

    // Inner border inset 3px
    g.lineStyle(0.7, C.goldDim, 0.6);
    g.drawRect(3, 3, CW - 6, CH - 6);

    // Title separator — ornamental centered diamond line
    const sepY = 32;
    g.lineStyle(0.8, C.gold, 0.7);
    g.moveTo(8, sepY); g.lineTo(CW / 2 - 5, sepY);
    g.moveTo(CW / 2 + 5, sepY); g.lineTo(CW - 8, sepY);
    g.lineStyle(0);
    g.beginFill(C.gold, 0.9);
    g.drawRect(CW / 2 - 3, sepY - 3, 6, 6); // diamond (rotated square)
    g.endFill();

    // Bottom separator
    g.lineStyle(0.8, C.gold, 0.4);
    g.moveTo(8, CH - 18); g.lineTo(CW - 8, CH - 18);

    this.container.addChild(g);

    // Corner flourishes
    const flG = new PIXI.Graphics();
    drawCornerFlourish(flG,  3,  3,  1,  1, C.gold, 0.75);
    drawCornerFlourish(flG, CW - 3,  3, -1,  1, C.gold, 0.75);
    drawCornerFlourish(flG,  3, CH - 3,  1, -1, C.gold, 0.75);
    drawCornerFlourish(flG, CW - 3, CH - 3, -1, -1, C.gold, 0.75);
    this.container.addChild(flG);

    // Cost badge — circular gold medallion
    const badge = new PIXI.Graphics();
    badge.lineStyle(1.5, C.gold, 1);
    badge.beginFill(C.shadow, 0.9);
    badge.drawCircle(11, 11, 9);
    badge.endFill();
    badge.lineStyle(0.5, C.goldHi, 0.5);
    badge.drawCircle(11, 11, 7);
    this.container.addChild(badge);

    const costText = new PIXI.Text(this.def.cost.toString(), {
      fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: 'bold', fill: C.gold,
    });
    costText.anchor.set(0.5); costText.x = 11; costText.y = 11;
    this.container.addChild(costText);

    // Card name
    const nameText = new PIXI.Text(this.def.name, {
      fontFamily: 'Georgia, serif',
      fontSize: 11, fontWeight: 'bold',
      fill: C.cream, align: 'center',
    });
    nameText.anchor.set(0.5); nameText.x = CW / 2; nameText.y = 17;
    this.container.addChild(nameText);

    // Description
    const descText = new PIXI.Text(this.def.desc, {
      fontFamily: 'Georgia, serif',
      fontSize: 10, fill: C.cream,
      align: 'center',
      wordWrap: true, wordWrapWidth: CW - 16,
      lineHeight: 14,
    });
    descText.anchor.set(0.5);
    descText.x = CW / 2;
    descText.y = (32 + CH - 18) / 2 + 2;
    this.container.addChild(descText);

    // Type label
    const typeText = new PIXI.Text(this.def.type.toUpperCase(), {
      fontFamily: 'Georgia, serif',
      fontSize: 7, fontStyle: 'italic',
      fill: this.accent, alpha: 0.85,
    });
    typeText.anchor.set(0.5); typeText.x = CW / 2; typeText.y = CH - 10;
    this.container.addChild(typeText);
  }

  _interact() {
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.on('pointerover', () => { this.hovered = true; });
    this.container.on('pointerout',  () => { this.hovered = false; });
  }

  update(dt) {
    const s = Math.min(1, dt * 8);
    const liftY = this.hovered ? -12 : 0;

    this.container.x += (this.targetX - this.container.x) * s;
    this.container.y += (this.targetY + liftY - this.container.y) * s;
    this.container.rotation += (this.targetRot - this.container.rotation) * s;

    const tScale = this.hovered ? 1.08 : 1.0;
    this.container.scale.x += (tScale - this.container.scale.x) * s;
    this.container.scale.y += (tScale - this.container.scale.y) * s;

    this.glowPhase += dt * (this.hovered ? 4 : 1.5);
    const pulse = (Math.sin(this.glowPhase) + 1) / 2;
    const targetBloom = this.hovered ? 0.5 + pulse * 0.5 : 0;
    this.bloom.alpha += (targetBloom - this.bloom.alpha) * s;
  }

  moveTo(x, y, rot = 0) {
    this.targetX = x; this.targetY = y; this.targetRot = rot;
    this.container.x = x; this.container.y = y;
  }
}

// ============================================================
// UI
// ============================================================
function buildUI() {
  // Top panel
  const topBg = new PIXI.Graphics();
  topBg.beginFill(0x0a0814, 0.92);
  topBg.drawRect(0, 0, W, 54);
  topBg.endFill();
  topBg.lineStyle(1, C.gold, 0.6);
  topBg.moveTo(0, 54); topBg.lineTo(W, 54);
  layerUI.addChild(topBg);

  drawHorizontalOrnament(layerUI, 0, W, 54, C.gold, 0.35);

  const title = new PIXI.Text('Dominion', {
    fontFamily: 'Georgia, serif',
    fontSize: 20, fontStyle: 'italic', fontWeight: 'bold',
    fill: C.gold, letterSpacing: 2,
  });
  title.x = 14; title.y = 14;
  layerUI.addChild(title);

  const vpText = new PIXI.Text('VP ✦ 3   Turn ✦ 1', {
    fontFamily: 'Georgia, serif', fontSize: 10, fill: C.dimCream,
  });
  vpText.anchor.set(1, 0.5);
  vpText.x = W - 12; vpText.y = 28;
  layerUI.addChild(vpText);

  [['— Supply —', 62, C.gold], ['— Hand —', H - 200, C.dimCream]]
    .forEach(([label, y, col]) => {
      const t = new PIXI.Text(label, {
        fontFamily: 'Georgia, serif', fontSize: 9, fontStyle: 'italic', fill: col,
      });
      t.anchor.set(0.5, 0); t.x = W / 2; t.y = y;
      layerUI.addChild(t);
    });

  // Bottom panel
  const botBg = new PIXI.Graphics();
  botBg.beginFill(0x0a0814, 0.92);
  botBg.drawRect(0, H - 52, W, 52);
  botBg.endFill();
  botBg.lineStyle(1, C.gold, 0.3);
  botBg.moveTo(0, H - 52); botBg.lineTo(W, H - 52);
  layerUI.addChild(botBg);

  drawHorizontalOrnament(layerUI, 0, W, H - 52, C.gold, 0.2);

  ['Actions: 1', 'Buys: 1', 'Coins: 0', 'Deck: 10'].forEach((label, i) => {
    const t = new PIXI.Text(label, {
      fontFamily: 'Georgia, serif', fontSize: 10, fill: C.dimCream,
    });
    t.anchor.set(0.5, 0.5);
    t.x = W / 4 * i + W / 8; t.y = H - 26;
    layerUI.addChild(t);
  });
}

// ============================================================
// Card layout
// ============================================================
const allCards = [];

function buildCards() {
  const supply = CARD_DEFS.slice(0, 4);
  const supplyY = 76;
  supply.forEach((def, i) => {
    const c = new ArtNouveauCard(def, i);
    const x = W / 4 * i + (W / 4 - CW) / 2;
    c.moveTo(x, supplyY);
    c.container.zIndex = i;
    layerCards.addChild(c.container);
    allCards.push(c);
  });

  const supply2 = CARD_DEFS.slice(4);
  const supply2Y = 76 + CH + 14;
  supply2.forEach((def, i) => {
    const c = new ArtNouveauCard(def, i + 4);
    const totalW = supply2.length * CW + (supply2.length - 1) * 10;
    const startX = (W - totalW) / 2;
    c.moveTo(startX + i * (CW + 10), supply2Y);
    c.container.zIndex = i + 4;
    layerCards.addChild(c.container);
    allCards.push(c);
  });

  const handDefs = [CARD_DEFS[4], CARD_DEFS[4], CARD_DEFS[6], CARD_DEFS[0], CARD_DEFS[6]];
  const handY = H - 52 - CH - 14;
  handDefs.forEach((def, i) => {
    const c = new ArtNouveauCard(def, i + 10);
    const angle = (i - 2) * 0.05;
    const bow = Math.abs(i - 2) * 5;
    const totalW = handDefs.length * (CW + 8) - 8;
    const startX = (W - totalW) / 2;
    c.moveTo(startX + i * (CW + 8), handY + bow);
    c.targetRot = angle;
    c.container.rotation = angle;
    c.container.zIndex = i + 10;
    layerCards.addChild(c.container);
    allCards.push(c);
  });

  layerCards.sortChildren();
}

// ============================================================
// Ticker
// ============================================================
let lastTime = performance.now();

app.ticker.add(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  goldDust.forEach(m => m.update(dt));
  allCards.forEach(c => c.update(dt));
});

// Boot
buildBackground();
buildGoldDust();
buildUI();
buildCards();
