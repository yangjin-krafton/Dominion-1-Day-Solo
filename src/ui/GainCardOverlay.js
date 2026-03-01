// ============================================================
// ui/GainCardOverlay.js — 카드 획득 선택 오버레이 (전체화면)
//  사용: showGainCardOverlay(layer, supply, maxCost, onGain, onCancel)
// ============================================================
import {
  C,
  CARD_W, CARD_H,
  SCREEN_W as W, SCREEN_H as H,
} from '../config.js';
import { buildFrontFace } from './CardArt.js';
import * as CardDetail from './CardDetail.js';

// ── 레이아웃 상수 ───────────────────────────────────────────
const PAD_X   = 10;   // 좌우 여백
const PAD_Y   = 8;    // 카드 간 세로 간격
const GAP     = 8;    // 카드 간 가로 간격
const HDR_H   = 58;   // 헤더 높이
const BTN_H   = 52;   // 하단 취소 버튼 높이

/**
 * 획득 가능 카드 수에 따라 최적 열 수 반환
 */
function _bestCols(n) {
  if (n <= 2) return n;
  if (n <= 4) return Math.min(n, 4);
  if (n <= 6) return 3;
  return 4;
}

/**
 * @param {PIXI.Container} layer   - 오버레이를 붙일 레이어 (lUI)
 * @param {Map}            supply  - gs.supply
 * @param {number}         maxCost - 최대 비용 필터
 * @param {function}       onGain  - (def) 호출됨
 * @param {function}       onCancel
 * @returns {{ close: () => void }}
 */
export function showGainCardOverlay(layer, supply, maxCost, onGain, onCancel) {
  const overlay = new PIXI.Container();
  overlay.zIndex = 9500;
  layer.sortableChildren = true;

  // ── 전체화면 배경 ─────────────────────────────────────────
  const backdrop = new PIXI.Graphics();
  backdrop.beginFill(0x06030f, 0.96);
  backdrop.drawRect(0, 0, W, H);
  backdrop.endFill();
  backdrop.eventMode = 'static';
  overlay.addChild(backdrop);

  // ── 헤더 ──────────────────────────────────────────────────
  const hdrLine = new PIXI.Graphics();
  hdrLine.lineStyle(1, C.goldDim, 0.4);
  hdrLine.moveTo(0, HDR_H); hdrLine.lineTo(W, HDR_H);
  overlay.addChild(hdrLine);

  const title = new PIXI.Text(`카드 획득`, {
    fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 'bold', fill: C.goldHi,
  });
  title.anchor.set(0.5, 0); title.x = W / 2; title.y = 10;
  overlay.addChild(title);

  const subtitle = new PIXI.Text(`비용 ${maxCost} 이하 카드를 선택하세요`, {
    fontFamily: 'Georgia, serif', fontSize: 10, fontStyle: 'italic', fill: C.dimCream,
  });
  subtitle.anchor.set(0.5, 0); subtitle.x = W / 2; subtitle.y = 34;
  overlay.addChild(subtitle);

  // ── 카드 목록 ─────────────────────────────────────────────
  const eligible = [...supply.entries()].filter(([, { def, count }]) =>
    def.cost <= maxCost && count > 0,
  );

  if (eligible.length === 0) {
    const empty = new PIXI.Text('획득 가능한 카드가 없습니다', {
      fontFamily: 'Georgia, serif', fontSize: 13, fill: C.dimCream, fontStyle: 'italic',
    });
    empty.anchor.set(0.5, 0.5); empty.x = W / 2; empty.y = H / 2;
    overlay.addChild(empty);
  } else {
    // ── 동적 카드 크기 계산 ──────────────────────────────────
    const COLS  = _bestCols(eligible.length);
    const ROWS  = Math.ceil(eligible.length / COLS);

    // 가로 방향: 여백·간격 제외한 최대 카드 너비
    const availW = W - 2 * PAD_X - (COLS - 1) * GAP;
    const SW     = Math.floor(availW / COLS);
    const SCALE  = SW / CARD_W;
    const SH     = Math.round(CARD_H * SCALE);

    // 카드 그리드 시작 y (헤더 아래 중앙 배치)
    const gridH  = ROWS * SH + (ROWS - 1) * PAD_Y;
    const cardAreaH = H - HDR_H - BTN_H;
    const GY     = HDR_H + Math.max(10, Math.round((cardAreaH - gridH) / 2));
    const GX     = PAD_X;

    eligible.forEach(([id, { def, count }], idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const sx  = GX + col * (SW + GAP);
      const sy  = GY + row * (SH + PAD_Y);

      const slot = new PIXI.Container();
      slot.x = sx; slot.y = sy;

      // 카드 앞면
      const face = buildFrontFace(def);
      face.scale.set(SCALE);
      slot.addChild(face);

      // 수량 배지 (카드 우하단)
      const badgeG = new PIXI.Graphics();
      badgeG.beginFill(C.dark, 0.92);
      badgeG.lineStyle(1, C.gold, 0.75);
      badgeG.drawRoundedRect(-18, -8, 36, 16, 4);
      badgeG.endFill();
      const cntTxt = new PIXI.Text(`×${count}`, {
        fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 'bold', fill: C.gold,
      });
      cntTxt.anchor.set(0.5);
      badgeG.addChild(cntTxt);
      badgeG.x = SW - 14; badgeG.y = SH - 8;
      slot.addChild(badgeG);

      // 인터랙션: 탭 → 획득 / 홀드 → 상세 보기
      slot.eventMode = 'static'; slot.cursor = 'pointer';
      let _t = null, _sx = 0, _sy = 0;
      slot.on('pointerdown', (e) => {
        _sx = e.global.x; _sy = e.global.y;
        _t  = setTimeout(() => { _t = null; CardDetail.show(def); }, 500);
      });
      slot.on('pointermove', (e) => {
        if (!_t) return;
        const dx = e.global.x - _sx, dy = e.global.y - _sy;
        if (dx * dx + dy * dy > 64) { clearTimeout(_t); _t = null; }
      });
      slot.on('pointerup', () => {
        if (_t) { clearTimeout(_t); _t = null; onGain(def); }
      });
      slot.on('pointerupoutside', () => { clearTimeout(_t); _t = null; });

      overlay.addChild(slot);
    });
  }

  // ── 취소 버튼 (화면 최하단) ───────────────────────────────
  const BTN_W    = 160;
  const cancelBtn = new PIXI.Container();
  const cancelBg  = new PIXI.Graphics();
  cancelBg.beginFill(0x1a1030);
  cancelBg.lineStyle(1.5, C.goldDim, 0.7);
  cancelBg.drawRoundedRect(0, 0, BTN_W, 36, 8);
  cancelBg.endFill();
  cancelBtn.addChild(cancelBg);

  const cancelTxt = new PIXI.Text('취소 (아무것도 획득 안 함)', {
    fontFamily: 'Georgia, serif', fontSize: 10, fill: C.dimCream,
  });
  cancelTxt.anchor.set(0.5); cancelTxt.x = BTN_W / 2; cancelTxt.y = 18;
  cancelBtn.addChild(cancelTxt);

  cancelBtn.x = Math.round((W - BTN_W) / 2);
  cancelBtn.y = H - BTN_H + 8;
  cancelBtn.eventMode = 'static'; cancelBtn.cursor = 'pointer';
  cancelBtn.on('pointerdown',      () => cancelBtn.scale.set(0.95));
  cancelBtn.on('pointerup',        () => { cancelBtn.scale.set(1); onCancel(); });
  cancelBtn.on('pointerupoutside', () => cancelBtn.scale.set(1));
  overlay.addChild(cancelBtn);

  layer.addChild(overlay);

  return {
    close() {
      if (overlay.parent) overlay.parent.removeChild(overlay);
      overlay.destroy({ children: true });
    },
  };
}
