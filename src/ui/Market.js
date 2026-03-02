// ============================================================
// ui/Market.js — 시장(공급) 그리드  최대 4열 × 3행 (12슬롯)
// ============================================================
import {
  C,
  CARD_W, CARD_H,
  MARKET_SCALE,
  ZONE,
  SCREEN_W as W,
} from '../config.js';
import { buildFrontFace } from './CardArt.js';
import * as CardDetail    from './CardDetail.js';
import { TL_H }           from './MarketTimeline.js';

// ── 마켓 카드 크기 ──────────────────────────────────────────
const MW    = Math.round(CARD_W * MARKET_SCALE);   // 90px
const MH    = Math.round(CARD_H * MARKET_SCALE);   // 135px
const GAP   = 6;   // MARGIN과 동일 (좌우 6px + 열간 6px)
const COLS  = 4;
const ROWS  = 3;
const MAX_SLOTS = COLS * ROWS;   // 12슬롯

// 그리드 전체 너비 & 시작 x (중앙 정렬)
const GRID_W  = COLS * MW + (COLS - 1) * GAP;      // 4*63+3*5=267px
const START_X = Math.round((W - GRID_W) / 2);      // 61px

// 카드 상단 y (타임라인 영역 TL_H + 4px 여백)
const CARD_Y0 = ZONE.MARKET_Y + TL_H + 4;

// 그리드 실제 하단 y (섹션 bg·경계선에 사용)
const MARKET_SECTION_END = CARD_Y0 + ROWS * MH + (ROWS - 1) * GAP + 8;  // ~383
const SECTION_H = MARKET_SECTION_END - ZONE.MARKET_Y;

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
    g.moveTo(0, ZONE.MARKET_Y);       g.lineTo(W, ZONE.MARKET_Y);
    g.moveTo(0, MARKET_SECTION_END);  g.lineTo(W, MARKET_SECTION_END);

    this.container.addChild(g);

    // 섹션 타이틀은 MarketTimeline으로 대체됨
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

    // ─ 구매 불가 dim 오버레이 (전체 카드 덮음) ─
    const dimOverlay = new PIXI.Graphics();
    dimOverlay.beginFill(0x000000, 0.55);
    dimOverlay.drawRect(0, 0, MW, MH);
    dimOverlay.endFill();
    dimOverlay.visible = true;   // setAffordable 호출 전까지 dim
    wrapper.addChild(dimOverlay);

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
      // 품절 시 setAffordable 호출 전에도 즉시 dim 보장
      if (count <= 0) dimOverlay.visible = true;
    };

    this.slots.set(id, { container: wrapper, updateCount, dimOverlay, def, getCurCount: () => curCount });
  }

  // ── 구매 후 수량 갱신 ─────────────────────────────────────
  /** @param {Map<string, {def, count}>} supply */
  refresh(supply) {
    for (const [id, { count }] of supply) {
      this.slots.get(id)?.updateCount(count);
    }
  }

  // ── 구매 가능 카드 dim 제어 ────────────────────────────────
  /**
   * @param {number} coins  - 현재 보유 코인
   * @param {number} buys   - 남은 구매 횟수 (0이면 전체 dim)
   */
  setAffordable(coins, buys) {
    for (const slot of this.slots.values()) {
      const affordable = buys > 0 && slot.getCurCount() > 0 && slot.def.cost <= coins;
      slot.dimOverlay.visible = !affordable;
    }
  }

  // ── T+1 경고 이펙트 (소멸 예정 카드 위에 깜빡이는 눈 아이콘) ────
  /**
   * 지정 카드 슬롯에 눈 아이콘 오버레이를 붙이고 깜빡임 시작
   * @param {string|null} id  경고 표시할 카드 ID (null이면 clearWarning)
   */
  setWarningCard(id) {
    this.clearWarning();
    if (!id) return;
    const slot = this.slots.get(id);
    if (!slot || slot.getCurCount() <= 0) return;

    // PNG 자체 알파채널 활용 — 1:1 비율, 현재 크기의 50%, 카드 중앙 배치
    const eye = PIXI.Sprite.from('./asset/eye_effect.png');
    const sz       = Math.round(MW * 0.50);   // 1:1 정사각형 (MW의 50%)
    eye.width      = sz;
    eye.height     = sz;
    eye.anchor.set(0.5);
    eye.x          = MW / 2;
    eye.y          = MH / 2;
    eye.blendMode  = PIXI.BLEND_MODES.NORMAL;
    eye.alpha      = 0.85;

    slot.container.addChild(eye);
    this._warnOv   = eye;   // Sprite 직접 참조 (Container 불필요)
    this._warnId   = id;
    this._warnTime = 0;
  }

  /** 경고 오버레이 제거 */
  clearWarning() {
    if (this._warnOv?.parent) {
      this._warnOv.parent.removeChild(this._warnOv);
      this._warnOv.destroy({ children: true });
    }
    this._warnOv = null;
    this._warnId = null;
  }

  // ── 시장 이벤트 소멸 연출 ────────────────────────────────
  /**
   * 지정 카드 슬롯에 빨간 플래시 → 페이드 아웃 후 콜백
   * @param {string}   id     - supply 카드 ID
   * @param {function} onDone - 애니메이션 완료 콜백
   */
  vanishFlash(id, onDone) {
    const slot = this.slots.get(id);
    if (!slot) { onDone?.(); return; }

    const flash = new PIXI.Graphics();
    flash.beginFill(0xff2222, 0.6);
    flash.drawRect(0, 0, MW, MH);
    flash.endFill();
    slot.container.addChild(flash);

    const DUR = 500;
    const t0  = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - t0) / DUR, 1);
      // sin 곡선: 빠르게 밝아졌다가 천천히 사라짐
      flash.alpha = 0.6 * Math.sin(Math.PI * t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        if (flash.parent) flash.parent.removeChild(flash);
        flash.destroy();
        onDone?.();
      }
    };
    requestAnimationFrame(tick);
  }

  // ── 슬롯 쉐이킹 (이벤트 발생 시 흔들림 연출) ──────────────
  /**
   * 지정 카드 슬롯을 좌우 감쇠 진동으로 흔들기 (380ms)
   * @param {string} id  - supply 카드 ID
   */
  shakeCard(id) {
    const slot = this.slots.get(id);
    if (!slot) return;

    const ct    = slot.container;
    const origX = ct.x;
    const DUR   = 380;   // ms
    const AMP   = 5;     // 진폭 px
    const FREQ  = 5;     // 반주기 횟수
    const t0    = Date.now();

    const tick = () => {
      const t = Math.min((Date.now() - t0) / DUR, 1);
      // 감쇠 sin: 처음에 크게, 끝에 수렴
      ct.x = origX + Math.sin(t * Math.PI * FREQ * 2) * AMP * (1 - t);
      if (t < 1) requestAnimationFrame(tick);
      else        ct.x = origX;
    };
    requestAnimationFrame(tick);
  }

  // ── 게임루프 업데이트 ─────────────────────────────────────
  update(dt) {
    if (!this._warnOv?.parent) return;
    this._warnTime = (this._warnTime ?? 0) + dt;
    // 0.7Hz 깜빡임: 0.0 ~ 1.0 (sin² 곡선 — 자연스러운 fade in/out)
    // PNG 자체 알파가 살아있으므로 전체 alpha만 조절하면 됨
    const s = Math.sin(this._warnTime * Math.PI * 0.7);
    this._warnOv.alpha = s * s;   // sin² → 항상 ≥0, 부드럽게 나타났다 사라짐
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
