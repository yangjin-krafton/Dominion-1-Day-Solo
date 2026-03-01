// ============================================================
// CardDetail.js — 카드 상세 보기 오버레이 (싱글턴)
// 사용법: init(layer) → show(def) → 아무 곳 클릭 시 hide()
// ============================================================
import {
  C, ACCENT,
  SCREEN_W as W, SCREEN_H as H,
  DETAIL_W as DW, DETAIL_H as DH,  // config에서 일괄 관리
} from '../config.js';
import { lerpColor } from './CardArt.js';

// ─── 상세 뷰 위치 (크기는 config.js의 DETAIL_W/H에서 결정) ───
const CX = Math.round((W - DW) / 2);  // 카드 좌측 x
const CY   = 54;                             // 카드 상단 y

// ─── 싱글턴 상태 ─────────────────────────────────────────────
let _layer   = null;
let _overlay = null;
let _rafId   = null;

// ─── 대형 카드 렌더링 ────────────────────────────────────────
function _buildLargeCard(def) {
  const acc = ACCENT[def.type] ?? C.gold;
  const c   = new PIXI.Container();
  const g   = new PIXI.Graphics();

  // 그라디언트 바디 (20밴드 — 더 부드러운 전환)
  const top = def.gradTop ?? def.base;
  const mid = def.gradMid ?? def.base;
  const bot = def.gradBot ?? def.base;
  for (let i = 0; i < 20; i++) {
    const t   = i / 19;
    const col = t <= 0.5
      ? lerpColor(top, mid, t * 2)
      : lerpColor(mid, bot, (t - 0.5) * 2);
    g.beginFill(col);
    g.drawRect(0, i * (DH / 20), DW, DH / 20 + 1);
    g.endFill();
  }

  // 상단 타입 컬러 워시
  g.beginFill(acc, 0.12); g.drawRect(0, 0, DW, 96); g.endFill();

  // 골드 테두리 (2겹)
  g.lineStyle(4,   C.gold,    0.9); g.drawRect(0, 0, DW, DH);
  g.lineStyle(1.5, C.goldDim, 0.4); g.drawRect(8, 8, DW - 16, DH - 16);

  // 제목 구분선 + 다이아몬드
  const sepY = 96;
  g.lineStyle(2, C.gold, 0.7);
  g.moveTo(24, sepY); g.lineTo(DW / 2 - 14, sepY);
  g.moveTo(DW / 2 + 14, sepY); g.lineTo(DW - 24, sepY);
  g.lineStyle(0);
  g.beginFill(C.gold, 0.9);
  g.drawPolygon([DW/2, sepY-9, DW/2+9, sepY, DW/2, sepY+9, DW/2-9, sepY]);
  g.endFill();

  // 하단 구분선
  g.lineStyle(2, C.gold, 0.35); g.moveTo(24, DH - 52); g.lineTo(DW - 24, DH - 52);
  c.addChild(g);

  // 코스트 배지
  const badge = new PIXI.Graphics();
  badge.lineStyle(3.5, C.gold); badge.beginFill(C.dark, 0.9);
  badge.drawCircle(32, 32, 26); badge.endFill();
  badge.lineStyle(1.5, C.goldHi, 0.3); badge.drawCircle(32, 32, 20);
  c.addChild(badge);
  const costTxt = new PIXI.Text(String(def.cost), {
    fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 'bold', fill: C.gold,
  });
  costTxt.anchor.set(0.5); costTxt.x = 32; costTxt.y = 32;
  c.addChild(costTxt);

  // 카드 이름
  const nameTxt = new PIXI.Text(def.name, {
    fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 'bold',
    fill: C.cream, align: 'center',
  });
  nameTxt.anchor.set(0.5); nameTxt.x = DW / 2 + 10; nameTxt.y = 48;
  c.addChild(nameTxt);

  // 설명 텍스트
  const descTxt = new PIXI.Text(def.desc, {
    fontFamily: 'Georgia, serif', fontSize: 28,
    fill: C.cream, align: 'center',
    wordWrap: true, wordWrapWidth: DW - 40, lineHeight: 38,
  });
  descTxt.anchor.set(0.5);
  descTxt.x = DW / 2;
  descTxt.y = (sepY + DH - 52) / 2 + 4;
  c.addChild(descTxt);

  // 타입 레이블
  const typeLabel = (def.rawType ?? def.type).replace(/-/g, ' · ');
  const typeTxt = new PIXI.Text(typeLabel.toUpperCase(), {
    fontFamily: 'Georgia, serif', fontSize: 18, fontStyle: 'italic',
    fill: acc, alpha: 0.85,
  });
  typeTxt.anchor.set(0.5); typeTxt.x = DW / 2; typeTxt.y = DH - 28;
  c.addChild(typeTxt);

  return c;
}

// ─── 카드 아래 부가 정보 패널 ────────────────────────────────
function _buildInfoPanel(def) {
  const panel = new PIXI.Container();
  const infoY = CY + DH + 20;

  const lines = [
    `${def.nameEn}  ·  ${def.set}  ·  Cost ${def.cost}${def.points !== 0 ? `  ·  VP ${def.points > 0 ? '+' : ''}${def.points}` : ''}`,
    '아무 곳이나 클릭하면 닫힙니다',
  ];

  lines.forEach((text, i) => {
    const t = new PIXI.Text(text, {
      fontFamily: 'Georgia, serif',
      fontSize:   i === 0 ? 14 : 11,
      fill:       i === 0 ? C.cream : C.dimCream,
      align:      'center',
    });
    t.anchor.set(0.5, 0); t.x = W / 2; t.y = infoY + i * 24;
    panel.addChild(t);
  });

  return panel;
}

// ─── 공개 API ─────────────────────────────────────────────────

/**
 * 오버레이가 사용할 PixiJS 레이어 등록 (부트 시 1회 호출)
 * @param {PIXI.Container} layer
 */
export function init(layer) {
  _layer = layer;
}

/**
 * 카드 상세 보기 표시 (팝인 애니메이션 포함)
 * @param {object} def - CardDef
 */
export function show(def) {
  if (!_layer || _overlay) return;

  _overlay = new PIXI.Container();
  _overlay.zIndex = 9999;

  // 반투명 배경 — 클릭 시 닫기
  const backdrop = new PIXI.Graphics();
  backdrop.beginFill(0x000000, 0.82); backdrop.drawRect(0, 0, W, H); backdrop.endFill();
  backdrop.eventMode = 'static'; backdrop.cursor = 'pointer';
  backdrop.on('pointerdown', hide);
  _overlay.addChild(backdrop);

  // 대형 카드 컨테이너 (pivot 중심 기준 → scale 애니메이션)
  const cardWrap = new PIXI.Container();
  cardWrap.addChild(_buildLargeCard(def));
  cardWrap.pivot.set(DW / 2, DH / 2);
  cardWrap.x = CX + DW / 2;
  cardWrap.y = CY + DH / 2;
  _overlay.addChild(cardWrap);

  // 부가 정보
  _overlay.addChild(_buildInfoPanel(def));

  _overlay.alpha = 0;
  cardWrap.scale.set(0.82);
  _layer.addChild(_overlay);

  // 팝인 애니메이션 (ease-out quad, 220ms)
  const start = Date.now();
  const animIn = () => {
    const t    = Math.min((Date.now() - start) / 220, 1);
    const ease = 1 - (1 - t) * (1 - t);
    _overlay.alpha = ease;
    cardWrap.scale.set(0.82 + 0.18 * ease);
    _rafId = t < 1 ? requestAnimationFrame(animIn) : null;
  };
  _rafId = requestAnimationFrame(animIn);
}

/** 상세 보기 닫기 */
export function hide() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_overlay && _layer) {
    _layer.removeChild(_overlay);
    _overlay.destroy({ children: true });
    _overlay = null;
  }
}
