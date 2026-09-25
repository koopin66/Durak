// Комната: пол, стены с окном, стол с сукном, стулья, лампа, самовар и прочий уют.
(function () {
  const D3 = window.D3 = window.D3 || {};

  const TABLE_TOP = 0.78;          // высота игровой поверхности
  const TABLE_W = 1.7, TABLE_D = 1.2;
  const ROOM_W = 6.4, ROOM_H = 3, BACK_Z = -2.3;
  D3.TABLE_TOP = TABLE_TOP;

  function std(opts) { return new THREE.MeshStandardMaterial(opts); }

  function shadowy(obj, cast = true, receive = true) {
    obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
    return obj;
  }

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  D3.roundedRectShape = roundedRectShape;

  function makeTable(woodMat) {
    const g = new THREE.Group();

    // Столешница: скруглённый прямоугольник со скошенной кромкой.
    const topShape = roundedRectShape(TABLE_W, TABLE_D, 0.22);
    const topGeo = new THREE.ExtrudeGeometry(topShape, {
      depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.015, bevelSegments: 3, curveSegments: 16,
    });
    topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = TABLE_TOP - 0.062;
    g.add(top);

    // Зелёное сукно чуть ниже бортика.
    const feltGeo = new THREE.ShapeGeometry(roundedRectShape(TABLE_W - 0.16, TABLE_D - 0.16, 0.16), 16);
    feltGeo.rotateX(-Math.PI / 2);
    const feltMat = std({ map: D3.tex.felt(), roughness: 0.95, color: 0xffffff });
    const feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.position.y = TABLE_TOP + 0.0015;
    g.add(feltMesh);

    // Бортик вокруг сукна.
    const rail = roundedRectShape(TABLE_W + 0.02, TABLE_D + 0.02, 0.23);
    rail.holes.push(roundedRectShape(TABLE_W - 0.16, TABLE_D - 0.16, 0.16));
    const railGeo = new THREE.ExtrudeGeometry(rail, {
      depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 16,
    });
    railGeo.rotateX(-Math.PI / 2);
    const railMesh = new THREE.Mesh(railGeo, std({ color: 0x3b1a0c, roughness: 0.45 }));
    railMesh.position.y = TABLE_TOP;
    g.add(railMesh);

    // Точёные ножки.
    const legProfile = [
      [0.0, 0], [0.035, 0], [0.04, 0.03], [0.03, 0.08], [0.026, 0.3], [0.042, 0.4], [0.03, 0.48],
      [0.034, 0.58], [0.045, 0.64], [0.045, 0.7], [0.0, 0.7],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const legGeo = new THREE.LatheGeometry(legProfile, 20);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(sx * (TABLE_W / 2 - 0.2), 0, sz * (TABLE_D / 2 - 0.18));
        g.add(leg);
      }
    }
    const apronMat = std({ color: 0x4a2412, roughness: 0.6 });
    const apronX = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W - 0.4, 0.1, 0.03), apronMat);
    const apronZ = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, TABLE_D - 0.36), apronMat);
    for (const s of [-1, 1]) {
      const a = apronX.clone(); a.position.set(0, TABLE_TOP - 0.11, s * (TABLE_D / 2 - 0.18)); g.add(a);
      const b = apronZ.clone(); b.position.set(s * (TABLE_W / 2 - 0.2), TABLE_TOP - 0.11, 0); g.add(b);
    }
    shadowy(g);
    feltMesh.castShadow = false;
    return g;
  }

  function makeChair(woodMat, cushionColor) {
    const g = new THREE.Group();
    const seatY = 0.46;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.44), woodMat);
    seat.position.y = seatY;
    g.add(seat);
    const cushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.21, 0.04, 24),
      std({ color: cushionColor, roughness: 0.9 })
    );
    cushion.scale.z = 0.95;
    cushion.position.y = seatY + 0.04;
    g.add(cushion);

    const legGeo = new THREE.CylinderGeometry(0.018, 0.022, seatY, 10);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(sx * 0.19, seatY / 2, sz * 0.18);
        g.add(leg);
      }
    }
    // Спинка — за сиденьем, со стороны −z (стул «смотрит» на +z).
    const postGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.56, 10);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(sx * 0.19, seatY + 0.28, -0.2);
      post.rotation.x = -0.08;
      g.add(post);
    }
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.03), woodMat);
    crest.position.set(0, seatY + 0.52, -0.222);
    crest.rotation.x = -0.08;
    g.add(crest);
    for (let i = -1; i <= 1; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.36, 0.015), woodMat);
      slat.position.set(i * 0.09, seatY + 0.27, -0.205);
      slat.rotation.x = -0.08;
      g.add(slat);
    }
    return shadowy(g);
  }

  function makeLamp(brass) {
    const g = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, ROOM_H - 2.3, 6), std({ color: 0x111111 }));
    cord.position.y = 2.3 + (ROOM_H - 2.3) / 2;
    g.add(cord);
    const shadeMat = std({ color: 0x1f5a3a, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.34, 0.2, 40, 1, true), shadeMat);
    shade.position.y = 2.2;
    g.add(shade);
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.069, 0.338, 0.198, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff1cf, side: THREE.BackSide })
    );
    inner.position.y = 2.2;
    g.add(inner);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.06, 20), brass);
    cap.position.y = 2.32;
    g.add(cap);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d0 }));
    bulb.position.y = 2.14;
    g.add(bulb);
    return g;
  }

  function makeSamovar(brass) {
    const g = new THREE.Group();
    const profile = [
      [0, 0], [0.09, 0], [0.1, 0.02], [0.05, 0.06], [0.05, 0.1], [0.12, 0.14], [0.16, 0.22], [0.165, 0.3],
      [0.15, 0.37], [0.1, 0.41], [0.06, 0.43], [0.06, 0.47], [0.09, 0.49], [0.04, 0.53], [0, 0.54],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), brass));
    const handleGeo = new THREE.TorusGeometry(0.05, 0.01, 8, 16, Math.PI);
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(handleGeo, brass);
      h.position.set(s * 0.165, 0.33, 0);
      h.rotation.z = s * Math.PI / 2;
      g.add(h);
    }
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), brass);
    tap.rotation.x = Math.PI / 2;
    tap.position.set(0, 0.16, 0.17);
    g.add(tap);
    const teapot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 20, 14),
      std({ color: 0xffffff, roughness: 0.2 })
    );
    teapot.scale.y = 0.8;
    teapot.position.y = 0.58;
    g.add(teapot);
    const dots = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 24), std({ color: 0x1c4fa0, roughness: 0.3 }));
    dots.rotation.x = Math.PI / 2;
    dots.position.y = 0.58;
    g.add(dots);
    return shadowy(g);
  }

  function makePlant() {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.3, 24), std({ color: 0xa4502c, roughness: 0.8 }));
    pot.position.y = 0.15;
    g.add(pot);
    const leafMat = std({ color: 0x2f7a3a, roughness: 0.6 });
    const r = D3.rng(9);
    for (let i = 0; i < 11; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), leafMat);
      leaf.scale.set(0.5, 3.2, 0.14);
      const a = (i / 11) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.06, 0.45 + r() * 0.1, Math.sin(a) * 0.06);
      leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
      g.add(leaf);
    }
    return shadowy(g);
  }

  function makeClock() {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 40), std({ color: 0x3b2413, roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.175, 40), std({ map: D3.tex.clock(), roughness: 0.6 }));
    face.position.z = 0.021;
    g.add(face);
    const handMat = std({ color: 0x1a1a1a });
    const hour = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.09, 0.004), handMat);
    hour.geometry.translate(0, 0.04, 0);
    hour.position.z = 0.026;
    const minute = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.14, 0.004), handMat);
    minute.geometry.translate(0, 0.065, 0);
    minute.position.z = 0.03;
    g.add(hour, minute);
    g.userData.update = () => {
      const d = new Date();
      const m = d.getMinutes() + d.getSeconds() / 60;
      minute.rotation.z = -(m / 60) * Math.PI * 2;
      hour.rotation.z = -(((d.getHours() % 12) + m / 60) / 12) * Math.PI * 2;
    };
    return g;
  }

  function makeRoom(scene, envMap) {
    const updaters = [];
    const brass = std({ color: 0xd9a441, metalness: 1, roughness: 0.28, envMap, envMapIntensity: 1.2 });
    const woodMat = std({ map: D3.tex.tableWood(), roughness: 0.45, color: 0xffffff });
    const chairWood = std({ color: 0x6b3a1e, roughness: 0.55 });

    // Пол и ковёр.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, 6),
      std({ map: D3.tex.floor(), roughness: 0.75 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = BACK_Z + 3;
    floor.receiveShadow = true;
    scene.add(floor);
    const rugMesh = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), std({ map: D3.tex.rug(), roughness: 1 }));
    rugMesh.rotation.x = -Math.PI / 2;
    rugMesh.position.set(0, 0.004, -0.1);
    rugMesh.scale.set(1.25, 1, 1);
    rugMesh.receiveShadow = true;
    scene.add(rugMesh);

    // Задняя стена с проёмом под окно.
    const win = { x: 1.05, y: 1.72, w: 0.95, h: 1.05 };
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-ROOM_W / 2, 0); wallShape.lineTo(ROOM_W / 2, 0);
    wallShape.lineTo(ROOM_W / 2, ROOM_H); wallShape.lineTo(-ROOM_W / 2, ROOM_H);
    const hole = new THREE.Path();
    hole.moveTo(win.x - win.w / 2, win.y - win.h / 2);
    hole.lineTo(win.x + win.w / 2, win.y - win.h / 2);
    hole.lineTo(win.x + win.w / 2, win.y + win.h / 2);
    hole.lineTo(win.x - win.w / 2, win.y + win.h / 2);
    wallShape.holes.push(hole);
    const wallGeo = new THREE.ShapeGeometry(wallShape);
    // UV в метрах, чтобы обои не растягивались.
    const uv = wallGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.64, uv.getY(i) / 0.75);
    const wallTex = D3.tex.wallpaper().clone();
    wallTex.needsUpdate = true;
    wallTex.repeat.set(1, 1);
    const wallMat = std({ map: wallTex, roughness: 0.9 });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.z = BACK_Z;
    backWall.receiveShadow = true;
    scene.add(backWall);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(6, ROOM_H), std({ map: D3.tex.wallpaper(), roughness: 0.9 }));
      side.position.set(s * ROOM_W / 2, ROOM_H / 2, BACK_Z + 3);
      side.rotation.y = -s * Math.PI / 2;
      side.receiveShadow = true;
      scene.add(side);
    }
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 6), std({ color: 0x2a2320, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, ROOM_H, BACK_Z + 3);
    scene.add(ceiling);

    // Деревянные панели внизу стен.
    const panelMat = std({ color: 0x4a2a17, roughness: 0.6 });
    const wainscot = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.9, 0.03), panelMat);
    wainscot.position.set(0, 0.45, BACK_Z + 0.015);
    wainscot.receiveShadow = true;
    scene.add(wainscot);
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.04, 0.06), std({ color: 0x3a1f10, roughness: 0.5 }));
    railTop.position.set(0, 0.91, BACK_Z + 0.03);
    scene.add(railTop);
    for (const s of [-1, 1]) {
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 6), panelMat);
      w2.position.set(s * (ROOM_W / 2 - 0.015), 0.45, BACK_Z + 3);
      scene.add(w2);
    }

    // Окно: ночное небо, снег, рама.
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2), new THREE.MeshBasicMaterial({ map: D3.tex.sky() }));
    sky.position.set(win.x, win.y, BACK_Z - 0.9);
    scene.add(sky);
    const frameMat = std({ color: 0xf1ead8, roughness: 0.5 });
    const fw = 0.06;
    const frameParts = [
      [win.w + fw * 2, fw, win.x, win.y + win.h / 2 + fw / 2],
      [win.w + fw * 2, fw, win.x, win.y - win.h / 2 - fw / 2],
      [fw, win.h, win.x - win.w / 2 - fw / 2, win.y],
      [fw, win.h, win.x + win.w / 2 + fw / 2, win.y],
      [0.03, win.h, win.x, win.y],
      [win.w, 0.03, win.x, win.y + win.h * 0.2],
    ];
    for (const [w, h, x, y] of frameParts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), frameMat);
      m.position.set(x, y, BACK_Z);
      scene.add(m);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(win.w + 0.24, 0.04, 0.2), frameMat);
    sill.position.set(win.x, win.y - win.h / 2 - 0.08, BACK_Z + 0.07);
    sill.receiveShadow = true;
    scene.add(sill);
    const snowCount = 220;
    const snowPos = new Float32Array(snowCount * 3);
    const snowSeed = D3.rng(4);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = win.x + (snowSeed() - 0.5) * 1.6;
      snowPos[i * 3 + 1] = win.y + (snowSeed() - 0.5) * 1.6;
      snowPos[i * 3 + 2] = BACK_Z - 0.1 - snowSeed() * 0.7;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      size: 0.018, map: D3.tex.dot(), transparent: true, depthWrite: false, color: 0xeef3ff,
    }));
    scene.add(snow);
    updaters.push((dt, t) => {
      const p = snowGeo.attributes.position;
      for (let i = 0; i < snowCount; i++) {
        let y = p.getY(i) - dt * (0.08 + (i % 5) * 0.02);
        if (y < win.y - 0.8) y = win.y + 0.8;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.02);
      }
      p.needsUpdate = true;
    });

    // Картина с берёзами.
    const paintFrame = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.62, 0.04), brass);
    paintFrame.position.set(-1.15, 1.8, BACK_Z + 0.02);
    scene.add(paintFrame);
    const paint = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.52), std({ map: D3.tex.painting(), roughness: 0.8 }));
    paint.position.set(-1.15, 1.8, BACK_Z + 0.045);
    scene.add(paint);

    const clock = makeClock();
    clock.position.set(-2.15, 2.0, BACK_Z + 0.03);
    scene.add(clock);
    updaters.push(clock.userData.update);

    // Стол, стулья.
    const table = makeTable(woodMat);
    scene.add(table);
    const chairs = {
      bot: makeChair(chairWood, 0x8c2f39),
      left: makeChair(chairWood, 0x2f4f8c),
      right: makeChair(chairWood, 0x8c6d2f),
    };
    chairs.bot.position.set(0, 0, -1.02);
    chairs.left.position.set(-1.2, 0, -0.05);
    chairs.left.rotation.y = Math.PI / 2 - 0.15;
    chairs.right.position.set(1.2, 0, -0.1);
    chairs.right.rotation.y = -Math.PI / 2 + 0.2;
    Object.values(chairs).forEach(c => scene.add(c));

    // Тумба с самоваром и цветок.
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.78, 0.46), std({ color: 0x5a3219, roughness: 0.55 }));
    cabinet.position.set(-2.1, 0.39, BACK_Z + 0.26);
    scene.add(shadowy(cabinet));
    for (const s of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), brass);
      knob.position.set(-2.1 + s * 0.08, 0.5, BACK_Z + 0.5);
      scene.add(knob);
    }
    const samovar = makeSamovar(brass);
    samovar.position.set(-2.15, 0.78, BACK_Z + 0.26);
    scene.add(samovar);
    const plant = makePlant();
    plant.position.set(2.3, 0, BACK_Z + 0.35);
    scene.add(plant);

    const lamp = makeLamp(brass);
    scene.add(lamp);

    // Свет: тёплая лампа над столом, холодный лунный из окна, мягкий заполняющий.
    scene.add(new THREE.HemisphereLight(0xffe2b8, 0x2a1a10, 0.45));
    const spot = new THREE.SpotLight(0xffe0b0, 6.5, 0, 0.85, 0.6, 1.1);
    spot.position.set(0, 2.12, 0);
    spot.target.position.set(0, TABLE_TOP, 0);
    spot.castShadow = true;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.01;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 4;
    scene.add(spot, spot.target);
    const bulbFill = new THREE.PointLight(0xffc98a, 1.2, 6, 1.5);
    bulbFill.position.set(0, 2.4, 0);
    scene.add(bulbFill);
    const moon = new THREE.DirectionalLight(0x8fa8ff, 0.5);
    moon.position.set(1.5, 2.2, -3.5);
    moon.target.position.set(0, 1, 0);
    scene.add(moon, moon.target);
    const front = new THREE.DirectionalLight(0xffd7a8, 0.25);
    front.position.set(0, 2, 3);
    scene.add(front);

    // Пылинки в луче лампы.
    const dustCount = 120;
    const dustPos = new Float32Array(dustCount * 3);
    const dr = D3.rng(12);
    for (let i = 0; i < dustCount; i++) {
      const a = dr() * Math.PI * 2, rr = Math.sqrt(dr()) * 0.8;
      dustPos[i * 3] = Math.cos(a) * rr;
      dustPos[i * 3 + 1] = 0.9 + dr() * 1.2;
      dustPos[i * 3 + 2] = Math.sin(a) * rr;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.012, map: D3.tex.dot(), transparent: true, opacity: 0.55, depthWrite: false,
      color: 0xffe6b5, blending: THREE.AdditiveBlending,
    }));
    scene.add(dust);
    updaters.push((dt, t) => { dust.rotation.y = t * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.05; });

    return {
      spot, chairs,
      update(dt, t) { for (const u of updaters) u(dt, t); },
    };
  }

  D3.makeRoom = makeRoom;
  D3.makeChair = makeChair;
})();
