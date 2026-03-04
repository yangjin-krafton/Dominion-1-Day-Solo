// ============================================================
// VictoryCelebration.js — 승리 연출
//   꽃가루 파티클 (좌우 양쪽) + 중앙 "승리" 텍스트 (3초)
// 사용법: init(layer) → show(onComplete)
// ============================================================
import { SCREEN_W as W, SCREEN_H as H } from '../config.js';

const DURATION    = 3000;          // ms
const PETAL_HALF  = 38;            // 한쪽 파티클 수
const COLORS      = [
  0xd4a820, 0xf04444, 0xa040d8,
  0x44c060, 0x4488e8, 0xf08820, 0xe840a8,
];

let _layer   = null;
let _overlay = null;
let _rafId   = null;

// ─── 초기화 ──────────────────────────────────────────────────
export function init(layer) { _layer = layer; }

// ─── 연출 시작 ───────────────────────────────────────────────
export function show(onComplete) {
  if (!_layer || _overlay) { onComplete?.(); return; }

  _overlay            = new PIXI.Container();
  _overlay.zIndex     = 9997;
  _overlay.eventMode  = 'none';
  _layer.addChild(_overlay);

  // ── 반투명 배경
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.52);
  bg.drawRect(0, 0, W, H);
  bg.endFill();
  _overlay.addChild(bg);

  // ── 꽃가루 파티클
  const petals = _makePetals();
  petals.forEach(p => _overlay.addChild(p.gfx));

  // ── "승리" 텍스트
  const txt = new PIXI.Text('승리', {
    fontFamily:       'Georgia, serif',
    fontSize:          90,
    fontStyle:         'italic',
    fontWeight:        'bold',
    fill:              [0xfff8b0, 0xd4a820],
    fillGradientType:  0,
    stroke:            0x3a1800,
    strokeThickness:   7,
    dropShadow:        true,
    dropShadowColor:   0xffcc00,
    dropShadowBlur:    28,
    dropShadowDistance: 0,
  });
  txt.anchor.set(0.5);
  txt.x = W / 2;
  txt.y = H * 0.38;
  txt.scale.set(0);
  _overlay.addChild(txt);

  // ── rAF 루프
  const t0 = Date.now();
  const _tick = () => {
    const ms = Date.now() - t0;

    // 텍스트 bounce scale: 0 → 1.3 → 1.0
    if      (ms < 320)  txt.scale.set(_easeOut(ms / 320) * 1.3);
    else if (ms < 500)  txt.scale.set(1.3 - 0.3 * _easeIn((ms - 320) / 180));
    else                txt.scale.set(1.0);

    // 전체 페이드아웃 (마지막 700ms)
    if (ms > DURATION - 700)
      _overlay.alpha = Math.max(0, 1 - (ms - (DURATION - 700)) / 700);

    // 파티클 이동
    for (const p of petals) {
      if (ms < p.delay) continue;
      const dt       = (ms - p.delay) / 1000;   // seconds
      p.gfx.x        = p.x0 + p.vx * dt;
      p.gfx.y        = p.y0 + p.vy * dt + 0.5 * p.g * dt * dt;
      p.gfx.rotation += p.rs;
      const life     = 1 - (ms - p.delay) / Math.max(1, DURATION - p.delay);
      p.gfx.alpha    = Math.max(0, life);
    }

    if (ms >= DURATION) {
      _cleanup();
      onComplete?.();
    } else {
      _rafId = requestAnimationFrame(_tick);
    }
  };
  _rafId = requestAnimationFrame(_tick);
}

// ─── 내부 ────────────────────────────────────────────────────
function _makePetals() {
  return Array.from({ length: PETAL_HALF * 2 }, (_, i) => {
    const left = i < PETAL_HALF;
    const col  = COLORS[i % COLORS.length];
    const pw   = 7 + Math.random() * 10;
    const ph   = 4 + Math.random() * 7;
    const gfx  = new PIXI.Graphics();
    gfx.beginFill(col, 0.92);
    gfx.drawRect(-pw / 2, -ph / 2, pw, ph);
    gfx.endFill();
    gfx.alpha    = 0;
    gfx.rotation = Math.random() * Math.PI * 2;
    return {
      gfx,
      x0:    left ? -20 : W + 20,
      y0:    H * (0.2 + Math.random() * 0.6),
      vx:    (60 + Math.random() * 130) * (left ? 1 : -1),
      vy:   -(170 + Math.random() * 280),   // 초기 상방 속도 (px/s)
      g:     390 + Math.random() * 220,     // 중력 가속도 (px/s²)
      rs:    (Math.random() - 0.5) * 0.18, // 프레임당 회전량
      delay: Math.random() * 420,           // 발사 딜레이 (ms)
    };
  });
}

function _cleanup() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_overlay && _layer) {
    _layer.removeChild(_overlay);
    _overlay.destroy({ children: true });
    _overlay = null;
  }
}

const _easeOut = t => 1 - (1 - t) ** 3;
const _easeIn  = t => t * t;
