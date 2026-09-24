// 3D-карты: меши, раскладка по зонам (колода, руки, стол, бито) и анимация перелётов.
(function () {
  const D3 = window.D3 = window.D3 || {};
  if (!window.THREE) return;
  const V = THREE.Vector3, Q = THREE.Quaternion;

  const CARD_W = 0.14, CARD_H = 0.196;
  D3.CARD_W = CARD_W; D3.CARD_H = CARD_H;

  const X = new V(1, 0, 0), Y = new V(0, 1, 0), Z = new V(0, 0, 1);
  const qAxis = (axis, a) => new Q().setFromAxisAngle(axis, a);
  const FACE_UP = qAxis(X, -Math.PI / 2);
  const FACE_DOWN = qAxis(X, Math.PI / 2);

  const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
  }

  function cardGeometry() {
    const geo = new THREE.ShapeGeometry(D3.roundedRectShape(CARD_W, CARD_H, 0.012), 6);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / CARD_W + 0.5, pos.getY(i) / CARD_H + 0.5);
    }
    return geo;
  }

  class Cards {
    constructor(scene, camera) {
      this.scene = scene;
      this.camera = camera;
      this.cards = new Map();
      this.geo = cardGeometry();
      this.glowGeo = new THREE.ShapeGeometry(D3.roundedRectShape(CARD_W + 0.022, CARD_H + 0.022, 0.02), 6);
      this.backMat = new THREE.MeshStandardMaterial({ map: D3.tex.cardBack(), roughness: 0.6 });
      this.discardOrder = [];
      this.trumpSuit = null;
      this.view = { width: 1, height: 1, handBottom: 1 };
      this.hoverId = null;
      this.drag = null;
      this.onMove = null;
      this._tmp = new V();
    }

    // Создаём 36 мешей один раз; при новой игре меняем лишь текстуры козырей.
    ensureCards(allCards, trumpSuit) {
      const trumpChanged = trumpSuit !== this.trumpSuit;
      this.trumpSuit = trumpSuit;
      for (const card of allCards) {
        let c = this.cards.get(card.id);
        if (!c) {
          const group = new THREE.Group();
          const frontMat = new THREE.MeshStandardMaterial({ roughness: 0.75, emissive: 0xffffff, emissiveIntensity: 0 });
          const front = new THREE.Mesh(this.geo, frontMat);
          front.position.z = 0.0004;
          const back = new THREE.Mesh(this.geo, this.backMat);
          back.rotation.y = Math.PI;
          back.position.z = -0.0004;
          const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false,
          });
          const glowMesh = new THREE.Mesh(this.glowGeo, glowMat);
          glowMesh.position.z = -0.0012;
          glowMesh.renderOrder = -1;
          group.add(glowMesh, front, back);
          front.castShadow = back.castShadow = true;
          front.receiveShadow = true;
          front.userData.cardId = card.id;
          this.scene.add(group);
          c = {
            card, group, front, back, glow: glowMat, zone: null,
            target: null, tw: null, shake: 0, glowTarget: 0, dim: 1,
          };
          this.cards.set(card.id, c);
        }
        if (trumpChanged || !c.front.material.map) {
          c.front.material.map = D3.tex.cardFront(card, card.suit === trumpSuit);
          c.front.material.emissiveMap = c.front.material.map;
          c.front.material.needsUpdate = true;
        }
      }
    }

    // ---------- Расчёт целевых положений ----------
    computeTargets(state, opts) {
      const T = D3.TABLE_TOP;
      const targets = new Map();
      const put = (id, pos, quat, extra = {}) => targets.set(id, { pos, quat, scale: 1, ...extra });

      // Колода и козырь под ней.
      const deckPos = new V(-0.5, T, 0.02);
      state.deck.forEach((card, i) => {
        if (i === 0 && card.id === state.trumpCard.id) {
          const q = qAxis(Y, Math.PI / 2 + 0.05).multiply(FACE_UP);
          put(card.id, new V(deckPos.x + 0.05, T + 0.0015, deckPos.z), q, { zone: 'deck' });
        } else {
          const q = qAxis(Y, (hash(card.id) - 0.5) * 0.06).multiply(FACE_DOWN);
          put(card.id, new V(deckPos.x + (hash(card.id + 'x') - 0.5) * 0.004, T + 0.004 + i * 0.0013, deckPos.z), q, { zone: 'deck' });
        }
      });

      // Пары на столе.
      const n = state.table.length;
      const spread = 0.2, rowGap = 0.25;
      state.table.forEach((pair, i) => {
        const row = n <= 3 ? 0 : Math.floor(i / 3);
        const inRow = n <= 3 ? n : (row === 0 ? 3 : n - 3);
        const col = i - row * 3;
        const x = (col - (inRow - 1) / 2) * spread + 0.03;
        const z = n <= 3 ? 0.02 : -0.12 + row * rowGap;
        const yaw = (hash(pair.attack.id) - 0.5) * 0.14;
        put(pair.attack.id, new V(x, T + 0.003, z), qAxis(Y, yaw).multiply(FACE_UP), { zone: 'table' });
        if (pair.defense) {
          const dyaw = -0.22 + (hash(pair.defense.id) - 0.5) * 0.1;
          put(pair.defense.id, new V(x + 0.03, T + 0.008, z + 0.04), qAxis(Y, dyaw).multiply(FACE_UP), { zone: 'table' });
        }
      });

      // Рука соперника — веер, который он держит перед собой.
      const bot = state.players[1].hand;
      const fanCenter = new V(0, 0.99, -0.64);
      const fanQ = qAxis(Y, Math.PI).multiply(qAxis(X, 0.35));
      const m = bot.length;
      const step = Math.min(0.13, 1.3 / Math.max(m, 1));
      bot.forEach((card, i) => {
        const a = (i - (m - 1) / 2) * step;
        const local = new V(Math.sin(a) * 0.2, Math.cos(a) * 0.2 - 0.2, i * 0.0022);
        const pos = local.applyQuaternion(fanQ).add(fanCenter);
        const q = fanQ.clone().multiply(qAxis(Z, -a));
        put(card.id, pos, q, { zone: 'bot', scale: 0.85 });
      });

      // Моя рука — в пространстве камеры, у нижнего края экрана.
      const mine = opts.myHand;
      const handTargets = this.handLayout(mine.length, mine.map(c => opts.playable(c)), mine.map(c => c.id));
      mine.forEach((card, i) => {
        put(card.id, handTargets[i].pos, handTargets[i].quat, {
          zone: 'me', scale: handTargets[i].scale, playable: opts.playable(card), mine: true, index: i,
        });
      });

      // Бито: всё, что не нашло себе места, лежит стопкой справа.
      const discardPos = new V(0.52, T, -0.1);
      for (const c of this.cards.values()) {
        if (targets.has(c.card.id)) continue;
        if (!this.discardOrder.includes(c.card.id)) this.discardOrder.push(c.card.id);
      }
      this.discardOrder = this.discardOrder.filter(id => !targets.has(id));
      this.discardOrder.forEach((id, i) => {
        const h = hash(id);
        const q = qAxis(Y, (h - 0.5) * 0.9).multiply(FACE_DOWN);
        put(id, new V(discardPos.x + (h - 0.5) * 0.05, T + 0.003 + i * 0.0013, discardPos.z + (hash(id + 'z') - 0.5) * 0.05), q, { zone: 'discard' });
      });
      return targets;
    }

    handLayout(n, playable, ids) {
      const cam = this.camera;
      const { width: W, height: H, handBottom } = this.view;
      const d = 0.6;
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      const tanH = tanV * cam.aspect;
      const pxPerUnit = H / (2 * d * tanV);
      const cardHpx = Math.min(H * 0.2, (W * 0.27) * 1.4, 190);
      const cardWpx = cardHpx / 1.4;
      const scale = cardHpx / pxPerUnit / CARD_H;
      const availW = Math.min(W - 16, 820);
      const step = n > 1 ? Math.min(cardWpx * 0.72, (availW - cardWpx) / (n - 1)) : 0;
      const centerY = handBottom - cardHpx * 0.5 - 4;
      const maxAngle = Math.min(0.07, 0.6 / Math.max(n, 1));
      const out = [];
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        const xpx = off * step;
        const norm = xpx / (availW / 2 || 1);
        let ypx = centerY + norm * norm * cardHpx * 0.12;
        if (playable[i]) ypx -= cardHpx * 0.13;
        if (ids[i] === this.hoverId) ypx -= cardHpx * 0.1;
        const ndcX = xpx / (W / 2), ndcY = 1 - (2 * ypx) / H;
        const local = new V(ndcX * tanH * d, ndcY * tanV * d, -d + i * 0.0016);
        const pos = local.applyMatrix4(cam.matrixWorld);
        const quat = cam.quaternion.clone().multiply(qAxis(X, -0.12)).multiply(qAxis(Z, -off * maxAngle));
        out.push({ pos, quat, scale: ids[i] === this.hoverId ? scale * 1.05 : scale });
      }
      return out;
    }

    // ---------- Синхронизация с состоянием игры ----------
    sync(state, opts) {
      this.ensureCards([...state.deck, ...state.players[0].hand, ...state.players[1].hand,
        ...state.table.flatMap(p => (p.defense ? [p.attack, p.defense] : [p.attack]))], state.trumpSuit);
      if (opts.newGame) this.discardOrder = [];
      this.lastState = state;
      this.lastOpts = opts;
      const targets = this.computeTargets(state, opts);
      let dealIndex = 0;
      const moved = [];
      for (const [id, tg] of targets) {
        const c = this.cards.get(id);
        const prevZone = c.zone;
        c.zone = tg.zone;
        c.mine = !!tg.mine;
        c.glowTarget = tg.playable ? 1 : 0;
        c.dim = opts.myTurn && tg.mine && !tg.playable ? 0.55 : 1;
        c.front.castShadow = !tg.mine;
        c.back.castShadow = !tg.mine;
        if (this.drag && this.drag.id === id) { c.target = tg; continue; }

        let delay = 0, dur = 0.5;
        if (opts.newGame) {
          // Сначала все карты слетаются в колоду, потом раздача по одной.
          const deckLike = tg.zone === 'deck';
          const gather = this.deckGatherTarget();
          if (prevZone === null) {
            c.group.position.copy(gather.pos);
            c.group.quaternion.copy(gather.quat);
          } else if (prevZone !== 'deck') {
            this.tween(c, gather, 0.45, 0, 0.12);
          }
          if (!deckLike) { delay = 0.55 + dealIndex * 0.11; dealIndex++; }
          this.tween(c, tg, 0.5, delay, deckLike ? 0.02 : 0.18, true);
          continue;
        }
        if (prevZone === tg.zone && tg.zone === 'me') dur = 0.22;
        if (prevZone === 'deck' && tg.zone !== 'deck') { delay = dealIndex * 0.1; dealIndex++; }
        if (prevZone !== tg.zone) moved.push({ id, from: prevZone, to: tg.zone });
        const arc = prevZone === tg.zone ? 0 : 0.14;
        this.tween(c, tg, dur, delay, arc);
      }
      return moved;
    }

    deckGatherTarget() {
      return { pos: new V(-0.5, D3.TABLE_TOP + 0.03, 0.02), quat: FACE_DOWN.clone(), scale: 1 };
    }

    tween(c, tg, dur, delay, arc, queue) {
      if (!queue && c.target && c.tw == null &&
          c.target.pos.distanceToSquared(tg.pos) < 1e-10 && c.target.quat.angleTo(tg.quat) < 1e-4 &&
          Math.abs(c.target.scale - tg.scale) < 1e-4) {
        c.target = tg;
        return;
      }
      // Карта ещё ждёт своей очереди при раздаче — меняем только пункт назначения,
      // чтобы не сбить поочерёдный полёт.
      if (!queue && c.queue) { c.queue.to = tg; c.target = tg; return; }
      if (!queue && c.tw && !c.tw.started) { c.tw.to = tg; c.target = tg; return; }
      const step = { to: tg, dur, delay, arc };
      if (queue && c.tw) {
        c.queue = step;
      } else {
        c.queue = null;
        this.startTween(c, step);
      }
      c.target = tg;
    }

    startTween(c, step) {
      const g = c.group;
      c.tw = {
        fromPos: g.position.clone(), fromQuat: g.quaternion.clone(), fromScale: g.scale.x,
        to: step.to, t: -step.delay, dur: step.dur, arc: step.arc, started: false,
      };
    }

    placeInstant(state, opts) {
      this.sync(state, opts);
      for (const c of this.cards.values()) {
        if (!c.target) continue;
        c.group.position.copy(c.target.pos);
        c.group.quaternion.copy(c.target.quat);
        c.group.scale.setScalar(c.target.scale);
        c.tw = null; c.queue = null;
      }
    }

    relayoutHand() {
      if (!this.lastState) return;
      this.sync(this.lastState, { ...this.lastOpts, newGame: false });
    }

    setHover(id) {
      if (id === this.hoverId) return;
      this.hoverId = id;
      this.relayoutHand();
    }

    shake(id) {
      const c = this.cards.get(id);
      if (c) c.shake = 0.4;
    }

    pick(raycaster) {
      const fronts = [];
      for (const c of this.cards.values()) if (c.mine) fronts.push(c.front);
      const hit = raycaster.intersectObjects(fronts, false)[0];
      return hit ? hit.object.userData.cardId : null;
    }

    // Точка на плоскости перед камерой под указателем.
    pointerWorld(ndcX, ndcY, d = 0.55) {
      const cam = this.camera;
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      return new V(ndcX * tanV * cam.aspect * d, ndcY * tanV * d, -d).applyMatrix4(cam.matrixWorld);
    }

    // Текущее положение карты — чтобы рука соперника «несла» её.
    positionOf(id, out = new V()) {
      const c = this.cards.get(id);
      return c ? out.copy(c.group.position) : null;
    }

    isMoving(id) {
      const c = this.cards.get(id);
      return !!(c && (c.tw || c.queue));
    }

    update(dt) {
      for (const c of this.cards.values()) {
        const g = c.group;
        if (this.drag && this.drag.id === c.card.id && this.drag.moved) {
          g.position.lerp(this.drag.pos, 1 - Math.exp(-25 * dt));
          g.quaternion.slerp(this.drag.quat, 1 - Math.exp(-20 * dt));
          g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, this.drag.scale, 1 - Math.exp(-15 * dt)));
        } else if (c.tw) {
          const tw = c.tw;
          tw.t += dt;
          if (tw.t >= 0) {
            if (!tw.started) {
              tw.started = true;
              tw.fromPos.copy(g.position); tw.fromQuat.copy(g.quaternion); tw.fromScale = g.scale.x;
              if (tw.arc > 0.05 && this.onMove) this.onMove(c);
            }
            const k = Math.min(1, tw.t / tw.dur);
            const e = easeInOut(k);
            g.position.lerpVectors(tw.fromPos, tw.to.pos, e);
            g.position.y += tw.arc * Math.sin(Math.PI * k);
            g.quaternion.slerpQuaternions(tw.fromQuat, tw.to.quat, e);
            g.scale.setScalar(THREE.MathUtils.lerp(tw.fromScale, tw.to.scale, e));
            if (k >= 1) {
              c.tw = null;
              if (c.queue) { this.startTween(c, c.queue); c.queue = null; }
            }
          }
        }
        if (c.shake > 0) {
          c.shake = Math.max(0, c.shake - dt);
          const s = Math.sin(c.shake * 60) * c.shake * 0.02;
          g.position.addScaledVector(this._tmp.set(1, 0, 0).applyQuaternion(this.camera.quaternion), s);
        }
        const pulse = 0.7 + Math.sin(performance.now() / 260) * 0.2;
        c.glow.opacity = THREE.MathUtils.lerp(c.glow.opacity, c.glowTarget * pulse, 1 - Math.exp(-10 * dt));
        const col = c.front.material.color;
        const dim = THREE.MathUtils.lerp(col.r, c.dim, 1 - Math.exp(-10 * dt));
        col.setRGB(dim, dim, dim);
        // Карты в руке смотрят на игрока, а не на лампу, — подсвечиваем их.
        const glowTarget = c.mine ? 0.42 * c.dim : 0.04;
        const mat = c.front.material;
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, glowTarget, 1 - Math.exp(-10 * dt));
      }
    }
  }

  D3.Cards = Cards;
})();
