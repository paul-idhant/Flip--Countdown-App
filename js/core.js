/* ============================================================
   core.js — utilities, Store (local persistence), Time engine
   Global: window.Core
   ============================================================ */
(function () {
  'use strict';

  /* ---------- tiny DOM / string helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const uid = () => 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- time constants & math ---------- */
  const DAY = 86400000, HOUR = 3600000, MIN = 60000;

  /**
   * Decompose a millisecond duration into days/hours/minutes/seconds.
   * The ONLY source of truth: callers pass (targetTs - now) every tick,
   * so the countdown self-corrects after sleep / inactive tabs. Never
   * decrement counters independently.
   */
  function decompose(ms) {
    if (!isFinite(ms)) ms = 0;
    if (ms <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    const minutes = Math.floor((ms % HOUR) / MIN);
    const seconds = Math.floor((ms % MIN) / 1000);
    return { total: ms, days, hours, minutes, seconds, done: false };
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_W = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function fmtTarget(ts) {
    const d = new Date(ts);
    return DAYS_W[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' +
      d.getFullYear() + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtClock(now) {
    const d = new Date(now || Date.now());
    let tz = '';
    try {
      tz = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(d)
        .find(p => p.type === 'timeZoneName').value;
    } catch (e) { tz = ''; }
    return DAYS_W[d.getDay()] + ' ' + pad2(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' +
      d.getFullYear() + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' +
      pad2(d.getSeconds()) + (tz ? ' ' + tz : '');
  }

  function fmtSummary(ms) {
    if (ms <= 0) return "It's time";
    const r = decompose(ms);
    const parts = [];
    if (r.days > 0) parts.push(r.days + 'd');
    if (r.hours > 0 || r.days > 0) parts.push(r.hours + 'h');
    if (r.days === 0) parts.push(r.minutes + 'm');
    if (r.days === 0 && r.hours === 0 && r.minutes === 0) parts.push(r.seconds + 's');
    return 'in ' + parts.slice(0, 3).join(' ');
  }

  function tzName() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'; }
    catch (e) { return 'local time'; }
  }

  /* ---------- Store: localStorage persistence ---------- */
  const KEY = 'flip-cinematic-countdown-v1';

  function defaultData() {
    return {
      countdowns: [],       // {id,title,description,targetTs,createdAt,pausedMs,completedAt}
      activeId: null,
      primaryId: null,
      settings: { bgIntensity: 70, animations: true, dust: true },
      spotify: {
        mode: 'off',        // 'off' | 'demo' | 'real'
        clientId: '',
        redirectUri: '',
        accessToken: null, refreshToken: null, expiresAt: 0,
        verifier: null, account: null
      }
    };
  }

  const Store = {
    data: defaultData(),

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const d = defaultData();
          this.data = {
            countdowns: Array.isArray(parsed.countdowns) ? parsed.countdowns : [],
            activeId: parsed.activeId || null,
            primaryId: parsed.primaryId || null,
            settings: Object.assign(d.settings, parsed.settings || {}),
            spotify: Object.assign(d.spotify, parsed.spotify || {})
          };
        }
      } catch (e) { this.data = defaultData(); }
      // Respect OS reduced-motion on first run
      try {
        if (!localStorage.getItem(KEY) && window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.data.settings.animations = false;
          this.data.settings.dust = false;
        }
      } catch (e) {}
      return this.data;
    },

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); }
      catch (e) {}
    },

    get(id) { return this.data.countdowns.find(c => c.id === id) || null; },

    active() {
      return this.get(this.data.activeId) ||
        this.get(this.data.primaryId) ||
        this.data.countdowns[0] || null;
    },

    add(cd) {
      this.data.countdowns.push(cd);
      if (!this.data.primaryId) this.data.primaryId = cd.id;
      this.data.activeId = cd.id;
      this.save();
      return cd;
    },

    update(id, patch) {
      const c = this.get(id);
      if (c) Object.assign(c, patch);
      this.save();
      return c;
    },

    remove(id) {
      this.data.countdowns = this.data.countdowns.filter(c => c.id !== id);
      if (this.data.activeId === id) this.data.activeId = this.data.primaryId;
      if (this.data.primaryId === id) {
        this.data.primaryId = this.data.countdowns.length ? this.data.countdowns[0].id : null;
      }
      if (this.data.activeId && !this.get(this.data.activeId)) this.data.activeId = this.data.primaryId;
      this.save();
    },

    clear() { this.data = defaultData(); this.save(); }
  };

  /* ---------- Ticker: single master interval ---------- */
  const Ticker = {
    subs: [],
    timer: null,
    on(fn) { this.subs.push(fn); },
    start(ms) {
      if (this.timer) return;
      const loop = () => {
        const now = Date.now();
        for (const fn of this.subs) { try { fn(now); } catch (e) {} }
      };
      loop();
      this.timer = setInterval(loop, ms || 250);
    }
  };

  window.Core = { $, $$, uid, clamp, pad2, esc, DAY, HOUR, MIN, decompose, fmtTarget, fmtClock, fmtSummary, tzName, Store, Ticker };
})();
