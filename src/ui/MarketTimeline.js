// ============================================================
// ui/MarketTimeline.js — 시장 이벤트 타임라인 (가로 캡슐 스크롤)
//
// 시장 섹션 최상단에 4개 캡슐을 가로로 배치.
// 미공개 수준(reveal)에 따라 정보를 점차 숨김:
//   reveal 0 (T+1) : 카드명 + 수량 완전 공개   (alpha 1.0, 밝은 색)
//   reveal 1 (T+2) : 카드명 공개, 수량 '?'     (alpha 0.78)
//   reveal 2 (T+3) : 타입만 공개               (alpha 0.52)
//   reveal 3 (T+4) : 완전 숨김 '???'           (alpha 0.28)
//
// scroll(newQueue, onDone) 호출 시:
//   · 기존 4개 캡슐이 왼쪽으로 슬라이드 (T+1 화면 밖으로)
//   · 새 T+4 캡슐이 오른쪽에서 진입
//   · easeOutCubic 440ms
// ============================================================
import { C, SCREEN_W as W, ZONE } from '../config.js';

// ── 레이아웃 상수 ──────────────────────────────────────────
const TL_Y    = ZONE.MARKET_Y + 2;   // 타임라인 상단 Y (시장섹션 상단 바로 아래)
export const TL_H = 22;               // 타임라인 영역 높이 (Market.js CARD_Y0 오프셋에 사용)

const CAP_H   = 16;                  // 캡슐 높이
const CAP_W   = 82;                  // 캡슐 너비
const CAP_GAP = 5;                   // 캡슐 간격
const CAPS_W  = 4 * CAP_W + 3 * CAP_GAP;  // 전체 너비 = 343px
const START_X = Math.round((W - CAPS_W) / 2);  // 중앙 정렬 시작 X = ~24

// ── 이벤트 타입별 강조색 ───────────────────────────────────
const ETYPE_COLOR = {
  vanish: 0xe03030,   // 빨강  — 카드 소멸
  drain:  0x9933cc,   // 보라  — 타입 고갈
  surge:  0xcc7700,   // 주황  — 급등
  skip:   0x3a4a3a,   // 녹회색 — 평온
};

const REVEAL_ALPHA = [1.0, 0.78, 0.52, 0.28];

// ── 텍스트 생성 헬퍼 ─────────────────────────────────────
function capsuleText(event, reveal) {
  if (!event || reveal >= 3) return '???';
  const { type, cardName, cardType, count } = event;

  if (type === 'skip')  return '평온';
  if (type === 'surge') {
    const nm = reveal >= 2 ? (cardType ?? '?') : (cardName ?? '?');
    return `${nm} 급등`;
  }
  if (type === 'drain') {
    // drain은 타입만 공개 가능 (특정 카드 예측 불가)
    const ct = cardType ?? '?';
    return reveal >= 3 ? '?' : `${ct} 고갈`;
  }
  // vanish
  const nm  = reveal >= 2 ? (cardType ?? '?') : (cardName ?? '?');
  const cnt = reveal >= 1 ? '?' : String(count ?? '?');
  return `${nm} ×${cnt}`;
}

function capsuleColor(event, reveal) {
  if (!event || reveal >= 3) return 0x333333;
  return ETYPE_COLOR[event.type] ?? 0x444444;
}

// ── 캡슐 1개 팩토리 ──────────────────────────────────────
/**
 * @param {number} idx  0~3 (화살표 구분자 표시 여부에 사용)
 * @returns {{ ct: PIXI.Container, update: function }}
 */
function makeCap(idx) {
  const ct  = new PIXI.Container();
  const bg  = new PIXI.Graphics();
  const dot = new PIXI.Graphics();

  const lbl = new PIXI.Text('', {
    fontFamily: 'Georgia, serif',
    fontSize: 7,
    fill: 0xffffff,
  });
  lbl.anchor.set(0, 0.5);
  lbl.x = 12; lbl.y = CAP_H / 2;

  ct.addChild(bg, dot, lbl);

  // 구분 화살표 (첫 캡슐 제외)
  if (idx > 0) {
    const arr = new PIXI.Text('▶', {
      fontFamily: 'serif', fontSize: 6, fill: 0x554433,
    });
    arr.anchor.set(0.5, 0.5);
    arr.x = -CAP_GAP / 2; arr.y = CAP_H / 2;
    ct.addChild(arr);
  }

  const update = (event, reveal) => {
    const color = capsuleColor(event, reveal);

    bg.clear();
    bg.beginFill(C.dark, 0.93);
    bg.lineStyle(0.8, color, 0.65);
    bg.drawRoundedRect(0, 0, CAP_W, CAP_H, 4);
    bg.endFill();

    dot.clear();
    dot.beginFill(color, 0.9);
    dot.drawCircle(6, CAP_H / 2, 2.5);
    dot.endFill();

    lbl.text       = capsuleText(event, reveal);
    lbl.style.fill = color;
    ct.alpha       = REVEAL_ALPHA[reveal] ?? 0.28;
  };

  return { ct, update };
}

// ============================================================
export class MarketTimeline {
  /**
   * @param {PIXI.Container} layer
   * @param {object[]} queue  - 초기 큐 (4개)
   */
  constructor(layer, queue) {
    this.layer     = layer;
    this._caps     = [];

    // 메인 컨테이너
    this.container = new PIXI.Container();
    layer.addChild(this.container);

    // 클리핑 마스크: 캡슐 스크롤 시 영역 외부 숨김
    this._maskG = new PIXI.Graphics();
    this._maskG.beginFill(0xffffff);
    this._maskG.drawRect(START_X - 1, TL_Y - 1, CAPS_W + 2, CAP_H + 2);
    this._maskG.endFill();
    layer.addChild(this._maskG);
    this.container.mask = this._maskG;

    this._build(queue);
  }

  // ── 초기 빌드 ────────────────────────────────────────────
  _build(queue) {
    for (let i = 0; i < 4; i++) {
      const cap = makeCap(i);
      cap.ct.x = START_X + i * (CAP_W + CAP_GAP);
      cap.ct.y = TL_Y;
      this.container.addChild(cap.ct);
      cap.update(queue[i] ?? null, i);
      this._caps.push(cap);
    }
  }

  // ── 즉시 갱신 (애니메이션 없음) ─────────────────────────
  /** @param {object[]} queue */
  refresh(queue) {
    for (let i = 0; i < 4; i++) {
      this._caps[i]?.update(queue[i] ?? null, i);
    }
  }

  // ── 턴 종료 스크롤 연출 ──────────────────────────────────
  /**
   * @param {object[]} newQueue  - popMarketEvent + pushNextMarketEvent 후의 큐 [T+1…T+4]
   * @param {function} onDone
   */
  scroll(newQueue, onDone) {
    const SLIDE = CAP_W + CAP_GAP;   // 한 스텝 이동 거리
    const DUR   = 440;               // ms
    const t0    = Date.now();

    // 오른쪽에서 들어올 새 T+4 캡슐
    const incoming = makeCap(3);
    incoming.ct.x = START_X + 4 * SLIDE;
    incoming.ct.y = TL_Y;
    incoming.update(newQueue[3] ?? null, 3);
    this.container.addChild(incoming.ct);

    const easeOut = t => 1 - Math.pow(1 - t, 3);

    const tick = () => {
      const t  = Math.min((Date.now() - t0) / DUR, 1);
      const dx = easeOut(t) * SLIDE;

      for (let i = 0; i < 4; i++) {
        this._caps[i].ct.x = START_X + i * SLIDE - dx;
      }
      incoming.ct.x = START_X + 4 * SLIDE - dx;

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // ── 완료: T+1 캡슐 제거, 위치 재정렬, 내용 갱신 ──
        this.container.removeChild(this._caps[0].ct);
        this._caps[0].ct.destroy({ children: true });
        this._caps.shift();
        this._caps.push(incoming);

        for (let i = 0; i < 4; i++) {
          this._caps[i].ct.x = START_X + i * SLIDE;
          this._caps[i].update(newQueue[i] ?? null, i);
        }
        onDone?.();
      }
    };
    requestAnimationFrame(tick);
  }

  // ── 정리 ─────────────────────────────────────────────────
  destroy() {
    if (this._maskG?.parent) this._maskG.parent.removeChild(this._maskG);
    this._maskG?.destroy();
    this.layer.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
