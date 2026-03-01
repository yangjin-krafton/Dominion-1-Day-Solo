// ============================================================
// Card.js — Card 클래스 (Art-Nouveau 비주얼 · 모션 시스템)
// ============================================================
import { C, ACCENT, CARD_W as CW, CARD_H as CH, AREAS } from '../config.js';
import { buildFrontFace, buildBackFace } from './CardArt.js';
import * as CardDetail from './CardDetail.js';

export class Card {
  /**
   * @param {object} def     - config.js DEF 항목
   * @param {number} id      - 고유 ID
   * @param {Function} onPlay - 클릭 시 콜백 (main.js에서 주입)
   */
  constructor(def, id, onPlay) {
    this.def    = def;
    this.id     = id;
    this.onPlay = onPlay;
    this.area   = AREAS.DECK;
    this.isFaceUp = false;

    // ── 모션 상태 ────────────────────────────────────────────
    this.targetX          = 0;
    this.targetY          = 0;
    this.targetRotation   = 0;
    this.targetScale      = 1;
    this.hoverOffset      = 0;
    this.targetHoverOffset = 0;
    this.glowTime         = 0;
    this.hovered          = false;
    this.flipped          = false;   // flip 애니메이션 진행 중 플래그

    this.container = new PIXI.Container();
    this._build();
    this._bindEvents();
  }

  // ── 그래픽 구성 ───────────────────────────────────────────
  _build() {
    // BlurFilter 블룸 (호버 시 표시)
    this.bloom = new PIXI.Graphics();
    this.bloom.beginFill(ACCENT[this.def.type], 0.3);
    this.bloom.drawRect(-8, -8, CW + 16, CH + 16);
    this.bloom.endFill();
    this.bloom.filters = [new PIXI.filters.BlurFilter(14)];
    this.bloom.alpha   = 0;
    this.container.addChild(this.bloom);

    // 드롭 섀도
    const shadow = new PIXI.Graphics();
    shadow.beginFill(C.shadow, 0.45);
    shadow.drawRect(3, 3, CW, CH);
    shadow.endFill();
    this.container.addChild(shadow);

    // 호버 테두리 글로우 (Graphics, 매 프레임 업데이트)
    this.borderGlow = new PIXI.Graphics();
    this.container.addChild(this.borderGlow);

    // 뒷면 / 앞면
    this.backFace  = buildBackFace();
    this.frontFace = buildFrontFace(this.def);
    this.frontFace.visible = false;
    this.container.addChild(this.backFace, this.frontFace);
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────────
  _bindEvents() {
    this.container.eventMode = 'static';
    this.container.cursor    = 'pointer';

    let _timer = null, _startX = 0, _startY = 0;
    const _cancel = () => { clearTimeout(_timer); _timer = null; };

    this.container.on('pointerover', () => {
      if (this.isFaceUp) this.setHovered(true);
    });
    this.container.on('pointerout', () => { this.setHovered(false); _cancel(); });

    // 롱프레스 시작
    this.container.on('pointerdown', (e) => {
      _startX = e.global.x; _startY = e.global.y;
      _timer = setTimeout(() => {
        _timer = null;
        this.setHovered(false);
        CardDetail.show(this.def);       // 500ms 유지 → 상세 보기
      }, 500);
    });

    // 이동 시 롱프레스 취소 (8px 임계값)
    this.container.on('pointermove', (e) => {
      if (!_timer) return;
      const dx = e.global.x - _startX, dy = e.global.y - _startY;
      if (dx * dx + dy * dy > 64) _cancel();
    });

    // 짧은 클릭 → 카드 플레이
    this.container.on('pointerup', () => {
      if (_timer) {
        _cancel();
        if (this.area === AREAS.HAND && this.isFaceUp && this.onPlay) this.onPlay(this);
      }
    });
    this.container.on('pointerupoutside', _cancel);
  }

  // ── 공개 API ──────────────────────────────────────────────

  /** 목표 위치 설정 (lerp로 부드럽게 이동) */
  moveTo(x, y, rotation = 0, scale = 1) {
    this.targetX        = x;
    this.targetY        = y;
    this.targetRotation = rotation;
    this.targetScale    = scale;
  }

  /** 호버 상태 설정 */
  setHovered(val) {
    this.hovered = val;
    if (val) {
      this.targetScale       = 1.15;
      this.targetHoverOffset = -20;
    } else {
      this.targetScale       = 1.0;
      this.targetHoverOffset = 0;
    }
  }

  /**
   * 카드 뒤집기 애니메이션
   * scaleX: 1 → 0 (중간에 face 교체) → 1
   */
  flip(duration = 0.3) {
    const startTime    = Date.now();
    const initScaleX   = this.container.scale.x;
    this.flipped       = false;

    const animate = () => {
      const t = Math.min((Date.now() - startTime) / 1000 / duration, 1);

      if (t < 0.5) {
        this.container.scale.x = initScaleX * (1 - t * 2);
      } else {
        if (!this.flipped) {
          this.isFaceUp          = !this.isFaceUp;
          this.frontFace.visible = this.isFaceUp;
          this.backFace.visible  = !this.isFaceUp;
          this.flipped           = true;
        }
        this.container.scale.x = initScaleX * ((t - 0.5) * 2);
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.container.scale.x = initScaleX;
        this.flipped            = false;
      }
    };

    animate();
  }

  // ── 내부 업데이트 ─────────────────────────────────────────

  /** 골드 테두리 글로우 펄스 (호버 시만) */
  _updateGlow(dt) {
    if (!this.hovered) {
      this.borderGlow.clear();
      return;
    }
    this.glowTime += dt * 3;
    const pulse     = (Math.sin(this.glowTime) + 1) / 2;
    const glowAlpha = 0.3 + pulse * 0.55;
    const glowWidth = 1.5 + pulse * 1.5;

    this.borderGlow.clear();
    this.borderGlow.lineStyle(glowWidth, C.gold, glowAlpha);
    this.borderGlow.drawRect(0, 0, CW, CH);
  }

  /**
   * 매 프레임 호출 — 전체 lerp 업데이트
   * @param {number} dt - 초 단위 델타타임
   */
  update(dt) {
    const s = Math.min(1, dt * 8);   // 부드럽기 계수

    // 위치 lerp (호버 오프셋 포함)
    this.container.x += (this.targetX - this.container.x) * s;
    this.container.y += (this.targetY + this.targetHoverOffset - this.container.y) * s;

    // 회전 lerp
    this.container.rotation += (this.targetRotation - this.container.rotation) * s;

    // 스케일 lerp (flip 중에는 X 축 건드리지 않음)
    if (!this.flipped) {
      this.container.scale.x += (this.targetScale - this.container.scale.x) * s;
    }
    this.container.scale.y += (this.targetScale - this.container.scale.y) * s;

    // 호버 오프셋 lerp
    this.hoverOffset += (this.targetHoverOffset - this.hoverOffset) * s;

    // 블룸 alpha lerp
    const targetBloom = this.hovered ? 0.8 : 0;
    this.bloom.alpha  += (targetBloom - this.bloom.alpha) * s;

    // 글로우 테두리
    this._updateGlow(dt);
  }
}
