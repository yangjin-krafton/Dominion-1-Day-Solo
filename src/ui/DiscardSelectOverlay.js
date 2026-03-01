// ============================================================
// ui/DiscardSelectOverlay.js — 핸드 카드 선택 → 버리기 오버레이
//  사용: showDiscardSelectOverlay(layer, handCards, onConfirm, onCancel)
//   handCards  : Card[]  현재 손패
//   onConfirm(selected: Card[]) : 선택된 카드 배열 전달
//   onCancel() : 아무것도 안 함 (0장 버리고 닫기)
// ============================================================
import {
  C,
  CARD_W, CARD_H,
  SCREEN_W as W, SCREEN_H as H,
} from '../config.js';
import { buildFrontFace } from './CardArt.js';

// ── 레이아웃 ────────────────────────────────────────────────
const PAD_X  = 10;
const GAP    = 8;
const HDR_H  = 64;
const BTN_H  = 56;

function _bestCols(n) {
  if (n <= 3) return n;
  if (n <= 6) return 3;
  return 4;
}

/**
 * 선택 오버레이
 */
export function showDiscardSelectOverlay(layer, handCards, onConfirm, onCancel) {
  const overlay = new PIXI.Container();
  overlay.zIndex = 9500;
  layer.sortableChildren = true;

  // ── 전체화면 배경 ─────────────────────────────────────────
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

  const title = new PIXI.Text('저장고', {
    fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 'bold', fill: C.goldHi,
  });
  title.anchor.set(0.5, 0); title.x = W / 2; title.y = 10;
  overlay.addChild(title);

  const subtitle = new PIXI.Text('버릴 카드를 선택하세요 (0장 이상)', {
    fontFamily: 'Georgia, serif', fontSize: 10, fontStyle: 'italic', fill: C.dimCream,
  });
  subtitle.anchor.set(0.5, 0); subtitle.x = W / 2; subtitle.y = 34;
  overlay.addChild(subtitle);

  // ── 선택 상태 ─────────────────────────────────────────────
  const selected = new Set();    // Card 객체들의 Set

  // 확인 버튼 텍스트 갱신 함수 (forward ref)
  let _updateBtn = null;

  // ── 카드 그리드 ───────────────────────────────────────────
  if (handCards.length === 0) {
    const empty = new PIXI.Text('손패에 카드가 없습니다', {
      fontFamily: 'Georgia, serif', fontSize: 13, fill: C.dimCream, fontStyle: 'italic',
    });
    empty.anchor.set(0.5, 0.5); empty.x = W / 2; empty.y = H / 2;
    overlay.addChild(empty);
  } else {
    const COLS  = _bestCols(handCards.length);
    const ROWS  = Math.ceil(handCards.length / COLS);
    const availW = W - 2 * PAD_X - (COLS - 1) * GAP;
    const SW     = Math.floor(availW / COLS);
    const SCALE  = SW / CARD_W;
    const SH     = Math.round(CARD_H * SCALE);

    const gridH    = ROWS * SH + (ROWS - 1) * GAP;
    const cardAreaH = H - HDR_H - BTN_H;
    const GY       = HDR_H + Math.max(10, Math.round((cardAreaH - gridH) / 2));

    handCards.forEach((card, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const sx  = PAD_X + col * (SW + GAP);
      const sy  = GY + row * (SH + GAP);

      const slot = new PIXI.Container();
      slot.x = sx; slot.y = sy;

      // 카드 앞면
      const face = buildFrontFace(card.def);
      face.scale.set(SCALE);
      slot.addChild(face);

      // 선택 오버레이 (처음엔 숨김)
      const selOverlay = new PIXI.Graphics();
      selOverlay.beginFill(0xffe066, 0.35);
      selOverlay.drawRect(0, 0, SW, SH);
      selOverlay.endFill();
      selOverlay.lineStyle(3, 0xffe066, 0.95);
      selOverlay.drawRect(1, 1, SW - 2, SH - 2);
      selOverlay.alpha = 0;
      slot.addChild(selOverlay);

      // 선택 체크 뱃지
      const checkBg = new PIXI.Graphics();
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

      const _setSelected = (on) => {
        selOverlay.alpha = on ? 1 : 0;
        checkBg.alpha    = on ? 1 : 0;
        face.alpha       = on ? 0.75 : 1;
      };

      // 탭 → 선택/해제
      slot.eventMode = 'static'; slot.cursor = 'pointer';
      let _t = null, _sx = 0, _sy = 0;
      slot.on('pointerdown', (e) => {
        _sx = e.global.x; _sy = e.global.y;
        _t  = setTimeout(() => { _t = null; }, 500);
      });
      slot.on('pointermove', (e) => {
        if (!_t) return;
        const dx = e.global.x - _sx, dy = e.global.y - _sy;
        if (dx * dx + dy * dy > 64) { clearTimeout(_t); _t = null; }
      });
      slot.on('pointerup', () => {
        if (_t) {
          clearTimeout(_t); _t = null;
          if (selected.has(card)) { selected.delete(card); _setSelected(false); }
          else                    { selected.add(card);    _setSelected(true);  }
          _updateBtn?.();
        }
      });
      slot.on('pointerupoutside', () => { clearTimeout(_t); _t = null; });

      overlay.addChild(slot);
    });
  }

  // ── 하단 버튼 영역 ────────────────────────────────────────
  const BTN_Y = H - BTN_H + 6;

  // 확인 버튼
  const confirmBtnW = 200;
  const confirmBtn  = new PIXI.Container();
  const confirmBg   = new PIXI.Graphics();
  confirmBg.beginFill(0x1a1030);
  confirmBg.lineStyle(1.5, C.gold, 0.8);
  confirmBg.drawRoundedRect(0, 0, confirmBtnW, 36, 8);
  confirmBg.endFill();
  confirmBtn.addChild(confirmBg);

  const confirmTxt = new PIXI.Text('건너뛰기 (0장)', {
    fontFamily: 'Georgia, serif', fontSize: 11, fill: C.goldHi,
  });
  confirmTxt.anchor.set(0.5); confirmTxt.x = confirmBtnW / 2; confirmTxt.y = 18;
  confirmBtn.addChild(confirmTxt);

  confirmBtn.x = Math.round(W / 2 - confirmBtnW / 2);
  confirmBtn.y = BTN_Y;
  confirmBtn.eventMode = 'static'; confirmBtn.cursor = 'pointer';
  confirmBtn.on('pointerdown',      () => confirmBtn.scale.set(0.95));
  confirmBtn.on('pointerup',        () => { confirmBtn.scale.set(1); onConfirm([...selected]); });
  confirmBtn.on('pointerupoutside', () => confirmBtn.scale.set(1));
  overlay.addChild(confirmBtn);

  // 버튼 텍스트 갱신
  _updateBtn = () => {
    const n = selected.size;
    confirmTxt.text = n === 0
      ? '건너뛰기 (0장)'
      : `${n}장 버리고 ${n}장 뽑기`;
  };

  layer.addChild(overlay);

  return {
    close() {
      if (overlay.parent) overlay.parent.removeChild(overlay);
      overlay.destroy({ children: true });
    },
  };
}
