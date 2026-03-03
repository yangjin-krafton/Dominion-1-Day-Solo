// ============================================================
// CatalogOverlay.js — 도감 PixiJS 오버레이
// CardDetail의 buildDetailCard를 0.45 스케일로 재사용
// 사용법: init(layer) → show(cardMap) → hide()
// ============================================================
import {
  C,
  SCREEN_W as W, SCREEN_H as H,
  DETAIL_W as DW, DETAIL_H as DH,
  CARD_W,
  BASIC_IDS, KINGDOM_POOL,
} from '../config.js';
import { buildDetailCard } from './CardDetail.js';

// ─── 도감 카드 스케일 (CARD_W × 1.5 / DETAIL_W) ──────────────
// CARD_W=90 → 90×1.5=135 / DW=300 = 0.45
const CAT_SCALE = (CARD_W * 1.5) / DW;         // 0.45
const CAT_CW    = Math.round(DW * CAT_SCALE);  // 135px
const CAT_CH    = Math.round(DH * CAT_SCALE);  // 202px

const HEADER_H = 52;
const COLS     = 2;
const GAP      = 8;
const PAD      = 12;

// ─── 싱글턴 상태 ─────────────────────────────────────────────
let _layer   = null;
let _overlay = null;

// ─── 초기화 (부트 시 1회) ────────────────────────────────────
export function init(layer) {
  _layer = layer;
}

// ─── 도감 열기 ───────────────────────────────────────────────
export function show(cardMap) {
  if (!_layer || _overlay) return;

  _overlay = new PIXI.Container();
  _overlay.zIndex    = 9998;
  _overlay.eventMode = 'static';

  // 배경 (반투명)
  const backdrop = new PIXI.Graphics();
  backdrop.beginFill(0x000000, 0.94);
  backdrop.drawRect(0, 0, W, H);
  backdrop.endFill();
  _overlay.addChild(backdrop);

  // ── 헤더 ──────────────────────────────────────────────────
  const header = new PIXI.Graphics();
  header.beginFill(0x0a0814, 0.98);
  header.drawRect(0, 0, W, HEADER_H);
  header.endFill();
  header.lineStyle(1, C.gold, 0.4);
  header.moveTo(0, HEADER_H); header.lineTo(W, HEADER_H);
  _overlay.addChild(header);

  const titleTxt = new PIXI.Text('도감', {
    fontFamily: 'Georgia, serif', fontSize: 18,
    fontStyle: 'italic', fill: C.gold, letterSpacing: 2,
  });
  titleTxt.anchor.set(0, 0.5);
  titleTxt.x = 16; titleTxt.y = HEADER_H / 2;
  _overlay.addChild(titleTxt);

  const closeBtn = _makeCloseBtn(() => hide());
  closeBtn.x = W - 22; closeBtn.y = HEADER_H / 2;
  _overlay.addChild(closeBtn);

  // ── 스크롤 영역 (마스크) ──────────────────────────────────
  const scrollH    = H - HEADER_H;
  const scrollMask = new PIXI.Graphics();
  scrollMask.beginFill(0xffffff);
  scrollMask.drawRect(0, HEADER_H, W, scrollH);
  scrollMask.endFill();
  _overlay.addChild(scrollMask);

  const scrollCont = new PIXI.Container();
  scrollCont.y    = HEADER_H;
  scrollCont.mask = scrollMask;
  _overlay.addChild(scrollCont);

  // ── 카드 그리드 콘텐츠 ────────────────────────────────────
  let contentY = PAD;
  const colStartX = Math.round((W - (CAT_CW * COLS + GAP * (COLS - 1))) / 2);

  const _addSection = (label, ids) => {
    const defs = ids.map(id => cardMap.get(id)).filter(Boolean);
    if (!defs.length) return;

    // 섹션 레이블
    const sLbl = new PIXI.Text(label, {
      fontFamily: 'Georgia, serif', fontSize: 10,
      fontStyle: 'italic', fill: C.goldDim, letterSpacing: 3,
    });
    sLbl.x = PAD; sLbl.y = contentY;
    scrollCont.addChild(sLbl);
    contentY += 22;

    // 구분선
    const line = new PIXI.Graphics();
    line.lineStyle(0.5, C.goldDim, 0.4);
    line.moveTo(PAD, contentY); line.lineTo(W - PAD, contentY);
    scrollCont.addChild(line);
    contentY += 8;

    // 카드 배치
    defs.forEach((def, i) => {
      const col  = i % COLS;
      const row  = Math.floor(i / COLS);
      const card = buildDetailCard(def);
      card.scale.set(CAT_SCALE);
      card.x = colStartX + col * (CAT_CW + GAP);
      card.y = contentY  + row * (CAT_CH + GAP);
      scrollCont.addChild(card);
    });

    contentY += Math.ceil(defs.length / COLS) * (CAT_CH + GAP) + PAD;
  };

  _addSection('기본 카드', BASIC_IDS);
  _addSection('왕국 카드', KINGDOM_POOL);

  const totalH   = contentY;
  const minScrollY = Math.min(0, scrollH - totalH);

  // ── 스크롤 인터랙션 ───────────────────────────────────────
  let _dragActive  = false;
  let _dragStartY  = 0;
  let _dragBase    = 0;
  let _curScrollY  = 0;
  // 관성 스크롤
  let _velocity    = 0;
  let _lastY       = 0;
  let _lastTime    = 0;
  let _rafId       = null;

  const _clamp = y => Math.max(minScrollY, Math.min(0, y));

  const _applyScroll = y => {
    _curScrollY      = _clamp(y);
    scrollCont.y     = HEADER_H + _curScrollY;
  };

  _overlay.on('pointerdown', e => {
    if (e.global.y < HEADER_H) return;
    _dragActive = true;
    _dragStartY = e.global.y;
    _dragBase   = _curScrollY;
    _lastY      = e.global.y;
    _lastTime   = Date.now();
    _velocity   = 0;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  });

  _overlay.on('pointermove', e => {
    if (!_dragActive) return;
    const now = Date.now();
    const dt  = now - _lastTime || 1;
    _velocity = (e.global.y - _lastY) / dt * 16;   // px/frame
    _lastY    = e.global.y;
    _lastTime = now;
    _applyScroll(_dragBase + (e.global.y - _dragStartY));
  });

  const _stopDrag = () => {
    if (!_dragActive) return;
    _dragActive = false;

    // 관성 스크롤 (감속)
    const _inertia = () => {
      _velocity *= 0.92;
      if (Math.abs(_velocity) > 0.5) {
        _applyScroll(_curScrollY + _velocity);
        _rafId = requestAnimationFrame(_inertia);
      } else {
        _rafId = null;
      }
    };
    _rafId = requestAnimationFrame(_inertia);
  };
  _overlay.on('pointerup',        _stopDrag);
  _overlay.on('pointerupoutside', _stopDrag);

  _layer.addChild(_overlay);

  // 페이드인
  _overlay.alpha = 0;
  const t0 = Date.now();
  const _fadeIn = () => {
    const t = Math.min((Date.now() - t0) / 200, 1);
    _overlay.alpha = t;
    if (t < 1) requestAnimationFrame(_fadeIn);
  };
  requestAnimationFrame(_fadeIn);
}

// ─── 도감 닫기 ───────────────────────────────────────────────
export function hide() {
  if (_overlay && _layer) {
    _layer.removeChild(_overlay);
    _overlay.destroy({ children: true });
    _overlay = null;
  }
}

// ─── ✕ 닫기 버튼 ─────────────────────────────────────────────
function _makeCloseBtn(onClick) {
  const btn = new PIXI.Container();

  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a1030, 0.9);
  bg.lineStyle(1, C.goldDim, 0.6);
  bg.drawRoundedRect(-14, -14, 28, 28, 4);
  bg.endFill();
  btn.addChild(bg);

  const t = new PIXI.Text('✕', {
    fontFamily: 'Georgia, serif', fontSize: 14, fill: C.dimCream,
  });
  t.anchor.set(0.5);
  btn.addChild(t);

  btn.eventMode = 'static'; btn.cursor = 'pointer';
  btn.on('pointerdown',      e => { e.stopPropagation(); btn.scale.set(0.9); });
  btn.on('pointerup',        e => { e.stopPropagation(); btn.scale.set(1); onClick?.(); });
  btn.on('pointerupoutside', e => { e.stopPropagation(); btn.scale.set(1); });
  return btn;
}
