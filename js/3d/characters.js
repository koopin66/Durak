// Персонажи-соперники: робот, дед в ушанке и кот. Руки двигаются через IK,
// поэтому соперник действительно держит веер карт, тянется к столу и хватается за голову.
(function () {
  const D3 = window.D3 = window.D3 || {};
  if (!window.THREE) return;
  const V = THREE.Vector3;
  const UP = new V(0, 1, 0);
  const std = o => new THREE.MeshStandardMaterial(o);
  const glow = c => new THREE.MeshBasicMaterial({ color: c });

  function add(parent, geo, mat, pos, scale, rot) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  class Arm {
    constructor(parent, mat, handMat, r, a, b, handGeo) {
      this.a = a; this.b = b;
      this.upper = add(parent, new THREE.CapsuleGeometry(r, a, 4, 10), mat);
      this.lower = add(parent, new THREE.CapsuleGeometry(r * 0.9, b, 4, 10), mat);
      this.hand = add(parent, handGeo || new THREE.SphereGeometry(r * 1.25, 14, 10), handMat);
      this.E = new V(); this.T = new V();
      this._d = new V(); this._b = new V();
    }

    // Двухзвенный IK: плечо S, цель target, pole — куда сгибать локоть.
    solve(S, target, pole) {
      const { a, b } = this;
      const d = this._d.subVectors(target, S);
      const len = Math.min(Math.max(d.length(), 0.05), a + b - 0.002);
      d.normalize();
      const cosA = (a * a + len * len - b * b) / (2 * a * len);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const bend = this._b.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
      this.E.copy(S).addScaledVector(d, a * cosA).addScaledVector(bend, a * sinA);
      this.T.copy(S).addScaledVector(d, len);
      this.place(this.upper, S, this.E);
      this.place(this.lower, this.E, this.T);
      this.hand.position.copy(this.T);
      this.hand.quaternion.copy(this.lower.quaternion);
    }

    place(m, p, q) {
      m.position.addVectors(p, q).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, this._b.subVectors(q, p).normalize());
    }
  }

  function eye(parent, pos, white, pupil, r) {
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    add(g, new THREE.SphereGeometry(r, 16, 12), white);
    add(g, new THREE.SphereGeometry(r * 0.55, 12, 10), pupil, [0, 0, r * 0.62], [1, 1, 0.5]);
    parent.add(g);
    return g;
  }

  // ---------- Сборщики внешности ----------
  const BUILDERS = {
    robot(c, env) {
      const metal = std({ color: 0xd4dbe8, metalness: 0.55, roughness: 0.32, envMap: env, envMapIntensity: 1.5 });
      const dark = std({ color: 0x2a3140, metalness: 0.5, roughness: 0.4, envMap: env });
      const screen = std({ color: 0x07101f, roughness: 0.15, metalness: 0.2 });
      const cyan = glow(0x5ef2ff);
      add(c.torso, new THREE.CylinderGeometry(0.11, 0.13, 0.14, 20), dark, [0, 0.07, 0]);
      add(c.torso, new THREE.BoxGeometry(0.4, 0.36, 0.26), metal, [0, 0.31, 0]);
      add(c.torso, new THREE.BoxGeometry(0.2, 0.12, 0.012), screen, [0, 0.34, 0.132]);
      c.lights = [0xff5c7a, 0xffd25e, 0x5ef2ff].map((col, i) =>
        add(c.torso, new THREE.SphereGeometry(0.014, 10, 8), glow(col), [-0.05 + i * 0.05, 0.34, 0.14]));
      for (const s of [-1, 1]) add(c.torso, new THREE.SphereGeometry(0.06, 16, 12), dark, [s * 0.21, 0.46, 0]);
      add(c.torso, new THREE.CylinderGeometry(0.04, 0.05, 0.08, 12), dark, [0, 0.52, 0]);

      add(c.head, new THREE.BoxGeometry(0.3, 0.24, 0.26), metal, [0, 0.14, 0]);
      add(c.head, new THREE.BoxGeometry(0.25, 0.16, 0.012), screen, [0, 0.14, 0.131]);
      for (const s of [-1, 1]) {
        const e = add(c.head, new THREE.CircleGeometry(0.032, 20), cyan, [s * 0.058, 0.165, 0.138]);
        c.eyes.push(e);
        add(c.head, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), dark, [s * 0.165, 0.14, 0], null, [0, 0, Math.PI / 2]);
      }
      c.mouth = add(c.head, new THREE.BoxGeometry(0.08, 0.014, 0.004), cyan, [0, 0.095, 0.139]);
      add(c.head, new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), dark, [0, 0.31, 0]);
      c.antenna = add(c.head, new THREE.SphereGeometry(0.026, 14, 10), glow(0xff5c7a), [0, 0.37, 0]);
      c.armMat = metal; c.handMat = dark; c.armR = 0.034;
      c.legMat = dark;
      c.extra = (t, mood) => {
        c.lights.forEach((l, i) => { l.visible = Math.sin(t * 3 + i * 2.1) > -0.3; });
        const k = 1 + Math.sin(t * 4) * 0.15;
        c.antenna.scale.setScalar(mood === 'think' ? 1 + Math.abs(Math.sin(t * 12)) * 0.5 : k);
        c.antenna.material.color.setHex(mood === 'think' ? 0xffd25e : mood === 'lose' ? 0x5e7aff : 0xff5c7a);
      };
    },

    grandpa(c) {
      const sweater = std({ map: D3.tex.knit('#9b2230', '#f1e3c6'), roughness: 0.95 });
      const skin = std({ color: 0xf0c3a0, roughness: 0.7 });
      const white = std({ color: 0xf4f1ea, roughness: 1 });
      const fur = std({ color: 0x5b3a22, roughness: 1 });
      const dark = std({ color: 0x1b1b1b, roughness: 0.4 });
      add(c.torso, new THREE.CapsuleGeometry(0.19, 0.22, 6, 18), sweater, [0, 0.29, 0], [1.12, 1, 0.8]);
      add(c.torso, new THREE.CylinderGeometry(0.05, 0.06, 0.08, 12), skin, [0, 0.53, 0]);
      add(c.torso, new THREE.TorusGeometry(0.075, 0.025, 8, 20), sweater, [0, 0.52, 0], null, [Math.PI / 2, 0, 0]);

      add(c.head, new THREE.SphereGeometry(0.13, 24, 18), skin, [0, 0.15, 0]);
      add(c.head, new THREE.SphereGeometry(0.03, 14, 10), std({ color: 0xe39a80, roughness: 0.6 }), [0, 0.14, 0.128]);
      for (const s of [-1, 1]) {
        add(c.head, new THREE.SphereGeometry(0.035, 12, 10), skin, [s * 0.128, 0.15, 0], [0.5, 1, 1]);
        c.eyes.push(eye(c.head, [s * 0.046, 0.18, 0.108], white, dark, 0.021));
        c.brows.push(add(c.head, new THREE.BoxGeometry(0.065, 0.018, 0.02), white, [s * 0.048, 0.218, 0.115]));
        add(c.head, new THREE.SphereGeometry(0.04, 12, 10), white, [s * 0.036, 0.105, 0.118], [1.35, 0.5, 0.6], [0, 0, s * 0.35]);
        add(c.head, new THREE.TorusGeometry(0.032, 0.004, 8, 24), std({ color: 0xc9a24a, metalness: 1, roughness: 0.3 }),
          [s * 0.047, 0.18, 0.132]);
        add(c.head, new THREE.CapsuleGeometry(0.034, 0.06, 4, 10), fur, [s * 0.142, 0.12, -0.01], [1, 1, 1.5], [0, 0, s * 0.12]);
      }
      add(c.head, new THREE.SphereGeometry(0.115, 18, 14), white, [0, 0.045, 0.055], [1, 1.1, 0.7]);
      c.mouth = add(c.head, new THREE.SphereGeometry(0.02, 12, 8), std({ color: 0x5a1f1f }), [0, 0.074, 0.13], [1.3, 0.35, 0.5]);
      const hat = std({ color: 0x3e2a1c, roughness: 0.9 });
      add(c.head, new THREE.SphereGeometry(0.142, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hat, [0, 0.2, 0], [1, 0.8, 1]);
      add(c.head, new THREE.TorusGeometry(0.14, 0.03, 10, 32), fur, [0, 0.215, 0], [1, 1, 1.4], [Math.PI / 2, 0, 0]);
      add(c.head, new THREE.CircleGeometry(0.02, 5), std({ color: 0xd4a94a, metalness: 1, roughness: 0.3 }), [0, 0.232, 0.172], null, [-0.15, 0, 0]);
      c.armMat = sweater; c.handMat = skin; c.armR = 0.05;
      c.legMat = std({ color: 0x33343c, roughness: 0.9 });
    },

    cat(c) {
      const fur = std({ color: 0xe08a3c, roughness: 0.9 });
      const white = std({ color: 0xfbf3e6, roughness: 0.9 });
      const pink = std({ color: 0xf2a0a8, roughness: 0.7 });
      const green = std({ color: 0x9be36a, roughness: 0.15, emissive: 0x1c3310 });
      const dark = std({ color: 0x111111, roughness: 0.3 });
      add(c.torso, new THREE.CapsuleGeometry(0.17, 0.2, 6, 18), fur, [0, 0.27, 0], [1, 1, 0.85]);
      add(c.torso, new THREE.SphereGeometry(0.14, 16, 12), white, [0, 0.25, 0.08], [0.9, 1.25, 0.55]);
      for (let i = 0; i < 3; i++) {
        add(c.torso, new THREE.TorusGeometry(0.168, 0.012, 6, 24, Math.PI), std({ color: 0xb8612a, roughness: 0.9 }),
          [0, 0.18 + i * 0.1, -0.005], [1, 1, 0.85], [Math.PI / 2, 0, Math.PI]);
      }

      add(c.head, new THREE.SphereGeometry(0.15, 24, 18), fur, [0, 0.15, 0], [1.12, 0.95, 1]);
      for (const s of [-1, 1]) {
        add(c.head, new THREE.ConeGeometry(0.058, 0.11, 12), fur, [s * 0.09, 0.28, -0.01], null, [0, 0, -s * 0.3]);
        add(c.head, new THREE.ConeGeometry(0.036, 0.07, 12), pink, [s * 0.087, 0.27, 0.012], null, [0, 0, -s * 0.3]);
        add(c.head, new THREE.SphereGeometry(0.045, 14, 10), white, [s * 0.03, 0.1, 0.125], [1, 0.8, 0.8]);
        const e = new THREE.Group();
        e.position.set(s * 0.062, 0.18, 0.118);
        add(e, new THREE.SphereGeometry(0.033, 16, 12), green, null, [1, 1.1, 0.6]);
        add(e, new THREE.SphereGeometry(0.013, 10, 8), dark, [0, 0, 0.018], [0.4, 1.8, 0.5]);
        c.head.add(e);
        c.eyes.push(e);
        for (let k = -1; k <= 1; k++) {
          add(c.head, new THREE.CylinderGeometry(0.0018, 0.0018, 0.13, 4), white,
            [s * 0.1, 0.1 + k * 0.012, 0.13], null, [0, 0, Math.PI / 2 + s * k * 0.15]);
        }
      }
      add(c.head, new THREE.SphereGeometry(0.018, 10, 8), pink, [0, 0.128, 0.158], [1.3, 0.8, 1]);
      c.mouth = add(c.head, new THREE.SphereGeometry(0.016, 10, 8), std({ color: 0x5a1f1f }), [0, 0.072, 0.145], [1.2, 0.4, 0.5]);

      // Хвост — цепочка шариков, волной покачивается за стулом.
      c.tail = [];
      for (let i = 0; i < 10; i++) {
        c.tail.push(add(c.root, new THREE.SphereGeometry(0.042 - i * 0.0015, 12, 10), i > 7 ? white : fur));
      }
      c.armMat = fur; c.handMat = white; c.armR = 0.045;
      c.legMat = fur;
      c.extra = (t, mood) => {
        const speed = mood === 'lose' ? 1 : mood === 'win' ? 7 : 2.2;
        c.tail.forEach((s, i) => {
          const k = i / 9;
          s.position.set(Math.sin(t * speed + i * 0.5) * 0.08 * k, 0.05 + k * 0.5, -0.24 - Math.sin(k * 2.2) * 0.08);
        });
      };
    },
  };

  class Character {
    constructor(kind, env) {
      this.kind = kind;
      this.object = new THREE.Group();
      this.root = new THREE.Group();
      this.root.position.set(0, 0.5, -0.97);
      this.object.add(this.root);
      this.torso = new THREE.Group();
      this.root.add(this.torso);
      this.head = new THREE.Group();
      this.head.position.set(0, 0.56, 0);
      this.torso.add(this.head);
      this.eyes = []; this.brows = []; this.mouth = null; this.extra = null;

      BUILDERS[kind](this, env);

      // Ноги почти не видны из-под стола, но заметны сбоку в широком окне.
      for (const s of [-1, 1]) {
        add(this.root, new THREE.CapsuleGeometry(0.06, 0.3, 4, 10), this.legMat, [s * 0.1, 0.02, 0.17], null, [Math.PI / 2, 0, 0]);
        add(this.root, new THREE.CapsuleGeometry(0.05, 0.38, 4, 10), this.legMat, [s * 0.1, -0.24, 0.36]);
      }

      this.shoulders = [new V(-0.21, 0.46, 0.02), new V(0.21, 0.46, 0.02)];
      this.arms = [
        new Arm(this.object, this.armMat, this.handMat, this.armR, 0.27, 0.27),
        new Arm(this.object, this.armMat, this.handMat, this.armR, 0.27, 0.27),
      ];
      this.handPos = [new V(-0.1, 0.9, -0.62), new V(0.1, 0.9, -0.62)];

      this.mood = 'idle';
      this.moodT = 0;
      this.talkT = 0;
      this.blinkT = 0;
      this.nextBlink = 2;
      this._v = new V(); this._w = new V(); this._pole = new V();
      this._headPos = new V();
    }

    setMood(mood, duration = 0) {
      this.mood = mood;
      this.moodT = duration;
    }

    talk(sec = 1.2) { this.talkT = sec; }

    headWorld(out = new V()) {
      return this.head.localToWorld(out.set(0, 0.16, 0));
    }

    update(dt, t, ctx) {
      if (this.moodT > 0) {
        this.moodT -= dt;
        if (this.moodT <= 0) this.mood = 'idle';
      }
      const mood = this.mood;

      // Корпус: дыхание, наклон, подпрыгивания.
      let lean = 0.06, tilt = Math.sin(t * 0.7) * 0.02, bounce = 0;
      if (mood === 'think') { lean = 0.14; tilt = 0.07; }
      if (mood === 'happy') bounce = Math.abs(Math.sin(t * 10)) * 0.02;
      if (mood === 'win') { lean = -0.12; bounce = Math.abs(Math.sin(t * 7)) * 0.07; }
      if (mood === 'lose') { lean = 0.32; tilt = Math.sin(t * 1.5) * 0.04; }
      if (ctx.reach) lean = Math.max(lean, 0.28);
      this.torso.rotation.x = damp(this.torso.rotation.x, lean, 6, dt);
      this.torso.rotation.z = damp(this.torso.rotation.z, tilt, 4, dt);
      this.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
      this.root.position.y = damp(this.root.position.y, 0.5 + bounce, 20, dt);

      // Голова смотрит на цель.
      this.head.getWorldPosition(this._headPos);
      const d = this._v.subVectors(ctx.lookAt, this._headPos);
      let yaw = Math.atan2(d.x, d.z);
      let pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)) - this.torso.rotation.x;
      let roll = 0;
      if (mood === 'think') roll = 0.18;
      if (mood === 'lose') pitch += 0.3;
      if (mood === 'win') { pitch -= 0.25; roll = Math.sin(t * 7) * 0.12; }
      yaw = Math.max(-0.9, Math.min(0.9, yaw));
      pitch = Math.max(-0.5, Math.min(0.7, pitch));
      this.head.rotation.y = damp(this.head.rotation.y, yaw, 5, dt);
      this.head.rotation.x = damp(this.head.rotation.x, pitch, 5, dt);
      this.head.rotation.z = damp(this.head.rotation.z, roll, 4, dt);

      // Моргание и мимика.
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.blinkT = 0.14; this.nextBlink = 2 + Math.random() * 3; }
      this.blinkT = Math.max(0, this.blinkT - dt);
      let eyeOpen = this.blinkT > 0 ? 0.1 : 1;
      if (mood === 'happy' || mood === 'win') eyeOpen = Math.min(eyeOpen, 0.45);
      for (const e of this.eyes) e.scale.y = damp(e.scale.y, eyeOpen, 30, dt);
      this.brows.forEach((b, i) => {
        const s = i === 0 ? -1 : 1;
        const angle = mood === 'lose' ? -s * 0.35 : mood === 'think' ? s * 0.25 * (i === 0 ? 1 : 0) : 0;
        const lift = mood === 'win' || mood === 'surprised' ? 0.012 : 0;
        b.rotation.z = damp(b.rotation.z, angle, 8, dt);
        b.position.y = damp(b.position.y, 0.218 + lift, 8, dt);
      });
      if (this.mouth) {
        this.talkT = Math.max(0, this.talkT - dt);
        const open = this.talkT > 0 ? 0.6 + Math.abs(Math.sin(t * 17)) * 1.8 : mood === 'win' ? 1.8 : 1;
        const wide = mood === 'happy' || mood === 'win' ? 1.4 : mood === 'lose' ? 0.7 : 1;
        this.mouth.scale.y = damp(this.mouth.scale.y, (this.kind === 'robot' ? 1 : 0.35) * open, 20, dt);
        this.mouth.scale.x = damp(this.mouth.scale.x, (this.kind === 'robot' ? 1 : 1.3) * wide, 10, dt);
      }

      // Руки: цели по настроению, затем IK.
      const targets = [this._v.copy(ctx.rest[0]), this._w.copy(ctx.rest[1])];
      if (mood === 'think') this.head.localToWorld(targets[0].set(-0.02, 0.04, 0.16));
      if (mood === 'win') {
        targets[0].set(-0.38, 1.62 + Math.sin(t * 7) * 0.05, -0.85);
        targets[1].set(0.38, 1.62 + Math.cos(t * 7) * 0.05, -0.85);
      }
      if (mood === 'lose') this.head.localToWorld(targets[0].set(0.02, 0.22, 0.14));
      for (let i = 0; i < 2; i++) {
        const follow = ctx.follow && ctx.follow[i];
        if (follow) targets[i].copy(follow);
        this.handPos[i].lerp(targets[i], 1 - Math.exp(-(follow ? 16 : 8) * dt));
        const S = this.torso.localToWorld(this._headPos.copy(this.shoulders[i]));
        const side = i === 0 ? -1 : 1;
        this._pole.set(side * 0.9, -1, -0.5).normalize();
        this.arms[i].solve(S, this.handPos[i], this._pole);
      }

      if (this.extra) this.extra(t, mood);
    }
  }

  // Зритель: кот, дремлющий на соседнем стуле и следящий за картами.
  function makeSpectatorCat() {
    const g = new THREE.Group();
    const fur = std({ color: 0x7d7f86, roughness: 0.9 });
    const white = std({ color: 0xf5f2ec, roughness: 0.9 });
    const pink = std({ color: 0xf2a0a8 });
    const eyeMat = std({ color: 0xf2c94c, emissive: 0x332200, roughness: 0.2 });
    const dark = std({ color: 0x111111 });
    add(g, new THREE.SphereGeometry(0.15, 20, 16), fur, [0, 0.14, 0], [1, 1.15, 1.2]);
    add(g, new THREE.SphereGeometry(0.1, 16, 12), white, [0, 0.12, 0.1], [0.8, 1, 0.6]);
    const head = new THREE.Group();
    head.position.set(0, 0.34, 0.06);
    g.add(head);
    add(head, new THREE.SphereGeometry(0.1, 20, 16), fur, null, [1.12, 0.95, 1]);
    const eyes = [];
    for (const s of [-1, 1]) {
      add(head, new THREE.ConeGeometry(0.04, 0.08, 10), fur, [s * 0.06, 0.09, -0.01], null, [0, 0, -s * 0.3]);
      add(head, new THREE.ConeGeometry(0.025, 0.05, 10), pink, [s * 0.058, 0.085, 0.006], null, [0, 0, -s * 0.3]);
      const e = new THREE.Group();
      e.position.set(s * 0.04, 0.02, 0.08);
      add(e, new THREE.SphereGeometry(0.022, 12, 10), eyeMat, null, [1, 1, 0.6]);
      add(e, new THREE.SphereGeometry(0.009, 8, 6), dark, [0, 0, 0.012], [0.4, 1.8, 0.5]);
      head.add(e);
      eyes.push(e);
      add(head, new THREE.SphereGeometry(0.03, 10, 8), white, [s * 0.02, -0.03, 0.08], [1, 0.8, 0.8]);
    }
    add(head, new THREE.SphereGeometry(0.012, 8, 6), pink, [0, -0.01, 0.105]);
    const tail = [];
    for (let i = 0; i < 9; i++) tail.push(add(g, new THREE.SphereGeometry(0.03, 10, 8), i > 6 ? white : fur));
    let blink = 0, next = 3;
    const look = new V();
    g.userData.update = (dt, t, target) => {
      next -= dt;
      if (next < 0) { blink = 0.15; next = 2.5 + Math.random() * 4; }
      blink = Math.max(0, blink - dt);
      for (const e of eyes) e.scale.y = blink > 0 ? 0.1 : 1;
      head.getWorldPosition(look);
      const local = g.worldToLocal(look.copy(target));
      const yaw = Math.atan2(local.x, local.z);
      head.rotation.y = damp(head.rotation.y, Math.max(-1, Math.min(1, yaw)), 3, dt);
      head.rotation.x = damp(head.rotation.x, 0.35, 3, dt);
      head.rotation.z = Math.sin(t * 0.9) * 0.08;
      tail.forEach((s, i) => {
        const a = i / 8 * Math.PI * 1.3 + Math.sin(t * 1.4) * 0.15 * (i / 8);
        s.position.set(Math.sin(a) * 0.2, 0.03 + i * 0.004, -Math.cos(a) * 0.2 + 0.02);
      });
    };
    return g;
  }

  D3.Character = Character;
  D3.makeSpectatorCat = makeSpectatorCat;
})();
