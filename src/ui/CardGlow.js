// ============================================================
// ui/CardGlow.js — 구매 가능 카드 테두리 빛 흐름 이펙트
//
// 사용법:
//   const glow = new CardGlow(width, height);
//   wrapper.addChild(glow.g);
//   glow.setActive(true);        // 활성화
//   glow.update(dt);             // 매 프레임 호출
// ============================================================

const BASE_COLOR = 0xd4a820;  // 골드 (기본 테두리)
const GLOW_OUTER = 0xd4a820;  // 외곽 글로우
const GLOW_CORE  = 0xffe09a;  // 코어 밝은 금빛
const HEAD_DOT   = 0xfffae0;  // 헤드 포인트 최고 밝기

const DIM_OUTER  = 0x1e2535;  // 구매 불가 — 넓은 어두운 외곽
const DIM_INNER  = 0x3a4a60;  // 구매 불가 — 안쪽 청회색 선

/**
 * 둘레 위 픽셀 거리 t 에 해당하는 (x, y) 좌표 반환
 * 시계방향: 좌상단 → 우상단 → 우하단 → 좌하단 → 좌상단
 */
function perimPoint(t, w, h) {
  const perim = 2 * (w + h);
  t = ((t % perim) + perim) % perim;
  if (t <= w) return [t,     0    ];  t -= w;
  if (t <= h) return [w,     t    ];  t -= h;
  if (t <= w) return [w - t, h    ];  t -= w;
  return              [0,     h - t];
}

export class CardGlow {
  /**
   * @param {number} w  카드 너비 (픽셀)
   * @param {number} h  카드 높이 (픽셀)
   */
  constructor(w, h) {
    this.w       = w;
    this.h       = h;
    this._pos    = 0;       // 빛의 현재 둘레 위 픽셀 위치
    this._time   = 0;       // 펄스용 누적 시간
    this._active = false;
    this.g       = new PIXI.Graphics();
    this._drawBase();       // 초기 상태: 희미한 골드 테두리
  }

  /** 구매 가능 여부에 따라 이펙트 on/off */
  setActive(active) {
    if (this._active === active) return;
    this._active = active;
    if (!active) {
      this.g.clear();
      this._drawBase();
    }
  }

  /** 매 프레임 호출 (Market.update(dt)에서 위임) */
  update(dt) {
    if (!this._active) return;
    const perim  = 2 * (this.w + this.h);
    this._time  += dt;
    // 3.5초에 1바퀴
    this._pos = (this._pos + dt * (perim / 3.5)) % perim;
    this._redraw();
  }

  // ── 내부 ──────────────────────────────────────────────────

  _drawBase() {
    // 구매 불가 상태: 차갑고 어두운 청회색 2겹 (활성 골드와 명확히 대비)
    this.g.lineStyle(4, DIM_OUTER, 0.55);   // 넓은 외곽 (어둡고 흐릿한)
    this.g.drawRect(0, 0, this.w, this.h);
    this.g.lineStyle(1, DIM_INNER, 0.45);   // 얇은 내부 선 (청회색)
    this.g.drawRect(0, 0, this.w, this.h);
  }

  _redraw() {
    const { w, h, g } = this;
    const perim   = 2 * (w + h);
    const head    = this._pos;
    const tailLen = perim * 0.22;  // 꼬리 길이: 둘레의 22%
    const N       = 18;            // 꼬리를 나누는 세그먼트 수

    g.clear();

    // ── 기본 테두리 ──────────────────────────────────────────
    g.lineStyle(1, BASE_COLOR, 0.28);
    g.drawRect(0, 0, w, h);

    // ── 전체 아웃라인 글로우 (외곽→내부 3겹, 느린 펄스) ──────
    // 2.2초 주기, 80%~100% 사이 진동 (더 은은하게)
    const pulse = 0.80 + 0.20 * Math.sin(this._time * Math.PI * 2 / 2.2);
    g.lineStyle(6, GLOW_OUTER, 0.045 * pulse); // 넓은 외곽 헤일로
    g.drawRect(0, 0, w, h);
    g.lineStyle(3, GLOW_OUTER, 0.09 * pulse);  // 중간 헤일로
    g.drawRect(0, 0, w, h);
    g.lineStyle(1, GLOW_CORE,  0.25 * pulse);  // 밝은 내부 엣지
    g.drawRect(0, 0, w, h);

    // ── 빛 꼬리 (꼬리→헤드, 점점 밝아짐) ──────────────────
    for (let i = 0; i < N; i++) {
      const t0   = head - tailLen * (1 - i / N);
      const t1   = head - tailLen * (1 - (i + 1) / N);
      const frac = (i + 1) / N;              // 0=꼬리끝, 1=헤드
      const ease = frac * frac;              // 이지아웃 커브

      const [x0, y0] = perimPoint(t0, w, h);
      const [x1, y1] = perimPoint(t1, w, h);

      // 외곽 헤일로 (은은하게)
      g.lineStyle(2.5 + frac * 1.5, GLOW_OUTER, ease * 0.10);
      g.moveTo(x0, y0); g.lineTo(x1, y1);

      // 코어 선 (부드럽게)
      g.lineStyle(0.6 + frac * 1.0, GLOW_CORE, ease * 0.50);
      g.moveTo(x0, y0); g.lineTo(x1, y1);
    }

    // ── 헤드 포인트 (작고 은은한 불꽃) ────────────────────
    const [hx, hy] = perimPoint(head, w, h);
    g.lineStyle(0);
    g.beginFill(GLOW_OUTER, 0.18);
    g.drawCircle(hx, hy, 3);
    g.endFill();
    // 코어
    g.beginFill(GLOW_CORE, 0.55);
    g.drawCircle(hx, hy, 1.5);
    g.endFill();
    // 하이라이트
    g.beginFill(HEAD_DOT, 0.75);
    g.drawCircle(hx, hy, 0.6);
    g.endFill();
  }
}
