// ============================================================
// ui/CardSelectOverlay.js — 공용 카드 선택 오버레이 (범용)
//
// showCardSelectOverlay(layer, opts)
//
//   opts.title          string
//   opts.effectDesc     string | null               효과 설명 (WHY/RESULT)
//   opts.subtitle       string | (n:number)=>string 조작 안내 (WHAT TO DO)
//   opts.items          Card[] | {def, count}[]
//   opts.mode           'multi' | 'single'           기본: 'multi'
//   opts.minCount       number                        기본: 0
//   opts.maxCount       number | null                 기본: null
//   opts.showStockBadge boolean                       기본: false
//   opts.filter         (item) => boolean | null
//   opts.confirmLabel   string | (n:number)=>string  multi 확인 버튼
//   opts.canConfirmEmpty boolean                      기본: true
//   opts.cancelLabel    string | null                 기본: null
//   opts.allowDetail    boolean                       기본: true
//   opts.onConfirm      (selectedItems) => void
//   opts.onCancel       () => void
// ============================================================
import {
  C, CARD_W, CARD_H,
  SCREEN_W as W, SCREEN_H as H,
} from '../config.js';
import { buildFrontFace } from './CardArt.js';
import * as CardDetail     from './CardDetail.js';
import { CardGlow }        from './CardGlow.js';

// ── 레이아웃 상수 ─────────────────────────────────────────────
const PAD_X   = 12;
const GAP     = 10;
const HDR_H   = 110;  // 헤더 높이 (텍스트 크기 ×1.5)
const TOP_PAD = 14;   // 헤더 → 그리드 간격
const BTN_PAD = 16;   // 그리드 → 확인 버튼 간격

function _bestCols(n) {
  if (n <= 2) return n;
  if (n <= 4) return Math.min(n, 4);
  if (n <= 6) return 3;
  return 4;
}

// ─────────────────────────────────────────────────────────────
// 배경 다이아몬드 격자
// ─────────────────────────────────────────────────────────────
function _drawLattice(g) {
  const STEP = 28;
  g.lineStyle(0.5, C.goldDim, 0.12);
  for (let row = 0; row * STEP < H + STEP; row++) {
    const ox = (row % 2) * (STEP / 2);
    for (let col = -1; col * STEP < W + STEP; col++) {
      const cx = col * STEP + ox;
      const cy = row * STEP;
      g.moveTo(cx,            cy - STEP / 2);
      g.lineTo(cx + STEP / 2, cy);
      g.lineTo(cx,            cy + STEP / 2);
      g.lineTo(cx - STEP / 2, cy);
      g.closePath();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 헤더 하단 장식 분리선
// ─────────────────────────────────────────────────────────────
function _drawHeaderDivider(g, y) {
  g.lineStyle(0.8, C.gold, 0.35);
  g.moveTo(16, y); g.lineTo(W / 2 - 10, y);
  g.moveTo(W / 2 + 10, y); g.lineTo(W - 16, y);

  g.lineStyle(1, C.gold, 0.7);
  g.beginFill(C.goldDim, 0.6);
  g.moveTo(W / 2,     y - 5);
  g.lineTo(W / 2 + 5, y);
  g.lineTo(W / 2,     y + 5);
  g.lineTo(W / 2 - 5, y);
  g.closePath();
  g.endFill();

  g.lineStyle(0);
  g.beginFill(C.gold, 0.5);
  g.drawCircle(20,     y, 1.5);
  g.drawCircle(W - 20, y, 1.5);
  g.endFill();
}

// ─────────────────────────────────────────────────────────────
// 버튼 코너 악센트
// ─────────────────────────────────────────────────────────────
function _drawCornerAccents(g, x, y, w, h) {
  const SZ = 4;
  g.lineStyle(0);
  g.beginFill(C.goldDim, 0.9);
  g.drawRect(x - SZ / 2,     y - SZ / 2,     SZ, SZ);
  g.drawRect(x + w - SZ / 2, y - SZ / 2,     SZ, SZ);
  g.drawRect(x - SZ / 2,     y + h - SZ / 2, SZ, SZ);
  g.drawRect(x + w - SZ / 2, y + h - SZ / 2, SZ, SZ);
  g.endFill();
}

// ─────────────────────────────────────────────────────────────
// 버튼 생성 헬퍼
// ─────────────────────────────────────────────────────────────
function _makeButton({ label, w, h = 40, accent, fontSize = 11, isSecondary = false }) {
  const btn = new PIXI.Container();
  const bg  = new PIXI.Graphics();
  const acc = new PIXI.Graphics();

  const _redraw = (disabled) => {
    bg.clear();
    if (isSecondary) {
      bg.beginFill(C.panel, 0.85);
      bg.lineStyle(1, accent, disabled ? 0.25 : 0.55);
    } else {
      bg.beginFill(0x1a1030, 1);
      bg.lineStyle(1.5, accent, disabled ? 0.35 : 0.92);
    }
    bg.drawRoundedRect(0, 0, w, h, 7);
    bg.endFill();

    if (!isSecondary) {
      acc.clear();
      _drawCornerAccents(acc, 0, 0, w, h);
    }
  };

  _redraw(false);
  btn.addChild(bg);
  if (!isSecondary) btn.addChild(acc);

  const txt = new PIXI.Text(label, {
    fontFamily: 'Georgia, serif',
    fontSize,
    fontWeight: isSecondary ? 'normal' : 'bold',
    fill:       isSecondary ? C.dimCream : C.goldHi,
  });
  txt.anchor.set(0.5);
  txt.x = w / 2;
  txt.y = h / 2;
  btn.addChild(txt);

  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointerdown',      () => btn.scale.set(0.95));
  btn.on('pointerupoutside', () => btn.scale.set(1));

  return { btn, txt, redraw: _redraw };
}

// ═════════════════════════════════════════════════════════════
// 메인 함수
// ═════════════════════════════════════════════════════════════
export function showCardSelectOverlay(layer, opts) {
  const {
    title,
    effectDesc     = null,
    subtitle,
    items: rawItems,
    mode           = 'multi',
    minCount       = 0,
    maxCount       = null,
    showStockBadge = false,
    filter         = null,
    confirmLabel,
    canConfirmEmpty = true,
    cancelLabel    = null,
    allowDetail    = true,
    onConfirm,
    onCancel       = () => {},
  } = opts;

  const items      = filter ? rawItems.filter(filter) : rawItems;
  const hasConfirm = mode === 'multi';
  const hasCancel  = !!cancelLabel;

  // ── 그리드 치수 사전 계산 (수직 중앙 정렬에 필요) ─────────
  const COLS   = items.length > 0 ? _bestCols(items.length) : 0;
  const ROWS   = items.length > 0 ? Math.ceil(items.length / COLS) : 0;
  const availW = W - 2 * PAD_X - Math.max(0, COLS - 1) * GAP;
  const SW     = COLS > 0 ? Math.floor(availW / COLS) : 0;
  const SCALE  = COLS > 0 ? SW / CARD_W : 1;
  const SH     = COLS > 0 ? Math.round(CARD_H * SCALE) : 0;
  const gridH  = ROWS > 0 ? ROWS * SH + (ROWS - 1) * GAP : 0;

  // 버튼 블록 높이
  const btnBlockH = (hasConfirm ? 42 : 0)
                  + (hasConfirm && hasCancel ? 8 : 0)
                  + (hasCancel  ? 36 : 0);

  // 전체 콘텐츠 블록 높이 → 수직 중앙 시작 Y
  const totalH = HDR_H + TOP_PAD + gridH + (btnBlockH > 0 ? BTN_PAD + btnBlockH : 0);
  const startY = Math.max(4, Math.round((H - totalH) / 2));

  // ── 그리드·버튼 절대 Y 좌표 ──────────────────────────────
  const GY          = startY + HDR_H + TOP_PAD;
  const confirmBtnY = GY + gridH + BTN_PAD;
  const cancelBtnY  = confirmBtnY + 42 + 8;

  // ── 루트 컨테이너 ─────────────────────────────────────────
  const overlay = new PIXI.Container();
  overlay.zIndex = 9500;
  layer.sortableChildren = true;

  // ═══════════════════════════════════════════════════════════
  // 배경 (전체화면 고정)
  // ═══════════════════════════════════════════════════════════
  const bgBase = new PIXI.Graphics();
  bgBase.beginFill(C.bg, 0.97);
  bgBase.drawRect(0, 0, W, H);
  bgBase.endFill();
  bgBase.eventMode = 'static';
  overlay.addChild(bgBase);

  const bgLattice = new PIXI.Graphics();
  _drawLattice(bgLattice);
  overlay.addChild(bgLattice);

  const bgGlow = new PIXI.Graphics();
  bgGlow.beginFill(C.gold, 0.028);
  bgGlow.drawCircle(W / 2, H / 2, 220);   // 화면 중앙 글로우
  bgGlow.endFill();
  try { bgGlow.filters = [new PIXI.BlurFilter(40)]; } catch (_) {}
  overlay.addChild(bgGlow);

  // ═══════════════════════════════════════════════════════════
  // 헤더 패널 (콘텐츠 블록 최상단, startY 기준)
  // ═══════════════════════════════════════════════════════════
  const hdrBg = new PIXI.Graphics();
  hdrBg.beginFill(0x0a0814, 0.97);
  hdrBg.drawRect(0, startY, W, HDR_H);
  hdrBg.endFill();
  hdrBg.lineStyle(1, C.gold, 0.22);
  hdrBg.moveTo(0, startY + HDR_H);
  hdrBg.lineTo(W, startY + HDR_H);
  overlay.addChild(hdrBg);

  const hdrDeco = new PIXI.Graphics();
  _drawHeaderDivider(hdrDeco, startY + HDR_H - 1);
  overlay.addChild(hdrDeco);

  // 행1: 카드 이름 (26px bold)
  const titleTxt = new PIXI.Text(title, {
    fontFamily: 'Georgia, serif',
    fontSize:   26,
    fontWeight: 'bold',
    fill:       C.goldHi,
  });
  titleTxt.anchor.set(0.5, 0);
  titleTxt.x = W / 2;
  titleTxt.y = startY + 8;
  overlay.addChild(titleTxt);

  // 행2: 효과 설명 (14px)
  if (effectDesc) {
    const effectTxt = new PIXI.Text(`◆  ${effectDesc}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   14,
      fill:       C.gold,
    });
    effectTxt.anchor.set(0.5, 0);
    effectTxt.x = W / 2;
    effectTxt.y = startY + 43;
    overlay.addChild(effectTxt);
  }

  // 행3: 조작 안내 (15px italic)
  const subtitleStr = typeof subtitle === 'function' ? subtitle(0) : (subtitle ?? '');
  const subtitleTxt = new PIXI.Text(subtitleStr, {
    fontFamily: 'Georgia, serif',
    fontSize:   15,
    fontStyle:  'italic',
    fill:       C.dimCream,
  });
  subtitleTxt.anchor.set(0.5, 0);
  subtitleTxt.x = W / 2;
  subtitleTxt.y = startY + (effectDesc ? 65 : 48);
  overlay.addChild(subtitleTxt);

  // 카운트 배지 (multi 모드)
  let countBadgeTxt = null;
  if (mode === 'multi') {
    const badgeG = new PIXI.Graphics();
    badgeG.beginFill(C.dark, 0.9);
    badgeG.lineStyle(1, C.goldDim, 0.65);
    badgeG.drawRoundedRect(0, 0, 46, 20, 5);
    badgeG.endFill();
    countBadgeTxt = new PIXI.Text('0장', {
      fontFamily: 'Georgia, serif', fontSize: 12,
      fontWeight: 'bold', fill: C.dimCream,
    });
    countBadgeTxt.anchor.set(0.5);
    countBadgeTxt.x = 23; countBadgeTxt.y = 10;
    badgeG.addChild(countBadgeTxt);
    badgeG.x = W / 2 + titleTxt.width / 2 + 8;
    badgeG.y = startY + 10;
    overlay.addChild(badgeG);
  }

  // ── CardGlow 공유 틱 ─────────────────────────────────────
  const _activeGlows = new Map();
  const _tickFn = () => {
    if (_activeGlows.size === 0) return;
    const dt = PIXI.Ticker.shared.elapsedMS / 1000;
    _activeGlows.forEach((glow) => glow.update(dt));
  };
  PIXI.Ticker.shared.add(_tickFn);

  // ── 닫기 ─────────────────────────────────────────────────
  const _close = () => {
    PIXI.Ticker.shared.remove(_tickFn);
    _activeGlows.clear();
    if (overlay.parent) overlay.parent.removeChild(overlay);
    overlay.destroy({ children: true });
  };

  const selected = new Set();
  let _updateUI  = null;

  // ═══════════════════════════════════════════════════════════
  // 빈 목록
  // ═══════════════════════════════════════════════════════════
  if (items.length === 0) {
    const deco = new PIXI.Graphics();
    deco.lineStyle(1, C.gold, 0.4);
    deco.moveTo(W / 2,      H / 2 - 28);
    deco.lineTo(W / 2 + 20, H / 2);
    deco.lineTo(W / 2,      H / 2 + 28);
    deco.lineTo(W / 2 - 20, H / 2);
    deco.closePath();
    overlay.addChild(deco);

    const emptyTxt = new PIXI.Text('선택 가능한 카드가 없습니다', {
      fontFamily: 'Georgia, serif', fontSize: 19,
      fontStyle: 'italic', fill: C.dimCream,
    });
    emptyTxt.anchor.set(0.5);
    emptyTxt.x = W / 2; emptyTxt.y = H / 2;
    overlay.addChild(emptyTxt);

    const { btn } = _makeButton({
      label: cancelLabel ?? '확인', w: 160,
      accent: C.goldDim, isSecondary: true,
    });
    btn.x = Math.round((W - 160) / 2);
    btn.y = H / 2 + 50;
    btn.on('pointerup', () => { btn.scale.set(1); _close(); onCancel(); });
    overlay.addChild(btn);

    layer.addChild(overlay);
    return { close: _close };
  }

  // ═══════════════════════════════════════════════════════════
  // 카드 그리드 (GY = startY + HDR_H + TOP_PAD)
  // ═══════════════════════════════════════════════════════════
  items.forEach((item, idx) => {
    const itemDef = item.def;
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    const slot = new PIXI.Container();
    slot.x     = PAD_X + col * (SW + GAP);
    slot.y     = GY    + row * (SH + GAP);
    slot.alpha = 0.5;   // 초기: 모든 카드 0.5 → 선택 시 1.0

    // 슬롯 베이스
    const slotBg = new PIXI.Graphics();
    slotBg.beginFill(C.dark, 0.55);
    slotBg.lineStyle(0.8, C.goldDim, 0.2);
    slotBg.drawRoundedRect(-2, -2, SW + 4, SH + 4, 4);
    slotBg.endFill();
    slot.addChild(slotBg);

    // 카드 앞면
    const face = buildFrontFace(itemDef);
    face.scale.set(SCALE);
    slot.addChild(face);

    // 수량 배지
    if (showStockBadge && item.count != null) {
      const bG = new PIXI.Graphics();
      bG.beginFill(C.dark, 0.94);
      bG.lineStyle(1, C.gold, 0.8);
      bG.drawRoundedRect(0, 0, 32, 16, 4);
      bG.endFill();
      const bTxt = new PIXI.Text(`×${item.count}`, {
        fontFamily: 'Georgia, serif', fontSize: 9,
        fontWeight: 'bold', fill: C.gold,
      });
      bTxt.anchor.set(0.5);
      bTxt.x = 16; bTxt.y = 8;
      bG.addChild(bTxt);
      bG.x = 2; bG.y = SH - 18;
      slot.addChild(bG);
    }

    // CardGlow (선택 시에만 활성)
    const glow = new CardGlow(SW, SH);
    glow.g.alpha = 0;
    slot.addChild(glow.g);

    // 선택: slot.alpha 1.0 + 글로우 / 해제: slot.alpha 0.5
    const _setSelected = (on) => {
      slot.alpha = on ? 1.0 : 0.5;
      if (on) {
        glow.g.alpha = 1;
        glow.setActive(true);
        _activeGlows.set(slot, glow);
      } else {
        glow.setActive(false);
        glow.g.alpha = 0;
        _activeGlows.delete(slot);
      }
    };

    // 인터랙션
    slot.eventMode = 'static';
    slot.cursor = 'pointer';
    let _timer = null, _px = 0, _py = 0;

    slot.on('pointerdown', (e) => {
      _px = e.global.x; _py = e.global.y;
      _timer = setTimeout(() => {
        _timer = null;
        if (allowDetail) CardDetail.show(itemDef);
      }, 500);
    });

    slot.on('pointermove', (e) => {
      if (!_timer) return;
      const dx = e.global.x - _px, dy = e.global.y - _py;
      if (dx * dx + dy * dy > 64) { clearTimeout(_timer); _timer = null; }
    });

    slot.on('pointerup', () => {
      if (!_timer) return;
      clearTimeout(_timer); _timer = null;

      if (mode === 'single') {
        _close();
        onConfirm([item]);
      } else {
        if (selected.has(item)) {
          selected.delete(item);
          _setSelected(false);   // slot.alpha = 0.5
        } else if (maxCount === null || selected.size < maxCount) {
          selected.add(item);
          _setSelected(true);    // slot.alpha = 1.0
        }
        _updateUI?.();
      }
    });

    slot.on('pointerupoutside', () => { clearTimeout(_timer); _timer = null; });
    overlay.addChild(slot);
  });

  // ═══════════════════════════════════════════════════════════
  // 버튼 (그리드 바로 아래)
  // ═══════════════════════════════════════════════════════════
  const CONFIRM_W = 230;
  let confirmEl = null;

  if (hasConfirm) {
    const initLabel = typeof confirmLabel === 'function' ? confirmLabel(0) : (confirmLabel ?? '확인');
    confirmEl = _makeButton({ label: initLabel, w: CONFIRM_W, h: 42, accent: C.gold, fontSize: 12 });
    confirmEl.btn.x = Math.round((W - CONFIRM_W) / 2);
    confirmEl.btn.y = confirmBtnY;

    const _isEnabled = () => canConfirmEmpty ? true : selected.size >= minCount;
    confirmEl.btn.on('pointerup', () => {
      confirmEl.btn.scale.set(1);
      if (!_isEnabled()) return;
      _close();
      onConfirm([...selected]);
    });
    overlay.addChild(confirmEl.btn);
  }

  if (hasCancel) {
    const cancelY = hasConfirm ? cancelBtnY : confirmBtnY;
    const cancelW = hasConfirm ? 190 : 200;
    const cancelEl = _makeButton({
      label: cancelLabel, w: cancelW, h: 36,
      accent: C.goldDim, isSecondary: true, fontSize: 10,
    });
    cancelEl.btn.x = Math.round((W - cancelW) / 2);
    cancelEl.btn.y = cancelY;
    cancelEl.btn.on('pointerup', () => { cancelEl.btn.scale.set(1); _close(); onCancel(); });
    overlay.addChild(cancelEl.btn);
  }

  // 롱프레스 힌트 (화면 최하단 고정)
  if (allowDetail) {
    const hintTxt = new PIXI.Text('길게 누르면 카드 상세보기', {
      fontFamily: 'Georgia, serif', fontSize: 8,
      fontStyle: 'italic', fill: C.dimCream,
    });
    hintTxt.alpha = 0.5;
    hintTxt.anchor.set(0.5, 1);
    hintTxt.x = W / 2;
    hintTxt.y = H - 4;
    overlay.addChild(hintTxt);
  }

  // ═══════════════════════════════════════════════════════════
  // UI 업데이트 (multi 모드)
  // ═══════════════════════════════════════════════════════════
  _updateUI = () => {
    const n = selected.size;

    if (countBadgeTxt) countBadgeTxt.text = `${n}장`;
    if (typeof subtitle === 'function') subtitleTxt.text = subtitle(n);

    if (confirmEl) {
      if (confirmLabel) {
        confirmEl.txt.text = typeof confirmLabel === 'function' ? confirmLabel(n) : confirmLabel;
      }
      const enabled = canConfirmEmpty ? true : n >= minCount;
      confirmEl.redraw(!enabled);
      confirmEl.txt.alpha = enabled ? 1 : 0.4;
    }

    // slot.alpha는 _setSelected에서 직접 제어
  };

  if (confirmEl && !canConfirmEmpty) _updateUI();

  layer.addChild(overlay);
  return { close: _close };
}
