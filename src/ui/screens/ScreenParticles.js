// ============================================================
// ScreenParticles.js — 오버레이 배경 파티클 (순수 Canvas 2D)
// 금빛 부유 입자 + Art-Nouveau 꽃잎 파티클
// ============================================================

// 금빛 (mote)와 보라/금 (petal) 두 가지 타입
const MOTE_COLS  = [[212,165,32],[255,224,102],[200,150,20]];
const PETAL_COLS = [[153,51,204],[180,100,255],[212,165,32],[170,90,220]];

class Particle {
  constructor(w, h, initY) {
    this.w = w;
    this.h = h;
    this.reset(initY);
  }

  reset(initY = false) {
    this.type  = Math.random() < 0.55 ? 'mote' : 'petal';
    this.x     = Math.random() * this.w;
    this.y     = initY ? Math.random() * this.h : this.h + 20;
    this.vy    = -(10 + Math.random() * 38);
    this.vx    = (Math.random() - 0.5) * 7;
    this.rot   = Math.random() * Math.PI * 2;
    this.rotV  = (Math.random() - 0.5) * 0.06;
    this.size  = this.type === 'mote' ? 1 + Math.random() * 2.2 : 4 + Math.random() * 8;
    this.life  = 0.35 + Math.random() * 0.65;
    this.decay = 0.0012 + Math.random() * 0.0028;
    this.wob   = Math.random() * Math.PI * 2;
    this.wobV  = 0.018 + Math.random() * 0.025;

    const pool = this.type === 'mote' ? MOTE_COLS : PETAL_COLS;
    const c    = pool[Math.floor(Math.random() * pool.length)];
    this.r = c[0]; this.g = c[1]; this.b = c[2];
  }

  update(dt) {
    this.life -= this.decay;
    this.wob  += this.wobV;
    this.x    += this.vx * dt * 60 + Math.sin(this.wob) * 0.9;
    this.y    += this.vy * dt;
    this.rot  += this.rotV;
    if (this.life <= 0 || this.y < -20) this.reset();
  }

  draw(ctx) {
    const a = this.life * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y);

    if (this.type === 'mote') {
      // 작은 원형 금빛 입자
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${this.r},${this.g},${this.b})`;
      ctx.fill();
    } else {
      // Art-Nouveau 꽃잎 (두 베지어 곡선)
      ctx.rotate(this.rot);
      const s = this.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo( s*0.55, -s*0.4,  s*0.55,  s*0.4, 0,  s);
      ctx.bezierCurveTo(-s*0.55,  s*0.4, -s*0.55, -s*0.4, 0, -s);
      ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},0.85)`;
      ctx.fill();

      // 꽃잎 중앙 심줄 (금빛 라인)
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(0,  s * 0.85);
      ctx.strokeStyle = `rgba(212,165,32,0.3)`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * 파티클 캔버스를 screenEl에 주입하고 애니메이션 시작
 * @param {HTMLElement} screenEl - .ds-screen 엘리먼트
 * @returns {() => void} cleanup 함수 (hide 시 호출)
 */
export function startParticles(screenEl) {
  const canvas = document.createElement('canvas');
  canvas.className = 'ds-particles-canvas';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // ds-card 앞(배경)에 삽입
  screenEl.insertBefore(canvas, screenEl.firstChild);

  const ctx      = canvas.getContext('2d');
  const COUNT    = 28;
  const particles = Array.from({ length: COUNT }, () => new Particle(canvas.width, canvas.height, true));

  let rafId   = null;
  let lastTs  = 0;

  function frame(ts) {
    if (lastTs === 0) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(dt); p.draw(ctx); });

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    canvas.remove();
  };
}
