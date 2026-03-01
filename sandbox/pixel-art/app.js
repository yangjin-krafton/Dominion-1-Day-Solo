// ============================================================
// PIXEL ART STYLE — PixiJS visual sandbox (no game logic)
// ============================================================

const W = 390;
const H = 844;
const PX = 2; // pixel unit size

// NES-inspired palette
const P = {
  bg:      0x0d0d1a,
  panel:   0x1a1a2e,
  border:  0x00ffcc,
  border2: 0xff0066,
  gold:    0xffdd00,
  silver:  0xaaaacc,
  copper:  0xcc6633,
  action:  0xff4466,
  victory: 0x44ffaa,
  dark:    0x111122,
  white:   0xffffff,
  gray:    0x666688,
  cyan:    0x00eeff,
  purple:  0xaa44ff,
  shadow:  0x000011,
};

// Card type definitions (visual only)
const CARD_DEFS = [
  { name: 'COPPER',   cost: 0, baseColor: P.copper,  icon: 'coin',   type: 'treasure' },
  { name: 'SILVER',   cost: 3, baseColor: P.silver,  icon: 'coin2',  type: 'treasure' },
  { name: 'GOLD',     cost: 6, baseColor: P.gold,    icon: 'coin3',  type: 'treasure' },
  { name: 'ESTATE',   cost: 2, baseColor: P.victory, icon: 'house',  type: 'victory'  },
  { name: 'SMITHY',   cost: 4, baseColor: P.action,  icon: 'hammer', type: 'action'   },
  { name: 'VILLAGE',  cost: 3, baseColor: P.cyan,    icon: 'tower',  type: 'action'   },
  { name: 'MARKET',   cost: 5, baseColor: P.purple,  icon: 'bag',    type: 'action'   },
];

// ============================================================
// PixiJS setup — pixel-perfect, no antialiasing
// ============================================================
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const app = new PIXI.Application({
  width: W,
  height: H,
  backgroundColor: P.bg,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: false,
});

document.querySelector('#game-container').appendChild(app.view);

// Scanline canvas overlay
buildScanlines();

// Layers
const layerBg    = new PIXI.Container();
const layerCards = new PIXI.Container();
const layerFx    = new PIXI.Container();
const layerUI    = new PIXI.Container();
app.stage.addChild(layerBg, layerCards, layerFx, layerUI);
layerCards.sortableChildren = true;

// ============================================================
// Pixel drawing helpers
// ============================================================

/** Draw a solid pixel rect (1 unit = PX px) */
function pxRect(g, col, px, py, pw, ph, alpha = 1) {
  g.beginFill(col, alpha);
  g.drawRect(px * PX, py * PX, pw * PX, ph * PX);
  g.endFill();
}

/** Draw a 1-px-unit border box */
function pxBorder(g, col, px, py, pw, ph, t = 1) {
  // top
  g.beginFill(col); g.drawRect(px*PX, py*PX, pw*PX, t*PX); g.endFill();
  // bottom
  g.beginFill(col); g.drawRect(px*PX, (py+ph-t)*PX, pw*PX, t*PX); g.endFill();
  // left
  g.beginFill(col); g.drawRect(px*PX, py*PX, t*PX, ph*PX); g.endFill();
  // right
  g.beginFill(col); g.drawRect((px+pw-t)*PX, py*PX, t*PX, ph*PX); g.endFill();
}

/** Pixel font text (chunky, no antialiasing) */
function pxText(str, fontSize, color, bold = true) {
  return new PIXI.Text(str, {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize,
    fontWeight: bold ? '900' : '400',
    fill: color,
    resolution: 2,
    align: 'center',
  });
}

// ============================================================
// Pixel-art icons (drawn with small rects)
// ============================================================

function drawIcon(g, type, cx, cy, col) {
  const d = (rx, ry, rw, rh) => pxRect(g, col, cx + rx, cy + ry, rw, rh);

  if (type === 'coin' || type === 'coin2' || type === 'coin3') {
    // Circle-ish coin
    d(-2, -3, 4, 1);
    d(-3, -2, 6, 4);
    d(-2,  2, 4, 1);
    // shine
    g.beginFill(0xffffff, 0.5);
    g.drawRect((cx-1)*PX, (cy-2)*PX, 1*PX, 2*PX);
    g.endFill();
  } else if (type === 'house') {
    // Roof
    d(-1, -3, 2, 1);
    d(-2, -2, 4, 1);
    d(-3, -1, 6, 1);
    // Walls
    d(-2,  0, 4, 3);
    // Door
    g.beginFill(P.dark);
    g.drawRect((cx-1)*PX, (cy+1)*PX, 2*PX, 2*PX);
    g.endFill();
  } else if (type === 'hammer') {
    // Head
    d(-2, -3, 4, 2);
    // Handle
    d(-1, -1, 2, 4);
  } else if (type === 'tower') {
    // Battlements
    d(-3, -4, 2, 1); d(1, -4, 2, 1);
    // Tower body
    d(-2, -3, 4, 7);
    // Arrow slit
    g.beginFill(P.dark);
    g.drawRect((cx-0.5)*PX, (cy-1)*PX, 1*PX, 2*PX);
    g.endFill();
  } else if (type === 'bag') {
    // Bag opening
    d(-1, -4, 2, 1);
    // Bag body
    d(-3, -3, 6, 1);
    d(-3, -2, 6, 5);
    d(-2,  3, 4, 1);
    // Shine
    g.beginFill(0xffffff, 0.3);
    g.drawRect((cx-2)*PX, (cy-2)*PX, 1*PX, 2*PX);
    g.endFill();
  }
}

// ============================================================
// Pixel-art Card
// ============================================================

const CARD_W = 28; // units
const CARD_H = 42; // units

class PixelCard {
  constructor(def, index) {
    this.def = def;
    this.index = index;

    this.container = new PIXI.Container();
    this.targetX = 0;
    this.targetY = 0;
    this.targetRot = 0;
    this.hovered = false;
    this.glowPhase = Math.random() * Math.PI * 2;

    this._build();
    this._interact();
  }

  _build() {
    const g = new PIXI.Graphics();
    const def = this.def;
    const w = CARD_W;
    const h = CARD_H;

    // Drop shadow (offset 2px)
    pxRect(g, P.shadow, 1, 1, w, h);

    // Card body
    pxRect(g, P.panel, 0, 0, w, h);

    // Top color band
    pxRect(g, def.baseColor, 1, 1, w - 2, 8);

    // Type stripe (bottom)
    pxRect(g, this._typeStripeColor(), 1, h - 5, w - 2, 4);

    // Border (2-tone pixel border)
    pxBorder(g, P.border, 0, 0, w, h, 1);
    // inner corner dots for pixel feel
    pxRect(g, P.border, 1, 1, 1, 1);
    pxRect(g, P.border, w - 2, 1, 1, 1);
    pxRect(g, P.border, 1, h - 2, 1, 1);
    pxRect(g, P.border, w - 2, h - 2, 1, 1);

    // Icon area background
    pxRect(g, P.dark, 3, 10, w - 6, 16);
    pxBorder(g, P.gray, 3, 10, w - 6, 16, 1);

    // Draw icon
    drawIcon(g, def.icon, w / 2, 18, def.baseColor);

    // Cost badge (top-left)
    pxRect(g, P.gold, 1, 1, 5, 5);
    pxBorder(g, P.dark, 1, 1, 5, 5, 1);

    this.gfx = g;
    this.container.addChild(g);

    // Name text
    const name = pxText(def.name, 7, P.white);
    name.anchor.set(0.5, 0);
    name.x = (w / 2) * PX;
    name.y = 27 * PX;
    this.container.addChild(name);

    // Cost text
    const cost = pxText(def.cost.toString(), 8, P.dark);
    cost.anchor.set(0.5);
    cost.x = 3.5 * PX;
    cost.y = 3.5 * PX;
    this.container.addChild(cost);

    // Type label
    const typeLabel = pxText(def.type.toUpperCase(), 5, this._typeStripeColor());
    typeLabel.anchor.set(0.5, 1);
    typeLabel.x = (w / 2) * PX;
    typeLabel.y = (h - 1) * PX;
    this.container.addChild(typeLabel);

    // Glow border (hidden by default)
    this.glowGfx = new PIXI.Graphics();
    this.container.addChildAt(this.glowGfx, 0);
  }

  _typeStripeColor() {
    if (this.def.type === 'treasure') return P.gold;
    if (this.def.type === 'victory')  return P.victory;
    return P.action;
  }

  _interact() {
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    this.container.on('pointerover', () => {
      this.hovered = true;
    });
    this.container.on('pointerout', () => {
      this.hovered = false;
      this.glowGfx.clear();
    });
  }

  update(dt) {
    const s = Math.min(1, dt * 9);
    const hoverLift = this.hovered ? -12 : 0;

    this.container.x += (this.targetX - this.container.x) * s;
    this.container.y += (this.targetY + hoverLift - this.container.y) * s;
    this.container.rotation += (this.targetRot - this.container.rotation) * s;

    const targetScale = this.hovered ? 1.12 : 1.0;
    this.container.scale.x += (targetScale - this.container.scale.x) * s;
    this.container.scale.y += (targetScale - this.container.scale.y) * s;

    if (this.hovered) {
      this.glowPhase += dt * 4;
      const pulse = (Math.sin(this.glowPhase) + 1) / 2;
      const alpha = 0.4 + pulse * 0.5;
      const expand = Math.round(pulse * 2);

      this.glowGfx.clear();
      // Outer pixel glow (blocky, not rounded)
      pxBorder(this.glowGfx, P.cyan, -expand, -expand, CARD_W + expand * 2, CARD_H + expand * 2, 1);
      this.glowGfx.alpha = alpha;
    }
  }

  moveTo(x, y, rot = 0) {
    this.targetX = x;
    this.targetY = y;
    this.targetRot = rot;
  }
}

// ============================================================
// Background: pixel grid / dungeon floor
// ============================================================

function buildBackground() {
  const g = new PIXI.Graphics();

  // Base floor tiles (checkerboard, subtle)
  const tileSize = 16;
  for (let ty = 0; ty < H / tileSize + 1; ty++) {
    for (let tx = 0; tx < W / tileSize + 1; tx++) {
      const light = (tx + ty) % 2 === 0;
      g.beginFill(light ? 0x12122a : 0x0f0f20);
      g.drawRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
      g.endFill();
    }
  }

  // Grid lines (pixel perfect, 1px)
  g.lineStyle(1, 0x1a1a3a, 0.6);
  for (let x = 0; x <= W; x += tileSize) {
    g.moveTo(x, 0); g.lineTo(x, H);
  }
  for (let y = 0; y <= H; y += tileSize) {
    g.moveTo(0, y); g.lineTo(W, y);
  }

  layerBg.addChild(g);
}

// ============================================================
// UI Panels (pixel-bordered)
// ============================================================

function buildPanels() {
  // Top HUD panel
  const topPanel = new PIXI.Graphics();
  pxRect(topPanel, P.panel, 0, 0, W / PX, 40);
  pxBorder(topPanel, P.border, 0, 0, W / PX, 40, 1);
  // Pixel corner accents
  pxRect(topPanel, P.cyan,   0, 0, 3, 3);
  pxRect(topPanel, P.cyan,   W / PX - 3, 0, 3, 3);
  layerUI.addChild(topPanel);

  // HUD text
  const hudTitle = pxText('DOMINION', 14, P.cyan);
  hudTitle.anchor.set(0, 0.5);
  hudTitle.x = 10;
  hudTitle.y = 40;
  layerUI.addChild(hudTitle);

  const hudRight = pxText('VP:03  TURN:01', 10, P.gold);
  hudRight.anchor.set(1, 0.5);
  hudRight.x = W - 8;
  hudRight.y = 40;
  layerUI.addChild(hudRight);

  // Bottom status bar
  const botPanel = new PIXI.Graphics();
  const botY = (H - 60) / PX;
  pxRect(botPanel, P.panel, 0, botY, W / PX, 60 / PX);
  pxBorder(botPanel, P.border2, 0, botY, W / PX, 60 / PX, 1);
  pxRect(botPanel, P.action, 0, botY, 3, 3);
  pxRect(botPanel, P.action, W / PX - 3, botY, 3, 3);
  layerUI.addChild(botPanel);

  // Status text
  const statusLabels = ['ACT:1', 'BUY:1', 'COIN:0', 'DECK:10'];
  statusLabels.forEach((label, i) => {
    const t = pxText(label, 10, P.white);
    t.anchor.set(0.5, 0.5);
    t.x = 45 + i * 82;
    t.y = H - 30;
    layerUI.addChild(t);
  });

  // Section dividers (pixel pipes)
  for (let i = 1; i < 4; i++) {
    const div = new PIXI.Graphics();
    div.beginFill(P.border2);
    div.drawRect(i * 82 + 5, H - 52, PX, 44);
    div.endFill();
    layerUI.addChild(div);
  }

  // Supply area label
  const supplyLabel = pxText('[ SUPPLY ]', 11, P.border);
  supplyLabel.anchor.set(0.5, 0);
  supplyLabel.x = W / 2;
  supplyLabel.y = 62;
  layerUI.addChild(supplyLabel);

  // Hand area label
  const handLabel = pxText('[ HAND ]', 11, P.border2);
  handLabel.anchor.set(0.5, 0);
  handLabel.x = W / 2;
  handLabel.y = H - 200;
  layerUI.addChild(handLabel);
}

// ============================================================
// Pixel particles (floating sparks)
// ============================================================

const particles = [];

class Spark {
  constructor() {
    this.reset();
    this.y = Math.random() * H; // start scattered
  }

  reset() {
    this.x = Math.random() * W;
    this.y = H + 4;
    this.vx = (Math.random() - 0.5) * 20;
    this.vy = -(20 + Math.random() * 40);
    this.life = 1.0;
    this.decay = 0.003 + Math.random() * 0.005;
    this.size = Math.random() < 0.5 ? PX : PX * 2;
    const colors = [P.cyan, P.gold, P.action, P.purple, P.victory, P.border];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.gfx = new PIXI.Graphics();
    layerFx.addChild(this.gfx);
  }

  update(dt) {
    this.life -= this.decay;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 5 * dt; // gentle gravity

    if (this.life <= 0 || this.y < -10) {
      this.gfx.clear();
      this.x = Math.random() * W;
      this.y = H + 4;
      this.vx = (Math.random() - 0.5) * 20;
      this.vy = -(20 + Math.random() * 40);
      this.life = 1.0;
    } else {
      this.gfx.clear();
      this.gfx.beginFill(this.color, this.life);
      this.gfx.drawRect(
        Math.round(this.x / PX) * PX,
        Math.round(this.y / PX) * PX,
        this.size,
        this.size
      );
      this.gfx.endFill();
    }
  }
}

function buildParticles() {
  for (let i = 0; i < 40; i++) {
    particles.push(new Spark());
  }
}

// ============================================================
// Scanlines overlay (canvas 2D)
// ============================================================

function buildScanlines() {
  const canvas = document.getElementById('scanlines');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, y, canvas.width, 2);
  }
}

// ============================================================
// Card layout
// ============================================================

const allCards = [];

function buildCards() {
  // Supply row: top 4 cards
  const supplyDefs = CARD_DEFS.slice(0, 4);
  const supplyY = 90;
  const supplySpacing = (W - 20) / supplyDefs.length;

  supplyDefs.forEach((def, i) => {
    const card = new PixelCard(def, i);
    const cx = 10 + supplySpacing * i + supplySpacing / 2 - (CARD_W * PX) / 2;
    card.container.x = cx;
    card.container.y = supplyY;
    card.targetX = cx;
    card.targetY = supplyY;
    card.container.zIndex = i;
    layerCards.addChild(card.container);
    allCards.push(card);
  });

  // Action row: 3 cards below supply
  const actionDefs = CARD_DEFS.slice(4);
  const actY = 260;
  const actSpacing = W / (actionDefs.length + 1);

  actionDefs.forEach((def, i) => {
    const card = new PixelCard(def, i + 4);
    const cx = actSpacing * (i + 1) - (CARD_W * PX) / 2;
    card.container.x = cx;
    card.container.y = actY;
    card.targetX = cx;
    card.targetY = actY;
    card.container.zIndex = i + 4;
    layerCards.addChild(card.container);
    allCards.push(card);
  });

  // Hand row: 5 cards at bottom
  const handDefs = [CARD_DEFS[0], CARD_DEFS[0], CARD_DEFS[3], CARD_DEFS[0], CARD_DEFS[3]];
  const handY = H - 180;
  const handSpacing = (W - 40) / (handDefs.length + 1);

  handDefs.forEach((def, i) => {
    const card = new PixelCard(def, i + 10);
    const angle = (i - 2) * 0.06;
    const yBow = Math.abs(i - 2) * 4;
    const cx = 20 + handSpacing * (i + 1) - (CARD_W * PX) / 2;
    card.container.x = cx;
    card.container.y = handY + yBow;
    card.targetX = cx;
    card.targetY = handY + yBow;
    card.targetRot = angle;
    card.container.zIndex = i + 10;
    layerCards.addChild(card.container);
    allCards.push(card);
  });

  layerCards.sortChildren();
}

// ============================================================
// Ticker (animate sparks + cards)
// ============================================================

let lastTime = performance.now();

app.ticker.add(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  particles.forEach(p => p.update(dt));
  allCards.forEach(c => c.update(dt));
});

// ============================================================
// Boot
// ============================================================

buildBackground();
buildParticles();
buildPanels();
buildCards();
