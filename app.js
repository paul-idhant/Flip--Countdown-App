(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'flip-single-v2';
  const state = Object.assign({ countdown: null, playlist: '', mode: 'duration', theme: 'original' }, load());
  let last = {};
  let screen = 'home';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200); }

  function split(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return { days: Math.floor(total / 86400), hours: Math.floor(total % 86400 / 3600), minutes: Math.floor(total % 3600 / 60), seconds: total % 60 };
  }
  function cards(parts) {
    const values = [['days', parts.days], ['hours', parts.hours], ['minutes', parts.minutes], ['seconds', parts.seconds]];
    $('#flipRow').innerHTML = values.map(([key, value]) => `<div class="unit"><div class="card ${last[key] !== undefined && last[key] !== value ? 'changed' : ''}"><span>${key === 'days' ? value : pad(value)}</span><i></i></div><b>${key}</b></div>`).join('');
    last = parts;
  }
  function targetLabel(ts) {
    return new Intl.DateTimeFormat(undefined, { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(ts));
  }
  function applyTheme() {
    if (state.theme === 'newsprint') state.theme = 'gallery';
    if (state.theme === 'porcelain') state.theme = 'champagne';
    document.documentElement.dataset.theme = state.theme === 'original' ? '' : state.theme;
    document.querySelectorAll('.theme-choice').forEach(button => button.classList.toggle('selected', button.dataset.theme === state.theme));
  }
  function showApp(create = false) {
    screen = 'app';
    render();
    if (create || !state.countdown) openSetup(false);
  }
  function showHome() { screen = 'home'; render(); }
  function render() {
    const cd = state.countdown;
    document.body.classList.toggle('countdown-active', screen === 'app' && !!cd);
    $('#home').classList.toggle('hidden', screen !== 'home');
    $('#welcome').classList.toggle('hidden', screen !== 'app' || !!cd);
    $('#countdown').classList.toggle('hidden', screen !== 'app' || !cd);
    $('#editBtn').classList.toggle('hidden', screen !== 'app' || !cd);
    $('#homeBtn').classList.toggle('hidden', screen === 'home');
    if (!cd || screen !== 'app') return;
    $('#title').textContent = cd.title;
    $('#description').textContent = cd.description || '';
    $('#description').classList.toggle('hidden', !cd.description);
    $('#targetText').textContent = targetLabel(cd.target);
    const remaining = cd.target - Date.now();
    cards(split(remaining));
    $('#complete').classList.toggle('hidden', remaining > 0);
  }
  function updateClock() {
    $('#clock').textContent = new Intl.DateTimeFormat(undefined, { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit' }).format(new Date());
  }

  function openSetup(edit = false) {
    const cd = state.countdown;
    $('#inputTitle').value = edit && cd ? cd.title : '';
    $('#inputDescription').value = edit && cd ? cd.description : '';
    const d = new Date(edit && cd ? cd.target : Date.now() + 3600000);
    $('#date').value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    $('#time').value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $('#setupError').textContent = '';
    setMode(edit && cd ? 'date' : state.mode || 'duration');
    $('#setupOverlay').classList.remove('hidden');
    setTimeout(() => $('#inputTitle').focus(), 50);
  }
  function closeSetup() { $('#setupOverlay').classList.add('hidden'); }
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    $('#durationPane').classList.toggle('hidden', mode !== 'duration');
    $('#datePane').classList.toggle('hidden', mode !== 'date');
  }

  function playlistId(url) {
    try {
      const u = new URL(url.trim());
      if (!/(^|\.)spotify\.com$/i.test(u.hostname)) return null;
      const match = u.pathname.match(/^\/(?:intl-[^/]+\/)?playlist\/([A-Za-z0-9]+)(?:\/|$)/);
      return match ? match[1] : null;
    } catch { return null; }
  }
  function renderPlaylist() {
    const id = playlistId(state.playlist);
    $('#embedWrap').innerHTML = id ? `<iframe title="Spotify playlist" src="https://open.spotify.com/embed/playlist/${encodeURIComponent(id)}?utm_source=generator&theme=0" width="100%" height="420" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>` : '';
    $('#removePlaylist').classList.toggle('hidden', !id);
    $('#playlistUrl').value = state.playlist || '';
    $('#footerMusicText').textContent = id ? 'Spotify playlist ready' : 'Add a Spotify playlist';
    $('.spotify-dot').classList.toggle('live', !!id);
  }
  function openPlayer() { $('#playerPanel').classList.add('open'); setTimeout(() => $('#playlistUrl').focus(), 100); }

  $('#setupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#inputTitle').value.trim();
    let target;
    if (state.mode === 'duration') {
      const h = Number($('#hours').value) || 0, m = Number($('#minutes').value) || 0, s = Number($('#seconds').value) || 0;
      const duration = (h * 3600 + m * 60 + s) * 1000;
      if (duration <= 0) return $('#setupError').textContent = 'Choose a duration greater than zero.';
      target = Date.now() + duration;
    } else {
      target = new Date(`${$('#date').value}T${$('#time').value || '00:00'}`).getTime();
      if (!Number.isFinite(target) || target <= Date.now()) return $('#setupError').textContent = 'Choose a date and time in the future.';
    }
    state.countdown = { title, description: $('#inputDescription').value.trim(), target };
    save(); closeSetup(); last = {}; render(); toast('Countdown started');
    if (matchMedia('(max-width: 900px)').matches) {
      try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch {}
    }
  });
  $('#playlistForm').addEventListener('submit', (e) => {
    e.preventDefault(); const value = $('#playlistUrl').value.trim();
    if (!playlistId(value)) return $('#playlistError').textContent = 'Paste a valid Spotify playlist link.';
    $('#playlistError').textContent = ''; state.playlist = value; save(); renderPlaylist(); toast('Playlist added');
  });
  $('#removePlaylist').onclick = () => { state.playlist = ''; save(); renderPlaylist(); toast('Playlist removed'); };
  $('#startBtn').onclick = () => openSetup(false);
  $('#enterBtn').onclick = () => showApp(false);
  $('#homeCreateBtn').onclick = () => showApp(true);
  $('#homeBtn').onclick = showHome;
  $('#editBtn').onclick = () => openSetup(true);
  $('#againBtn').onclick = () => openSetup(false);
  $('#resetBtn').onclick = () => { if (confirm('Clear this countdown?')) { state.countdown = null; save(); last = {}; render(); } };
  $('#cancelSetup').onclick = $('#cancelSetup2').onclick = closeSetup;
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $('#' + b.dataset.close).classList.remove('open'));
  $('#musicBtn').onclick = $('#footerMusic').onclick = openPlayer;
  $('#settingsBtn').onclick = () => $('#settingsPanel').classList.add('open');
  document.querySelectorAll('.theme-choice').forEach(button => button.onclick = () => {
    state.theme = button.dataset.theme; save(); applyTheme(); toast(`${button.querySelector('b').textContent} theme applied`);
  });
  $('#fullBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  $('#setupOverlay').onclick = (e) => { if (e.target.id === 'setupOverlay' && state.countdown) closeSetup(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSetup(); $('#playerPanel').classList.remove('open'); } if (e.key.toLowerCase() === 'f' && !/input|textarea/i.test(e.target.tagName)) $('#fullBtn').click(); });

  applyTheme(); render(); renderPlaylist(); updateClock();
  setInterval(() => { render(); updateClock(); }, 1000);
})();
