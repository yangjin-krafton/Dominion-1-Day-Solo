// ============================================================
// STAINED GLASS — PixiJS visual sandbox
// Techniques: BLEND_MODES.ADD for transmitted light,
//             lead caming frames, animated light beams,
//             semi-transparent jewel glass panels
// ============================================================

const W = 390, H = 844;
const CW = 86, CH = 128;

const C = {
  bg:    0x111118,
  stone: 0x1c1c28,
  lead:  0x0a0a12,
  white: 0xffffff,
  cream: 0xfff8e8,
  dim:   0x888899,

  // Glass colors (rich, saturated)
  glassViolet:  0x6633cc,
  glassBlue:    0x1144cc,
  glassGreen:   0x115533,
  glassAmber:   0xcc7700,
  glassRed:     0xaa1122,
  glassTeal:    0x116677,
  glassGold:    0xcc9900,
  glassRose:    0x992255,

  // Transmitted light colors (brighter, additive)
  lightViolet:  0xaa66ff,
  lightBlue:    0x4488ff,
  lightGreen:   0x44dd88,
  lightAmber:   0xffcc44,
  lightRed:     0xff4466,
  lightTeal:    0x44ccdd,
  lightGold:    0xffdd44,
  lightRose:    0xff66aa,
};

const TYPE_GLASS = {
  Action:   { dark: C.glassViolet, light: C.lightViolet },
  Treasure: { dark: C.glassAmber,  light: C.lightAmber  },
  Victory:  { dark: C.glassGreen,  light: C.lightGreen  },
};

const CARD_DEFS = [
  { name: 'Smithy',        cost: 4, type: 'Action',   desc: '+3 Cards' },
  { name: 'Village',       cost: 3, type: 'Action',   desc: '+1 Card\n+2 Actions' },
  { name: 'Market',        cost: 5, type: 'Action',   desc: '+1 Card\n+1 Action\n+1 Buy\n+$1' },
  { name: 'Council Room',  cost: 5, type: 'Action',   desc: '+4 Cards\n+1 Buy\n\nEach other player draws a card.' },
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
const layerBeams = new PIXI.Container(); // additive light beams
const layerCards = new PIXI.Container();
const layerFx    = new PIXI.Container();
const layerUI    = new PIXI.Container();
app.stage.addChild(layerBg, layerBeams, layerCards, layerFx, layerUI);
layerCards.sortableChildren = true;

// ============================================================
// Background: cathedral stone wall
// ============================================================
function buildBackground() {
  const g = new PIXI.Graphics();

  // Stone base
  g.beginFill(C.bg); g.drawRect(0, 0, W, H); g.endFill();

  // Stone block grid
  const bW = 40, bH = 20;
  for (let row = 0; row < H / bH + 1; row++) {
    for (let col = 0; col < W / bW + 1; col++) {
      const offset = row % 2 === 0 ? 0 : bW / 2;
      const bx = col * bW - offset;
      const by = row * bH;

      // Stone face (slight variation)
      const shade = 0x1a + Math.floor(Math.random() * 6);
      g.beginFill((shade << 16) | (shade << 8) | (shade + 8));
      g.drawRect(bx + 1, by + 1, bW - 2, bH - 2);
      g.endFill();

      // Mortar lines
      g.lineStyle(1, C.lead, 0.8);
      g.drawRect(bx, by, bW, bH);
    }
  }

  layerBg.addChild(g);

  // Soft ambient glow from "window" above
  const ambient = new PIXI.Graphics();
  ambient.beginFill(0x2233ff, 0.06);
  ambient.drawEllipse(W / 2, 0, W * 0.8, H * 0.5);
  ambient.endFill();
  ambient.filters = [new PIXI.filters.BlurFilter(30)];
  layerBg.addChild(ambient);
}

// ============================================================
// Animated light beams (BLEND_MODES.ADD)
// ============================================================
let beamTime = 0;
const NUM_BEAMS = 5;
const beamColors = [C.lightViolet, C.lightAmber, C.lightBlue, C.lightGreen, C.lightRose];

function buildBeams() {
  for (let i = 0; i < NUM_BEAMS; i++) {
    const beam = new PIXI.Graphics();
    beam.blendMode = PIXI.BLEND_MODES.ADD;
    layerBeams.addChild(beam);
  }
}

function updateBeams(dt) {
  beamTime += dt * 0.3;
  layerBeams.children.forEach((beam, i) => {
    const phase = beamTime + (i / NUM_BEAMS) * Math.PI * 2;
    const cx = W / 2 + Math.sin(phase * 0.7) * W * 0.4;
    const spread = 30 + Math.sin(phase * 1.1) * 20;
    const alpha = 0.018 + Math.sin(phase * 0.9) * 0.008;

    beam.clear();
    beam.beginFill(beamColors[i], alpha);
    // Triangular beam from top
    beam.moveTo(cx, -10);
    beam.lineTo(cx - spread, H);
    beam.lineTo(cx + spread, H);
    beam.closePath();
    beam.endFill();
  });
}

// ============================================================
// Glass sparkle particles (edge of glass)
// ============================================================
const sparkles = [];
class GlassSparkle {
  constructor() {
    this.reset(true);
    this.gfx = new PIXI.Graphics();
    this.gfx.blendMode = PIXI.BLEND_MODES.ADD;
    layerFx.addChild(this.gfx);
  }
  reset(init = false) {
    this.x = Math.random() * W;
    this.y = init ? Math.random() * H : Math.random() * H * 0.7;
    this.life = 1.0;
    this.decay = 0.015 + Math.random() * 0.025;
    this.r = 1 + Math.random() * 2;
    const colors = [C.lightViolet, C.lightAmber, C.lightBlue, C.lightGreen, C.lightGold];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.vy = -(5 + Math.random() * 15);
  }
  update(dt) {
    this.life -= this.decay;
    this.y += this.vy * dt;
    if (this.life <= 0) this.reset();
    else {
      this.gfx.clear();
      this.gfx.beginFill(this.color, this.life * 0.6);
      this.gfx.drawCircle(this.x, this.y, this.r);
      this.gfx.endFill();
      // Cross sparkle
      if (this.r > 1.5) {
        this.gfx.beginFill(this.color, this.life * 0.3);
        this.gfx.drawRect(this.x - 4, this.y - 0.5, 8, 1);
        this.gfx.drawRect(this.x - 0.5, this.y - 4, 1, 8);
        this.gfx.endFill();
      }
    }
  }
}

function buildSparkles() {
  for (let i = 0; i < 35; i++) sparkles.push(new GlassSparkle());
}

// ============================================================
// Stained Glass Card
// ============================================================
class StainedGlassCard {
  constructor(def, idx) {
    this.def = def;
    this.idx = idx;
    this.glass = TYPE_GLASS[def.type];
    this.container = new PIXI.Container();

    this.targetX = 0; this.targetY = 0; this.targetRot = 0;
    this.hovered = false;
    this.lightPhase = Math.random() * Math.PI * 2;

    this._build();
    this._interact();
  }

  _build() {
    // Light bloom behind card (additive)
    this.bloom = new PIXI.Graphics();
    this.bloom.blendMode = PIXI.BLEND_MODES.ADD;
    this.bloom.beginFill(this.glass.light, 0.25);
    this.bloom.drawRect(-8, -8, CW + 16, CH + 16);
    this.bloom.endFill();
    this.bloom.filters = [new PIXI.filters.BlurFilter(14)];
    this.bloom.alpha = 0.1;
    this.container.addChild(this.bloom);

    const g = new PIXI.Graphics();

    // ─── Lead outer frame ───
    g.beginFill(C.lead);
    g.drawRect(0, 0, CW, CH);
    g.endFill();

    const L = 4; // lead thickness

    // ─── Top glass panel (type color) ───
    g.beginFill(this.glass.dark, 0.85);
    g.drawRect(L, L, CW - L * 2, 30);
    g.endFill();

    // Light transmitted through top glass (additive layer)
    const topLight = new PIXI.Graphics();
    topLight.blendMode = PIXI.BLEND_MODES.ADD;
    topLight.beginFill(this.glass.light, 0.2);
    topLight.drawRect(L, L, CW - L * 2, 30);
    topLight.endFill();
    this.container.addChild(topLight);

    // ─── Middle text glass (dark, readable) ───
    g.beginFill(0x08080e, 0.92);
    g.drawRect(L, L + 30 + L, CW - L * 2, CH - (L + 30 + L) - (18 + L));
    g.endFill();

    // ─── Bottom type panel ───
    g.beginFill(this.glass.dark, 0.6);
    g.drawRect(L, CH - 18, CW - L * 2, 14);
    g.endFill();

    const botLight = new PIXI.Graphics();
    botLight.blendMode = PIXI.BLEND_MODES.ADD;
    botLight.beginFill(this.glass.light, 0.12);
    botLight.drawRect(L, CH - 18, CW - L * 2, 14);
    botLight.endFill();
    this.container.addChild(botLight);

    // ─── Lead H-dividers ───
    g.beginFill(C.lead);
    g.drawRect(L, L + 30, CW - L * 2, L);          // below title
    g.drawRect(L, CH - 18 - L, CW - L * 2, L);      // above type
    g.endFill();

    // ─── Lead border highlight (inner bevel feel) ───
    g.lineStyle(0.5, 0x2a2a3a, 0.6);
    g.drawRect(L, L, CW - L * 2, CH - L * 2);

    this.container.addChild(g);

    // ─── Rose window in top panel (decorative circles) ───
    const rose = new PIXI.Graphics();
    rose.blendMode = PIXI.BLEND_MODES.ADD;
    const roseX = CW / 2, roseY = L + 15;
    // Center circle
    rose.lineStyle(1.5, C.lead, 1);
    rose.beginFill(this.glass.light, 0.15);
    rose.drawCircle(roseX, roseY, 8);
    rose.endFill();
    // Petal circles
    for (let p = 0; p < 6; p++) {
      const angle = (Math.PI / 3) * p;
      const px = roseX + 10 * Math.cos(angle);
      const py = roseY + 10 * Math.sin(angle);
      rose.lineStyle(1, C.lead, 1);
      rose.beginFill(this.glass.dark, 0.5);
      rose.drawCircle(px, py, 5);
      rose.endFill();
    }
    this.container.addChild(rose);

    // ─── Cost badge ───
    const badge = new PIXI.Graphics();
    badge.beginFill(C.lead);
    badge.drawCircle(L + 8, L + 8, 8);
    badge.endFill();
    badge.lineStyle(1.5, this.glass.light, 0.8);
    badge.drawCircle(L + 8, L + 8, 7);
    this.container.addChild(badge);

    const costText = new PIXI.Text(this.def.cost.toString(), {
      fontFamily: 'Georgia, serif', fontSize: 10, fontWeight: 'bold',
      fill: C.cream,
    });
    costText.anchor.set(0.5); costText.x = L + 8; costText.y = L + 8;
    this.container.addChild(costText);

    // ─── Card name (in type glass panel) ───
    const nameText = new PIXI.Text(this.def.name, {
      fontFamily: 'Georgia, serif',
      fontSize: 10, fontWeight: 'bold',
      fill: C.cream, align: 'center',
      dropShadow: true, dropShadowDistance: 1, dropShadowAlpha: 0.8,
    });
    nameText.anchor.set(0.5);
    nameText.x = CW / 2 + 4; // offset right to avoid cost badge
    nameText.y = L + 15;
    this.container.addChild(nameText);

    // ─── Description (dark middle panel) ───
    const topOfText = L + 30 + L;
    const botOfText = CH - 18 - L;
    const descText = new PIXI.Text(this.def.desc, {
      fontFamily: 'Georgia, serif',
      fontSize: 10, fill: C.cream,
      align: 'center',
      wordWrap: true, wordWrapWidth: CW - L * 2 - 8,
      lineHeight: 14,
    });
    descText.anchor.set(0.5);
    descText.x = CW / 2;
    descText.y = (topOfText + botOfText) / 2;
    this.container.addChild(descText);

    // ─── Type label ───
    const typeText = new PIXI.Text(this.def.type.toUpperCase(), {
      fontFamily: 'Georgia, serif', fontSize: 7, fontStyle: 'italic',
      fill: this.glass.light, align: 'center',
    });
    typeText.anchor.set(0.5);
    typeText.x = CW / 2; typeText.y = CH - 11;
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
    const liftY = this.hovered ? -13 : 0;

    this.container.x += (this.targetX - this.container.x) * s;
    this.container.y += (this.targetY + liftY - this.container.y) * s;
    this.container.rotation += (this.targetRot - this.container.rotation) * s;

    const tScale = this.hovered ? 1.09 : 1.0;
    this.container.scale.x += (tScale - this.container.scale.x) * s;
    this.container.scale.y += (tScale - this.container.scale.y) * s;

    // Bloom pulse
    this.lightPhase += dt * (this.hovered ? 3.5 : 1.2);
    const pulse = (Math.sin(this.lightPhase) + 1) / 2;
    const targetBloom = this.hovered ? 0.5 + pulse * 0.5 : 0.08 + pulse * 0.04;
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
  const topBg = new PIXI.Graphics();
  topBg.beginFill(C.lead, 0.96);
  topBg.drawRect(0, 0, W, 54);
  topBg.endFill();
  topBg.lineStyle(2, C.stone, 1);
  topBg.moveTo(0, 54); topBg.lineTo(W, 54);
  layerUI.addChild(topBg);

  // Decorative top border strip
  const strip = new PIXI.Graphics();
  strip.beginFill(C.glassBlue, 0.6); strip.drawRect(0, 52, W / 3, 2); strip.endFill();
  strip.beginFill(C.glassAmber, 0.6); strip.drawRect(W / 3, 52, W / 3, 2); strip.endFill();
  strip.beginFill(C.glassViolet, 0.6); strip.drawRect(W * 2 / 3, 52, W / 3, 2); strip.endFill();
  layerUI.addChild(strip);

  const title = new PIXI.Text('Dominion', {
    fontFamily: 'Georgia, serif',
    fontSize: 20, fontStyle: 'italic', fontWeight: 'bold',
    fill: C.lightAmber,
  });
  title.x = 14; title.y = 14;
  layerUI.addChild(title);

  const vpText = new PIXI.Text('VP ❖ 3   Turn ❖ 1', {
    fontFamily: 'Georgia, serif', fontSize: 10, fill: C.dim,
  });
  vpText.anchor.set(1, 0.5);
  vpText.x = W - 12; vpText.y = 28;
  layerUI.addChild(vpText);

  [['— Supply —', 62, C.dim], ['— Hand —', H - 200, C.dim]]
    .forEach(([label, y, col]) => {
      const t = new PIXI.Text(label, {
        fontFamily: 'Georgia, serif', fontSize: 9, fontStyle: 'italic', fill: col,
      });
      t.anchor.set(0.5, 0); t.x = W / 2; t.y = y;
      layerUI.addChild(t);
    });

  // Bottom bar
  const botBg = new PIXI.Graphics();
  botBg.beginFill(C.lead, 0.96);
  botBg.drawRect(0, H - 52, W, 52);
  botBg.endFill();
  const botStrip = new PIXI.Graphics();
  botStrip.beginFill(C.glassGreen,  0.5); botStrip.drawRect(0, H - 52, W / 4, 2); botStrip.endFill();
  botStrip.beginFill(C.glassAmber,  0.5); botStrip.drawRect(W / 4, H - 52, W / 4, 2); botStrip.endFill();
  botStrip.beginFill(C.glassRed,    0.5); botStrip.drawRect(W / 2, H - 52, W / 4, 2); botStrip.endFill();
  botStrip.beginFill(C.glassTeal,   0.5); botStrip.drawRect(W * 3 / 4, H - 52, W / 4, 2); botStrip.endFill();
  layerUI.addChild(botBg, botStrip);

  ['Actions: 1', 'Buys: 1', 'Coins: 0', 'Deck: 10'].forEach((label, i) => {
    const t = new PIXI.Text(label, {
      fontFamily: 'Georgia, serif', fontSize: 10, fill: C.dim,
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
    const c = new StainedGlassCard(def, i);
    const x = W / 4 * i + (W / 4 - CW) / 2;
    c.moveTo(x, supplyY);
    c.container.zIndex = i;
    layerCards.addChild(c.container);
    allCards.push(c);
  });

  const supply2 = CARD_DEFS.slice(4);
  const supply2Y = 76 + CH + 14;
  supply2.forEach((def, i) => {
    const c = new StainedGlassCard(def, i + 4);
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
    const c = new StainedGlassCard(def, i + 10);
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

  updateBeams(dt);
  sparkles.forEach(s => s.update(dt));
  allCards.forEach(c => c.update(dt));
});

// Boot
buildBackground();
buildBeams();
buildSparkles();
buildUI();
buildCards();
