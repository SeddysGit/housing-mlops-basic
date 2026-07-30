/* ============================================================
   JUJUTSU CLASH — Gojo vs Sukuna, 3D arena fighter
   Engine: combat, abilities, domains, AI, camera, FX, rounds
   ============================================================ */
(function () {
  'use strict';

  /* ================= CONFIG ================= */
  const ARENA_R = 18;
  const GRAVITY = -34;
  const WALK_SPEED = 6.4;
  const MAX_HP = 1000;
  const MAX_CE = 100;
  const ROUND_TIME = 99;
  const WINS_NEEDED = 2;
  const BLACK_FLASH_CHANCE = 0.12;

  const CHARS = {
    gojo: {
      name: 'SATORU GOJO',
      css: '#4fd4ff',
      color: 0x4fd4ff,
      guardName: 'Infinity',
      skills: {
        s1: { name: 'Lapse: Blue', ce: 15, cd: 5 },
        s2: { name: 'Reversal: Red', ce: 25, cd: 8 },
        s3: { name: 'Hollow Purple', ce: 40, cd: 18 },
        dom: { name: 'Unlimited Void', ce: 100 },
      },
    },
    sukuna: {
      name: 'RYOMEN SUKUNA',
      css: '#ff5540',
      color: 0xff5540,
      guardName: 'Guard',
      skills: {
        s1: { name: 'Dismantle', ce: 15, cd: 3 },
        s2: { name: 'Cleave', ce: 25, cd: 8 },
        s3: { name: 'Fire Arrow', ce: 40, cd: 18 },
        dom: { name: 'Malevolent Shrine', ce: 100 },
      },
    },
  };

  /* ================= GLOBALS ================= */
  let scene, camera, renderer, clock;
  let fighters = [];
  let projectiles = [];
  let effects = [];
  let domain = null;
  let gameState = 'menu'; // menu, select, intro, fight, roundEnd, matchEnd
  let paused = false;
  let roundNum = 1;
  let roundTimer = ROUND_TIME;
  let wins = [0, 0];
  let mode = { vsAI: true, difficulty: 'normal', p1Char: 'gojo' };
  let shake = { t: 0, mag: 0 };
  let slowmo = { t: 0, factor: 1 };
  let camSide = 1;
  let camPos = new THREE.Vector3(0, 6, 20);
  let announceQ = [];
  let announceCur = null;
  let elapsed = 0;
  let introT = 0;
  let roundEndT = 0;
  let arena = {};
  let flashLight = null;
  let ui = {};

  const V3 = () => new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const burstV = new THREE.Vector3();
  const flashFx = { alpha: 0, rate: 1 };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function distXZ(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }

  /* ================= INPUT ================= */
  const held = new Set();
  const pressed = new Set();

  const P1MAP = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', light: 'KeyJ', heavy: 'KeyK', guard: 'KeyL', s1: 'KeyU', s2: 'KeyI', s3: 'KeyO', dom: 'KeyP' };
  const P2MAP = { fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', jump: 'ShiftRight', dash: 'ControlRight', light: 'Comma', heavy: 'Period', guard: 'Slash', s1: 'Semicolon', s2: 'Quote', s3: 'BracketRight', dom: 'Enter' };

  const GAME_CODES = new Set();
  [P1MAP, P2MAP].forEach(m => Object.keys(m).forEach(k => GAME_CODES.add(m[k])));

  window.addEventListener('keydown', function (e) {
    if (GAME_CODES.has(e.code) && gameState !== 'menu' && gameState !== 'select') e.preventDefault();
    if (!held.has(e.code)) pressed.add(e.code);
    held.add(e.code);
    AudioSys.unlock();
    if (e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') { const m = AudioSys.toggleMute(); ui.muteBtn.textContent = m ? '🔇' : '🔊'; }
    if (e.code === 'KeyH') ui.help.classList.toggle('hidden');
    if (e.code === 'KeyR' && gameState === 'matchEnd') rematch();
  });
  window.addEventListener('keyup', function (e) { held.delete(e.code); });
  window.addEventListener('blur', function () { held.clear(); });

  function readInput(f) {
    const map = f.idx === 0 ? P1MAP : P2MAP;
    return {
      mx: (held.has(map.right) ? 1 : 0) - (held.has(map.left) ? 1 : 0),
      mz: (held.has(map.fwd) ? 1 : 0) - (held.has(map.back) ? 1 : 0),
      jump: pressed.has(map.jump),
      dash: pressed.has(map.dash),
      light: pressed.has(map.light),
      heavy: pressed.has(map.heavy),
      guard: held.has(map.guard),
      s1: pressed.has(map.s1),
      s2: pressed.has(map.s2),
      s3: pressed.has(map.s3),
      dom: pressed.has(map.dom),
    };
  }

  const NULL_INPUT = { mx: 0, mz: 0, jump: false, dash: false, light: false, heavy: false, guard: false, s1: false, s2: false, s3: false, dom: false };

  /* ================= THREE SETUP ================= */
  function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e1c, 0.011);
    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.copy(camPos);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    document.getElementById('game').appendChild(renderer.domElement);

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    clock = new THREE.Clock();
    buildArena();
    initParticles();

    flashLight = new THREE.PointLight(0xffffff, 0, 40);
    flashLight.position.set(0, 4, 0);
    scene.add(flashLight);
  }

  /* ================= ARENA ================= */
  function groundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#20242e';
    g.fillRect(0, 0, 1024, 1024);
    // asphalt noise
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = 'rgba(' + (30 + Math.random() * 40 | 0) + ',' + (32 + Math.random() * 42 | 0) + ',' + (40 + Math.random() * 50 | 0) + ',0.25)';
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    // crosswalk stripes
    g.fillStyle = 'rgba(210,214,225,0.22)';
    for (let i = 0; i < 10; i++) g.fillRect(300, 130 + i * 80, 424, 26);
    // center circle marking
    g.strokeStyle = 'rgba(120,180,255,0.25)';
    g.lineWidth = 10;
    g.beginPath(); g.arc(512, 512, 380, 0, Math.PI * 2); g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function windowTexture(hue) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0e18';
    g.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 248; y += 18) {
      for (let x = 8; x < 120; x += 16) {
        if (Math.random() < 0.55) {
          const warm = Math.random() < 0.6;
          g.fillStyle = warm ? 'rgba(255,214,140,' + rand(0.35, 0.95) + ')' : 'rgba(' + hue + ',' + rand(0.35, 0.9) + ')';
          g.fillRect(x, y, 10, 12);
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function skyTexture() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#040613');
    gr.addColorStop(0.55, '#0b1230');
    gr.addColorStop(1, '#1c2547');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function buildArena() {
    // lights
    arena.hemi = new THREE.HemisphereLight(0x8fa3d0, 0x1a1626, 0.75);
    scene.add(arena.hemi);
    arena.moonLight = new THREE.DirectionalLight(0xbdd3ff, 1.15);
    arena.moonLight.position.set(14, 26, 10);
    arena.moonLight.castShadow = true;
    arena.moonLight.shadow.mapSize.set(1024, 1024);
    arena.moonLight.shadow.camera.left = -24;
    arena.moonLight.shadow.camera.right = 24;
    arena.moonLight.shadow.camera.top = 24;
    arena.moonLight.shadow.camera.bottom = -24;
    arena.moonLight.shadow.camera.far = 80;
    scene.add(arena.moonLight);
    arena.rimCyan = new THREE.PointLight(0x2266ff, 0.5, 60);
    arena.rimCyan.position.set(-20, 8, -16);
    scene.add(arena.rimCyan);
    arena.rimRed = new THREE.PointLight(0xff3322, 0.4, 60);
    arena.rimRed.position.set(20, 8, 16);
    scene.add(arena.rimRed);

    // ground
    arena.groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.92, color: 0xffffff });
    arena.ground = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R + 9, 48), arena.groundMat);
    arena.ground.rotation.x = -Math.PI / 2;
    arena.ground.receiveShadow = true;
    scene.add(arena.ground);

    // arena boundary ring
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3f6dff, transparent: true, opacity: 0.35 });
    arena.ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_R - 0.18, ARENA_R + 0.18, 64), ringMat);
    arena.ring.rotation.x = -Math.PI / 2;
    arena.ring.position.y = 0.02;
    scene.add(arena.ring);

    // city
    arena.city = new THREE.Group();
    const hues = ['140,220,255', '255,150,180', '160,255,200'];
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2 + rand(-0.06, 0.06);
      const dist = rand(34, 54);
      const w = rand(5, 10), h = rand(8, 26), d = rand(5, 10);
      const tex = windowTexture(hues[i % 3]);
      tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(2, Math.round(h / 5)));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const bmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0x1a2028, emissiveIntensity: 0.3 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
      b.position.set(Math.cos(ang) * dist, h / 2 - 0.5, Math.sin(ang) * dist);
      b.rotation.y = -ang + Math.PI / 2;
      arena.city.add(b);
    }
    scene.add(arena.city);

    // sky dome + stars + moon
    arena.sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 24, 12),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
    );
    scene.add(arena.sky);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 420; i++) {
      const a = rand(0, Math.PI * 2), e = rand(0.1, 1.4), r = 140;
      starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    arena.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
    scene.add(arena.stars);

    const moonMat = new THREE.MeshBasicMaterial({ color: 0xf4f0e0, fog: false });
    arena.moon = new THREE.Mesh(new THREE.CircleGeometry(7, 24), moonMat);
    arena.moon.position.set(60, 70, -100);
    arena.moon.lookAt(0, 0, 0);
    scene.add(arena.moon);

    buildVoidGroup();
    buildShrineGroup();
  }

  function buildVoidGroup() {
    arena.voidGroup = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#030108';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      const a = Math.random();
      g.fillStyle = a < 0.5 ? 'rgba(150,120,255,' + rand(0.1, 0.7) + ')' : 'rgba(255,255,255,' + rand(0.1, 0.6) + ')';
      const s = Math.random() < 0.92 ? 1 : 2;
      g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
    }
    // nebula wisps
    for (let i = 0; i < 14; i++) {
      const gr = g.createRadialGradient(Math.random() * 512, Math.random() * 512, 2, Math.random() * 512, Math.random() * 512, rand(40, 110));
      gr.addColorStop(0, 'rgba(' + (Math.random() < 0.5 ? '120,60,220' : '40,80,200') + ',0.12)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 512);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
    arena.voidGroup.add(sphere);
    arena.voidSphere = sphere;
    arena.voidGroup.visible = false;
    scene.add(arena.voidGroup);
  }

  function buildShrineGroup() {
    const grp = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.8 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xcfc4a8, roughness: 0.85 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 5), dark);
    base.position.y = 0.4;
    grp.add(base);
    for (const px of [-2.8, 2.8]) {
      for (const pz of [-1.7, 1.7]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.4, 8), dark);
        col.position.set(px, 2.9, pz);
        grp.add(col);
      }
    }
    const roof1 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 6.4), dark);
    roof1.position.y = 5.3;
    grp.add(roof1);
    const roof2 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 4.8), dark);
    roof2.position.y = 6.4;
    grp.add(roof2);
    const roofTop = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), dark);
    roofTop.position.y = 7.4;
    roofTop.rotation.y = Math.PI / 4;
    grp.add(roofTop);
    // horns
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 6), bone);
      horn.position.set(s * 3.4, 6.4, 0);
      horn.rotation.z = -s * 0.5;
      grp.add(horn);
      // skulls along base
      for (let i = 0; i < 3; i++) {
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), bone);
        skull.position.set(s * (1 + i * 1.1), 0.95, 2.3);
        grp.add(skull);
      }
    }
    grp.visible = false;
    grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    arena.shrine = grp;
    scene.add(grp);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2211, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    arena.shrineRing = new THREE.Mesh(new THREE.RingGeometry(13.7, 14.15, 64), ringMat);
    arena.shrineRing.rotation.x = -Math.PI / 2;
    arena.shrineRing.position.y = 0.04;
    arena.shrineRing.visible = false;
    scene.add(arena.shrineRing);
  }

  /* ================= PARTICLES ================= */
  let pool = [];
  let particleTex = null;

  function initParticles() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    particleTex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 260; i++) {
      const mat = new THREE.SpriteMaterial({ map: particleTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      pool.push({ sprite: s, alive: false, vel: V3(), life: 0, life0: 1, size: 1, gravity: 0, damp: 1 });
    }
  }

  function spawnP(pos, vel, life, size, color, opts) {
    opts = opts || {};
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.alive) {
        p.alive = true;
        p.sprite.visible = true;
        p.sprite.position.copy(pos);
        p.vel.copy(vel);
        p.life = p.life0 = life;
        p.size = size;
        p.gravity = opts.gravity || 0;
        p.damp = opts.damp !== undefined ? opts.damp : 1;
        p.sprite.material.color.set(color);
        p.sprite.material.opacity = 1;
        p.sprite.scale.set(size, size, 1);
        return;
      }
    }
  }

  function burst(pos, color, n, speed, life, size, opts) {
    // burstV is dedicated scratch: callers often pass tmpV as pos
    for (let i = 0; i < n; i++) {
      burstV.set(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.3, speed));
      spawnP(pos, burstV, rand(life * 0.5, life), rand(size * 0.5, size), color, opts);
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; p.sprite.visible = false; continue; }
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.damp, dt * 60));
      p.sprite.position.addScaledVector(p.vel, dt);
      const t = p.life / p.life0;
      p.sprite.material.opacity = t;
      const s = p.size * (0.4 + 0.6 * t);
      p.sprite.scale.set(s, s, 1);
    }
  }

  /* ================= EFFECTS ================= */
  function addEffect(e) { effects.push(e); }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      if (!effects[i].update(dt)) {
        if (effects[i].dispose) effects[i].dispose();
        effects.splice(i, 1);
      }
    }
  }

  function spawnRing(pos, color, maxR, dur, vertical) {
    const geo = new THREE.RingGeometry(0.35, 0.55, 40);
    const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    if (vertical) m.lookAt(camera.position); else { m.rotation.x = -Math.PI / 2; m.position.y = Math.max(0.05, pos.y); }
    scene.add(m);
    let t = 0;
    addEffect({
      update(dt) {
        t += dt;
        const k = t / dur;
        if (k >= 1) return false;
        const s = 0.5 + k * maxR;
        m.scale.set(s, s, 1);
        mat.opacity = 0.9 * (1 - k);
        return true;
      },
      dispose() { scene.remove(m); geo.dispose(); mat.dispose(); },
    });
  }

  function spawnSlashArc(pos, color, big) {
    const w = big ? rand(2.6, 4.2) : rand(1.4, 2.2);
    const geo = new THREE.PlaneGeometry(w, w * 0.09);
    const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    scene.add(m);
    let t = 0;
    const dur = 0.16;
    addEffect({
      update(dt) {
        t += dt;
        if (t >= dur) return false;
        mat.opacity = 1 - t / dur;
        m.scale.x = 1 + t * 6;
        return true;
      },
      dispose() { scene.remove(m); geo.dispose(); mat.dispose(); },
    });
  }

  function flashAt(pos, color, intensity, dur) {
    flashLight.position.copy(pos);
    flashLight.position.y += 1.5;
    flashLight.color.set(color);
    flashLight.intensity = intensity;
    let t = 0;
    addEffect({
      update(dt) {
        t += dt;
        if (t >= dur) { flashLight.intensity = 0; return false; }
        flashLight.intensity = intensity * (1 - t / dur);
        return true;
      },
    });
  }

  function addShake(mag, dur) {
    shake.mag = Math.max(shake.mag, mag);
    shake.t = Math.max(shake.t, dur);
  }

  // fade driven from the game loop (CSS transitions can stall on heavy frames)
  function screenFlash(color, dur) {
    ui.flash.style.background = color;
    flashFx.alpha = 0.85;
    flashFx.rate = 0.85 / Math.max(0.05, dur);
  }

  function updateFlash(rawDt) {
    if (flashFx.alpha <= 0) return;
    flashFx.alpha = Math.max(0, flashFx.alpha - flashFx.rate * rawDt);
    ui.flash.style.opacity = flashFx.alpha;
  }

  /* ================= FIGHTERS ================= */
  function createFighter(charKey, idx) {
    const model = charKey === 'gojo' ? CharFactory.buildGojo() : CharFactory.buildSukuna();
    scene.add(model.group);
    const f = {
      idx: idx,
      charKey: charKey,
      cfg: CHARS[charKey],
      model: model,
      pos: V3(),
      vel: V3(),
      facing: 0,
      hp: MAX_HP,
      displayHp: MAX_HP,
      ce: 50,
      onGround: true,
      state: 'idle', // idle|dash|attack|skill|guard|hitstun|knockdown|stunned|domainCast|ko|win|repelled
      action: null,  // {name,t,dur,data}
      cds: { s1: 0, s2: 0, s3: 0 },
      guarding: false,
      guardBreakT: 0,
      invulnT: 0,
      stunT: 0,
      comboHits: 0,
      aura: 0,
      animName: 'idle',
      animSpeed: 1,
      animStrafe: 0,
      animSeed: rand(0, 10),
      ai: null,
      input: NULL_INPUT,
      buffer: { jump: 0, dash: 0, light: 0, heavy: 0, s1: 0, s2: 0, s3: 0, dom: 0 },
    };
    return f;
  }

  function opponentOf(f) { return fighters[1 - f.idx]; }

  function resetFighter(f, x, z, faceAngle) {
    f.pos.set(x, 0, z);
    f.vel.set(0, 0, 0);
    f.hp = MAX_HP;
    f.displayHp = MAX_HP;
    f.ce = 50;
    f.state = 'idle';
    f.action = null;
    f.cds = { s1: 0, s2: 0, s3: 0 };
    f.guarding = false;
    f.guardBreakT = 0;
    f.invulnT = 0;
    f.stunT = 0;
    f.onGround = true;
    f.facing = faceAngle;
    f.animName = 'idle';
    f.model.group.position.copy(f.pos);
    f.model.group.rotation.y = faceAngle;
    f.model.rig.body.rotation.x = 0;
    if (f.ai) f.ai = makeAI(mode.difficulty);
  }

  /* ================= DAMAGE ================= */
  // opts: {kb, kbUp, hitstun, melee, knockdown, dot, noFloor, ignoreGuard, infCost}
  function dealDamage(target, attacker, amount, opts) {
    opts = opts || {};
    if (target.invulnT > 0 && !opts.dot) return { missed: true };
    if (target.state === 'ko' || gameState !== 'fight') return { missed: true };

    // --- guard interactions ---
    if (target.guarding && !opts.ignoreGuard) {
      if (target.charKey === 'gojo') {
        // INFINITY: attacks stop before reaching him
        const cost = opts.infCost !== undefined ? opts.infCost : (opts.melee ? 6 : 8);
        if (target.ce >= cost) {
          target.ce -= cost;
          infinityRipple(target, attacker);
          if (opts.melee && attacker) {
            // attacker's blow halts at Infinity — brief stagger
            startAction(attacker, 'repelled', 0.45);
            attacker.state = 'repelled';
          }
          return { blocked: true, infinity: true };
        }
        // not enough CE: guard shatters
        target.guarding = false;
        target.guardBreakT = 1.2;
        startAction(target, 'guardBreak', 1.2);
        target.state = 'hitstun';
        amount *= 0.6;
        announce('INFINITY BREAKS!', '', 1.0, 'sub');
      } else {
        // Sukuna blocks: heavy reduction + chip
        AudioSys.block();
        burst(tmpV.copy(target.pos).setY(1.2), 0xffcc66, 6, 4, 0.3, 0.5);
        amount *= 0.15;
        target.hp = Math.max(1, target.hp - amount);
        target.ce = Math.min(MAX_CE, target.ce + 2);
        pushBack(target, attacker, (opts.kb || 6) * 0.4, 0);
        return { blocked: true };
      }
    }

    // --- black flash ---
    let blackFlash = false;
    if (opts.melee && attacker && Math.random() < BLACK_FLASH_CHANCE) {
      blackFlash = true;
      amount *= 2.5;
      attacker.ce = Math.min(MAX_CE, attacker.ce + 15);
      blackFlashFX(target.pos);
    }

    if (domain && domain.key === 'void' && attacker === domain.owner && opts.melee) amount *= 1.25;

    target.hp -= amount;
    if (opts.dot && !opts.noFloor) target.hp = Math.max(1, target.hp);
    if (attacker) attacker.ce = Math.min(MAX_CE, attacker.ce + (opts.melee ? 8 : 5));
    target.ce = Math.min(MAX_CE, target.ce + 3);

    // interrupt target action (domain casts have super armor)
    const armored = target.action && target.action.data && target.action.data.armor;
    if (!opts.dot && !armored) {
      target.action = null;
      target.guarding = false;
      if (opts.knockdown || blackFlash) {
        startAction(target, 'knockdown', 1.25);
        target.state = 'knockdown';
        target.invulnT = 1.0;
      } else if (target.state !== 'stunned') {
        startAction(target, 'hitstun', opts.hitstun || 0.34);
        target.state = 'hitstun';
      }
      pushBack(target, attacker, opts.kb || 4, opts.kbUp || 0);
    }

    if (target.hp <= 0) {
      target.hp = 0;
      koFighter(target);
    }
    return { hit: true, blackFlash: blackFlash, dmg: amount };
  }

  function pushBack(target, attacker, kb, kbUp) {
    if (!attacker) return;
    tmpV.subVectors(target.pos, attacker.pos);
    tmpV.y = 0;
    if (tmpV.lengthSq() < 0.001) tmpV.set(0, 0, 1);
    tmpV.normalize();
    target.vel.x += tmpV.x * kb;
    target.vel.z += tmpV.z * kb;
    target.vel.y += kbUp;
    if (kbUp > 0) target.onGround = false;
  }

  function infinityRipple(gojoF, attacker) {
    AudioSys.block();
    tmpV.copy(gojoF.pos);
    if (attacker) tmpV.lerp(attacker.pos, 0.4);
    tmpV.y = 1.3;
    spawnRing(tmpV, 0xbfaaff, 3.2, 0.35, true);
    burst(tmpV, 0x9f88ff, 10, 5, 0.35, 0.55);
  }

  function blackFlashFX(pos) {
    AudioSys.blackFlash();
    addShake(0.55, 0.45);
    slowmo.t = 0.35;
    slowmo.factor = 0.25;
    screenFlash('#000', 0.5);
    tmpV.copy(pos); tmpV.y = 1.3;
    burst(tmpV, 0xff2222, 22, 12, 0.5, 0.9);
    burst(tmpV, 0x220011, 14, 8, 0.55, 1.3);
    spawnRing(tmpV, 0xff1111, 5, 0.4, true);
    flashAt(pos, 0xff2222, 6, 0.4);
    announce('BLACK FLASH', '', 0.9, 'bf');
  }

  function koFighter(target) {
    target.state = 'ko';
    target.action = null;
    target.animName = 'knockdown';
    AudioSys.ko();
    addShake(0.7, 0.8);
    slowmo.t = 1.3;
    slowmo.factor = 0.3;
    endDomain();
    beginRoundEnd(opponentOf(target));
  }

  /* ================= ACTIONS & SKILLS ================= */
  function startAction(f, name, dur, data) {
    f.action = { name: name, t: 0, dur: dur, data: data || {} };
  }

  function crossed(act, threshold, dt) {
    return act.t >= threshold && act.t - dt < threshold;
  }

  function canAct(f) {
    return !f.action && f.state !== 'hitstun' && f.state !== 'knockdown' && f.state !== 'stunned' && f.state !== 'ko' && f.state !== 'win' && f.state !== 'repelled' && gameState === 'fight';
  }

  function meleeStrike(f, dmg, range, opts) {
    const o = opponentOf(f);
    const d = distXZ(f.pos, o.pos);
    if (d <= range && Math.abs(f.pos.y - o.pos.y) < 1.8) {
      const res = dealDamage(o, f, dmg, Object.assign({ melee: true }, opts));
      if (res.hit) {
        AudioSys.hit();
        tmpV.copy(o.pos); tmpV.y = 1.3;
        burst(tmpV, f.cfg.color, 8, 6, 0.3, 0.55);
        spawnSlashArc(tmpV, 0xffffff, false);
        addShake(0.12, 0.15);
      }
      return res;
    }
    AudioSys.swoosh();
    return { missed: true };
  }

  function trySkill(f, slot) {
    const sk = f.cfg.skills[slot];
    if (f.cds[slot] > 0 || f.ce < sk.ce) return;
    f.ce -= sk.ce;
    f.cds[slot] = sk.cd;
    f.state = 'skill';
    if (f.charKey === 'gojo') {
      if (slot === 's1') startAction(f, 'blue', 0.65);
      else if (slot === 's2') startAction(f, 'red', 0.6);
      else if (slot === 's3') { startAction(f, 'purple', 1.45); AudioSys.charge(1.0); }
    } else {
      if (slot === 's1') startAction(f, 'dismantle', 0.5);
      else if (slot === 's2') startAction(f, 'cleave', 0.0); // dur set below
      else if (slot === 's3') { startAction(f, 'fuga', 1.15); AudioSys.charge(0.7); }
    }
    if (f.charKey === 'sukuna' && slot === 's2') {
      const o = opponentOf(f);
      if (distXZ(f.pos, o.pos) < 5.5) {
        // blink to target and flurry
        tmpV.subVectors(f.pos, o.pos).setY(0);
        if (tmpV.lengthSq() < 0.01) tmpV.set(0, 0, 1);
        tmpV.normalize().multiplyScalar(1.25);
        f.pos.set(o.pos.x + tmpV.x, 0, o.pos.z + tmpV.z);
        f.vel.set(0, 0, 0);
        AudioSys.dash();
        startAction(f, 'cleaveFlurry', 1.0);
      } else {
        startAction(f, 'cleaveWave', 0.45);
      }
    }
  }

  function tryDomain(f) {
    if (f.ce < MAX_CE) return;
    if (domain && domain.owner === f) return;
    f.ce = 0;
    f.state = 'domainCast';
    startAction(f, 'domainCast', 1.35, { armor: true });
    AudioSys.domain();
    announce('DOMAIN EXPANSION', f.cfg.skills.dom.name, 1.6, f.charKey === 'gojo' ? 'void' : 'shrine');
    addShake(0.25, 1.2);
  }

  /* ---------- projectiles ---------- */
  function projMesh(type, color) {
    let m;
    if (type === 'slash') {
      m = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.28), new THREE.MeshBasicMaterial({ color: color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false }));
      m.rotation.z = rand(-0.5, 0.5);
    } else {
      m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false }));
    }
    scene.add(m);
    return m;
  }

  function spawnProjectile(cfg) {
    const p = {
      owner: cfg.owner,
      pos: cfg.pos.clone(),
      vel: cfg.vel.clone(),
      r: cfg.r,
      visR: cfg.visR || cfg.r,
      dmg: cfg.dmg,
      kb: cfg.kb || 6,
      kbUp: cfg.kbUp || 2,
      life: cfg.life || 2.5,
      pierce: !!cfg.pierce,
      hitSet: new Set(),
      type: cfg.type,
      color: cfg.color,
      trailColor: cfg.trailColor || cfg.color,
      infCost: cfg.infCost,
      knockdown: !!cfg.knockdown,
      groundExplode: !!cfg.groundExplode,
      onImpact: cfg.onImpact || null,
      mesh: projMesh(cfg.type === 'slash' ? 'slash' : 'orb', cfg.color),
      trailT: 0,
    };
    p.mesh.position.copy(p.pos);
    if (cfg.type !== 'slash') p.mesh.scale.setScalar(p.visR);
    else p.mesh.lookAt(tmpV.copy(p.pos).add(p.vel));
    projectiles.push(p);
    return p;
  }

  function explodeAt(pos, owner, maxDmg, radius, color) {
    AudioSys.explosion();
    addShake(0.5, 0.5);
    flashAt(pos, color, 8, 0.6);
    spawnRing(tmpV.copy(pos).setY(0.1), color, radius * 1.6, 0.55, false);
    spawnRing(tmpV.copy(pos).setY(1), color, radius * 1.2, 0.45, true);
    burst(tmpV.copy(pos).setY(1), color, 26, 14, 0.7, 1.2, { gravity: -8 });
    burst(tmpV.copy(pos).setY(1), 0xffaa44, 18, 10, 0.6, 1.0);
    for (const f of fighters) {
      if (f === owner) continue;
      const d = f.pos.distanceTo(pos);
      if (d < radius) {
        const dmg = maxDmg * (1 - 0.55 * (d / radius));
        dealDamage(f, owner, dmg, { kb: 14, kbUp: 8, knockdown: true, infCost: 35 });
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      // trail
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.02;
        tmpV2.set(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3));
        spawnP(tmpV.copy(p.pos).add(tmpV2), tmpV2.multiplyScalar(2), 0.3, p.visR * 0.9, p.trailColor);
      }
      let dead = false;

      // fighter collisions
      for (const f of fighters) {
        if (f === p.owner || p.hitSet.has(f)) continue;
        tmpV.subVectors(f.pos, p.pos);
        tmpV.y = f.pos.y + 1.0 - p.pos.y;
        if (tmpV.length() < p.r + 0.75) {
          if (f.guarding && f.charKey === 'gojo') {
            // Infinity stops projectiles
            const cost = p.infCost !== undefined ? p.infCost : 8;
            if (f.ce >= cost) {
              f.ce -= cost;
              infinityRipple(f, null);
              burst(p.pos, 0xbfaaff, 10, 6, 0.4, 0.7);
              dead = true;
              break;
            }
            f.guarding = false;
            f.guardBreakT = 1.2;
            startAction(f, 'guardBreak', 1.2);
            f.state = 'hitstun';
            announce('INFINITY BREAKS!', '', 1.0, 'sub');
          }
          p.hitSet.add(f);
          if (p.onImpact) {
            p.onImpact(f, p.pos);
          } else {
            dealDamage(f, p.owner, p.dmg, { kb: p.kb, kbUp: p.kbUp, knockdown: p.knockdown, infCost: p.infCost });
            if (p.type === 'slash') AudioSys.slash(); else AudioSys.blast(200);
            burst(p.pos, p.color, 12, 8, 0.4, 0.8);
            spawnSlashArc(tmpV.copy(f.pos).setY(1.3), p.color, false);
            addShake(0.2, 0.2);
          }
          if (!p.pierce) dead = true;
          break;
        }
      }

      if (!dead && p.groundExplode && p.pos.y <= 0.25) {
        if (p.onImpact) p.onImpact(null, p.pos);
        dead = true;
      }
      if (!dead && (p.life <= 0 || p.pos.length() > 90)) {
        if (p.groundExplode && p.onImpact) p.onImpact(null, p.pos);
        dead = true;
      }
      if (dead) {
        scene.remove(p.mesh);
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
        projectiles.splice(i, 1);
      }
    }
  }

  function forwardOf(f) {
    return tmpV2.set(Math.sin(f.facing), 0, Math.cos(f.facing)).clone();
  }

  /* ---------- per-action update ---------- */
  function updateAction(f, dt) {
    const act = f.action;
    if (!act) return;
    act.t += dt;
    const o = opponentOf(f);
    const fw = forwardOf(f);

    switch (act.name) {
      /* ----- shared melee ----- */
      case 'light1':
      case 'light2':
      case 'light3': {
        const step = act.name === 'light1' ? 0 : act.name === 'light2' ? 1 : 2;
        f.animName = ['light1', 'light2', 'light3'][step];
        const hitT = [0.13, 0.13, 0.2][step];
        const dmg = [30, 35, 52][step];
        if (crossed(act, hitT, dt)) {
          const opts = step === 2 ? { kb: 8, kbUp: 4, hitstun: 0.4 } : { kb: 3 };
          meleeStrike(f, dmg, 2.1, opts);
          // small forward lunge
          f.vel.x += fw.x * 3; f.vel.z += fw.z * 3;
        }
        if (f.buffer.light > 0 && act.t > hitT * 0.6 && step < 2) { act.data.next = true; f.buffer.light = 0; }
        if (act.t >= act.dur) {
          if (act.data.next) {
            startAction(f, step === 0 ? 'light2' : 'light3', step === 0 ? 0.34 : 0.48);
            f.state = 'attack';
          } else { f.action = null; f.state = 'idle'; }
        }
        break;
      }
      case 'heavy': {
        f.animName = act.t < 0.26 ? 'heavy' : (f.charKey === 'sukuna' ? 'slashR' : 'heavyHit');
        if (crossed(act, 0.28, dt)) {
          const res = meleeStrike(f, 92, 2.4, { kb: 13, kbUp: 6, knockdown: true });
          if (res.hit) { AudioSys.heavyHit(); addShake(0.3, 0.25); }
          f.vel.x += fw.x * 4.5; f.vel.z += fw.z * 4.5;
          if (f.charKey === 'sukuna') spawnSlashArc(tmpV.copy(f.pos).addScaledVector(fw, 1.5).setY(1.3), 0xff5540, true);
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; }
        break;
      }
      case 'repelled':
      case 'hitstun':
      case 'guardBreak': {
        f.animName = 'hitstun';
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; }
        break;
      }
      case 'knockdown': {
        f.animName = 'knockdown';
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; f.invulnT = Math.max(f.invulnT, 0.35); }
        break;
      }

      /* ----- GOJO ----- */
      case 'blue': {
        f.animName = 'castForward';
        if (crossed(act, 0.3, dt)) {
          AudioSys.blast(420);
          spawnBlueVortex(f, o.pos.clone());
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; }
        break;
      }
      case 'red': {
        f.animName = 'castForward';
        if (crossed(act, 0.34, dt)) {
          AudioSys.blast(160);
          addShake(0.2, 0.2);
          const start = f.pos.clone().addScaledVector(fw, 1.2).setY(1.35);
          tmpV.subVectors(o.pos, f.pos).setY(0).normalize();
          spawnProjectile({
            owner: f, pos: start, vel: tmpV.clone().multiplyScalar(30),
            r: 0.7, visR: 0.55, dmg: 120, kb: 22, kbUp: 9, knockdown: true,
            color: 0xff3344, trailColor: 0xff6677, type: 'orb', life: 2.2, infCost: 20,
          });
          burst(start, 0xff3344, 10, 6, 0.3, 0.7);
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; }
        break;
      }
      case 'purple': {
        f.animName = 'castCharge';
        // charge FX
        if (act.t < 1.0) {
          f.aura = 1;
          if (Math.random() < 0.5) {
            const hp = f.pos.clone().addScaledVector(fw, 0.9).setY(1.5);
            spawnP(hp.clone().add(tmpV.set(rand(-1.4, 1.4), rand(-1, 1.4), rand(-1.4, 1.4))), tmpV.multiplyScalar(-3), 0.3, 0.6, Math.random() < 0.5 ? 0x4fd4ff : 0xff3344);
          }
        }
        if (crossed(act, 1.0, dt)) {
          AudioSys.blast(90);
          AudioSys.explosion();
          addShake(0.6, 0.7);
          screenFlash('rgba(160,60,255,0.5)', 0.6);
          const start = f.pos.clone().addScaledVector(fw, 1.6).setY(1.4);
          tmpV.subVectors(o.pos, f.pos).setY(0).normalize();
          spawnProjectile({
            owner: f, pos: start, vel: tmpV.clone().multiplyScalar(23),
            r: 2.4, visR: 2.1, dmg: 260, kb: 26, kbUp: 12, knockdown: true, pierce: true,
            color: 0xa22cff, trailColor: 0xc06bff, type: 'orb', life: 4, infCost: 45,
          });
          flashAt(start, 0xa22cff, 10, 0.8);
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; f.aura = 0; }
        break;
      }

      /* ----- SUKUNA ----- */
      case 'dismantle': {
        f.animName = act.t < 0.2 ? 'slashL' : 'slashR';
        if (crossed(act, 0.22, dt)) {
          AudioSys.slash();
          const base = Math.atan2(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
          for (let k = -1; k <= 1; k++) {
            const a = base + k * 0.14;
            const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
            spawnProjectile({
              owner: f, pos: f.pos.clone().addScaledVector(dir, 1.2).setY(1.3),
              vel: dir.multiplyScalar(34), r: 0.6, visR: 0.6, dmg: 45, kb: 7, kbUp: 2,
              color: 0xff4433, trailColor: 0xff7766, type: 'slash', life: 1.6, infCost: 8,
            });
          }
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; }
        break;
      }
      case 'cleaveFlurry': {
        f.animName = Math.floor(act.t / 0.14) % 2 === 0 ? 'slashR' : 'slashL';
        for (let n = 0; n < 5; n++) {
          if (crossed(act, 0.12 + n * 0.14, dt)) {
            AudioSys.slash();
            const res = meleeStrike(f, 22, 2.6, { kb: 1, hitstun: 0.25, infCost: 6 });
            if (res.hit) spawnSlashArc(tmpV.copy(o.pos).setY(rand(0.8, 1.7)), 0xff4433, false);
          }
        }
        if (crossed(act, 0.88, dt)) {
          AudioSys.heavyHit();
          meleeStrike(f, 42, 2.8, { kb: 12, kbUp: 5, knockdown: true, infCost: 10 });
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; }
        break;
      }
      case 'cleaveWave': {
        f.animName = 'slashR';
        if (crossed(act, 0.2, dt)) {
          AudioSys.slash();
          tmpV.subVectors(o.pos, f.pos).setY(0).normalize();
          spawnProjectile({
            owner: f, pos: f.pos.clone().addScaledVector(tmpV, 1.2).setY(1.3),
            vel: tmpV.clone().multiplyScalar(30), r: 1.0, visR: 1.0, dmg: 72, kb: 10, kbUp: 4, knockdown: true,
            color: 0xff2222, trailColor: 0xff5544, type: 'slash', life: 1.8, infCost: 14,
          });
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; }
        break;
      }
      case 'fuga': {
        f.animName = 'bowDraw';
        if (act.t < 0.7) {
          f.aura = 1;
          if (Math.random() < 0.6) {
            const hp = f.pos.clone().addScaledVector(fw, 0.8).setY(1.4);
            spawnP(hp.clone().add(tmpV.set(rand(-1.2, 1.2), rand(-0.8, 1.2), rand(-1.2, 1.2))), tmpV.multiplyScalar(-3.5), 0.28, 0.6, Math.random() < 0.6 ? 0xff6a1a : 0xffc040);
          }
        }
        if (crossed(act, 0.7, dt)) {
          AudioSys.blast(300);
          addShake(0.3, 0.3);
          const start = f.pos.clone().addScaledVector(fw, 1.4).setY(1.4);
          tmpV.subVectors(o.pos, f.pos).setY(0).normalize();
          spawnProjectile({
            owner: f, pos: start, vel: tmpV.clone().multiplyScalar(40),
            r: 0.6, visR: 0.5, dmg: 0, color: 0xff6a1a, trailColor: 0xffa040, type: 'orb', life: 2.5,
            groundExplode: true, infCost: 35,
            onImpact: function (hitF, point) {
              explodeAt(point.clone(), f, hitF ? 230 : 200, 5, 0xff6a1a);
            },
          });
          flashAt(start, 0xff6a1a, 6, 0.4);
        }
        if (act.t >= act.dur) { f.action = null; f.state = 'idle'; f.aura = 0; }
        break;
      }

      /* ----- DOMAIN cast ----- */
      case 'domainCast': {
        f.animName = 'domainSign';
        f.aura = 1;
        if (Math.random() < 0.7) {
          spawnP(f.pos.clone().add(tmpV.set(rand(-1.5, 1.5), rand(0, 2.2), rand(-1.5, 1.5))), tmpV.set(0, rand(1, 3), 0), 0.5, 0.8, f.cfg.color);
        }
        if (act.t >= act.dur) {
          f.action = null;
          f.state = 'idle';
          f.aura = 0;
          activateDomain(f);
        }
        break;
      }
    }
  }

  /* ---------- Blue vortex (effect entity) ---------- */
  function spawnBlueVortex(owner, targetPos) {
    targetPos.y = 1.2;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), new THREE.MeshBasicMaterial({ color: 0x2fa8ff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false }));
    core.position.copy(targetPos);
    scene.add(core);
    flashAt(targetPos, 0x2fa8ff, 5, 0.5);
    let t = 0;
    const DUR = 1.5;
    let tickT = 0;
    addEffect({
      update(dt) {
        t += dt;
        if (t >= DUR) {
          // implosion pop
          AudioSys.blast(500);
          spawnRing(targetPos, 0x2fa8ff, 5, 0.4, true);
          burst(targetPos, 0x6fc8ff, 18, 10, 0.5, 0.9);
          for (const f of fighters) {
            if (f === owner) continue;
            if (f.pos.distanceTo(targetPos) < 3) dealDamage(f, owner, 45, { kb: 6, kbUp: 5, infCost: 12 });
          }
          return false;
        }
        core.scale.setScalar(1 + Math.sin(t * 20) * 0.15 + t * 0.5);
        // swirl particles
        if (Math.random() < 0.8) {
          const a = rand(0, Math.PI * 2);
          const r = rand(2, 5);
          tmpV.set(targetPos.x + Math.cos(a) * r, targetPos.y + rand(-1, 1), targetPos.z + Math.sin(a) * r);
          tmpV2.subVectors(targetPos, tmpV).normalize().multiplyScalar(7);
          spawnP(tmpV, tmpV2, 0.5, 0.5, 0x55bbff);
        }
        // pull opponent
        for (const f of fighters) {
          if (f === owner || f.state === 'ko') continue;
          const d = f.pos.distanceTo(targetPos);
          if (d < 8 && !(f.guarding && f.charKey === 'gojo')) {
            tmpV.subVectors(targetPos, f.pos).setY(0).normalize();
            const pull = 34 * (1 - d / 9);
            f.vel.x += tmpV.x * pull * dt * 3.2;
            f.vel.z += tmpV.z * pull * dt * 3.2;
            tickT -= dt;
            if (d < 2.4 && tickT <= 0) {
              tickT = 0.28;
              dealDamage(f, owner, 9, { kb: 0, hitstun: 0.2, infCost: 5 });
              AudioSys.hit();
            }
          }
        }
        return true;
      },
      dispose() { scene.remove(core); core.geometry.dispose(); core.material.dispose(); },
    });
  }

  /* ================= DOMAINS ================= */
  function activateDomain(f) {
    if (gameState !== 'fight') return;
    if (domain && domain.owner !== f) { resolveClash(f); return; }
    const key = f.charKey === 'gojo' ? 'void' : 'shrine';
    domain = { owner: f, key: key, t: 0, dur: 6.5, tick: 0, center: f.pos.clone() };
    screenFlash(key === 'void' ? 'rgba(255,255,255,0.95)' : 'rgba(255,30,20,0.7)', 1.0);
    addShake(0.5, 0.8);
    AudioSys.explosion();
    if (key === 'void') applyVoid(); else applyShrine(f);
  }

  function resolveClash(challenger) {
    const holder = domain.owner;
    announce('DOMAIN CLASH!', '', 1.4, 'clash');
    screenFlash('rgba(255,255,255,1)', 1.2);
    addShake(0.9, 1.0);
    AudioSys.explosion();
    slowmo.t = 0.9;
    slowmo.factor = 0.25;
    const scoreH = holder.hp / MAX_HP + rand(0, 0.55);
    const scoreC = challenger.hp / MAX_HP + rand(0, 0.55);
    endDomain();
    const winner = scoreC > scoreH ? challenger : holder;
    const loser = opponentOf(winner);
    dealDamage(loser, winner, 85, { kb: 10, kbUp: 6, knockdown: true, ignoreGuard: true });
    if (gameState !== 'fight') return; // clash burst was a KO
    // winner's domain takes hold (shortened)
    const key = winner.charKey === 'gojo' ? 'void' : 'shrine';
    domain = { owner: winner, key: key, t: 0, dur: 4.5, tick: 0, center: winner.pos.clone() };
    if (key === 'void') applyVoid(); else applyShrine(winner);
  }

  function applyVoid() {
    arena.voidGroup.visible = true;
    arena.city.visible = false;
    arena.sky.visible = false;
    arena.stars.visible = false;
    arena.moon.visible = false;
    scene.fog.color.set(0x050110);
    scene.fog.density = 0.004;
    arena.hemi.intensity = 0.35;
    arena.hemi.color.set(0x8f7fff);
    arena.moonLight.intensity = 0.7;
    arena.moonLight.color.set(0xb9a5ff);
    arena.groundMat.color.set(0x2a2140);
    arena.ring.material.color.set(0x8f6fff);
  }

  function applyShrine(f) {
    arena.shrine.visible = true;
    tmpV.copy(f.pos).setY(0);
    const outward = tmpV.lengthSq() > 0.1 ? tmpV.clone().normalize() : new THREE.Vector3(0, 0, -1);
    arena.shrine.position.copy(f.pos).addScaledVector(outward, 5.5).setY(0);
    arena.shrine.lookAt(0, 0, 0);
    arena.shrineRing.visible = true;
    arena.shrineRing.position.set(domain.center.x, 0.04, domain.center.z);
    scene.fog.color.set(0x220605);
    scene.fog.density = 0.014;
    arena.sky.visible = false;
    arena.stars.visible = false;
    arena.moon.visible = false;
    arena.hemi.intensity = 0.7;
    arena.hemi.color.set(0xff6a55);
    arena.moonLight.intensity = 1.0;
    arena.moonLight.color.set(0xff7a5a);
    arena.groundMat.color.set(0x4a2320);
    arena.ring.material.color.set(0xff4030);
  }

  function restoreArena() {
    arena.voidGroup.visible = false;
    arena.shrine.visible = false;
    arena.shrineRing.visible = false;
    arena.city.visible = true;
    arena.sky.visible = true;
    arena.stars.visible = true;
    arena.moon.visible = true;
    scene.fog.color.set(0x0a0e1c);
    scene.fog.density = 0.011;
    arena.hemi.intensity = 0.75;
    arena.hemi.color.set(0x8fa3d0);
    arena.moonLight.intensity = 1.15;
    arena.moonLight.color.set(0xbdd3ff);
    arena.groundMat.color.set(0xffffff);
    arena.ring.material.color.set(0x3f6dff);
  }

  function endDomain() {
    if (!domain) return;
    domain = null;
    restoreArena();
  }

  function updateDomain(dt) {
    if (!domain) return;
    domain.t += dt;
    const owner = domain.owner;
    const victim = opponentOf(owner);

    if (domain.key === 'void') {
      arena.voidSphere.rotation.y += dt * 0.05;
      arena.voidSphere.rotation.z += dt * 0.02;
      // victim overwhelmed by infinite information (an armored counter domain-cast resists)
      if (victim.state !== 'ko' && victim.state !== 'knockdown' && !(victim.action && victim.action.data && victim.action.data.armor)) {
        victim.state = 'stunned';
        victim.stunT = 0.4;
        victim.action = null;
        victim.guarding = false;
      }
      domain.tick -= dt;
      if (domain.tick <= 0) {
        domain.tick = 0.5;
        dealDamage(victim, owner, 8, { dot: true });
        spawnP(victim.pos.clone().add(tmpV.set(rand(-0.6, 0.6), rand(0.5, 2), rand(-0.6, 0.6))), tmpV.set(0, 1.5, 0), 0.5, 0.5, 0xbfaaff);
      }
    } else {
      // Malevolent Shrine: slashes rain inside the ring
      domain.tick -= dt;
      if (domain.tick <= 0) {
        domain.tick = 0.2;
        AudioSys.slash();
        // ambient slashes
        const a = rand(0, Math.PI * 2), r = rand(0, 13);
        tmpV.set(domain.center.x + Math.cos(a) * r, rand(0.5, 3), domain.center.z + Math.sin(a) * r);
        spawnSlashArc(tmpV, 0xff3322, Math.random() < 0.3);
        // strike victim if inside (no stagger — they can still run for the edge)
        if (distXZ(victim.pos, domain.center) < 14 && victim.state !== 'ko') {
          const res = dealDamage(victim, owner, 13, { dot: true, infCost: 8, noFloor: true });
          if (res.hit || res.blocked) spawnSlashArc(victim.pos.clone().setY(rand(0.6, 1.8)), 0xff5533, false);
        }
      }
    }

    if (!domain) return; // a DoT tick KO'd the victim: koFighter already ended the domain
    if (domain.t >= domain.dur || owner.state === 'ko') {
      endDomain();
      if (owner.state !== 'ko') announce('DOMAIN COLLAPSES', '', 1.0, 'sub');
    }
  }

  /* ================= FIGHTER UPDATE ================= */
  function updateFighter(f, dt) {
    const o = opponentOf(f);

    // cooldowns / regen / timers
    for (const k in f.cds) f.cds[k] = Math.max(0, f.cds[k] - dt);
    f.invulnT = Math.max(0, f.invulnT - dt);
    f.stunT = Math.max(0, f.stunT - dt);
    if (f.state === 'stunned' && f.stunT <= 0) f.state = 'idle';
    if (!f.guarding && !f.action) f.ce = Math.min(MAX_CE, f.ce + 5 * dt);
    f.displayHp += (f.hp - f.displayHp) * Math.min(1, dt * 6);

    // face opponent (unless down/ko)
    if (f.state !== 'ko' && f.state !== 'knockdown') {
      const target = Math.atan2(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
      let d = target - f.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      f.facing += d * Math.min(1, dt * 10);
    }

    const inp = f.input;

    // guard hold
    if (canAct(f) && inp.guard && f.guardBreakT <= 0) {
      if (!f.guarding) AudioSys.swoosh();
      f.guarding = true;
      f.state = 'guard';
      if (f.charKey === 'gojo') {
        f.ce -= 9 * dt;
        if (Math.random() < 0.25) {
          const a = rand(0, Math.PI * 2);
          spawnP(f.pos.clone().add(tmpV.set(Math.cos(a) * 1.1, rand(0.4, 1.8), Math.sin(a) * 1.1)), tmpV.set(0, 0.5, 0), 0.4, 0.35, 0x9f88ff);
        }
        if (f.ce <= 0) {
          f.ce = 0;
          f.guarding = false;
          f.guardBreakT = 1.2;
          startAction(f, 'guardBreak', 1.2);
          f.state = 'hitstun';
        }
      }
    } else if (f.guarding && (!inp.guard || !canAct(f))) {
      f.guarding = false;
      if (f.state === 'guard') f.state = 'idle';
    }
    f.guardBreakT = Math.max(0, f.guardBreakT - dt);

    // input buffer: presses made slightly early still come out (~0.3s window)
    for (const bk in f.buffer) {
      if (inp[bk]) f.buffer[bk] = 0.42;
      else if (f.buffer[bk] > 0) f.buffer[bk] -= dt;
    }
    const take = function (bk) { if (f.buffer[bk] > 0) { f.buffer[bk] = 0; return true; } return false; };

    // actions in progress
    updateAction(f, dt);

    // new intents
    if (canAct(f) && !f.guarding) {
      if (take('light')) { f.state = 'attack'; startAction(f, 'light1', 0.34); AudioSys.swoosh(); }
      else if (take('heavy')) { f.state = 'attack'; startAction(f, 'heavy', 0.62); AudioSys.swoosh(); }
      else if (take('s1')) trySkill(f, 's1');
      else if (take('s2')) trySkill(f, 's2');
      else if (take('s3')) trySkill(f, 's3');
      else if (take('dom')) tryDomain(f);
      else if (take('dash')) {
        f.state = 'dash';
        startAction(f, 'dash', 0.24);
        f.invulnT = 0.28;
        AudioSys.dash();
        // dash toward input dir or back
        const fw = forwardOf(f);
        const right = tmpV.set(fw.z, 0, -fw.x);
        tmpV2.set(0, 0, 0).addScaledVector(fw, inp.mz).addScaledVector(right, inp.mx);
        if (tmpV2.lengthSq() < 0.01) tmpV2.copy(fw).multiplyScalar(-1);
        tmpV2.normalize();
        f.vel.x = tmpV2.x * 19;
        f.vel.z = tmpV2.z * 19;
        burst(f.pos.clone().setY(0.6), 0xffffff, 6, 3, 0.25, 0.5);
      }
      else if (f.buffer.jump > 0 && f.onGround) {
        f.buffer.jump = 0;
        f.vel.y = 11.5;
        f.onGround = false;
        AudioSys.swoosh();
      }
    }
    if (f.action && f.action.name === 'dash') {
      f.animName = 'dash';
      if (f.action.t >= f.action.dur) { f.action = null; f.state = 'idle'; }
    }

    // movement
    const moving = (inp.mx !== 0 || inp.mz !== 0);
    const freeMove = canAct(f) && !f.guarding;
    if (freeMove && moving) {
      const fw = forwardOf(f);
      const right = tmpV.set(fw.z, 0, -fw.x).clone();
      tmpV2.set(0, 0, 0).addScaledVector(fw, inp.mz).addScaledVector(right, inp.mx).normalize();
      const spd = WALK_SPEED * (inp.mz < 0 ? 0.85 : 1);
      const ctrl = f.onGround ? 1 : 0.45;
      f.vel.x += (tmpV2.x * spd - f.vel.x) * Math.min(1, dt * 10) * ctrl;
      f.vel.z += (tmpV2.z * spd - f.vel.z) * Math.min(1, dt * 10) * ctrl;
      f.state = f.onGround ? 'move' : f.state;
      f.animStrafe = inp.mx;
      f.animSpeed = 1;
    } else if (f.onGround) {
      f.vel.x *= Math.pow(0.0001, dt);
      f.vel.z *= Math.pow(0.0001, dt);
    }

    // physics
    f.vel.y += GRAVITY * dt;
    f.pos.addScaledVector(f.vel, dt);
    if (f.pos.y <= 0) {
      if (!f.onGround && f.vel.y < -14) {
        addShake(0.15, 0.15);
        burst(f.pos.clone().setY(0.2), 0x888899, 8, 4, 0.3, 0.5);
      }
      f.pos.y = 0;
      f.vel.y = 0;
      f.onGround = true;
    }
    // arena bounds
    const r = Math.sqrt(f.pos.x * f.pos.x + f.pos.z * f.pos.z);
    if (r > ARENA_R) {
      f.pos.x *= ARENA_R / r;
      f.pos.z *= ARENA_R / r;
      const nx = f.pos.x / ARENA_R, nz = f.pos.z / ARENA_R;
      const dot = f.vel.x * nx + f.vel.z * nz;
      if (dot > 0) { f.vel.x -= nx * dot; f.vel.z -= nz * dot; }
    }

    // anim selection when idle-ish
    if (!f.action) {
      if (f.state === 'stunned') f.animName = 'stunned';
      else if (f.state === 'ko') f.animName = 'knockdown';
      else if (f.state === 'win') f.animName = 'victory';
      else if (f.guarding) f.animName = f.charKey === 'gojo' ? 'infinity' : 'guard';
      else if (!f.onGround) f.animName = 'jump';
      else if (moving && freeMove) f.animName = 'run';
      else f.animName = 'idle';
    }

    // aura particles for domain owners
    if (domain && domain.owner === f && Math.random() < 0.3) {
      spawnP(f.pos.clone().add(tmpV.set(rand(-0.7, 0.7), rand(0, 2), rand(-0.7, 0.7))), tmpV.set(0, rand(1, 2.5), 0), 0.5, 0.5, f.cfg.color);
    }

    // sync mesh
    f.model.group.position.copy(f.pos);
    f.model.group.rotation.y = f.facing;
    // knockdown body rotate handled by pose (bodyRotX)
  }

  function fighterCollision() {
    const a = fighters[0], b = fighters[1];
    if (a.state === 'ko' || b.state === 'ko') return;
    const d = distXZ(a.pos, b.pos);
    const minD = 0.95;
    if (d < minD && d > 0.001) {
      tmpV.subVectors(b.pos, a.pos).setY(0).normalize();
      const push = (minD - d) / 2;
      a.pos.addScaledVector(tmpV, -push);
      b.pos.addScaledVector(tmpV, push);
    }
  }

  /* ================= AI ================= */
  function makeAI(difficulty) {
    const presets = {
      easy: { think: 0.4, guardP: 0.12, aggr: 0.5, skillP: 0.4 },
      normal: { think: 0.24, guardP: 0.3, aggr: 0.75, skillP: 0.65 },
      hard: { think: 0.15, guardP: 0.55, aggr: 1, skillP: 0.85 },
    };
    return Object.assign({ t: 0, moveX: 0, moveZ: 0, guardT: 0, strafeDir: Math.random() < 0.5 ? 1 : -1 }, presets[difficulty] || presets.normal);
  }

  function aiInput(f, dt) {
    const ai = f.ai;
    const o = opponentOf(f);
    const inp = { mx: 0, mz: 0, jump: false, dash: false, light: false, heavy: false, guard: false, s1: false, s2: false, s3: false, dom: false };
    if (f.state === 'ko' || gameState !== 'fight') return inp;

    ai.t -= dt;
    ai.guardT = Math.max(0, ai.guardT - dt);
    const d = distXZ(f.pos, o.pos);

    // escape enemy shrine
    if (domain && domain.key === 'shrine' && domain.owner !== f) {
      tmpV.subVectors(f.pos, domain.center).setY(0);
      if (tmpV.length() < 14.5) {
        // run outward relative to facing (facing is toward opponent)
        const fw = forwardOf(f);
        const right = tmpV2.set(fw.z, 0, -fw.x);
        tmpV.normalize();
        inp.mz = clamp(tmpV.dot(fw) * 2, -1, 1);
        inp.mx = clamp(tmpV.dot(right) * 2, -1, 1);
        if (Math.random() < 0.05) inp.dash = true;
        return inp;
      }
    }

    if (ai.guardT > 0) { inp.guard = true; return inp; }

    if (ai.t <= 0) {
      ai.t = ai.think * rand(0.8, 1.3);
      const oppAttacking = o.action && ['light1', 'light2', 'light3', 'heavy', 'dismantle', 'cleaveFlurry', 'cleaveWave'].indexOf(o.action.name) >= 0;
      const oppCastingBig = o.action && ['purple', 'fuga', 'domainCast'].indexOf(o.action.name) >= 0;

      // domain decision (counter-cast for a clash when the enemy expands theirs)
      const oppCastingDomain = o.action && o.action.name === 'domainCast';
      if (f.ce >= MAX_CE && (f.hp < MAX_HP * 0.5 || o.hp < MAX_HP * 0.4 || oppCastingDomain || (domain && domain.owner !== f)) && Math.random() < (oppCastingDomain ? 0.85 : 0.5)) {
        inp.dom = true;
        return inp;
      }
      // guard reaction
      if (oppAttacking && d < 4 && Math.random() < ai.guardP) {
        ai.guardT = rand(0.3, 0.7);
        inp.guard = true;
        return inp;
      }
      // punish big casts by rushing or ranged skill
      if (oppCastingBig && Math.random() < 0.7) {
        if (d > 6 && f.cds.s1 <= 0 && f.ce >= f.cfg.skills.s1.ce) { inp.s1 = true; return inp; }
        inp.dash = true; inp.mz = 1;
      }
      // skills by range
      const S = f.cfg.skills;
      if (Math.random() < ai.skillP) {
        if (f.charKey === 'gojo') {
          if (d > 4 && d < 14 && f.cds.s1 <= 0 && f.ce >= S.s1.ce && Math.random() < 0.5) inp.s1 = true;
          else if (d > 2 && d < 10 && f.cds.s2 <= 0 && f.ce >= S.s2.ce && Math.random() < 0.45) inp.s2 = true;
          else if ((d > 7 || o.state === 'knockdown' || o.state === 'stunned') && f.cds.s3 <= 0 && f.ce >= S.s3.ce && Math.random() < 0.4) inp.s3 = true;
        } else {
          if (d > 5 && d < 17 && f.cds.s1 <= 0 && f.ce >= S.s1.ce && Math.random() < 0.55) inp.s1 = true;
          else if (d < 5.5 && f.cds.s2 <= 0 && f.ce >= S.s2.ce && Math.random() < 0.5) inp.s2 = true;
          else if ((d > 8 || o.state === 'knockdown' || o.state === 'stunned' || oppCastingBig) && f.cds.s3 <= 0 && f.ce >= S.s3.ce && Math.random() < 0.4) inp.s3 = true;
        }
        if (inp.s1 || inp.s2 || inp.s3) return inp;
      }
      // melee
      if (d < 2.6 && Math.random() < ai.aggr) {
        if (Math.random() < 0.7) inp.light = true; else inp.heavy = true;
        return inp;
      }
      // movement plan
      ai.moveZ = d > 3.2 ? 1 : (d < 1.6 ? -0.6 : 0);
      if (Math.random() < 0.35) ai.strafeDir = -ai.strafeDir;
      ai.moveX = Math.random() < 0.6 ? ai.strafeDir * 0.7 : 0;
      if (d > 9 && Math.random() < 0.25 * ai.aggr) inp.dash = true;
      if (Math.random() < 0.05) inp.jump = true;
    }
    inp.mx = ai.moveX;
    inp.mz = ai.moveZ;
    return inp;
  }

  /* ================= CAMERA ================= */
  function updateCamera(dt) {
    const a = fighters[0], b = fighters[1];
    tmpV.addVectors(a.pos, b.pos).multiplyScalar(0.5);
    tmpV.y += 1.3;
    const sep = a.pos.distanceTo(b.pos);

    // perpendicular to the fight axis; keep current side
    tmpV2.subVectors(b.pos, a.pos).setY(0);
    if (tmpV2.lengthSq() < 0.01) tmpV2.set(1, 0, 0);
    tmpV2.normalize();
    const perp = new THREE.Vector3(-tmpV2.z, 0, tmpV2.x);
    const camDir = new THREE.Vector3().subVectors(camera.position, tmpV).setY(0);
    if (camDir.dot(perp) < 0) perp.multiplyScalar(-1);

    const dist = clamp(4.4 + sep * 0.55, 6.4, 19);
    const height = 2.0 + sep * 0.13;
    const target = new THREE.Vector3().copy(tmpV).addScaledVector(perp, dist);
    target.y = tmpV.y + height;

    // domain cast cinematic: push closer to caster
    let focus = null;
    for (const f of fighters) if (f.action && f.action.name === 'domainCast') focus = f;
    if (focus) {
      const fw = forwardOf(focus);
      target.copy(focus.pos).addScaledVector(fw, 4.2).setY(1.7);
      tmpV.copy(focus.pos).setY(1.5);
    }

    const k = 1 - Math.exp(-dt * (focus ? 6 : 3.5));
    camPos.lerp(target, k);
    camera.position.copy(camPos);

    // shake
    if (shake.t > 0) {
      shake.t -= dt;
      const m = shake.mag * (shake.t > 0 ? shake.t / 0.5 : 0);
      camera.position.x += rand(-m, m);
      camera.position.y += rand(-m, m) * 0.6;
      camera.position.z += rand(-m, m);
      if (shake.t <= 0) shake.mag = 0;
    }
    camera.lookAt(tmpV);
  }

  /* ================= UI / HUD ================= */
  function $(id) { return document.getElementById(id); }

  function cacheUI() {
    ui.menu = $('menu');
    ui.select = $('select');
    ui.hud = $('hud');
    ui.announce = $('announce');
    ui.announceSub = $('announce-sub');
    ui.flash = $('flash');
    ui.timer = $('timer');
    ui.result = $('result');
    ui.resultTitle = $('result-title');
    ui.pause = $('pause');
    ui.help = $('help');
    ui.muteBtn = $('mute-btn');
    ui.p = [
      { name: $('p1-name'), hp: $('p1-hp'), hpLag: $('p1-hp-lag'), ce: $('p1-ce'), pips: $('p1-pips'), skills: $('p1-skills'), guardLbl: $('p1-guard') },
      { name: $('p2-name'), hp: $('p2-hp'), hpLag: $('p2-hp-lag'), ce: $('p2-ce'), pips: $('p2-pips'), skills: $('p2-skills'), guardLbl: $('p2-guard') },
    ];
  }

  function buildSkillIcons(f) {
    const side = ui.p[f.idx];
    side.skills.innerHTML = '';
    const map = f.idx === 0 ? P1MAP : P2MAP;
    const keyLabels = f.idx === 0
      ? { s1: 'U', s2: 'I', s3: 'O', dom: 'P' }
      : (mode.vsAI ? { s1: '', s2: '', s3: '', dom: '' } : { s1: ';', s2: "'", s3: ']', dom: '⏎' });
    for (const slot of ['s1', 's2', 's3', 'dom']) {
      const sk = f.cfg.skills[slot];
      const el = document.createElement('div');
      el.className = 'skill' + (slot === 'dom' ? ' domain-skill' : '');
      el.innerHTML = '<div class="skill-key">' + keyLabels[slot] + '</div><div class="skill-name">' + sk.name + '</div><div class="skill-cd"></div>';
      el.dataset.slot = slot;
      side.skills.appendChild(el);
    }
  }

  function updateHUD() {
    for (let i = 0; i < 2; i++) {
      const f = fighters[i], side = ui.p[i];
      side.hp.style.width = (clamp(f.hp / MAX_HP, 0, 1) * 100) + '%';
      side.hpLag.style.width = (clamp(f.displayHp / MAX_HP, 0, 1) * 100) + '%';
      side.ce.style.width = (clamp(f.ce / MAX_CE, 0, 1) * 100) + '%';
      side.ce.classList.toggle('full', f.ce >= MAX_CE);
      side.guardLbl.textContent = f.cfg.guardName;
      const icons = side.skills.children;
      for (const el of icons) {
        const slot = el.dataset.slot;
        const sk = f.cfg.skills[slot];
        const cdEl = el.querySelector('.skill-cd');
        if (slot === 'dom') {
          const ready = f.ce >= MAX_CE;
          el.classList.toggle('ready', ready);
          cdEl.style.height = ((1 - f.ce / MAX_CE) * 100) + '%';
        } else {
          const cd = f.cds[slot];
          const ready = cd <= 0 && f.ce >= sk.ce;
          el.classList.toggle('ready', ready);
          el.classList.toggle('no-ce', cd <= 0 && f.ce < sk.ce);
          cdEl.style.height = (cd > 0 ? (cd / sk.cd) * 100 : 0) + '%';
        }
      }
    }
    ui.timer.textContent = Math.ceil(roundTimer);
  }

  function updatePips() {
    for (let i = 0; i < 2; i++) {
      const pips = ui.p[i].pips.children;
      for (let k = 0; k < pips.length; k++) pips[k].classList.toggle('won', wins[i] > k);
    }
  }

  function announce(text, sub, dur, cls) {
    announceQ.push({ text: text, sub: sub || '', dur: dur, cls: cls || '' });
  }

  function updateAnnounce(dt) {
    if (announceCur) {
      announceCur.dur -= dt;
      if (announceCur.dur <= 0) {
        announceCur = null;
        ui.announce.className = 'hidden';
      } else return;
    }
    if (announceQ.length > 0) {
      announceCur = announceQ.shift();
      ui.announce.className = 'show ' + announceCur.cls;
      ui.announce.querySelector('.announce-main').textContent = announceCur.text;
      ui.announceSub.textContent = announceCur.sub;
      AudioSys.announce();
    }
  }

  /* ================= GAME FLOW ================= */
  function disposeObject(obj) {
    obj.traverse(function (o) {
      if (o.isMesh || o.isSprite || o.isPoints) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      }
    });
  }

  function clearProjectiles() {
    for (const p of projectiles) {
      scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    }
    projectiles = [];
  }

  function showScreen(name) {
    for (const s of ['menu', 'select', 'hud', 'result', 'pause']) ui[s].classList.add('hidden');
    if (name) ui[name].classList.remove('hidden');
  }

  function startMatch(p1Char) {
    mode.p1Char = p1Char;
    const p2Char = p1Char === 'gojo' ? 'sukuna' : 'gojo';
    // clean up old fighters
    for (const f of fighters) { scene.remove(f.model.group); disposeObject(f.model.group); }
    fighters = [createFighter(p1Char, 0), createFighter(p2Char, 1)];
    if (mode.vsAI) fighters[1].ai = makeAI(mode.difficulty);
    wins = [0, 0];
    roundNum = 1;
    ui.p[0].name.textContent = fighters[0].cfg.name;
    ui.p[1].name.textContent = fighters[1].cfg.name + (mode.vsAI ? ' (CPU)' : '');
    ui.p[0].name.style.color = fighters[0].cfg.css;
    ui.p[1].name.style.color = fighters[1].cfg.css;
    buildSkillIcons(fighters[0]);
    buildSkillIcons(fighters[1]);
    showScreen('hud');
    startRound();
  }

  function startRound() {
    clearProjectiles();
    endDomain();
    resetFighter(fighters[0], -5, 0, Math.PI / 2);
    resetFighter(fighters[1], 5, 0, -Math.PI / 2);
    roundTimer = ROUND_TIME;
    updatePips();
    gameState = 'intro';
    introT = 2.3;
    announce('ROUND ' + roundNum, '', 1.2, 'round');
  }

  function beginRoundEnd(winner) {
    if (gameState !== 'fight') return;
    gameState = 'roundEnd';
    roundEndT = 3.0;
    wins[winner.idx]++;
    winner.state = 'win';
    winner.action = null;
    announce('KO', '', 1.4, 'ko');
    updatePips();
  }

  function timeOutRound() {
    const a = fighters[0], b = fighters[1];
    const winner = a.hp >= b.hp ? a : b;
    const loser = opponentOf(winner);
    endDomain();
    winner.action = null;
    loser.action = null;
    winner.aura = 0;
    loser.aura = 0;
    if (loser.state !== 'ko') loser.state = 'idle';
    gameState = 'roundEnd';
    roundEndT = 3.0;
    wins[winner.idx]++;
    winner.state = 'win';
    announce('TIME UP', '', 1.4, 'ko');
    updatePips();
  }

  function finishRound() {
    if (wins[0] >= WINS_NEEDED || wins[1] >= WINS_NEEDED) {
      const wIdx = wins[0] >= WINS_NEEDED ? 0 : 1;
      gameState = 'matchEnd';
      const w = fighters[wIdx];
      ui.resultTitle.textContent = w.cfg.name + ' WINS';
      ui.resultTitle.style.color = w.cfg.css;
      showScreen('result');
      ui.hud.classList.remove('hidden');
    } else {
      roundNum++;
      startRound();
    }
  }

  function rematch() {
    showScreen('hud');
    wins = [0, 0];
    roundNum = 1;
    startRound();
  }

  function backToMenu() {
    gameState = 'menu';
    endDomain();
    clearProjectiles();
    showScreen('menu');
  }

  function togglePause() {
    if (gameState !== 'fight' && gameState !== 'intro') return;
    paused = !paused;
    ui.pause.classList.toggle('hidden', !paused);
  }

  /* ================= MENU WIRING ================= */
  function wireMenus() {
    $('btn-1p').addEventListener('click', function () { mode.vsAI = true; showScreen('select'); });
    $('btn-2p').addEventListener('click', function () { mode.vsAI = false; showScreen('select'); });
    for (const diff of ['easy', 'normal', 'hard']) {
      $('diff-' + diff).addEventListener('click', function () {
        mode.difficulty = diff;
        for (const d2 of ['easy', 'normal', 'hard']) $('diff-' + d2).classList.toggle('sel', d2 === diff);
      });
    }
    $('pick-gojo').addEventListener('click', function () { AudioSys.unlock(); startMatch('gojo'); });
    $('pick-sukuna').addEventListener('click', function () { AudioSys.unlock(); startMatch('sukuna'); });
    $('select-back').addEventListener('click', function () { showScreen('menu'); });
    $('btn-rematch').addEventListener('click', rematch);
    $('btn-menu').addEventListener('click', backToMenu);
    $('btn-resume').addEventListener('click', togglePause);
    $('btn-quit').addEventListener('click', function () { paused = false; ui.pause.classList.add('hidden'); backToMenu(); });
    ui.muteBtn.addEventListener('mousedown', function (e) { e.preventDefault(); }); // never steal keyboard focus
    ui.muteBtn.addEventListener('click', function () { const m = AudioSys.toggleMute(); ui.muteBtn.textContent = m ? '🔇' : '🔊'; ui.muteBtn.blur(); });
    document.addEventListener('pointerdown', function () { AudioSys.unlock(); }, { once: true });
  }

  /* ================= MAIN LOOP ================= */
  function animate() {
    requestAnimationFrame(animate);
    let dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (paused) { pressed.clear(); renderer.render(scene, camera); return; }
    updateFlash(dt);

    // slow motion
    if (slowmo.t > 0) {
      slowmo.t -= dt;
      dt *= slowmo.factor;
      if (slowmo.t <= 0) slowmo.factor = 1;
    }

    if (gameState === 'intro') {
      introT -= dt;
      if (introT <= 1.0 && introT + dt > 1.0) announce('FIGHT!', '', 0.8, 'fight');
      if (introT <= 0) gameState = 'fight';
      for (const f of fighters) { f.input = NULL_INPUT; updateFighter(f, dt); }
      fighterCollision();
    } else if (gameState === 'fight') {
      roundTimer -= dt;
      if (roundTimer <= 0) { roundTimer = 0; timeOutRound(); }
      for (const f of fighters) {
        f.input = f.ai ? aiInput(f, dt) : readInput(f);
        updateFighter(f, dt);
      }
      fighterCollision();
      updateProjectiles(dt);
      updateDomain(dt);
    } else if (gameState === 'roundEnd') {
      roundEndT -= dt;
      for (const f of fighters) { f.input = NULL_INPUT; updateFighter(f, dt); }
      updateProjectiles(dt);
      if (roundEndT <= 0) finishRound();
    } else if (gameState === 'menu' || gameState === 'select' || gameState === 'matchEnd') {
      // idle orbit camera over arena
      if (fighters.length === 0 || gameState !== 'matchEnd') {
        const t = elapsed * 0.12;
        camera.position.set(Math.cos(t) * 24, 8 + Math.sin(elapsed * 0.4) * 1.5, Math.sin(t) * 24);
        camera.lookAt(0, 2, 0);
        camPos.copy(camera.position);
      }
      if (gameState === 'matchEnd') {
        for (const f of fighters) { f.input = NULL_INPUT; CharFactory.animateFighter(f, elapsed, dt); }
      }
    }

    if (fighters.length > 0 && (gameState === 'fight' || gameState === 'intro' || gameState === 'roundEnd')) {
      for (const f of fighters) CharFactory.animateFighter(f, elapsed, dt);
      updateCamera(dt);
      updateHUD();
    }
    if (gameState === 'matchEnd' && fighters.length > 0) updateCamera(dt);

    updateEffects(dt);
    updateParticles(dt);
    updateAnnounce(dt);
    pressed.clear();
    renderer.render(scene, camera);
  }

  /* ================= BOOT ================= */
  function boot() {
    cacheUI();
    initThree();
    wireMenus();
    showScreen('menu');
    animate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // tiny debug handle (used by automated smoke tests)
  window.__jjk = {
    get fighters() { return fighters; },
    get domain() { return domain; },
    get state() { return gameState; },
    giveCE: function (idx, amt) { if (fighters[idx]) fighters[idx].ce = amt; },
  };
})();
