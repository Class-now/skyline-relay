// Skyline Relay — a 60-second, one-button glider game for event booths.
// No build step, no external assets: open index.html and play.
(() => {
  'use strict';

  // ---------- setup ----------
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const opts = Object.assign({ len: 60, sound: true, attract: true }, store.get('sr-opts', {}));

  // ---------- seeded random so a round's course is reproducible ----------
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- audio ----------
  let ac = null;
  function beep(freq, dur = 0.08, type = 'sine', vol = 0.12) {
    if (!opts.sound || state.mode === 'attract') return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    } catch { /* audio unavailable */ }
  }

  // ---------- world ----------
  // World units: x in metres travelled, y in 0..1 of the playfield height (0 = top).
  const G = 0.55, LIFT = 1.15, MAX_V = 0.9, MIN_SPEED = 9, MAX_SPEED = 38;
  const state = {
    mode: 'title', // title | attract | play | over
    t: 0, left: 60, x: 0, y: 0.5, vy: 0, speed: 16, hold: false,
    score: 0, rings: 0, combo: 0, best: 0, stun: 0,
    objs: [], parts: [], clouds: [], nextSpawn: 0, rand: Math.random,
    idle: 0, flash: 0,
  };

  function resetRound(mode) {
    const seed = (Date.now() & 0xffffffff) ^ 0x9e3779b9;
    Object.assign(state, {
      mode, t: 0, left: opts.len, x: 0, y: 0.45, vy: 0, speed: 16, hold: false,
      score: 0, rings: 0, combo: 0, best: 0, stun: 0, objs: [], parts: [],
      nextSpawn: 40, rand: rng(seed), flash: 0,
    });
    state.clouds = Array.from({ length: 14 }, (_, i) => ({
      x: i * 45 + Math.random() * 30, y: Math.random() * 0.9, s: 0.5 + Math.random(), d: 0.3 + Math.random() * 0.5 }));
  }

  function spawn() {
    const r = state.rand;
    const k = r();
    const difficulty = Math.min(1, state.x / 1800);
    if (k < 0.5) {
      // a short arc of rings rewards a committed dive-then-climb
      const n = 2 + Math.floor(r() * 3), y0 = 0.2 + r() * 0.6, slope = (r() - 0.5) * 0.25;
      for (let i = 0; i < n; i++) state.objs.push({ type: 'ring', x: state.nextSpawn + i * 22, y: clamp(y0 + slope * i, 0.1, 0.88), hit: false });
      state.nextSpawn += n * 22 + 30 + r() * 30;
    } else if (k < 0.72) {
      state.objs.push({ type: 'updraft', x: state.nextSpawn, w: 28, hit: false });
      state.nextSpawn += 55 + r() * 30;
    } else {
      const big = r() < 0.3 + difficulty * 0.4;
      state.objs.push({ type: 'storm', x: state.nextSpawn, y: 0.15 + r() * 0.7, r: big ? 0.11 : 0.075, hit: false, ph: r() * 6 });
      state.nextSpawn += 45 - difficulty * 15 + r() * 30;
    }
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.2 + Math.random() * 0.6;
      state.parts.push({ x, y, vx: Math.cos(a) * s * 30, vy: Math.sin(a) * s * 0.6, life: 0.6, color });
    }
  }

  // ---------- attract-mode pilot: aims for the next ring, avoids storms ----------
  function autopilot() {
    const ahead = state.objs.find((o) => o.x > state.x + 4 && !o.hit && o.type !== 'updraft');
    let target = 0.5;
    if (ahead) target = ahead.type === 'ring' ? ahead.y : (ahead.y > 0.5 ? ahead.y - ahead.r - 0.12 : ahead.y + ahead.r + 0.12);
    return state.y > target + 0.02 || (state.vy > 0.25 && state.y > target - 0.05);
  }

  // ---------- update ----------
  function update(dt) {
    state.flash = Math.max(0, state.flash - dt);
    if (state.mode === 'title') {
      state.idle += dt;
      if (opts.attract && state.idle > 20) { resetRound('attract'); show(null); }
      driftClouds(dt * 8);
      return;
    }
    if (state.mode === 'over') { driftClouds(dt * 6); return; }

    state.t += dt;
    state.left = Math.max(0, opts.len - state.t);
    const holding = state.mode === 'attract' ? autopilot() : state.hold;

    // flight model: holding trades speed for lift, releasing trades height for speed
    if (state.stun > 0) {
      state.stun -= dt; state.vy += G * 1.4 * dt;
    } else if (holding) {
      state.vy -= LIFT * dt * (state.speed / 22);
      state.speed -= 9 * dt;
    } else {
      state.vy += G * dt;
      state.speed += (state.vy > 0 ? 14 : 4) * dt;
    }
    state.speed = clamp(state.speed, MIN_SPEED, MAX_SPEED);
    state.vy = clamp(state.vy, -MAX_V, MAX_V);
    state.y += state.vy * dt;
    if (state.y < 0.04) { state.y = 0.04; state.vy = Math.max(0, state.vy); }
    if (state.y > 0.94) { // skimming the ground costs speed and the combo
      state.y = 0.94; state.vy = -0.35; state.speed *= 0.6;
      if (state.combo) beep(160, 0.15, 'square');
      state.combo = 0; state.flash = 0.2;
    }

    const dx = state.speed * dt;
    state.x += dx;
    state.score += dx;
    driftClouds(dx);

    while (state.nextSpawn < state.x + 260) spawn();

    for (const o of state.objs) {
      const rel = o.x - state.x;
      if (o.type === 'ring' && !o.hit && Math.abs(rel) < 2.5 && Math.abs(o.y - state.y) < 0.065) {
        o.hit = true; state.rings++; state.combo++; state.best = Math.max(state.best, state.combo);
        const bonus = 25 * Math.min(state.combo, 8);
        state.score += bonus; state.speed = Math.min(MAX_SPEED, state.speed + 3);
        burst(o.x, o.y, '#ffd166'); beep(520 + Math.min(state.combo, 8) * 60, 0.09, 'triangle');
      } else if (o.type === 'updraft' && rel < 0 && rel > -o.w) {
        state.vy -= 1.6 * dt;
        if (!o.hit) { o.hit = true; beep(300, 0.2, 'sine', 0.06); }
      } else if (o.type === 'storm' && !o.hit) {
        // compare in screen pixels so the hitbox matches what the player sees at any aspect ratio
        if (Math.hypot(rel * PX(), (o.y - state.y) * H) < o.r * H * 0.95) {
          o.hit = true; state.stun = 0.7; state.speed *= 0.5; state.combo = 0; state.flash = 0.35;
          burst(o.x, state.y, '#ff6b6b', 20); beep(110, 0.3, 'sawtooth', 0.1);
        }
      }
    }
    state.objs = state.objs.filter((o) => o.x > state.x - 60);
    for (const p of state.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    state.parts = state.parts.filter((p) => p.life > 0);

    if (state.left <= 0) {
      if (state.mode === 'attract') { state.mode = 'title'; state.idle = 0; show('title'); }
      else finish();
    }
  }

  function driftClouds(dx) {
    for (const c of state.clouds) { c.x -= dx * c.d * 0.3; if (c.x < -60) { c.x += 640; c.y = Math.random() * 0.9; } }
  }

  // ---------- draw ----------
  const PX = () => W / 160; // pixels per metre: ~160 m visible
  const sx = (x) => W * 0.22 + (x - state.x) * PX();
  const sy = (y) => y * H;

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const dusk = clamp(state.t / Math.max(1, opts.len), 0, 1);
    g.addColorStop(0, mix('#0b2a4a', '#2b1a4a', dusk));
    g.addColorStop(0.6, mix('#1e6fb8', '#d9735a', dusk));
    g.addColorStop(1, mix('#9fd8ff', '#ffc38a', dusk));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (const c of state.clouds) cloud(c.x / 600 * W * 1.4, c.y * H, 40 * c.s * (H / 700), `rgba(255,255,255,${0.12 + c.d * 0.25})`);

    // ground strip
    ctx.fillStyle = 'rgba(10,30,50,.55)';
    ctx.fillRect(0, sy(0.955), W, H);

    for (const o of state.objs) {
      const x = sx(o.x);
      if (x < -120 || x > W + 120) continue;
      if (o.type === 'ring') {
        ctx.lineWidth = Math.max(4, H * 0.008);
        ctx.strokeStyle = o.hit ? 'rgba(255,209,102,.25)' : '#ffd166';
        ctx.beginPath(); ctx.ellipse(x, sy(o.y), H * 0.02, H * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (o.type === 'updraft') {
        const w = o.w * PX();
        const ug = ctx.createLinearGradient(0, H, 0, 0);
        ug.addColorStop(0, 'rgba(111,211,255,.35)'); ug.addColorStop(1, 'rgba(111,211,255,0)');
        ctx.fillStyle = ug; ctx.fillRect(x, 0, w, H);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const yy = ((state.t * 0.6 + i / 4) % 1) * H;
          ctx.beginPath(); ctx.moveTo(x + w * 0.5 - 10, H - yy + 10); ctx.lineTo(x + w * 0.5, H - yy); ctx.lineTo(x + w * 0.5 + 10, H - yy + 10); ctx.stroke();
        }
      } else if (o.type === 'storm') {
        const r = o.r * H, y = sy(o.y);
        cloud(x, y, r * 0.9, o.hit ? 'rgba(60,60,80,.4)' : '#3b3f5c');
        if (!o.hit && Math.sin(state.t * 7 + o.ph) > 0.6) {
          ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 3; ctx.beginPath();
          ctx.moveTo(x, y + r * 0.3); ctx.lineTo(x - r * 0.2, y + r * 0.7); ctx.lineTo(x + r * 0.1, y + r * 0.7); ctx.lineTo(x - r * 0.1, y + r * 1.1); ctx.stroke();
        }
      }
    }

    for (const p of state.parts) {
      ctx.globalAlpha = clamp(p.life / 0.6, 0, 1); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (state.mode === 'play' || state.mode === 'attract') glider(sx(state.x), sy(state.y), Math.atan2(state.vy * H, state.speed * PX()));

    if (state.flash > 0) { ctx.fillStyle = `rgba(255,107,107,${state.flash})`; ctx.fillRect(0, 0, W, H); }

    if (state.mode === 'attract') {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H * 0.42, W, H * 0.16);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(H * 0.06)}px system-ui`;
      ctx.fillText('TAP TO PLAY', W / 2, H * 0.52);
    }
  }

  function glider(x, y, ang) {
    const s = Math.max(14, H * 0.03);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = state.stun > 0 ? '#ffb3b3' : '#ffffff';
    ctx.strokeStyle = '#0b2a4a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s * 1.4, 0); ctx.lineTo(-s, -s * 0.7); ctx.lineTo(-s * 0.5, 0); ctx.lineTo(-s, s * 0.7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6fd3ff'; ctx.beginPath(); ctx.moveTo(s * 1.4, 0); ctx.lineTo(-s * 0.5, 0); ctx.lineTo(-s, s * 0.7); ctx.closePath(); ctx.fill();
    ctx.restore();
    // speed trail
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s - state.speed * 2, y - state.vy * 20); ctx.stroke();
  }

  function cloud(x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r * 0.9, y + r * 0.15, r * 0.75, 0, Math.PI * 2);
    ctx.arc(x - r * 0.9, y + r * 0.2, r * 0.7, 0, Math.PI * 2); ctx.fill();
  }

  function mix(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  }

  // ---------- HUD, panels, leaderboard ----------
  function hud() {
    const on = state.mode === 'play';
    $('hud').classList.toggle('show', on);
    if (!on) return;
    $('h-alt').textContent = `${Math.floor(state.score)} pts`;
    $('h-time').textContent = Math.ceil(state.left);
    $('h-combo').textContent = state.combo > 1 ? `x${Math.min(state.combo, 8)} combo` : '';
  }

  function show(id) {
    for (const p of document.querySelectorAll('.panel')) p.classList.toggle('show', p.id === id);
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const boardKey = () => `sr-board-${today()}`;
  const readBoard = () => store.get(boardKey(), []);
  function renderBoard(el, highlight, n = 10) {
    const rows = readBoard().slice(0, n);
    if (!rows.length) { el.innerHTML = '<p class="hint">No flights yet today — be the first on the board.</p>'; return; }
    el.innerHTML = '<table class="board">' + rows.map((r, i) =>
      `<tr class="${r.id === highlight ? 'me' : ''}"><td>${i + 1}</td><td>${r.name}</td><td>${r.rings} rings</td><td>${r.score}</td></tr>`).join('') + '</table>';
  }

  let lastRun = null;
  function finish() {
    state.mode = 'over';
    lastRun = { id: Date.now(), score: Math.floor(state.score), rings: state.rings, combo: state.best };
    $('final').textContent = `${lastRun.score} pts · ${lastRun.rings} rings · best combo x${Math.min(lastRun.combo, 8)}`;
    const rows = readBoard();
    const qualifies = rows.length < 10 || lastRun.score > rows[rows.length - 1].score;
    $('initials-wrap').style.display = qualifies ? '' : 'none';
    renderBoard($('board'), null);
    show('over'); beep(392, 0.12); setTimeout(() => beep(523, 0.2), 120);
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (const b of document.querySelectorAll('.ini')) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      b.textContent = letters[(letters.indexOf(b.textContent) + 1) % letters.length]; beep(660, 0.04);
    });
  }
  $('save').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!lastRun) return;
    const name = [...document.querySelectorAll('.ini')].map((b) => b.textContent).join('');
    const rows = readBoard();
    rows.push({ ...lastRun, name });
    rows.sort((a, b) => b.score - a.score);
    store.set(boardKey(), rows.slice(0, 10));
    $('initials-wrap').style.display = 'none';
    renderBoard($('board'), lastRun.id);
  });

  function startPlay() { resetRound('play'); show(null); state.idle = 0; beep(440, 0.08); }
  $('play').addEventListener('click', (e) => { e.stopPropagation(); startPlay(); });
  $('again').addEventListener('click', (e) => {
    e.stopPropagation(); state.mode = 'title'; state.idle = 0; renderBoard($('board-mini'), null, 3); show('title');
  });

  // staff menu: hidden behind a 2-second press so visitors don't open it by accident
  let staffTimer = 0;
  const staffBtn = $('staff');
  staffBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); staffTimer = setTimeout(() => {
    $('opt-len').value = String(opts.len); $('opt-sound').checked = opts.sound; $('opt-attract').checked = opts.attract;
    if (state.mode === 'play' || state.mode === 'attract') { state.mode = 'title'; }
    show('staffmenu'); }, 2000); });
  for (const ev of ['pointerup', 'pointerleave']) staffBtn.addEventListener(ev, () => clearTimeout(staffTimer));
  $('close-staff').addEventListener('click', (e) => {
    e.stopPropagation();
    opts.len = +$('opt-len').value; opts.sound = $('opt-sound').checked; opts.attract = $('opt-attract').checked;
    store.set('sr-opts', opts); state.idle = 0; renderBoard($('board-mini'), null, 3); show('title');
  });
  $('reset-board').addEventListener('click', (e) => { e.stopPropagation(); store.set(boardKey(), []); renderBoard($('board-mini'), null, 3); });
  $('staffmenu').addEventListener('pointerdown', (e) => e.stopPropagation());

  // one-button input: pointer anywhere or Space / Up arrow
  function press(e) {
    if (state.mode === 'attract') { startPlay(); return; }
    if (state.mode === 'title' && e && e.target === cv) { startPlay(); return; }
    if (state.mode === 'play') state.hold = true;
  }
  const release = () => { state.hold = false; };
  cv.addEventListener('pointerdown', press);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
    e.preventDefault();
    if (e.repeat) return;
    if (state.mode === 'title' || state.mode === 'attract') startPlay(); else press(e);
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') release(); });

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw(); hud();
    requestAnimationFrame(frame);
  }
  resetRound('title');
  renderBoard($('board-mini'), null, 3);
  requestAnimationFrame(frame);

  // test hook: lets automated checks drive the game without timing flakiness
  window.__skyline = { state, update, startPlay, opts };
})();
