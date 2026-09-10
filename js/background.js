/* ============================================================
   background.js — ThemeEngine · SpotifyBackground · Dust
   Global: window.BG
   Cinematic fullscreen atmosphere. Cheap by design:
   artwork is pre-blurred on a tiny canvas, motion is
   transform-only, dust is a single lightweight canvas.
   ============================================================ */
(function () {
  'use strict';

  const NEUTRAL = ['#1d2c4d', '#0c1424', '#262031'];

  /* ---------- ThemeEngine: ambient colour crossfade ---------- */
  const ThemeEngine = {
    els: [], active: 0, current: NEUTRAL.slice(),
    init() {
      this.els = [Core.$('#fA'), Core.$('#fB')];
      this.setVars(this.els[0], NEUTRAL);
      this.setVars(this.els[1], NEUTRAL);
      this.els[0].classList.add('show');
    },
    setVars(el, p) {
      el.style.setProperty('--a1', p[0]);
      el.style.setProperty('--a2', p[1]);
      el.style.setProperty('--a3', p[2]);
    },
    /** Smoothly transition the room's ambient lighting. */
    setPalette(p) {
      if (!p || !p.length) p = NEUTRAL;
      this.current = p.slice(0, 3);
      const idle = this.els[1 - this.active];
      const act = this.els[this.active];
      this.setVars(idle, this.current);
      void idle.offsetWidth;
      idle.classList.add('show');
      act.classList.remove('show');
      this.active = 1 - this.active;
    }
  };

  /* ---------- SpotifyBackground: blurred artwork environment ---------- */
  const SpotifyBackground = {
    els: [], active: 0, token: 0,
    init() { this.els = [Core.$('#artA'), Core.$('#artB')]; },

    /** Pre-blur + darken on a tiny canvas, then crossfade layers. */
    setArt(src) {
      const my = ++this.token;
      if (!src) {
        this.els.forEach(el => el.classList.remove('show'));
        return;
      }
      const img = new Image();
      if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (my !== this.token) return;
        let url = src;
        try {
          const S = 128;
          const c = document.createElement('canvas');
          c.width = S; c.height = Math.max(1, Math.round(S * img.height / img.width));
          const x = c.getContext('2d');
          x.filter = 'saturate(1.25) brightness(0.9)';
          x.drawImage(img, 0, 0, c.width, c.height);
          url = c.toDataURL('image/jpeg', 0.8);
        } catch (e) { /* tainted canvas — fall back to raw URL, CSS still blurs */ }
        if (my !== this.token) return;
        const idle = this.els[1 - this.active];
        const act = this.els[this.active];
        idle.style.backgroundImage = 'url("' + url + '")';
        void idle.offsetWidth;
        idle.classList.add('show');
        act.classList.remove('show');
        this.active = 1 - this.active;
      };
      img.onerror = () => { if (my === this.token) this.els.forEach(el => el.classList.remove('show')); };
      img.src = src;
    },

    /** 0–100 intensity → art + ambient opacity. Countdown stays readable. */
    setIntensity(v) {
      v = Core.clamp(Number(v) || 0, 0, 100);
      const root = document.documentElement;
      root.style.setProperty('--art-opacity', (0.1 + (v / 100) * 0.62).toFixed(3));
      root.style.setProperty('--amb-opacity', (0.22 + (v / 100) * 0.5).toFixed(3));
    }
  };

  /* ---------- Dust: extremely subtle floating particles ---------- */
  const Dust = {
    cv: null, ctx: null, parts: [], running: false, raf: 0, enabled: true,
    init() {
      this.cv = Core.$('#dust');
      if (!this.cv) return;
      this.ctx = this.cv.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.halt();
        else if (this.enabled) this.start();
      });
    },
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.cv.width = this.w * dpr; this.cv.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Core.clamp((this.w * this.h) / 52000, 18, 60));
      this.parts = [];
      for (let i = 0; i < count; i++) {
        this.parts.push({
          x: Math.random() * this.w, y: Math.random() * this.h,
          r: 0.6 + Math.random() * 1.5,
          vy: -(0.04 + Math.random() * 0.12),
          vx: (Math.random() - 0.5) * 0.08,
          a: 0.04 + Math.random() * 0.1,
          ph: Math.random() * Math.PI * 2
        });
      }
    },
    start() {
      if (this.running || !this.ctx || !this.enabled) return;
      this.running = true;
      const step = () => {
        if (!this.running) return;
        const x = this.ctx;
        x.clearRect(0, 0, this.w, this.h);
        const t = Date.now() / 1000;
        x.fillStyle = '#fff';
        for (const p of this.parts) {
          p.x += p.vx; p.y += p.vy;
          if (p.y < -4) { p.y = this.h + 4; p.x = Math.random() * this.w; }
          if (p.x < -4) p.x = this.w + 4; else if (p.x > this.w + 4) p.x = -4;
          x.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(t * 0.6 + p.ph));
          x.beginPath(); x.arc(p.x, p.y, p.r, 0, Math.PI * 2); x.fill();
        }
        x.globalAlpha = 1;
        this.raf = requestAnimationFrame(step);
      };
      step();
    },
    halt() { this.running = false; cancelAnimationFrame(this.raf); if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h); },
    setEnabled(on) {
      this.enabled = !!on;
      if (on) this.start(); else this.halt();
    }
  };

  function init(intensity, dustOn) {
    ThemeEngine.init();
    SpotifyBackground.init();
    Dust.init();
    SpotifyBackground.setIntensity(intensity == null ? 70 : intensity);
    Dust.setEnabled(dustOn !== false);
  }

  window.BG = { ThemeEngine, SpotifyBackground, Dust, NEUTRAL, init };
})();
