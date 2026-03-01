// ============================================================
// NEON CYBERPUNK — PixiJS visual sandbox
// Techniques: BlurFilter glow, data-stream particles, glitch hover
// ============================================================

const W = 390, H = 844;
const CW = 86, CH = 124; // card size in px

const C = {
  bg:     0x060616,
  panel:  0x09091f,
  grid:   0x0d0d30,
  cyan:   0x00ffdd,
  pink:   0xff0077,
  yellow: 0xffe000,
  green:  0x00ff88,
  purple: 0xbb00ff,
  white:  0xffffff,
  dim:    0x334466,
  dark:   0x030310,
};

const TYPE_COLOR = {
  Action:   C.cyan,
  Treasure: C.yellow,
  Victory:  C.green,
};

const CARD_DEFS = [
  { name: 'Smithy',        cost: 4, type: 'Action',   desc: '+3 Cards' },
  { name: 'Village',       cost: 3, type: 'Action',   desc: '+1 Card\n+2 Actions' },
  { name: 'Market',        cost: 5, type: 'Action',   desc: '+1 Card\n+1 Action\n+1 Buy\n+$1' },
  { name: 'Council\nRoom', cost: 5, type: 'Action',   desc: '+4 Cards\n+1 Buy\n\nEach other player draws a card.' },
  { name: 'Copper',        cost: 0, type: 'Treasure', desc: '$1' },
  { name: 'Silver',        cost: 3, type: 'Treasure', desc: '$2' },
  { name: 'Gold',          cost: 6, type: 'Treasure', desc: '$3' },
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
// Background: perspective grid
// ============================================================
function buildBackground() {
  const g = new PIXI.Graphics();

  // Base fill
  g.beginFill(C.bg); g.drawRect(0, 0, W, H); g.endFill();

  const vanishX = W / 2;
  const vanishY = H * 0.42;
  const lineColor = 0x0d1240;
  const lineAlpha = 0.9;

  // Horizontal lines (evenly spaced, converging effect via opacity)
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const y = vanishY + (H - vanishY) * (t * t);
    g.lineStyle(1, lineColor, lineAlpha * (0.2 + t * 0.8));
    g.moveTo(0, y); g.lineTo(W, y);
  }
  // Vertical lines converging to vanishing point
  for (let i = -12; i <= 12; i++) {
    const endX = i * (W / 12);
    g.lineStyle(1, lineColor, lineAlpha * 0.6);
    g.moveTo(vanishX, vanishY);
    g.lineTo(vanishX + endX, H);
  }

  // Horizon glow line
  const horizGlow = new PIXI.Graphics();
  horizGlow.beginFill(C.cyan, 0.08);
  horizGlow.drawRect(0, vanishY - 2, W, 4);
  horizGlow.endFill();
  horizGlow.filters = [new PIXI.filters.BlurFilter(6)];

  layerBg.addChild(g, horizGlow);

  // Corner bracket decorations
  const brackets = new PIXI.Graphics();
  const bLen = 20, bT = 2;
  [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(([bx, by], idx) => {
    const sx = idx % 2 === 0 ? 1 : -1;
    const sy = idx < 2 ? 1 : -1;
    brackets.lineStyle(bT, C.cyan, 0.7);
    brackets.moveTo(bx, by + sy * bLen); brackets.lineTo(bx, by); brackets.lineTo(bx + sx * bLen, by);
  });
  layerBg.addChild(brackets);
}

// ============================================================
// Data stream particles
// ============================================================
const streams = [];

class DataStream {
  constructor() {
    this.reset(true);
    this.gfx = new PIXI.Text('', {
      fontFamily: '"Courier New", monospace',
      fontSize: 9,
      fill: C.cyan,
    });
    layerFx.addChild(this.gfx);
  }

  reset(initial = false) {
    this.x = Math.random() * W;
    this.y = initial ? Math.random() * H : -20;
    this.speed = 30 + Math.random() * 60;
    this.alpha = 0.08 + Math.random() * 0.25;
    this.chars = Array.from({ length: 6 + Math.floor(Math.random() * 8) },
      () => String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)));
    this.interval = 0;
    this.tick = 0;
  }

  update(dt) {
    this.y += this.speed * dt;
    this.tick += dt;
    if (this.tick > 0.18) {
      this.tick = 0;
      // Scramble top char
      this.chars[0] = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96));
    }
    if (this.y > H + 60) this.reset();

    this.gfx.text = this.chars.join('\n');
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.gfx.alpha = this.alpha;
  }
}

function buildStreams() {
  for (let i = 0; i < 28; i++) streams.push(new DataStream());
}

// ============================================================
// Neon Card
// ============================================================
class NeonCard {
  constructor(def, idx) {
    this.def = def;
    this.idx = idx;
    this.nc = TYPE_COLOR[def.type];
    this.container = new PIXI.Container();

    this.targetX = 0;
    this.targetY = 0;
    this.targetRot = 0;
    this.hovered = false;
    this.glowPhase = Math.random() * Math.PI * 2;
    this.glitchTimer = 0;
    this.glitchOffset = 0;

    this._build();
    this._interact();
  }

  _build() {
    // --- Glow bloom behind card ---
    this.bloomGfx = new PIXI.Graphics();
    this.bloomGfx.beginFill(this.nc, 0.35);
    this.bloomGfx.drawRect(-6, -6, CW + 12, CH + 12);
    this.bloomGfx.endFill();
    this.bloomGfx.filters = [new PIXI.filters.BlurFilter(16)];
    this.bloomGfx.alpha = 0;
    this.container.addChild(this.bloomGfx);

    // --- Card body ---
    const g = new PIXI.Graphics();

    // Shadow
    g.beginFill(0x000000, 0.5);
    g.drawRect(3, 3, CW, CH);
    g.endFill();

    // Body fill
    g.beginFill(C.panel);
    g.drawRect(0, 0, CW, CH);
    g.endFill();

    // Top type-color band
    g.beginFill(this.nc, 0.12);
    g.drawRect(0, 0, CW, 28);
    g.endFill();

    // Outer neon border
    g.lineStyle(1.5, this.nc, 0.9);
    g.drawRect(0, 0, CW, CH);

    // Inner thin border (offset 2px)
    g.lineStyle(0.5, this.nc, 0.3);
    g.drawRect(3, 3, CW - 6, CH - 6);

    // Corner accent dots
    const dots = [[0,0],[CW,0],[0,CH],[CW,CH]];
    dots.forEach(([dx, dy]) => {
      g.lineStyle(0);
      g.beginFill(this.nc, 0.9);
      g.drawRect(dx - 2, dy - 2, 4, 4);
      g.endFill();
    });

    // Separator line after title
    g.lineStyle(1, this.nc, 0.5);
    g.moveTo(6, 30); g.lineTo(CW - 6, 30);

    // Separator line before type label
    g.lineStyle(1, this.nc, 0.3);
    g.moveTo(6, CH - 18); g.lineTo(CW - 6, CH - 18);

    this.container.addChild(g);

    // --- Cost badge (top-left hexagon) ---
    const costBadge = new PIXI.Graphics();
    costBadge.lineStyle(1.5, C.yellow, 1);
    costBadge.beginFill(C.dark);
    const hx = 9, hy = 10, hr = 9;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = hx + hr * Math.cos(angle);
      const py = hy + hr * Math.sin(angle);
      i === 0 ? costBadge.moveTo(px, py) : costBadge.lineTo(px, py);
    }
    costBadge.closePath();
    costBadge.endFill();
    this.container.addChild(costBadge);

    const costText = new PIXI.Text(this.def.cost.toString(), {
      fontFamily: '"Courier New", monospace',
      fontSize: 11, fontWeight: 'bold', fill: C.yellow,
    });
    costText.anchor.set(0.5);
    costText.x = hx; costText.y = hy;
    this.container.addChild(costText);

    // --- Card name ---
    const nameText = new PIXI.Text(this.def.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: 11, fontWeight: 'bold',
      fill: this.nc,
      align: 'center',
    });
    nameText.anchor.set(0.5, 0.5);
    nameText.x = CW / 2; nameText.y = 15;
    this.container.addChild(nameText);

    // --- Description text ---
    const descText = new PIXI.Text(this.def.desc, {
      fontFamily: '"Courier New", monospace',
      fontSize: 10,
      fill: C.white,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: CW - 14,
      lineHeight: 14,
    });
    descText.anchor.set(0.5, 0.5);
    descText.x = CW / 2;
    descText.y = (30 + CH - 18) / 2;
    this.container.addChild(descText);

    // --- Type label (bottom) ---
    const typeText = new PIXI.Text(this.def.type.toUpperCase(), {
      fontFamily: '"Courier New", monospace',
      fontSize: 8,
      fill: this.nc,
      alpha: 0.7,
      align: 'center',
    });
    typeText.anchor.set(0.5, 0.5);
    typeText.x = CW / 2; typeText.y = CH - 10;
    this.container.addChild(typeText);

    // Glitch strips (hidden by default)
    this.glitchGfx = new PIXI.Graphics();
    this.container.addChild(this.glitchGfx);
  }

  _interact() {
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.on('pointerover', () => { this.hovered = true; });
    this.container.on('pointerout',  () => { this.hovered = false; this.glitchGfx.clear(); });
  }

  _updateGlitch(dt) {
    this.glitchTimer -= dt;
    if (this.glitchTimer <= 0) {
      this.glitchTimer = 0.05 + Math.random() * 0.15;
      this.glitchOffset = (Math.random() - 0.5) * 6;
    }

    this.glitchGfx.clear();
    if (Math.random() < 0.3) {
      // Random horizontal slice offset
      const y1 = Math.random() * CH;
      const h  = 3 + Math.random() * 8;
      this.glitchGfx.beginFill(this.nc, 0.15);
      this.glitchGfx.drawRect(this.glitchOffset, y1, CW, h);
      this.glitchGfx.endFill();
    }
  }

  update(dt) {
    const s = Math.min(1, dt * 9);
    const liftY = this.hovered ? -14 : 0;

    this.container.x += (this.targetX - this.container.x) * s;
    this.container.y += (this.targetY + liftY - this.container.y) * s;
    this.container.rotation += (this.targetRot - this.container.rotation) * s;

    const tScale = this.hovered ? 1.08 : 1.0;
    this.container.scale.x += (tScale - this.container.scale.x) * s;
    this.container.scale.y += (tScale - this.container.scale.y) * s;

    // Bloom glow
    this.glowPhase += dt * (this.hovered ? 5 : 2);
    const pulse = (Math.sin(this.glowPhase) + 1) / 2;
    const targetBloom = this.hovered ? 0.6 + pulse * 0.4 : 0.0;
    this.bloomGfx.alpha += (targetBloom - this.bloomGfx.alpha) * s;

    if (this.hovered) this._updateGlitch(dt);
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
  // Top HUD
  const hudBg = new PIXI.Graphics();
  hudBg.beginFill(C.panel, 0.95);
  hudBg.drawRect(0, 0, W, 52);
  hudBg.endFill();
  hudBg.lineStyle(1, C.cyan, 0.5);
  hudBg.moveTo(0, 52); hudBg.lineTo(W, 52);
  layerUI.addChild(hudBg);

  const title = new PIXI.Text('DOMINION', {
    fontFamily: '"Courier New", monospace',
    fontSize: 18, fontWeight: '900', fill: C.cyan, letterSpacing: 4,
  });
  title.x = 14; title.y = 14;
  layerUI.addChild(title);

  const vpText = new PIXI.Text('VP:003  TRN:001', {
    fontFamily: '"Courier New", monospace',
    fontSize: 10, fill: C.pink,
  });
  vpText.anchor.set(1, 0);
  vpText.x = W - 10; vpText.y = 10;
  layerUI.addChild(vpText);

  const subText = new PIXI.Text('DECK:10  DISCARD:00  ACT:1  BUY:1  COIN:0', {
    fontFamily: '"Courier New", monospace',
    fontSize: 8, fill: C.dim,
  });
  subText.x = 14; subText.y = 36;
  layerUI.addChild(subText);

  // Section labels
  [['[ SUPPLY MATRIX ]', 60, C.cyan], ['[ HAND INTERFACE ]', H - 198, C.pink]]
    .forEach(([label, y, col]) => {
      const t = new PIXI.Text(label, {
        fontFamily: '"Courier New", monospace', fontSize: 9, fill: col, alpha: 0.8,
      });
      t.anchor.set(0.5, 0);
      t.x = W / 2; t.y = y;
      layerUI.addChild(t);
    });

  // Bottom status bar
  const botBg = new PIXI.Graphics();
  botBg.beginFill(C.panel, 0.95);
  botBg.drawRect(0, H - 52, W, 52);
  botBg.endFill();
  botBg.lineStyle(1, C.pink, 0.5);
  botBg.moveTo(0, H - 52); botBg.lineTo(W, H - 52);
  layerUI.addChild(botBg);

  const statLabels = ['ACT: 1', 'BUY: 1', 'COIN: 0', 'DECK: 10'];
  statLabels.forEach((label, i) => {
    const t = new PIXI.Text(label, {
      fontFamily: '"Courier New", monospace', fontSize: 10, fill: C.white,
    });
    t.anchor.set(0.5, 0.5);
    t.x = W / 4 * i + W / 8;
    t.y = H - 26;
    layerUI.addChild(t);
  });
}

// ============================================================
// Card layout
// ============================================================
const allCards = [];

function buildCards() {
  // Supply: top 4 (action + treasure)
  const supply = CARD_DEFS.slice(0, 4);
  const supplyY = 74;
  supply.forEach((def, i) => {
    const c = new NeonCard(def, i);
    const x = W / 4 * i + (W / 4 - CW) / 2;
    c.moveTo(x, supplyY);
    c.container.zIndex = i;
    layerCards.addChild(c.container);
    allCards.push(c);
  });

  // Supply row 2: treasure + victory
  const supply2 = CARD_DEFS.slice(4);
  const supply2Y = 74 + CH + 14;
  supply2.forEach((def, i) => {
    const c = new NeonCard(def, i + 4);
    const totalW = supply2.length * CW + (supply2.length - 1) * 12;
    const startX = (W - totalW) / 2;
    const x = startX + i * (CW + 12);
    c.moveTo(x, supply2Y);
    c.container.zIndex = i + 4;
    layerCards.addChild(c.container);
    allCards.push(c);
  });

  // Hand: 5 cards fan
  const handDefs = [CARD_DEFS[4], CARD_DEFS[4], CARD_DEFS[6], CARD_DEFS[0], CARD_DEFS[6]];
  const handY = H - 52 - CH - 14;
  handDefs.forEach((def, i) => {
    const c = new NeonCard(def, i + 10);
    const angle = (i - 2) * 0.055;
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

  streams.forEach(s => s.update(dt));
  allCards.forEach(c => c.update(dt));
});

// Boot
buildBackground();
buildStreams();
buildUI();
buildCards();
