/* ============================================================
   spotify.js — Real Spotify (PKCE, no backend) + Demo simulation
   Global: window.Spot
   Facade emits a uniform "track" shape for both sources:
   { key, title, artists, album, art (url), durationMs,
     progressMs, isPlaying, at, source:'real'|'demo' }
   ============================================================ */
(function () {
  'use strict';

  const AUTH_URL = 'https://accounts.spotify.com/authorize';
  const TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const API = 'https://api.spotify.com/v1';
  const SCOPES = 'user-read-playback-state user-read-currently-playing';

  /* ================= Real Spotify: PKCE auth ================= */
  function randVerifier() {
    const a = new Uint8Array(64);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => ('0' + b.toString(16)).slice(-2)).join('').slice(0, 128);
  }
  function b64url(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function challenge(v) {
    const data = new TextEncoder().encode(v);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return b64url(digest);
  }

  const Auth = {
    async begin(clientId, redirectUri) {
      const verifier = randVerifier();
      Core.Store.data.spotify.verifier = verifier;
      Core.Store.save();
      const ch = await challenge(verifier);
      const u = AUTH_URL +
        '?response_type=code' +
        '&client_id=' + encodeURIComponent(clientId.trim()) +
        '&scope=' + encodeURIComponent(SCOPES) +
        '&redirect_uri=' + encodeURIComponent(redirectUri.trim()) +
        '&code_challenge_method=S256' +
        '&code_challenge=' + encodeURIComponent(ch) +
        '&state=flip' + Date.now().toString(36);
      window.location.href = u;
    },

    params() {
      try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
    },

    cleanUrl() {
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete('code'); u.searchParams.delete('state'); u.searchParams.delete('error');
        window.history.replaceState({}, document.title, u.toString());
      } catch (e) {}
    },

    async exchange(code, redirectUri) {
      const sp = Core.Store.data.spotify;
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code, redirect_uri: redirectUri.trim(),
        client_id: sp.clientId.trim(),
        code_verifier: sp.verifier || ''
      });
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error('Token exchange failed (' + res.status + ') ' + t.slice(0, 120));
      }
      const j = await res.json();
      sp.accessToken = j.access_token;
      sp.refreshToken = j.refresh_token || sp.refreshToken;
      sp.expiresAt = Date.now() + (j.expires_in - 60) * 1000;
      sp.verifier = null;
      Core.Store.save();
    },

    async refresh() {
      const sp = Core.Store.data.spotify;
      if (!sp.refreshToken) throw new Error('No refresh token');
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: sp.refreshToken,
        client_id: sp.clientId.trim()
      });
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (!res.ok) throw new Error('Refresh failed (' + res.status + ')');
      const j = await res.json();
      sp.accessToken = j.access_token;
      if (j.refresh_token) sp.refreshToken = j.refresh_token;
      sp.expiresAt = Date.now() + (j.expires_in - 60) * 1000;
      Core.Store.save();
    },

    async token() {
      const sp = Core.Store.data.spotify;
      if (!sp.accessToken) return null;
      if (Date.now() > sp.expiresAt - 30000) { try { await this.refresh(); } catch (e) { return null; } }
      return Core.Store.data.spotify.accessToken;
    },

    async me() {
      const t = await this.token();
      if (!t) return null;
      const res = await fetch(API + '/me', { headers: { Authorization: 'Bearer ' + t } });
      if (!res.ok) return null;
      return res.json();
    }
  };

  /* ================= Real Spotify: player polling ================= */
  const Poller = {
    timer: null,
    onData: null, onError: null,

    start(ms) {
      this.stop();
      const run = () => this.poll();
      run();
      this.timer = setInterval(run, ms || 5000);
    },
    stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },

    async poll() {
      const t = await Auth.token();
      if (!t) { this.onError && this.onError('auth'); return; }
      let res;
      try {
        res = await fetch(API + '/me/player', { headers: { Authorization: 'Bearer ' + t } });
      } catch (e) { this.onError && this.onError('network'); return; }
      if (res.status === 204 || res.status === 404) { this.onData && this.onData(null); return; }
      if (res.status === 401) {
        try { await Auth.refresh(); } catch (e) { this.onError && this.onError('auth'); return; }
        return this.poll();
      }
      if (!res.ok) { this.onError && this.onError('api'); return; }
      let j; try { j = await res.json(); } catch (e) { return; }
      if (!j || !j.item) { this.onData && this.onData(null); return; }
      const imgs = (j.item.album && j.item.album.images) || [];
      const pick = (i) => (imgs[i] && imgs[i].url) || (imgs[0] && imgs[0].url) || '';
      this.onData && this.onData({
        key: 'sp:' + j.item.id,
        title: j.item.name || 'Unknown title',
        artists: (j.item.artists || []).map(a => a.name).join(', ') || 'Unknown artist',
        album: (j.item.album && j.item.album.name) || '',
        art: pick(1), artThumb: pick(2),
        durationMs: j.item.duration_ms || 0,
        progressMs: j.progress_ms || 0,
        isPlaying: !!j.is_playing,
        at: Date.now(), source: 'real'
      });
    }
  };

  /* ================= Colour helpers ================= */
  function hx(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hexColor, amt) { // amt -100..100
    const c = hx(hexColor).map(v => Math.round(Core.clamp(v + amt * 2.55, 0, 255)));
    return '#' + c.map(v => ('0' + v.toString(16)).slice(-2)).join('');
  }

  /** Extract 3 dark, sophisticated ambient colours from an image element. */
  function paletteFromImage(img) {
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 48, 48);
    const d = x.getImageData(0, 0, 48, 48).data;
    let r = 0, g = 0, b = 0, n = 0;
    const buckets = {}; // hue bucket -> {r,g,b,n,sat}
    for (let i = 0; i < d.length; i += 16) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      r += R; g += G; b += B; n++;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx < 12) continue;
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      let hue = 0;
      if (mx === R) hue = ((G - B) / (mx - mn || 1));
      else if (mx === G) hue = 2 + (B - R) / (mx - mn || 1);
      else hue = 4 + (R - G) / (mx - mn || 1);
      hue = Math.floor(((hue < 0 ? hue + 6 : hue) / 6) * 12);
      const k = hue + ':' + (sat > 0.35 ? 'v' : 'm');
      const bk = buckets[k] || (buckets[k] = { r: 0, g: 0, b: 0, n: 0, s: 0 });
      bk.r += R; bk.g += G; bk.b += B; bk.n++; bk.s += sat;
    }
    let best = null, bestScore = -1;
    Object.keys(buckets).forEach(k => {
      const bk = buckets[k];
      const score = (bk.s / bk.n) * Math.log(1 + bk.n) + (k.indexOf(':v') > -1 ? 0.4 : 0);
      if (score > bestScore) { bestScore = score; best = bk; }
    });
    const avg = [r / n, g / n, b / n];
    const dom = best ? [best.r / best.n, best.g / best.n, best.b / best.n] : avg;
    const dark = (col, f) => col.map(v => Math.round(Core.clamp(v * f, 8, 150)));
    const css = (col) => 'rgb(' + col.map(Math.round).join(',') + ')';
    // Sophisticated: deep dominant + deep average + deep accent mix
    return [css(dark(dom, 0.5)), css(dark(avg, 0.55)), css(dark([(dom[0] + avg[0]) / 2, (dom[1] + avg[1] * 0.6) / 1.6 + 18, (dom[2] + avg[2]) / 2], 0.5))];
  }

  const FALLBACKS = [
    ['#1d3a6e', '#0b1c40', '#0e5f8a'], ['#6e1d2c', '#3a0b14', '#8a3a0e'],
    ['#4a2490', '#1c0b3d', '#6e2c8a'], ['#0f6b4a', '#07281d', '#1d5a6e']
  ];
  function fallbackPalette(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return FALLBACKS[h % FALLBACKS.length].slice();
  }

  /** Resolve artwork URL + palette for a real track (display never depends on canvas). */
  function visualForReal(track) {
    return new Promise((resolve) => {
      const done = (palette) => resolve({ src: track.art, palette });
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try { done(paletteFromImage(img)); }
          catch (e) { done(fallbackPalette(track.key)); }
        };
        img.onerror = () => done(fallbackPalette(track.key));
        img.src = track.art;
        setTimeout(() => done(fallbackPalette(track.key)), 6000); // never hang
      } catch (e) { done(fallbackPalette(track.key)); }
    });
  }

  /* ================= Demo mode: simulated tracks + generated art ================= */
  const DemoTracks = [
    { id: 'demo-1', title: 'Midnight Drive', artist: 'Neon Coast', colors: ['#2f6bff', '#0b1e4b', '#57c8ff'], durationSec: 173 },
    { id: 'demo-2', title: 'Ember & Wine', artist: 'The Lowlight', colors: ['#ff4d5e', '#3d0b14', '#ff9a4d'], durationSec: 214 },
    { id: 'demo-3', title: 'Ultraviolet', artist: 'Glass Petals', colors: ['#8a4dff', '#1c0b3d', '#e07bff'], durationSec: 187 },
    { id: 'demo-4', title: 'Deep Forest', artist: 'Moss & Tide', colors: ['#2bff9d', '#07281d', '#4dc9ff'], durationSec: 201 }
  ];

  const artCache = {};
  function blob(x, px, py, pr, color, alpha) {
    const g = x.createRadialGradient(px, py, 0, px, py, pr);
    const c = hx(color);
    g.addColorStop(0, 'rgba(' + c.join(',') + ',' + alpha + ')');
    g.addColorStop(1, 'rgba(' + c.join(',') + ',0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
  }

  function makeDemoArt(t, idx) {
    if (artCache[t.id]) return artCache[t.id];
    const S = 512, c = document.createElement('canvas');
    c.width = S; c.height = S;
    const x = c.getContext('2d');
    const c1 = t.colors[0], c2 = t.colors[1], c3 = t.colors[2];
    const g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, shade(c2, -14)); g.addColorStop(0.55, shade(c2, -30)); g.addColorStop(1, shade(c1, -62));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'screen';
    blob(x, S * 0.3, S * 0.3, S * 0.55, c1, 0.5);
    blob(x, S * 0.76, S * 0.6, S * 0.6, c3, 0.4);
    blob(x, S * 0.55, S * 0.88, S * 0.5, c1, 0.35);
    x.globalCompositeOperation = 'source-over';
    // Motif per track — restrained, premium geometry
    x.strokeStyle = 'rgba(255,255,255,0.5)'; x.fillStyle = 'rgba(255,255,255,0.75)';
    if (idx % 4 === 0) {          // rings
      for (let i = 0; i < 4; i++) {
        x.lineWidth = i === 0 ? 7 : 2;
        x.globalAlpha = 0.75 - i * 0.16;
        x.beginPath(); x.arc(S * 0.5, S * 0.46, 52 + i * 44, 0, Math.PI * 2); x.stroke();
      }
      x.globalAlpha = 1;
      x.beginPath(); x.arc(S * 0.5, S * 0.46, 10, 0, Math.PI * 2); x.fill();
    } else if (idx % 4 === 1) {   // beam
      x.save(); x.translate(S / 2, S / 2); x.rotate(-0.5);
      const bg = x.createLinearGradient(-S, 0, S, 0);
      bg.addColorStop(0.42, 'rgba(255,255,255,0)'); bg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      bg.addColorStop(0.58, 'rgba(255,255,255,0)');
      x.fillStyle = bg; x.fillRect(-S, -S, S * 2, S * 2); x.restore();
      x.globalAlpha = 0.85; x.beginPath(); x.arc(S * 0.62, S * 0.4, 26, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
    } else if (idx % 4 === 2) {   // horizon
      x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, S * 0.62, S, S * 0.38);
      const sg = x.createRadialGradient(S * 0.5, S * 0.62, 4, S * 0.5, S * 0.62, 130);
      sg.addColorStop(0, 'rgba(255,255,255,0.95)'); sg.addColorStop(0.35, 'rgba(255,255,255,0.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = sg; x.beginPath(); x.arc(S * 0.5, S * 0.62, 130, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(0, S * 0.62 - 1, S, 2);
    } else {                      // dot grid
      for (let rY = 0; rY < 7; rY++) for (let rX = 0; rX < 7; rX++) {
        const dx = (rX - 3), dy = (rY - 3), dist = Math.sqrt(dx * dx + dy * dy);
        x.globalAlpha = Math.max(0.08, 0.8 - dist * 0.17);
        x.beginPath(); x.arc(S * 0.5 + dx * 52, S * 0.46 + dy * 52, 7 - dist * 0.7, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
    }
    // Grain
    x.fillStyle = 'rgba(255,255,255,1)';
    for (let i = 0; i < 2600; i++) {
      x.globalAlpha = Math.random() * 0.05;
      x.fillRect(Math.random() * S, Math.random() * S, 1.2, 1.2);
    }
    x.globalAlpha = 1;
    // Vignette
    const v = x.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    x.fillStyle = v; x.fillRect(0, 0, S, S);
    const url = c.toDataURL('image/jpeg', 0.82);
    artCache[t.id] = url;
    return url;
  }

  const Demo = {
    idx: 0, startedAt: Date.now(),
    current() { return DemoTracks[this.idx % DemoTracks.length]; },
    track() {
      const t = this.current();
      const dur = t.durationSec * 1000;
      const el = (Date.now() - this.startedAt) % dur;
      return {
        key: t.id, title: t.title, artists: t.artist, album: 'Demo Sessions',
        art: makeDemoArt(t, this.idx), artThumb: makeDemoArt(t, this.idx),
        durationMs: dur, progressMs: el, isPlaying: true, at: Date.now(), source: 'demo'
      };
    },
    palette() {
      const t = this.current();
      return [shade(t.colors[0], -38), shade(t.colors[1], -6), shade(t.colors[2], -42)];
    },
    tick() { // advance when a track ends
      const t = this.current();
      if (Date.now() - this.startedAt >= t.durationSec * 1000) {
        this.idx = (this.idx + 1) % DemoTracks.length;
        this.startedAt = Date.now();
        return true;
      }
      return false;
    },
    next() { this.idx = (this.idx + 1) % DemoTracks.length; this.startedAt = Date.now(); },
    restart() { this.startedAt = Date.now(); }
  };

  /* ================= Facade: uniform mode + track state ================= */
  const Facade = {
    mode: 'off',            // 'off' | 'demo' | 'real'
    status: 'idle',         // idle | live | none | auth | error | loading
    track: null,
    demoIdx: 0,
    subs: [],
    onChange(fn) { this.subs.push(fn); },
    emit() { const s = this.snap(); this.subs.forEach(fn => { try { fn(s); } catch (e) {} }); },
    snap() { return { mode: this.mode, status: this.status, track: this.track, account: Core.Store.data.spotify.account }; },

    init() {
      this.mode = Core.Store.data.spotify.mode || 'off';
      Poller.onData = (t) => {
        if (!t) {
          if (this.status !== 'none' || this.track) { this.track = null; this.status = 'none'; this.emit(); }
          return;
        }
        const changed = !this.track || this.track.key !== t.key;
        this.track = t; this.status = 'live';
        if (changed) this.emit(); // progress-only updates don't re-emit
      };
      Poller.onError = (kind) => {
        if (kind === 'auth') {
          Core.Store.data.spotify.accessToken = null;
          Core.Store.save();
          this.status = 'auth'; this.track = null; this.emit();
        } else if (this.status !== 'error') { this.status = 'error'; this.emit(); }
      };
      this.apply();
    },

    apply() {
      Poller.stop();
      if (this.mode === 'real' && Core.Store.data.spotify.accessToken) {
        this.status = 'loading'; this.emit();
        Poller.start(5000);
      } else if (this.mode === 'demo') {
        Demo.restart();
        const t = Demo.track();
        this.track = t; this.status = 'live'; this.demoIdx = Demo.idx;
        this.emit();
      } else {
        this.track = null; this.status = 'idle'; this.emit();
      }
    },

    setMode(m) {
      this.mode = m;
      Core.Store.data.spotify.mode = m;
      Core.Store.save();
      this.apply();
    },

    /** Called from the master tick: demo auto-advance (never touches countdown). */
    tick() {
      if (this.mode !== 'demo') return;
      if (Demo.tick()) {
        this.demoIdx = Demo.idx;
        this.track = Demo.track();
        this.emit();
      }
    },

    /** Fresh progress snapshot for the progress bar (extrapolated, cheap). */
    progress() {
      const t = this.track;
      if (!t || !this.status || this.status === 'none' || this.status === 'idle') return null;
      if (t.source === 'demo') {
        const d = Demo.current();
        const el = (Date.now() - Demo.startedAt) % (d.durationSec * 1000);
        return { ms: el, dur: d.durationSec * 1000, playing: true };
      }
      const extra = t.isPlaying ? (Date.now() - t.at) : 0;
      return { ms: Math.min(t.durationMs, t.progressMs + extra), dur: t.durationMs, playing: t.isPlaying };
    },

    /** Resolve {src, palette} for background theming. */
    visual(track) {
      if (!track) return Promise.resolve(null);
      if (track.source === 'demo') {
        // Find the demo index for this track key
        const i = DemoTracks.findIndex(d => d.id === track.key);
        const saved = Demo.idx;
        if (i > -1) Demo.idx = i;
        const pal = Demo.palette();
        Demo.idx = saved;
        return Promise.resolve({ src: track.art, palette: pal });
      }
      return visualForReal(track);
    }
  };

  window.Spot = { Auth, Poller, Demo, Facade, shade, fallbackPalette };
})();
