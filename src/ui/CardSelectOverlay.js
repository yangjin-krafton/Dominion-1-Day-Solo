// ============================================================
// ui/CardSelectOverlay.js — 공용 카드 선택 오버레이 (범용)
//
// showCardSelectOverlay(layer, opts)
//
//   opts.title          string
//   opts.subtitle       string | (selectedCount: number) => string
//   opts.items          Card[] | {def, count}[]   손패/버림더미/supply
//   opts.mode           'multi' | 'single'         기본: 'multi'
//   opts.minCount       number                      기본: 0
//   opts.maxCount       number | null               기본: null (무제한)
//   opts.showStockBadge boolean                     기본: false  (×count 배지)
//   opts.filter         (item) => boolean | null    표시 아이템 사전필터
//   opts.confirmLabel   string | (n:number)=>string multi 확인 버튼 레이블
//   opts.canConfirmEmpty boolean                    기본: true
//   opts.cancelLabel    string | null               기본: null (취소 없음)
//   opts.allowDetail    boolean                     기본: true  (롱프레스 상세)
//   opts.onConfirm      (selectedItems) => void
//   opts.onCancel       () => void
//
// 반환값: { close: () => void }
// ============================================================
import {
  C, CARD_W, CARD_H,
  SCREEN_W as W, SCREEN_H as H,
} from '../config.js';
import { buildFrontFace } from './CardArt.js';
import * as CardDetail     from './CardDetail.js';

// ── 레이아웃 상수 ─────────────────────────────────────────────
const PAD_X = 10;
const GAP   = 8;
const HDR_H = 64;

function _bestCols(n) {
  if (n <= 3) return n;
  if (n <= 6) return 3;
  return 4;
}

// ── 버튼 하나 생성 헬퍼 ──────────────────────────────────────
function _makeBtn(label, w, accentColor, fontSize = 11) {
  const btn = new PIXI.Container();
  const bg  = new PIXI.Graphics();

  const _draw = (dim) => {
    bg.clear();
    bg.beginFill(0x1a1030);
    bg.lineStyle(1.5, accentColor, dim ? 0.4 : 0.8);
    bg.drawRoundedRect(0, 0, w, 36, 8);
    bg.endFill();
  };
  _draw(false);
  btn.addChild(bg);

  const txt = new PIXI.Text(label, {
    fontFamily: 'Georgia, serif', fontSize, fill: accentColor,
  });
  txt.anchor.set(0.5); txt.x = w / 2; txt.y = 18;
  btn.addChild(txt);

  btn.eventMode = 'static'; btn.cursor = 'pointer';
  btn.on('pointerdown',      () => btn.scale.set(0.95));
  btn.on('pointerupoutside', () => btn.scale.set(1));

  return { btn, txt, bg, setDim: _draw };
}

// ─────────────────────────────────────────────────────────────

/**
 * @param {PIXI.Container} layer
 * @param {object} opts
 * @returns {{ close: () => void }}
 */
export function showCardSelectOverlay(layer, opts) {
  const {
    title,
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

  const items = filter ? rawItems.filter(filter) : rawItems;

  // ── 버튼 영역 높이 계산 ───────────────────────────────────
  const hasConfirm = mode === 'multi';
  const hasCancel  = !!cancelLabel;
  let BTN_AREA_H;
  if (hasConfirm && hasCancel) BTN_AREA_H = 100;
  else if (hasConfirm || hasCancel)  BTN_AREA_H = 56;
  else                               BTN_AREA_H = 24;

  // ── 컨테이너 ──────────────────────────────────────────────
  const overlay = new PIXI.Container();
  overlay.zIndex = 9500;
  layer.sortableChildren = true;

  // ── 배경 ──────────────────────────────────────────────────
  const backdrop = new PIXI.Graphics();
  backdrop.beginFill(0x060310, 0.97);
  backdrop.drawRect(0, 0, W, H);
  backdrop.endFill();
  backdrop.eventMode = 'static';
  overlay.addChild(backdrop);

  // ── 헤더 ──────────────────────────────────────────────────
  const hdrLine = new PIXI.Graphics();
  hdrLine.lineStyle(1, C.goldDim, 0.4);
  hdrLine.moveTo(0, HDR_H); hdrLine.lineTo(W, HDR_H);
  overlay.addChild(hdrLine);

  const titleTxt = new PIXI.Text(title, {
    fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 'bold', fill: C.goldHi,
  });
  titleTxt.anchor.set(0.5, 0); titleTxt.x = W / 2; titleTxt.y = 10;
  overlay.addChild(titleTxt);

  const subtitleStr = typeof subtitle === 'function' ? subtitle(0) : (subtitle ?? '');
  const subtitleTxt = new PIXI.Text(subtitleStr, {
    fontFamily: 'Georgia, serif', fontSize: 10, fontStyle: 'italic', fill: C.dimCream,
  });
  subtitleTxt.anchor.set(0.5, 0); subtitleTxt.x = W / 2; subtitleTxt.y = 34;
  overlay.addChild(subtitleTxt);

  // ── 닫기 함수 ────────────────────────────────────────────
  const _close = () => {
    if (overlay.parent) overlay.parent.removeChild(overlay);
    overlay.destroy({ children: true });
  };

  // ── 선택 상태 (multi 모드) ────────────────────────────────
  const selected = new Set();
  let _updateUI  = null;

  // ── 빈 목록 처리 ─────────────────────────────────────────
  if (items.length === 0) {
    const emptyTxt = new PIXI.Text('선택 가능한 카드가 없습니다', {
      fontFamily: 'Georgia, serif', fontSize: 13, fill: C.dimCream, fontStyle: 'italic',
    });
    emptyTxt.anchor.set(0.5, 0.5); emptyTxt.x = W / 2; emptyTxt.y = H / 2;
    overlay.addChild(emptyTxt);

    // 빈 상태에서도 항상 닫기 버튼 제공
    const closeLabel = cancelLabel ?? '확인';
    const { btn, txt: _t } = _makeBtn(closeLabel, 160, C.goldDim, 10);
    btn.x = Math.round((W - 160) / 2);
    btn.y = H - 50;
    btn.on('pointerup', () => { btn.scale.set(1); _close(); onCancel(); });
    overlay.addChild(btn);

    layer.addChild(overlay);
    return { close: _close };
  }

  // ── 카드 그리드 ───────────────────────────────────────────
  const COLS  = _bestCols(items.length);
  const ROWS  = Math.ceil(items.length / COLS);
  const availW = W - 2 * PAD_X - (COLS - 1) * GAP;
  const SW     = Math.floor(availW / COLS);
  const SCALE  = SW / CARD_W;
  const SH     = Math.round(CARD_H * SCALE);

  const gridH     = ROWS * SH + (ROWS - 1) * GAP;
  const cardAreaH = H - HDR_H - BTN_AREA_H;
  const GY        = HDR_H + Math.max(10, Math.round((cardAreaH - gridH) / 2));

  items.forEach((item, idx) => {
    const itemDef = item.def;   // Card.def  또는  {def,count}.def 모두 동일

    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const sx  = PAD_X + col * (SW + GAP);
    const sy  = GY    + row * (SH + GAP);

    const slot = new PIXI.Container();
    slot.x = sx; slot.y = sy;

    // 카드 앞면
    const face = buildFrontFace(itemDef);
    face.scale.set(SCALE);
    slot.addChild(face);

    // 수량 배지 (supply 아이템)
    if (showStockBadge && item.count != null) {
      const badgeG = new PIXI.Graphics();
      badgeG.beginFill(C.dark, 0.92);
      badgeG.lineStyle(1, C.gold, 0.75);
      badgeG.drawRoundedRect(-18, -8, 36, 16, 4);
      badgeG.endFill();
      const cntTxt = new PIXI.Text(`×${item.count}`, {
        fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 'bold', fill: C.gold,
      });
      cntTxt.anchor.set(0.5);
      badgeG.addChild(cntTxt);
      badgeG.x = SW - 14; badgeG.y = SH - 8;
      slot.addChild(badgeG);
    }

    // 선택 오버레이 + 체크뱃지 (multi 모드)
    let selOverlay = null, checkBg = null;
    if (mode === 'multi') {
      selOverlay = new PIXI.Graphics();
      selOverlay.beginFill(0xffe066, 0.35);
      selOverlay.drawRect(0, 0, SW, SH);
      selOverlay.endFill();
      selOverlay.lineStyle(3, 0xffe066, 0.95);
      selOverlay.drawRect(1, 1, SW - 2, SH - 2);
      selOverlay.alpha = 0;
      slot.addChild(selOverlay);

      checkBg = new PIXI.Graphics();
      checkBg.beginFill(0xffe066, 0.95);
      checkBg.drawCircle(0, 0, 12);
      checkBg.endFill();
      const checkTxt = new PIXI.Text('✓', {
        fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: C.dark,
      });
      checkTxt.anchor.set(0.5);
      checkBg.addChild(checkTxt);
      checkBg.x = SW - 10; checkBg.y = 10;
      checkBg.alpha = 0;
      slot.addChild(checkBg);
    }

    const _setSlotSelected = (on) => {
      if (selOverlay) selOverlay.alpha = on ? 1 : 0;
      if (checkBg)    checkBg.alpha    = on ? 1 : 0;
      face.alpha = on ? 0.75 : 1;
    };

    // 인터랙션
    slot.eventMode = 'static'; slot.cursor = 'pointer';
    let _t = null, _px = 0, _py = 0;

    slot.on('pointerdown', (e) => {
      _px = e.global.x; _py = e.global.y;
      _t = setTimeout(() => {
        _t = null;
        if (allowDetail) CardDetail.show(itemDef);
      }, 500);
    });

    slot.on('pointermove', (e) => {
      if (!_t) return;
      const dx = e.global.x - _px, dy = e.global.y - _py;
      if (dx * dx + dy * dy > 64) { clearTimeout(_t); _t = null; }
    });

    slot.on('pointerup', () => {
      if (!_t) return;
      clearTimeout(_t); _t = null;

      if (mode === 'single') {
        _close();
        onConfirm([item]);
      } else {
        // multi: 토글 (maxCount 초과 시 무시)
        if (selected.has(item)) {
          selected.delete(item);
          _setSlotSelected(false);
        } else if (maxCount === null || selected.size < maxCount) {
          selected.add(item);
          _setSlotSelected(true);
        }
        _updateUI?.();
      }
    });

    slot.on('pointerupoutside', () => { clearTimeout(_t); _t = null; });

    overlay.addChild(slot);
  });

  // ── 확인 버튼 (multi 모드) ────────────────────────────────
  if (mode === 'multi') {
    const CONFIRM_W = 220;
    const confirmBtnY = hasCancel ? H - 100 + 8 : H - 56 + 8;
    const initLabel = typeof confirmLabel === 'function' ? confirmLabel(0) : (confirmLabel ?? '확인');
    const { btn: confirmBtn, txt: confirmTxt, setDim } = _makeBtn(initLabel, CONFIRM_W, C.gold);

    confirmBtn.x = Math.round((W - CONFIRM_W) / 2);
    confirmBtn.y = confirmBtnY;

    const _isEnabled = () => canConfirmEmpty ? true : selected.size >= minCount;

    confirmBtn.on('pointerup', () => {
      confirmBtn.scale.set(1);
      if (!_isEnabled()) return;
      _close();
      onConfirm([...selected]);
    });
    overlay.addChild(confirmBtn);

    _updateUI = () => {
      const n = selected.size;
      // 부제목 동적 갱신
      if (typeof subtitle === 'function') subtitleTxt.text = subtitle(n);
      // 버튼 레이블 갱신
      if (confirmLabel) {
        confirmTxt.text = typeof confirmLabel === 'function' ? confirmLabel(n) : confirmLabel;
      }
      // 버튼 활성/비활성
      const enabled = _isEnabled();
      setDim(!enabled);
      confirmTxt.alpha = enabled ? 1 : 0.4;
    };

    // 초기 상태에서 minCount>0이면 비활성
    if (!_isEnabled()) _updateUI();
  }

  // ── 취소 버튼 ─────────────────────────────────────────────
  if (hasCancel) {
    const CANCEL_W  = 180;
    const cancelBtnY = H - 50;
    const { btn: cancelBtn } = _makeBtn(cancelLabel, CANCEL_W, C.goldDim, 10);
    cancelBtn.x = Math.round((W - CANCEL_W) / 2);
    cancelBtn.y = cancelBtnY;
    cancelBtn.on('pointerup', () => { cancelBtn.scale.set(1); _close(); onCancel(); });
    overlay.addChild(cancelBtn);
  }

  layer.addChild(overlay);
  return { close: _close };
}
