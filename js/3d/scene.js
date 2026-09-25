// Точка входа 3D: рендерер, камера, персонажи, ввод и связь с интерфейсом игры.
(function () {
  const D3 = window.D3 = window.D3 || {};
  const Scene3D = window.Scene3D = { ok: false, init: () => false };
  if (!window.THREE) return;

  let renderer, scene, camera, room, cards, env, clock;
  let character = null, spectator = null;
  const characters = {};
  let handlers = {};
  let canvas;
  let seated = false, camFly = null, orbitT = 0;
  const camTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3(0, 1.5, 1.4);
  let botThinking = false;
  let carry = [null, null];
  let lastSync = null;
  let bubble, bubbleT = 0;
  let confetti = null;

  function webglAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function makeEnv() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x2b1b12, side: THREE.BackSide })));
    const warm = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0xffd9a0, side: THREE.DoubleSide }));
    warm.position.y = 4.5; warm.rotation.x = Math.PI / 2;
    const cool = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ color: 0x5b76c9, side: THREE.DoubleSide }));
    cool.position.set(2, 1, -4.5);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ color: 0x6a3a22, side: THREE.DoubleSide }));
    fill.position.set(0, -1, 4.5);
    s.add(warm, cool, fill);
    const tex = pmrem.fromScene(s, 0.04).texture;
    pmrem.dispose();
    return tex;
  }

  // Точка обзора «с места игрока»: в портретной ориентации камера выше и смотрит круче.
  function seatView() {
    const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
    const portrait = aspect < 0.9;
    const pos = portrait ? new THREE.Vector3(0, 2.15, 1.62) : new THREE.Vector3(0, 1.82, 1.62);
    const target = portrait ? new THREE.Vector3(0, 0.66, -0.2) : new THREE.Vector3(0, 0.8, -0.2);
    const dist = pos.distanceTo(target);
    const halfW = portrait ? 0.8 : 0.95;
    const fromWidth = THREE.MathUtils.radToDeg(2 * Math.atan(halfW / dist / aspect));
    const fov = Math.min(Math.max(fromWidth, portrait ? 50 : 60), 88);
    return { pos, target, fov };
  }

  function applyView(v) {
    camera.position.copy(v.pos);
    camTarget.copy(v.target);
    camera.fov = v.fov;
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function orbitView(t) {
    const a = Math.sin(t * 0.12) * 0.9;
    const r = 2.9;
    return {
      pos: new THREE.Vector3(Math.sin(a) * r, 1.85 + Math.sin(t * 0.2) * 0.1, Math.cos(a) * r),
      target: new THREE.Vector3(0, 0.95, -0.35),
      fov: Math.min(75, seatView().fov + 4),
    };
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (seated && !camFly) applyView(seatView());
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function setCharacter(kind) {
    if (character) scene.remove(character.object);
    if (!characters[kind]) {
      const c = new D3.Character(kind, env);
      c.object.traverse(o => { if (o.isMesh) o.castShadow = true; });
      characters[kind] = c;
    }
    character = characters[kind];
    scene.add(character.object);
    spectator.visible = kind !== 'cat';
  }

  // ---------- Реплики-пузырьки ----------
  function say(text, sec = 2.2) {
    if (!bubble || !text) return;
    bubble.textContent = text;
    bubble.classList.add('show');
    bubbleT = sec;
    character.talk(Math.min(1.4, 0.35 + text.length * 0.06));
  }

  function updateBubble(dt) {
    if (!bubble) return;
    if (bubbleT > 0) {
      bubbleT -= dt;
      if (bubbleT <= 0) bubble.classList.remove('show');
    }
    const p = character.headWorld(new THREE.Vector3()).add(new THREE.Vector3(0, 0.16, 0)).project(camera);
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    bubble.style.transform = `translate(${x}px, ${Math.max(130, y)}px) translate(-50%, -100%)`;
  }

  // ---------- Конфетти на победу ----------
  function makeConfetti() {
    const count = 180;
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.02, 0.012),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      count
    );
    const palette = [0xff5c7a, 0xffd25e, 0x5ef2ff, 0x8b5cf6, 0x7ee787, 0xffffff];
    const color = new THREE.Color();
    const parts = [];
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, color.setHex(palette[i % palette.length]));
      parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() });
    }
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    const dummy = new THREE.Object3D();
    let life = 0;
    return {
      burst() {
        life = 4.5;
        mesh.visible = true;
        for (const q of parts) {
          q.p.set((Math.random() - 0.5) * 0.3, 0.9, (Math.random() - 0.5) * 0.3);
          q.v.set((Math.random() - 0.5) * 2.4, 2 + Math.random() * 2, (Math.random() - 0.5) * 2.4);
          q.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
        }
      },
      update(dt) {
        if (life <= 0) return;
        life -= dt;
        if (life <= 0) { mesh.visible = false; return; }
        parts.forEach((q, i) => {
          q.v.y -= 4.5 * dt;
          q.v.multiplyScalar(1 - 1.4 * dt);
          q.p.addScaledVector(q.v, dt);
          if (q.p.y < D3.TABLE_TOP + 0.005 && Math.abs(q.p.x) < 0.8 && Math.abs(q.p.z) < 0.55) {
            q.p.y = D3.TABLE_TOP + 0.005; q.v.set(0, 0, 0); q.w.multiplyScalar(0.9);
          }
          if (q.p.y < 0.01) { q.p.y = 0.01; q.v.set(0, 0, 0); }
          q.r.x += q.w.x * dt; q.r.y += q.w.y * dt; q.r.z += q.w.z * dt;
          dummy.position.copy(q.p);
          dummy.rotation.copy(q.r);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // ---------- Ввод: тап и перетаскивание карт ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function toNdc(e) {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }

  function onPointerDown(e) {
    if (!seated || !lastSync) return;
    toNdc(e);
    const id = cards.pick(raycaster);
    if (!id) return;
    const c = cards.cards.get(id);
    cards.drag = {
      id, x0: e.clientX, y0: e.clientY, moved: false, pointerId: e.pointerId,
      pos: c.group.position.clone(), quat: camera.quaternion.clone(), scale: c.group.scale.x,
    };
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!seated) return;
    const drag = cards.drag;
    if (drag && drag.pointerId === e.pointerId) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) {
        drag.moved = true;
        cards.cards.get(drag.id).tw = null;
      }
      if (drag.moved) {
        toNdc(e);
        drag.pos = cards.pointerWorld(ndc.x, ndc.y, 0.55);
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      toNdc(e);
      const id = cards.pick(raycaster);
      cards.setHover(id);
      const c = id && cards.cards.get(id);
      canvas.style.cursor = c && c.glowTarget > 0 ? 'pointer' : 'default';
    }
  }

  function onPointerUp(e) {
    const drag = cards.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    cards.drag = null;
    const releasedOnTable = drag.moved && e.clientY < cards.view.handBottom - window.innerHeight * 0.22;
    let played = false;
    if (!drag.moved || releasedOnTable) played = handlers.onCard ? handlers.onCard(drag.id) : false;
    if (!played) {
      if (!drag.moved || releasedOnTable) cards.shake(drag.id);
      cards.relayoutHand();
    }
  }

  // ---------- Главный цикл ----------
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (!seated && !camFly) {
      orbitT += dt;
      const v = orbitView(orbitT);
      camera.position.lerp(v.pos, 1 - Math.exp(-2 * dt));
      camTarget.lerp(v.target, 1 - Math.exp(-2 * dt));
      camera.fov = v.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(camTarget);
    } else if (camFly) {
      camFly.t += dt;
      const k = Math.min(1, camFly.t / camFly.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const to = seatView();
      camera.position.lerpVectors(camFly.fromPos, to.pos, e);
      camTarget.lerpVectors(camFly.fromTarget, to.target, e);
      camera.fov = THREE.MathUtils.lerp(camFly.fromFov, to.fov, e);
      camera.updateProjectionMatrix();
      camera.lookAt(camTarget);
      if (k >= 1) {
        const done = camFly.done;
        camFly = null;
        seated = true;
        applyView(to);
        if (done) done();
      }
    }
    camera.updateMatrixWorld();

    room.update(dt, t);
    cards.update(dt);

    // Куда смотрит соперник и что делают его руки.
    const botHandSize = lastSync ? lastSync.state.players[1].hand.length : 0;
    const follow = [null, null];
    let focus = null;
    carry = carry.map((id, i) => {
      if (id && cards.isMoving(id)) {
        follow[i] = cards.positionOf(id);
        focus = follow[i];
        return id;
      }
      return null;
    });
    const tableCenter = new THREE.Vector3(0, D3.TABLE_TOP, 0.05);
    let look;
    if (focus) look = focus;
    else if (botThinking) look = new THREE.Vector3(0, 0.95, -0.55);
    else if (lastSync && lastSync.state.table.length && Math.sin(t * 0.5) > -0.2) look = tableCenter;
    else look = camera.position;
    lookTarget.lerp(look, 1 - Math.exp(-6 * dt));
    const rest = botHandSize > 0
      ? [new THREE.Vector3(-0.085, 0.9, -0.67), new THREE.Vector3(0.085, 0.9, -0.67)]
      : [new THREE.Vector3(-0.2, D3.TABLE_TOP + 0.04, -0.5), new THREE.Vector3(0.2, D3.TABLE_TOP + 0.04, -0.5)];
    character.update(dt, t, { lookAt: lookTarget, rest, follow, reach: !!(follow[0] || follow[1]) });
    spectator.userData.update(dt, t, focus || tableCenter);

    if (confetti) confetti.update(dt);
    updateBubble(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---------- Публичное API ----------
  Scene3D.init = function (canvasEl, opts) {
    if (!window.THREE || !webglAvailable()) return false;
    try {
      canvas = canvasEl;
      handlers = opts || {};
      bubble = document.getElementById('bubble');
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      D3.maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x120b08);
      scene.fog = new THREE.Fog(0x120b08, 4.5, 9);
      camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 30);
      env = makeEnv();
      room = D3.makeRoom(scene, env);
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
      room.spot.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);

      spectator = D3.makeSpectatorCat();
      spectator.position.set(-1.18, 0.51, -0.06);
      spectator.rotation.y = Math.PI / 2 - 0.15;
      scene.add(spectator);

      cards = new D3.Cards(scene, camera);
      cards.onMove = () => { if (handlers.onCardMove) handlers.onCardMove(); };
      confetti = makeConfetti();
      setCharacter(opts.character || 'grandpa');

      applyView(orbitView(0));
      resize();
      window.addEventListener('resize', () => { resize(); if (handlers.onResize) handlers.onResize(); });
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !cards.drag) cards.setHover(null); });

      clock = new THREE.Clock();
      Scene3D.ok = true;
      requestAnimationFrame(frame);
      return true;
    } catch (err) {
      console.error('3D недоступно, включаю 2D-режим:', err);
      return false;
    }
  };

  Scene3D.setCharacter = kind => setCharacter(kind);

  // Перелёт камеры со «смотровой» орбиты на место игрока.
  Scene3D.sitDown = function (done) {
    if (seated) { done && done(); return; }
    camFly = {
      t: 0, dur: 1.3, done,
      fromPos: camera.position.clone(), fromTarget: camTarget.clone(), fromFov: camera.fov,
    };
  };

  Scene3D.standUp = function () {
    seated = false;
    camFly = null;
  };

  Scene3D.setView = function (view) {
    cards.view = view;
  };

  Scene3D.sync = function (state, opts) {
    lastSync = { state, opts };
    const moved = cards.sync(state, opts);
    if (opts.newGame) { carry = [null, null]; return; }
    // Соперник «несёт» карты рукой: сыгранную, взятые со стола, добор из колоды.
    const fromBot = moved.filter(m => m.from === 'bot');
    const toBot = moved.filter(m => m.to === 'bot');
    const botSwept = opts.botActed ? moved.filter(m => m.from === 'table' && m.to === 'discard') : [];
    if (fromBot.length) carry[0] = fromBot[0].id;
    if (toBot.length) {
      carry[0] = toBot[0].id;
      if (toBot.length > 1) carry[1] = toBot[toBot.length - 1].id;
    }
    if (botSwept.length) carry[1] = botSwept[0].id;
  };

  Scene3D.relayout = function () {
    if (seated) cards.relayoutHand();
  };

  Scene3D.setThinking = function (on) {
    botThinking = on;
    if (on && character.mood === 'idle') character.setMood('think');
    if (!on && character.mood === 'think') character.setMood('idle');
  };

  Scene3D.react = function (mood, text, duration = 1.6) {
    if (mood) character.setMood(mood, duration);
    if (text) say(text);
  };

  Scene3D.say = say;
  Scene3D.celebrate = () => confetti && confetti.burst();
  Scene3D.shake = id => cards.shake(id);
})();
