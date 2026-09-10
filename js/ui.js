/* ============================================================
   ui.js — CountdownCreator · CountdownList · SpotifyNowPlaying
             FullscreenMode · Settings · App boot
   Plain orchestrator on top of Core / Flip / Spot / BG.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, uid, clamp, pad2, esc, decompose, fmtTarget, fmtClock, fmtSummary, tzName, Store, Ticker } = window.Core;
  const Facade = window.Spot.Facade;

  const debounce = (fn, ms) => {
    let t = 0;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /* ================= Toasts ================= */
  const Toasts = {
    show(msg, ms) {
      const box = $('#toasts');
      if (!box) return;
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      box.appendChild(t);
      while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms || 3600);
    }
  };

  /* ================= Shared state ================= */
  let display = null;
  let editingId = null;
  let lastActiveId = null;
  let lastClock = 0, lastProg = 0;
  let bgTrackKey = null;
  let armTimer = 0;

  const isAnimated = () => !!Store.data.settings.animations;
  const noIn = (s) => fmtSummary(s).replace(/^in /, '');

  function arm(btn, label, fn) {
    if (btn.dataset.armed === '1') {
      clearTimeout(armTimer);
      delete btn.dataset.armed;
      btn.classList.remove('armed');
      fn();
      return;
    }
    btn.dataset.armed = '1';
    btn.dataset.label = btn.textContent;
    btn.textContent = label;
    btn.classList.add('armed');
    clearTimeout(armTimer);
    armTimer = setTimeout(() => {
      delete btn.dataset.armed;
      btn.classList.remove('armed');
      btn.textContent = btn.dataset.label;
    }, 3200);
  }

  /** Effective remaining ms for a countdown (pause-aware, completion-aware). */
  function remainingMs(cd, now) {
    if (!cd) return 0;
    if (cd.completedAt) return 0;
    if (cd.pausedMs != null) return cd.pausedMs;
    return cd.targetTs - (now || Date.now());
  }

  /* ================= CountdownDisplay host ================= */
  function fitTitle() {
    const el = $('#cdTitle');
    if (!el || !el.textContent) return;
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 64;
    let guard = 26;
    while (guard-- > 0 && el.scrollWidth > el.clientWidth + 4 && size > 19) {
      size *= 0.93;
      el.style.fontSize = size.toFixed(1) + 'px';
    }
  }

  function updateCompletedUI(cd) {
    const show = !!(cd && cd.completedAt && !cd.bannerHidden);
    $('#completedBanner').classList.toggle('hidden', !show);
    if (show) {
      $('#completedBanner .cb-eyebrow').textContent = cd.title;
      $('#completedSub').textContent = 'Reached ' + fmtTarget(cd.completedAt);
    }
  }

  function syncPauseUI(cd) {
    const paused = !!(cd && cd.pausedMs != null && !cd.completedAt);
    const done = !!(cd && cd.completedAt);
    $('#pausedBadge').classList.toggle('hidden', !paused);
    const btn = $('#pauseBtn');
    btn.textContent = paused ? 'Resume' : 'Pause';
    btn.style.display = done ? 'none' : '';
  }

  function renderView(now) {
    const cd = Store.active();
    $('#emptyState').classList.toggle('hidden', !!cd);
    $('#countdownView').classList.toggle('hidden', !cd);
    $('#switcherBtn .switcher-label').textContent = cd ? cd.title : 'Countdowns';
    if (!cd) { lastActiveId = null; return; }
    if (cd.id !== lastActiveId) {
      lastActiveId = cd.id;
      $('#cdTitle').textContent = cd.title;
      $('#cdDesc').textContent = cd.description || '';
      $('#cdDesc').classList.toggle('hidden', !cd.description);
      $('#targetLineText').textContent = fmtTarget(cd.pausedMs != null ? Date.now() + cd.pausedMs : cd.targetTs);
      display.setInstantAll(decompose(remainingMs(cd, now)));
      updateCompletedUI(cd);
      requestAnimationFrame(fitTitle);
    }
    syncPauseUI(cd);
  }

  function completeCountdown(cd, now) {
    cd.completedAt = now;
    cd.pausedMs = null;
    cd.bannerHidden = false;
    Store.save();
    updateCompletedUI(cd);
    syncPauseUI(cd);
    renderList();
    Toasts.show("It's time — " + cd.title);
  }

  /* ================= CountdownList (switcher) ================= */
  function summaryFor(cd, now) {
    if (cd.completedAt) return 'Complete';
    if (cd.pausedMs != null) return 'Paused · ' + noIn(cd.pausedMs) + ' left';
    const ms = cd.targetTs - now;
    return ms <= 0 ? "It's time" : fmtSummary(ms);
  }

  function renderList() {
    const list = $('#switcherList');
    const cds = Store.data.countdowns.slice().sort((a, b) => a.targetTs - b.targetTs);
    if (!cds.length) {
      list.innerHTML = '<div class="sw-empty">No countdowns yet.<br>Create your first moment.</div>';
      return;
    }
    const now = Date.now();
    list.innerHTML = '';
    cds.forEach(cd => {
      const item = document.createElement('div');
      item.className = 'sw-item' + (cd.id === Store.data.activeId ? ' active' : '');
      const main = document.createElement('button');
      main.className = 'sw-main';
      main.style.cssText = 'flex:1;min-width:0;background:none;border:none;color:inherit;text-align:left;padding:0;';
      main.innerHTML =
        '<div class="sw-title">' + esc(cd.title) + '</div>' +
        '<div class="sw-sub" data-sum="' + cd.id + '">' + esc(summaryFor(cd, now)) + '</div>';
      main.addEventListener('click', () => {
        Store.data.activeId = cd.id;
        Store.save();
        renderView(Date.now());
        renderList();
        toggleSwitcher(false);
      });
      item.appendChild(main);
      if (cd.id === Store.data.primaryId) {
        const star = document.createElement('span');
        star.className = 'sw-star';
        star.title = 'Primary countdown';
        star.textContent = '★';
        item.appendChild(star);
      }
      const acts = document.createElement('div');
      acts.className = 'sw-actions';
      const mk = (label, title, fn) => {
        const b = document.createElement('button');
        b.textContent = label; b.title = title;
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
        acts.appendChild(b);
      };
      mk(cd.id === Store.data.primaryId ? '★' : '☆', 'Set as primary', () => {
        Store.data.primaryId = cd.id; Store.save(); renderList();
        Toasts.show('Primary countdown: ' + cd.title);
      });
      mk('✎', 'Edit', () => { toggleSwitcher(false); Creator.open('edit', cd.id); });
      mk('✕', 'Delete', (b) => arm(b, 'Sure?', () => {
        const wasActive = Store.data.activeId === cd.id;
        Store.remove(cd.id);
        if (wasActive) lastActiveId = null;
        renderView(Date.now()); renderList();
        Toasts.show('Deleted "' + cd.title + '"');
      }));
      item.appendChild(acts);
      list.appendChild(item);
    });
  }

  function updateListSummaries(now) {
    $$('#switcherList [data-sum]').forEach(el => {
      const cd = Store.get(el.getAttribute('data-sum'));
      if (cd) {
        const s = summaryFor(cd, now);
        if (el.textContent !== s) el.textContent = s;
      }
    });
  }

  function toggleSwitcher(force) {
    const p = $('#switcherPanel');
    const open = force !== undefined ? force : !p.classList.contains('open');
    p.classList.toggle('open', open);
    if (open) renderList();
  }

  /* ================= CountdownCreator (modal) ================= */
  /* In-UI stepper fields: rules for clamp / wrap / padding */
  const FIELD_RULES = {
    inHH:   { min: 0, max: 23, pad: 2, wrap: true },
    inMM:   { min: 0, max: 59, pad: 2, wrap: true },
    dDays:  { min: 0, max: 999, pad: 0, wrap: false },
    dHours: { min: 0, max: 99, pad: 0, wrap: false },
    dMins:  { min: 0, max: 599, pad: 0, wrap: false },
    dSecs:  { min: 0, max: 599, pad: 0, wrap: false }
  };
  function readField(id) {
    const r = FIELD_RULES[id];
    const el = document.getElementById(id);
    let v = parseInt(el ? el.value : '', 10);
    if (!isFinite(v)) v = r.min;
    return clamp(v, r.min, r.max);
  }
  function writeField(id, v) {
    const r = FIELD_RULES[id];
    v = clamp(Math.round(v), r.min, r.max);
    document.getElementById(id).value = r.pad ? String(v).padStart(r.pad, '0') : String(v);
  }
  function stepField(id, dir) {
    const r = FIELD_RULES[id];
    let v = readField(id) + dir;
    if (r.wrap) {
      const span = r.max - r.min + 1;
      v = ((((v - r.min) % span) + span) % span) + r.min;
    } else {
      v = clamp(v, r.min, r.max);
    }
    writeField(id, v);
    Creator.updateEndsPreview();
  }

  const Creator = {
    mode: 'date', // 'date' | 'duration'

    open(mode, id) {
      editingId = mode === 'edit' ? id : null;
      const cd = editingId ? Store.get(editingId) : null;
      $('#creatorEyebrow').textContent = cd ? 'Edit countdown' : 'New countdown';
      $('#inTitle').value = cd ? cd.title : '';
      $('#inDesc').value = (cd && cd.description) || '';
      let d = new Date(Date.now() + 30 * 86400000);
      if (cd) {
        const eff = cd.pausedMs != null ? Date.now() + cd.pausedMs : cd.targetTs;
        d = new Date(Math.max(eff, Date.now() + 60000));
      }
      this.setDateFields(d);
      this.setDurationMs(Math.max(0, d.getTime() - Date.now()));
      this.setMode('date', true);
      $('#tzNote').textContent = 'Your timezone: ' + tzName() + ' (detected automatically)';
      $('#formError').textContent = '';
      $('#deleteCreate').classList.toggle('hidden', !cd);
      $('#creatorOverlay').classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      this.updateEndsPreview();
      setTimeout(() => $('#inTitle').focus(), 60);
    },

    close() {
      $('#creatorOverlay').classList.add('hidden');
      document.body.style.overflow = '';
      editingId = null;
    },

    setDateFields(d) {
      $('#inDate').value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
      writeField('inHH', d.getHours());
      writeField('inMM', d.getMinutes());
    },

    /** Switch tabs, converting values so the moment is never lost. */
    setMode(m, silent) {
      if (m !== this.mode && !silent) {
        if (m === 'duration') {
          const ts = this.dateFieldsTs();
          this.setDurationMs(ts ? Math.max(0, ts - Date.now()) : 0);
        } else {
          this.setDateFields(new Date(Date.now() + this.durationMs()));
        }
      }
      this.mode = m;
      $$('#creatorMode [data-cmode]').forEach(b =>
        b.classList.toggle('on', b.getAttribute('data-cmode') === m));
      $('#paneDate').classList.toggle('hidden', m !== 'date');
      $('#paneDuration').classList.toggle('hidden', m !== 'duration');
      $('#formError').textContent = '';
      this.updateEndsPreview();
    },

    dateFieldsTs() {
      const dv = $('#inDate').value;
      if (!dv) return null;
      const dp = dv.split('-').map(Number);
      const ts = new Date(dp[0], dp[1] - 1, dp[2], readField('inHH'), readField('inMM'), 0).getTime();
      return isFinite(ts) ? ts : null;
    },

    durationMs() {
      return readField('dDays') * 86400000 + readField('dHours') * 3600000 +
        readField('dMins') * 60000 + readField('dSecs') * 1000;
    },

    setDurationMs(ms) {
      const r = decompose(Math.max(0, Math.round(ms)));
      writeField('dDays', Math.min(999, r.days));
      writeField('dHours', r.days > 999 ? 99 : r.hours);
      writeField('dMins', r.minutes);
      writeField('dSecs', r.seconds);
    },

    endTs() {
      return this.mode === 'date' ? this.dateFieldsTs() : Date.now() + this.durationMs();
    },

    updateEndsPreview() {
      const el = $('#endsPreview');
      if (!el) return;
      const ts = this.endTs();
      if (ts == null) {
        el.textContent = 'Pick a date to see when it ends';
        el.classList.add('dim');
        return;
      }
      const diff = ts - Date.now();
      if (diff <= 0) {
        el.textContent = 'That moment is in the past — pick a future time';
        el.classList.add('dim');
        return;
      }
      el.classList.remove('dim');
      el.textContent = 'Ends ' + fmtTarget(ts) + ' · ' + noIn(diff) + ' from now';
    },

    preset(kind) {
      const now = new Date();
      let d;
      if (kind === 'newyear') {
        const jan1 = new Date(now.getFullYear(), 0, 1, 0, 0);
        d = new Date(now.getTime() >= jan1.getTime() ? now.getFullYear() + 1 : now.getFullYear(), 0, 1, 0, 0);
        if (!$('#inTitle').value.trim()) $('#inTitle').value = 'New Year';
      } else if (kind === '7d') {
        d = new Date(now.getTime() + 7 * 86400000);
      } else {
        d = new Date(now.getTime() + 30 * 86400000);
      }
      d.setSeconds(0, 0);
      this.setDateFields(d);
      this.updateEndsPreview();
    },

    save() {
      const title = $('#inTitle').value.trim();
      const desc = $('#inDesc').value.trim();
      const err = (m) => { $('#formError').textContent = m; };
      if (!title) return err('Give your countdown a name — e.g. “The Big Day”.');
      let ts;
      if (this.mode === 'date') {
        if (!$('#inDate').value) return err('Pick a target date.');
        ts = this.dateFieldsTs();
        if (ts == null) return err('That date and time look invalid.');
      } else {
        if (this.durationMs() < 5000) return err('Set a duration of at least a few seconds.');
        ts = Date.now() + this.durationMs();
      }
      if (ts - Date.now() < 5000) return err('Pick a date and time in the future.');

      if (editingId && Store.get(editingId)) {
        Store.update(editingId, {
          title: title.toUpperCase(), description: desc,
          targetTs: ts, pausedMs: null, completedAt: null, bannerHidden: false
        });
        Toasts.show('Countdown updated');
      } else {
        Store.add({
          id: uid(), title: title.toUpperCase(), description: desc,
          targetTs: ts, createdAt: Date.now(),
          pausedMs: null, completedAt: null, bannerHidden: false
        });
        Toasts.show('Counting down to ' + title);
      }
      lastActiveId = null;
      this.close();
      renderView(Date.now());
      renderList();
    }
  };

  /* ================= SpotifyNowPlaying ================= */
  const NowPlaying = {
    key: null,
    render(snap) {
      const box = $('#nowPlaying');
      if (!snap) snap = Facade.snap();
      // Connect state
      if (snap.mode === 'off') {
        this.key = 'off';
        box.innerHTML = '<button class="np-connect" id="npConnect">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 10.5c2.8-.8 5.5-.4 8 .9"/><path d="M8.3 13.2c2.3-.6 4.4-.3 6.4.8"/><path d="M8.6 15.7c1.8-.5 3.4-.2 5 .6"/></svg>' +
          'Connect Spotify</button>';
        $('#npConnect').addEventListener('click', () => Settings.open('spotify'));
        return;
      }
      if (snap.mode === 'real' && !Store.data.spotify.accessToken) {
        this.key = 'noreal';
        box.innerHTML = '<button class="np-connect" id="npConnect">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 10.5c2.8-.8 5.5-.4 8 .9"/><path d="M8.3 13.2c2.3-.6 4.4-.3 6.4.8"/><path d="M8.6 15.7c1.8-.5 3.4-.2 5 .6"/></svg>' +
          'Finish Spotify setup</button>';
        $('#npConnect').addEventListener('click', () => Settings.open('spotify'));
        return;
      }
      if (snap.status === 'loading') {
        this.key = 'loading';
        box.innerHTML = '<div class="np-empty"><b>Connecting to Spotify…</b><span>Reading your playback</span></div>';
        return;
      }
      if (snap.status === 'none') {
        this.key = 'none';
        box.innerHTML = '<button class="np-empty" id="npEmpty" style="cursor:pointer">' +
          '<b>Nothing playing</b><span>Play something on Spotify</span></button>';
        $('#npEmpty').addEventListener('click', () => Settings.open('spotify'));
        return;
      }
      if (snap.status === 'auth' || snap.status === 'error' || !snap.track) {
        this.key = 'err';
        box.innerHTML = '<button class="np-empty" id="npEmpty" style="cursor:pointer">' +
          '<b>Spotify needs attention</b><span>' + (snap.status === 'auth' ? 'Session expired — reconnect' : 'Could not reach Spotify') + '</span></button>';
        $('#npEmpty').addEventListener('click', () => Settings.open('spotify'));
        return;
      }
      // Live track
      const t = snap.track;
      if (this.key === t.key) { this.progress(); return; }
      this.key = t.key;
      const demo = t.source === 'demo';
      box.innerHTML =
        '<div class="np-card' + (demo ? ' demo' : '') + '" id="npCard" role="button" tabindex="0" title="Spotify settings">' +
        '<img class="np-art" id="npArt" alt="">' +
        '<div class="np-meta"><div class="np-top">' +
        '<span class="np-tag' + (demo ? '' : ' green') + '">' + (demo ? 'Demo · Spotify' : 'Spotify') + '</span>' +
        '<span class="eq' + (t.isPlaying ? ' playing' : '') + '" id="npEq"><i></i><i></i><i></i></span>' +
        '</div><div class="np-title">' + esc(t.title) + '</div>' +
        '<div class="np-artist">' + esc(t.artists) + '</div>' +
        '<div class="np-progress"><i id="npBar"></i></div></div>' +
        (demo ? '<button class="np-next" id="npNext" title="Next demo track"><svg width="13" height="13" viewBox="0 0 24 24"><path d="M6 5v14l8-7z" fill="currentColor"/><rect x="16" y="5" width="2.6" height="14" rx="1" fill="currentColor"/></svg></button>' : '') +
        '</div>';
      const img = $('#npArt');
      img.src = t.artThumb || t.art;
      img.onerror = () => { img.style.visibility = 'hidden'; };
      const open = () => Settings.open('spotify');
      $('#npCard').addEventListener('click', open);
      $('#npCard').addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      if (demo) {
        $('#npNext').addEventListener('click', (e) => {
          e.stopPropagation();
          window.Spot.Demo.next();
          Facade.track = window.Spot.Demo.track();
          Facade.emit();
        });
      }
      this.progress();
    },

    progress() {
      const bar = $('#npBar');
      if (!bar) return;
      const p = Facade.progress();
      if (!p || !p.dur) { bar.style.width = '0%'; return; }
      bar.style.width = clamp((p.ms / p.dur) * 100, 0, 100).toFixed(2) + '%';
      const eq = $('#npEq');
      if (eq) eq.classList.toggle('playing', !!p.playing);
    }
  };

  /* ================= Top bar Spotify pill ================= */
  const TopSpotify = {
    render(snap) {
      const btn = $('#spotifyBtn'), lab = $('#spotifyBtnLabel');
      btn.classList.remove('live', 'demo');
      if (snap.mode === 'demo' && snap.track) { btn.classList.add('demo'); lab.textContent = 'Demo'; }
      else if (snap.mode === 'real' && snap.status === 'live') { btn.classList.add('live'); lab.textContent = 'Live'; }
      else if (snap.mode === 'real') { lab.textContent = 'Spotify'; }
      else { lab.textContent = 'Spotify'; }
    }
  };

  /* ================= Background driver ================= */
  function applyBackground(snap) {
    const t = snap.track;
    const key = (t && snap.status === 'live') ? t.key : snap.mode + ':' + snap.status;
    if (key === bgTrackKey) return;
    bgTrackKey = key;
    if (t && snap.status === 'live') {
      Facade.visual(t).then(v => {
        if (!v) return;
        window.BG.SpotifyBackground.setArt(v.src);
        window.BG.ThemeEngine.setPalette(v.palette);
      }).catch(() => {});
    } else {
      window.BG.SpotifyBackground.setArt(null);
      window.BG.ThemeEngine.setPalette(window.BG.NEUTRAL);
    }
  }

  /* ================= FullscreenMode ================= */
  const FullscreenMode = {
    idleTimer: 0,
    get on() { return document.body.classList.contains('zen'); },
    async toggle() { this.on ? this.exit() : this.enter(); },
    async enter() {
      document.body.classList.add('zen');
      toggleSwitcher(false);
      Settings.close();
      this.poke();
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) { Toasts.show('Fullscreen blocked — using focus mode'); }
    },
    async exit() {
      document.body.classList.remove('zen');
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
    },
    poke() {
      const b = $('#zenExit');
      b.classList.add('show');
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => b.classList.remove('show'), 2600);
    }
  };

  /* ================= Settings ================= */
  const Settings = {
    open(section) {
      this.renderSpotify();
      $('#settingsPanel').classList.add('open');
      toggleSwitcher(false);
      if (section === 'spotify') {
        setTimeout(() => {
          const el = $('#setSpotify');
          if (el) el.scrollIntoView({ behavior: isAnimated() ? 'smooth' : 'auto', block: 'start' });
        }, 120);
      }
    },
    close() { $('#settingsPanel').classList.remove('open'); },

    renderSpotify() {
      const sp = Store.data.spotify;
      $$('#settingsPanel [data-spmode]').forEach(b =>
        b.classList.toggle('on', b.getAttribute('data-spmode') === sp.mode));
      $('#realConfig').classList.toggle('hidden', sp.mode !== 'real');
      $('#demoConfig').classList.toggle('hidden', sp.mode !== 'demo');
      if (!$('#spClientId').value) $('#spClientId').value = sp.clientId || '';
      if (!$('#spRedirect').value) $('#spRedirect').value = sp.redirectUri || '';
      $('#fileWarn').classList.toggle('hidden', window.location.protocol !== 'file:');
      const acc = $('#spAccount');
      if (sp.account && sp.accessToken) acc.innerHTML = 'Connected as <b>' + esc(sp.account.name || 'Spotify user') + '</b>';
      else if (sp.accessToken) acc.innerHTML = 'Connected to Spotify';
      else acc.textContent = 'Not connected.';
      $('#spDisconnect').classList.toggle('hidden', !sp.accessToken);
      $('#spConnect').textContent = sp.accessToken ? 'Reconnect' : 'Connect with Spotify';
      const d = window.Spot.Demo.current();
      $('#demoNow').innerHTML = 'Now simulating: <b>' + esc(d.title) + '</b> — ' + esc(d.artist);
    }
  };

  /* ================= Master tick (250ms) ================= */
  function tick(now) {
    const cd = Store.active();
    if (cd) {
      let rem;
      if (cd.completedAt) rem = decompose(0);
      else if (cd.pausedMs != null) rem = decompose(cd.pausedMs);
      else {
        rem = decompose(cd.targetTs - now); // TARGET − NOW every tick: no drift, ever
        if (rem.done) completeCountdown(cd, now);
      }
      display.update(rem, true); // only changed units flip
    }
    if (now - lastClock > 1000) {
      lastClock = now;
      $('#clockLine').textContent = fmtClock(now) + ' · IFNOVA';
      updateListSummaries(now);
    }
    if (now - lastProg > 500) {
      lastProg = now;
      Facade.tick(); // demo auto-advance; never touches the countdown
      NowPlaying.progress();
    }
  }

  /* ================= Events ================= */
  function bindAll() {
    // Spotify state → Now Playing + background (song changes never reset countdown)
    Facade.onChange((snap) => {
      NowPlaying.render(snap);
      TopSpotify.render(snap);
      if ($('#settingsPanel').classList.contains('open')) Settings.renderSpotify();
      applyBackground(snap);
    });

    $('#createFirstBtn').addEventListener('click', () => Creator.open('new'));
    $('#newBtn').addEventListener('click', () => Creator.open('new'));
    $('#newFromSwitcher').addEventListener('click', () => { toggleSwitcher(false); Creator.open('new'); });
    $('#switcherBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleSwitcher(); });
    $('#closeSwitcher').addEventListener('click', () => toggleSwitcher(false));
    document.addEventListener('click', (e) => {
      const p = $('#switcherPanel');
      if (p.classList.contains('open') && !p.contains(e.target) && !$('#switcherBtn').contains(e.target)) {
        toggleSwitcher(false);
      }
    });

    // Creator
    $('#cancelCreate').addEventListener('click', () => Creator.close());
    $('#creatorOverlay').addEventListener('click', (e) => { if (e.target.id === 'creatorOverlay') Creator.close(); });
    $('#saveCreate').addEventListener('click', () => Creator.save());
    $$('#creatorOverlay .chip[data-preset]').forEach(c => c.addEventListener('click', () => Creator.preset(c.getAttribute('data-preset'))));
    // Date / Duration tabs
    $$('#creatorMode [data-cmode]').forEach(b =>
      b.addEventListener('click', () => Creator.setMode(b.getAttribute('data-cmode'))));
    // Steppers: tap once, or press-and-hold to repeat
    $$('.step-btn').forEach(btn => {
      const id = btn.getAttribute('data-target');
      const dir = Number(btn.getAttribute('data-step')) || 1;
      let holdT = 0, repT = 0;
      const clear = () => { clearTimeout(holdT); clearInterval(repT); holdT = 0; repT = 0; };
      btn.addEventListener('click', () => stepField(id, dir));
      btn.addEventListener('pointerdown', () => {
        clear();
        holdT = setTimeout(() => { repT = setInterval(() => stepField(id, dir), 70); }, 420);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, clear));
    });
    // Direct typing in stepper values + date changes refresh the preview
    ['inHH', 'inMM', 'dDays', 'dHours', 'dMins', 'dSecs'].forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => Creator.updateEndsPreview());
      el.addEventListener('change', () => { writeField(id, readField(id)); Creator.updateEndsPreview(); });
    });
    $('#inDate').addEventListener('change', () => Creator.updateEndsPreview());
    // Quick time chips (date tab)
    $$('#paneDate .chip[data-time]').forEach(c => c.addEventListener('click', () => {
      const p = (c.getAttribute('data-time') || '00:00').split(':');
      writeField('inHH', Number(p[0])); writeField('inMM', Number(p[1]));
      Creator.updateEndsPreview();
    }));
    // Quick duration chips (duration tab)
    $$('#paneDuration .chip[data-dur]').forEach(c => c.addEventListener('click', () => {
      Creator.setDurationMs(Number(c.getAttribute('data-dur')) * 1000);
      Creator.updateEndsPreview();
    }));
    $('#deleteCreate').addEventListener('click', (e) => arm(e.currentTarget, 'Confirm delete?', () => {
      const cd = Store.get(editingId);
      if (cd) {
        Store.remove(editingId);
        lastActiveId = null;
        renderView(Date.now()); renderList();
        Toasts.show('Deleted "' + cd.title + '"');
      }
      Creator.close();
    }));
    $('#inTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') Creator.save(); });

    // Countdown controls
    $('#pauseBtn').addEventListener('click', () => {
      const cd = Store.active();
      if (!cd || cd.completedAt) return;
      if (cd.pausedMs != null) { // paused → resume with remaining time preserved
        Store.update(cd.id, { targetTs: Date.now() + cd.pausedMs, pausedMs: null });
        Toasts.show('Resumed');
      } else { // running → freeze remaining time
        const left = cd.targetTs - Date.now();
        if (left <= 0) { completeCountdown(Store.get(cd.id), Date.now()); return; }
        Store.update(cd.id, { pausedMs: left });
        Toasts.show('Paused');
      }
      lastActiveId = null;
      renderView(Date.now());
    });
    $('#editBtn').addEventListener('click', () => {
      const cd = Store.active();
      if (cd) Creator.open('edit', cd.id);
    });
    $('#completedEdit').addEventListener('click', () => {
      const cd = Store.active();
      if (cd) Creator.open('edit', cd.id);
    });
    $('#completedDismiss').addEventListener('click', () => {
      const cd = Store.active();
      if (cd) { Store.update(cd.id, { bannerHidden: true }); updateCompletedUI(Store.get(cd.id)); }
    });

    // Settings
    $('#settingsBtn').addEventListener('click', () => Settings.open());
    $('#closeSettings').addEventListener('click', () => Settings.close());
    $('#spotifyBtn').addEventListener('click', () => Settings.open('spotify'));
    const bi = $('#bgIntensity');
    bi.value = Store.data.settings.bgIntensity;
    $('#bgVal').textContent = bi.value;
    bi.addEventListener('input', () => {
      $('#bgVal').textContent = bi.value;
      window.BG.SpotifyBackground.setIntensity(Number(bi.value));
    });
    bi.addEventListener('change', () => {
      Store.data.settings.bgIntensity = Number(bi.value);
      Store.save();
    });
    const at = $('#animToggle');
    at.checked = !!Store.data.settings.animations;
    at.addEventListener('change', () => {
      Store.data.settings.animations = at.checked;
      Store.save();
      const cd = Store.active();
      if (cd) display.setInstantAll(decompose(remainingMs(cd)));
      Toasts.show(at.checked ? 'Animations on' : 'Animations off');
    });
    const dt = $('#dustToggle');
    dt.checked = !!Store.data.settings.dust;
    dt.addEventListener('change', () => {
      Store.data.settings.dust = dt.checked;
      Store.save();
      window.BG.Dust.setEnabled(dt.checked);
    });

    // Spotify settings
    $$('#settingsPanel [data-spmode]').forEach(b => b.addEventListener('click', () => {
      const m = b.getAttribute('data-spmode');
      Facade.setMode(m);
      Settings.renderSpotify();
      if (m === 'demo') {
        // Spotify added -> dismiss the dialog so the new atmosphere is revealed
        Settings.close();
        Toasts.show('Demo atmosphere on - simulating Spotify');
      } else {
        Toasts.show(m === 'real' ? 'Real Spotify mode' : 'Spotify background off');
      }
    }));
    $('#spConnect').addEventListener('click', async () => {
      const cid = $('#spClientId').value.trim();
      const red = $('#spRedirect').value.trim();
      if (!cid) return Toasts.show('Paste your Spotify Client ID first');
      if (!red || !/^https?:/.test(red)) return Toasts.show('Redirect URI must be an http(s) URL');
      Store.data.spotify.clientId = cid;
      Store.data.spotify.redirectUri = red;
      Store.data.spotify.mode = 'real';
      Store.save();
      Facade.setMode('real');
      try { await window.Spot.Auth.begin(cid, red); }
      catch (e) { Toasts.show('Could not start Spotify login'); }
    });
    $('#spDisconnect').addEventListener('click', () => {
      Store.data.spotify.accessToken = null;
      Store.data.spotify.refreshToken = null;
      Store.data.spotify.expiresAt = 0;
      Store.data.spotify.account = null;
      Store.save();
      Facade.setMode('off');
      Settings.renderSpotify();
      Toasts.show('Spotify disconnected');
    });
    $('#copyRedirect').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('#spRedirect').value);
        Toasts.show('Redirect URI copied');
      } catch (e) { Toasts.show('Copy failed — select the text manually'); }
    });
    $('#demoNext').addEventListener('click', () => {
      window.Spot.Demo.next();
      Facade.track = window.Spot.Demo.track();
      Facade.emit();
      Settings.renderSpotify();
    });
    $('#clearAll').addEventListener('click', (e) => arm(e.currentTarget, 'Delete everything?', () => {
      Store.clear();
      lastActiveId = null;
      Facade.setMode('off');
      window.BG.SpotifyBackground.setArt(null);
      window.BG.ThemeEngine.setPalette(window.BG.NEUTRAL);
      renderView(Date.now()); renderList(); Settings.renderSpotify();
      Toasts.show('All data cleared');
    }));

    // Fullscreen
    $('#fsBtn').addEventListener('click', () => FullscreenMode.toggle());
    $('#zenExit').addEventListener('click', () => FullscreenMode.exit());
    document.addEventListener('mousemove', () => { if (FullscreenMode.on) FullscreenMode.poke(); });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) document.body.classList.remove('zen');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target.tagName || '').toUpperCase());
      if (e.key === 'Escape') {
        if (!$('#creatorOverlay').classList.contains('hidden')) Creator.close();
        else if ($('#switcherPanel').classList.contains('open')) toggleSwitcher(false);
        else if ($('#settingsPanel').classList.contains('open')) Settings.close();
        else if (FullscreenMode.on) FullscreenMode.exit();
        return;
      }
      if (typing) return;
      if (e.key === 'n' || e.key === 'N') Creator.open('new');
      if (e.key === 'f' || e.key === 'F') FullscreenMode.toggle();
    });

    window.addEventListener('resize', debounce(fitTitle, 150));
  }

  /* ================= OAuth return handling ================= */
  async function handleOAuthReturn() {
    const p = window.Spot.Auth.params();
    if (!p) return;
    if (p.get('error')) {
      window.Spot.Auth.cleanUrl();
      Toasts.show('Spotify login was cancelled');
      return;
    }
    const code = p.get('code');
    if (!code) return;
    Toasts.show('Connecting to Spotify…');
    try {
      await window.Spot.Auth.exchange(code, Store.data.spotify.redirectUri);
      const me = await window.Spot.Auth.me().catch(() => null);
      Store.data.spotify.account = me ? { name: me.display_name || me.id, id: me.id } : null;
      Store.save();
      Facade.setMode('real');
      Settings.close(); // connected → make sure no setup dialog lingers
      Toasts.show('Spotify connected — background is live');
    } catch (e) {
      Toasts.show('Spotify connection failed — check Client ID & redirect URI');
    }
    window.Spot.Auth.cleanUrl();
  }

  /* ================= Boot ================= */
  function boot() {
    Store.load();
    if (!Store.data.spotify.redirectUri && window.location.protocol !== 'file:') {
      Store.data.spotify.redirectUri = window.location.href.split(/[?#]/)[0];
      Store.save();
    }
    window.BG.init(Store.data.settings.bgIntensity, Store.data.settings.dust);
    display = new window.Flip.CountdownDisplay($('#flipRow'), { isAnimated });
    bindAll();
    Facade.init(); // emits → Now Playing + background render
    renderView(Date.now());
    renderList();
    Settings.renderSpotify();
    TopSpotify.render(Facade.snap());
    handleOAuthReturn();
    Ticker.on(tick);
    Ticker.start(250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
