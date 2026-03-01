// ============================================================
// ui/Market.js — 시장(공급) 그리드  최대 4열 × 3행 (12슬롯)
// ============================================================
import {
  C, ACCENT,
  CARD_W, CARD_H,
  MARKET_SCALE,
  ZONE,
  SCREEN_W as W,
} from '../config.js';
import { buildFrontFace } from './CardArt.js';
import * as CardDetail    from './CardDetail.js';

// ── 마켓 카드 크기 ──────────────────────────────────────────
const MW    = Math.round(CARD_W * MARKET_SCALE);   // 63px
const MH    = Math.round(CARD_H * MARKET_SCALE);   // 95px
const GAP   = 5;
const COLS  = 4;
const ROWS  = 3;
const MAX_SLOTS = COLS * ROWS;   // 12슬롯

// 그리드 전체 너비 & 시작 x (중앙 정렬)
const GRID_W  = COLS * MW + (COLS - 1) * GAP;      // 4*63+3*5=267px
const START_X = Math.round((W - GRID_W) / 2);      // 61px

// 카드 상단 y (섹션 라벨 14px + 4px 여백)
const CARD_Y0 = ZONE.MARKET_Y + 18;

// 섹션 배경 높이
const SECTION_H = ZONE.STAT_Y - ZONE.MARKET_Y;

// ============================================================
export class Market {
  /**
   * @param {PIXI.Container} layer - 이 그래픽을 붙일 레이어
   * @param {function(def):void} onBuy  - 구매 요청 콜백
   */
  constructor(layer, onBuy) {
    this.layer  = layer;
    this.onBuy  = onBuy;
    this.slots  = new Map();  // id → { container, updateCount }

    this.container = new PIXI.Container();
    layer.addChild(this.container);

    this._buildBg();
  }

  // ── 섹션 배경 ──────────────────────────────────────────────
  _buildBg() {
    const g = new PIXI.Graphics();

    // 반투명 배경
    g.beginFill(0x06040f, 0.58);
    g.drawRect(0, ZONE.MARKET_Y, W, SECTION_H);
    g.endFill();

    // 위·아래 경계선
    g.lineStyle(1, C.goldDim, 0.4);
    g.moveTo(0, ZONE.MARKET_Y); g.lineTo(W, ZONE.MARKET_Y);
    g.moveTo(0, ZONE.STAT_Y);   g.lineTo(W, ZONE.STAT_Y);

    this.container.addChild(g);

    // 섹션 타이틀
    const lbl = new PIXI.Text('— 시  장 —', {
      fontFamily: 'Georgia, serif',
      fontSize: 9, fontStyle: 'italic',
      fill: C.dimCream,
    });
    lbl.anchor.set(0.5, 0);
    lbl.x = W / 2;
    lbl.y = ZONE.MARKET_Y + 3;
    this.container.addChild(lbl);
  }

  // ── 공급 세팅 (게임 시작 시 1회) ───────────────────────────
  /** @param {Map<string, {def, count}>} supply */
  setSupply(supply) {
    // 기존 슬롯 제거
    for (const s of this.slots.values()) {
      this.container.removeChild(s.container);
      s.container.destroy({ children: true });
    }
    this.slots.clear();

    let i = 0;
    for (const [id, { def, count }] of supply) {
      if (i >= MAX_SLOTS) break;   // 최대 12슬롯
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = START_X + col * (MW + GAP);
      const y   = CARD_Y0  + row * (MH + GAP);
      this._createSlot(id, def, count, x, y);
      i++;
    }
  }

  // ── 슬롯 생성 ─────────────────────────────────────────────
  _createSlot(id, def, initialCount, x, y) {
    let curCount = initialCount;

    const wrapper = new PIXI.Container();
    wrapper.x = x;
    wrapper.y = y;

    // ─ 카드 앞면 (MARKET_SCALE 축소) ─
    const face = buildFrontFace(def);
    face.scale.set(MARKET_SCALE);
    wrapper.addChild(face);

    // ─ 비어있을 때 어두운 오버레이 ─
    const emptyOverlay = new PIXI.Graphics();
    emptyOverlay.beginFill(0x000000, 0.65);
    emptyOverlay.drawRect(0, 0, MW, MH);
    emptyOverlay.endFill();
    emptyOverlay.visible = curCount <= 0;
    wrapper.addChild(emptyOverlay);

    // ─ 수량 배지 (카드 하단 중앙) ─
    const badgeG = new PIXI.Graphics();
    badgeG.beginFill(C.dark, 0.92);
    badgeG.lineStyle(0.8, C.gold, 0.7);
    badgeG.drawRoundedRect(-16, -7, 32, 14, 4);
    badgeG.endFill();

    const countTxt = new PIXI.Text(`×${curCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   8,
      fontWeight: 'bold',
      fill: curCount > 0 ? C.gold : 0x555544,
    });
    countTxt.anchor.set(0.5);
    badgeG.addChild(countTxt);
    badgeG.x = MW / 2;
    badgeG.y = MH - 5;
    wrapper.addChild(badgeG);

    // ─ 타입 색상 글로우 박스 (테두리) ─
    const accentCol = ACCENT[def.type] ?? C.goldDim;
    const border = new PIXI.Graphics();
    border.lineStyle(1.5, accentCol, 0.55);
    border.drawRect(0, 0, MW, MH);
    wrapper.addChild(border);

    // ─ 인터랙션 ─
    wrapper.eventMode = 'static';
    wrapper.cursor    = curCount > 0 ? 'pointer' : 'default';

    let _timer = null, _sx = 0, _sy = 0;

    wrapper.on('pointerdown', (e) => {
      _sx = e.global.x; _sy = e.global.y;
      _timer = setTimeout(() => {
        _timer = null;
        CardDetail.show(def);
      }, 500);
    });
    wrapper.on('pointermove', (e) => {
      if (!_timer) return;
      const dx = e.global.x - _sx, dy = e.global.y - _sy;
      if (dx * dx + dy * dy > 64) { clearTimeout(_timer); _timer = null; }
    });
    wrapper.on('pointerup', () => {
      if (_timer) {
        clearTimeout(_timer); _timer = null;
        if (curCount > 0) this.onBuy(def);
      }
    });
    wrapper.on('pointerupoutside', () => {
      clearTimeout(_timer); _timer = null;
    });
    this.container.addChild(wrapper);

    // ─ 수량 업데이트 함수 ─
    const updateCount = (count) => {
      curCount              = count;
      countTxt.text         = `×${count}`;
      countTxt.style.fill   = count > 0 ? C.gold : 0x555544;
      emptyOverlay.visible  = count <= 0;
      wrapper.cursor        = count > 0 ? 'pointer' : 'default';
    };

    this.slots.set(id, { container: wrapper, updateCount });
  }

  // ── 구매 후 수량 갱신 ─────────────────────────────────────
  /** @param {Map<string, {def, count}>} supply */
  refresh(supply) {
    for (const [id, { count }] of supply) {
      this.slots.get(id)?.updateCount(count);
    }
  }

  // ── 정리 ──────────────────────────────────────────────────
  destroy() {
    for (const s of this.slots.values()) {
      s.container.destroy({ children: true });
    }
    this.slots.clear();
    this.layer.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
