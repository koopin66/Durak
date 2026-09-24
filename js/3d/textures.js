// Процедурные текстуры на canvas: карты, дерево, обои, ковёр, окно, картина.
(function () {
  const D3 = window.D3 = window.D3 || {};

  const CARD_W = 360, CARD_H = 504;
  const RED = '#c8102e', BLACK = '#16181f', GOLD = '#d4a94a';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Детерминированный генератор случайных чисел — текстуры одинаковы при каждом запуске.
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Масти рисуем путями, а не символами шрифта: так они одинаковы на всех устройствах.
  function suitPath(ctx, suit, cx, cy, s) {
    const w = s, h = s;
    ctx.beginPath();
    if (suit === '♥') {
      ctx.moveTo(cx, cy + h * 0.44);
      ctx.bezierCurveTo(cx - w * 0.1, cy + h * 0.3, cx - w * 0.56, cy + h * 0.04, cx - w * 0.5, cy - h * 0.2);
      ctx.bezierCurveTo(cx - w * 0.45, cy - h * 0.52, cx - w * 0.07, cy - h * 0.52, cx, cy - h * 0.24);
      ctx.bezierCurveTo(cx + w * 0.07, cy - h * 0.52, cx + w * 0.45, cy - h * 0.52, cx + w * 0.5, cy - h * 0.2);
      ctx.bezierCurveTo(cx + w * 0.56, cy + h * 0.04, cx + w * 0.1, cy + h * 0.3, cx, cy + h * 0.44);
    } else if (suit === '♦') {
      ctx.moveTo(cx, cy - h * 0.5);
      ctx.quadraticCurveTo(cx + w * 0.14, cy - h * 0.14, cx + w * 0.38, cy);
      ctx.quadraticCurveTo(cx + w * 0.14, cy + h * 0.14, cx, cy + h * 0.5);
      ctx.quadraticCurveTo(cx - w * 0.14, cy + h * 0.14, cx - w * 0.38, cy);
      ctx.quadraticCurveTo(cx - w * 0.14, cy - h * 0.14, cx, cy - h * 0.5);
    } else if (suit === '♠') {
      ctx.moveTo(cx, cy - h * 0.5);
      ctx.bezierCurveTo(cx + w * 0.1, cy - h * 0.34, cx + w * 0.56, cy - h * 0.12, cx + w * 0.5, cy + h * 0.12);
      ctx.bezierCurveTo(cx + w * 0.45, cy + h * 0.38, cx + w * 0.1, cy + h * 0.38, cx + w * 0.03, cy + h * 0.2);
      ctx.quadraticCurveTo(cx + w * 0.06, cy + h * 0.42, cx + w * 0.2, cy + h * 0.5);
      ctx.lineTo(cx - w * 0.2, cy + h * 0.5);
      ctx.quadraticCurveTo(cx - w * 0.06, cy + h * 0.42, cx - w * 0.03, cy + h * 0.2);
      ctx.bezierCurveTo(cx - w * 0.1, cy + h * 0.38, cx - w * 0.45, cy + h * 0.38, cx - w * 0.5, cy + h * 0.12);
      ctx.bezierCurveTo(cx - w * 0.56, cy - h * 0.12, cx - w * 0.1, cy - h * 0.34, cx, cy - h * 0.5);
    } else {
      const r = w * 0.215;
      ctx.moveTo(cx + r, cy - h * 0.25);
      ctx.arc(cx, cy - h * 0.25, r, 0, Math.PI * 2);
      ctx.moveTo(cx - w * 0.25 + r, cy + h * 0.06);
      ctx.arc(cx - w * 0.25, cy + h * 0.06, r, 0, Math.PI * 2);
      ctx.moveTo(cx + w * 0.25 + r, cy + h * 0.06);
      ctx.arc(cx + w * 0.25, cy + h * 0.06, r, 0, Math.PI * 2);
      ctx.moveTo(cx + w * 0.12, cy - h * 0.05);
      ctx.arc(cx, cy - h * 0.05, w * 0.12, 0, Math.PI * 2);
      ctx.moveTo(cx + w * 0.04, cy + h * 0.08);
      ctx.quadraticCurveTo(cx + w * 0.06, cy + h * 0.42, cx + w * 0.2, cy + h * 0.5);
      ctx.lineTo(cx - w * 0.2, cy + h * 0.5);
      ctx.quadraticCurveTo(cx - w * 0.06, cy + h * 0.42, cx - w * 0.04, cy + h * 0.08);
    }
    ctx.fill();
  }

  const PIPS = {
    6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1]],
    7: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1], [.5, .25]],
    8: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1], [.5, .25], [.5, .75]],
    9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1], [.5, .5]],
    10: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1], [.5, 1 / 6], [.5, 5 / 6]],
  };

  const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';

  function drawCorner(ctx, card, color) {
    const r = RANK_NAMES[card.rank];
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${r.length > 1 ? 58 : 66}px ${SERIF}`;
    ctx.save();
    ctx.translate(48, 56);
    if (r.length > 1) ctx.scale(0.8, 1);
    ctx.fillText(r, 0, 0);
    ctx.restore();
    suitPath(ctx, card.suit, 48, 112, 44);
  }

  function drawCrown(ctx, cx, cy, s, round) {
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.45);
    ctx.lineTo(cx - s, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.12);
    ctx.lineTo(cx, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.12);
    ctx.lineTo(cx + s, cy - s * 0.2);
    ctx.lineTo(cx + s, cy + s * 0.45);
    ctx.closePath();
    ctx.fill();
    if (round) {
      for (const x of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.arc(cx + x * s, cy + (x === 0 ? -s * 0.58 : -s * 0.28), s * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function cardFront(card, isTrump) {
    const c = makeCanvas(CARD_W, CARD_H);
    const ctx = c.getContext('2d');
    const color = isRed(card) ? RED : BLACK;

    const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, '#fffdf7');
    bg.addColorStop(1, '#f1ece0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Тонкая внутренняя рамка; у козырей — золотая.
    roundRect(ctx, 10, 10, CARD_W - 20, CARD_H - 20, 22);
    ctx.lineWidth = isTrump ? 8 : 2;
    ctx.strokeStyle = isTrump ? GOLD : 'rgba(0,0,0,.12)';
    ctx.stroke();

    drawCorner(ctx, card, color);
    ctx.save();
    ctx.translate(CARD_W, CARD_H);
    ctx.rotate(Math.PI);
    drawCorner(ctx, card, color);
    ctx.restore();

    ctx.fillStyle = color;
    if (PIPS[card.rank]) {
      const x0 = CARD_W * 0.3, x1 = CARD_W * 0.7, y0 = CARD_H * 0.2, y1 = CARD_H * 0.8;
      for (const [px, py] of PIPS[card.rank]) {
        const x = x0 + (x1 - x0) * px, y = y0 + (y1 - y0) * py;
        ctx.save();
        ctx.translate(x, y);
        if (py > 0.5) ctx.rotate(Math.PI);
        suitPath(ctx, card.suit, 0, 0, 62);
        ctx.restore();
      }
    } else if (card.rank === 14) {
      const cx = CARD_W / 2, cy = CARD_H / 2;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 108, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.arc(cx, cy, 124, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      suitPath(ctx, card.suit, cx, cy, 150);
    } else {
      // Картинки: В, Д, К — рамка с гербом, буквой и короной.
      const fx = 70, fy = 60, fw = CARD_W - 140, fh = CARD_H - 120;
      const panel = ctx.createLinearGradient(0, fy, 0, fy + fh);
      panel.addColorStop(0, isRed(card) ? '#fde7e3' : '#e5e9f5');
      panel.addColorStop(1, isRed(card) ? '#f6c9bf' : '#c8d0e8');
      roundRect(ctx, fx, fy, fw, fh, 14);
      ctx.fillStyle = panel;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = GOLD;
      ctx.stroke();

      ctx.fillStyle = GOLD;
      const cx = CARD_W / 2;
      if (card.rank === 13) drawCrown(ctx, cx, fy + 62, 46, false);
      else if (card.rank === 12) drawCrown(ctx, cx, fy + 66, 38, true);
      else {
        ctx.beginPath();
        ctx.ellipse(cx, fy + 70, 44, 20, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(cx - 50, fy + 68, 100, 10);
      }

      ctx.fillStyle = color;
      ctx.font = `bold 150px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(RANK_NAMES[card.rank], cx, CARD_H / 2 + 10);
      suitPath(ctx, card.suit, cx, fy + fh - 58, 60);
    }
    return c;
  }

  function cardBack() {
    const c = makeCanvas(CARD_W, CARD_H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fbf6ea';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const m = 18;
    const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, '#8e1b2c');
    g.addColorStop(1, '#4a0b18');
    roundRect(ctx, m, m, CARD_W - 2 * m, CARD_H - 2 * m, 18);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(232, 190, 110, .35)';
    ctx.lineWidth = 2;
    for (let i = -CARD_H; i < CARD_W + CARD_H; i += 26) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CARD_H, CARD_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, CARD_H); ctx.lineTo(i + CARD_H, 0); ctx.stroke();
    }
    ctx.restore();
    roundRect(ctx, m + 10, m + 10, CARD_W - 2 * m - 20, CARD_H - 2 * m - 20, 12);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.stroke();

    const cx = CARD_W / 2, cy = CARD_H / 2;
    ctx.fillStyle = '#4a0b18';
    ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = GOLD;
    const d = 34;
    suitPath(ctx, '♠', cx, cy - d, 36);
    suitPath(ctx, '♥', cx + d, cy, 36);
    suitPath(ctx, '♣', cx, cy + d, 36);
    suitPath(ctx, '♦', cx - d, cy, 36);
    return c;
  }

  function floorWood() {
    const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d'), r = rng(7);
    const planks = 6, pw = S / planks;
    for (let i = 0; i < planks; i++) {
      const l = 30 + r() * 10;
      ctx.fillStyle = `hsl(${24 + r() * 6}, ${38 + r() * 10}%, ${l}%)`;
      ctx.fillRect(i * pw, 0, pw, S);
      for (let k = 0; k < 40; k++) {
        ctx.strokeStyle = `rgba(40, 20, 8, ${0.08 + r() * 0.12})`;
        ctx.lineWidth = 1 + r() * 2;
        const x = i * pw + r() * pw;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= S; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + k) * 4, y);
        ctx.stroke();
      }
      const cut = r() * S;
      ctx.fillStyle = 'rgba(20, 10, 4, .6)';
      ctx.fillRect(i * pw, cut, pw, 2);
      ctx.fillRect(i * pw, 0, 2, S);
    }
    return c;
  }

  function tableWood() {
    const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d'), r = rng(11);
    ctx.fillStyle = '#5a2a16';
    ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 140; k++) {
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '25, 8, 2' : '140, 70, 35'}, ${0.08 + r() * 0.14})`;
      ctx.lineWidth = 1 + r() * 3;
      const y = r() * S;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.015 + k) * 6);
      ctx.stroke();
    }
    return c;
  }

  function felt() {
    const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), r = rng(3);
    ctx.fillStyle = '#1d6b45';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 22;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function wallpaper() {
    const W = 256, H = 256, c = makeCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#23443f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0, 0, 0, .12)';
    ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(222, 186, 120, .16)';
    for (const [x, y] of [[W / 4, H / 4], [W * 3 / 4, H * 3 / 4]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 40); ctx.quadraticCurveTo(x + 10, y, x + 24, y);
      ctx.quadraticCurveTo(x + 10, y, x, y + 40); ctx.quadraticCurveTo(x - 10, y, x - 24, y);
      ctx.quadraticCurveTo(x - 10, y, x, y - 40);
      ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 52, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + 52, 6, 0, Math.PI * 2); ctx.fill();
    }
    return c;
  }

  function rug() {
    const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d'), cx = S / 2;
    const rings = ['#7c1d1d', '#d6a650', '#1e2f55', '#9b2626', '#d6a650', '#7c1d1d', '#1e2f55', '#b8862f'];
    rings.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cx, cx - i * 28, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(245, 222, 170, .55)';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, rr = cx - 42;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr);
      ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cx);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(214, 166, 80, .8)';
      ctx.beginPath(); ctx.ellipse(0, -44, 12, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    return c;
  }

  function nightSky() {
    const W = 512, H = 512, c = makeCanvas(W, H), ctx = c.getContext('2d'), r = rng(21);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1230');
    g.addColorStop(0.7, '#23305e');
    g.addColorStop(1, '#3c4a7a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + r() * 0.7})`;
      ctx.fillRect(r() * W, r() * H * 0.7, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    const mg = ctx.createRadialGradient(360, 120, 10, 360, 120, 110);
    mg.addColorStop(0, 'rgba(255, 244, 214, .5)');
    mg.addColorStop(1, 'rgba(255, 244, 214, 0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath(); ctx.arc(360, 120, 36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200, 190, 160, .35)';
    ctx.beginPath(); ctx.arc(350, 110, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(372, 132, 6, 0, Math.PI * 2); ctx.fill();
    // Заснеженные крыши и окна в домах напротив.
    ctx.fillStyle = '#121833';
    const roofs = [[0, 380, 120], [110, 350, 140], [240, 395, 110], [340, 360, 180]];
    for (const [x, y, w] of roofs) {
      ctx.fillRect(x, y, w, H - y);
      ctx.fillStyle = '#e8eefc';
      ctx.fillRect(x, y - 6, w, 8);
      ctx.fillStyle = '#121833';
      for (let wy = y + 30; wy < H; wy += 44) {
        for (let wx = x + 16; wx < x + w - 20; wx += 34) {
          if (r() < 0.35) {
            ctx.fillStyle = '#f6c56a';
            ctx.fillRect(wx, wy, 14, 18);
            ctx.fillStyle = '#121833';
          }
        }
      }
    }
    return c;
  }

  function painting() {
    const W = 512, H = 360, c = makeCanvas(W, H), ctx = c.getContext('2d'), r = rng(5);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f3c98b');
    g.addColorStop(0.6, '#e9a878');
    g.addColorStop(1, '#7c8a5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6f7d4e';
    ctx.beginPath(); ctx.moveTo(0, 260); ctx.quadraticCurveTo(200, 200, W, 250); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = '#556238';
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.quadraticCurveTo(300, 260, W, 310); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    // Берёзки.
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 70 + r() * 20, top = 40 + r() * 60, w = 8 + r() * 5;
      ctx.fillStyle = 'rgba(140, 160, 70, .75)';
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        ctx.ellipse(x + (r() - 0.5) * 50, top + 20 + k * 22, 24 + r() * 10, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f5f1e6';
      ctx.fillRect(x - w / 2, top, w, 300 - top);
      ctx.fillStyle = '#2a2a2a';
      for (let y = top + 10; y < 300; y += 14 + r() * 16) ctx.fillRect(x - w / 2, y, w * (0.4 + r() * 0.6), 3);
    }
    return c;
  }

  function clockFace() {
    const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), cx = S / 2;
    ctx.fillStyle = '#f7efdc';
    ctx.beginPath(); ctx.arc(cx, cx, cx, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1d12';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 28px ${SERIF}`;
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillText(String(i), cx + Math.sin(a) * 96, cx - Math.cos(a) * 96);
    }
    return c;
  }

  function knit(base, accent) {
    const S = 128, c = makeCanvas(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 40, S, 6);
    ctx.fillRect(0, 82, S, 6);
    for (let x = 0; x < S; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + 8, 56); ctx.lineTo(x + 16, 64); ctx.lineTo(x + 8, 72); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, .12)';
    for (let x = 0; x < S; x += 8) {
      for (let y = 0; y < S; y += 8) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 8); ctx.lineTo(x + 8, y); ctx.stroke();
      }
    }
    return c;
  }

  function softDot() {
    const S = 64, c = makeCanvas(S, S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return c;
  }

  const cache = new Map();
  function texture(key, draw, opts = {}) {
    if (cache.has(key)) return cache.get(key);
    const tex = new THREE.CanvasTexture(draw());
    tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tex.anisotropy = D3.maxAnisotropy || 1;
    if (opts.repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    cache.set(key, tex);
    return tex;
  }

  D3.tex = {
    cardFront: (card, isTrump) => texture(`card:${card.id}:${isTrump ? 1 : 0}`, () => cardFront(card, isTrump)),
    cardBack: () => texture('card:back', cardBack),
    floor: () => texture('floor', floorWood, { repeat: [3, 3] }),
    tableWood: () => texture('tableWood', tableWood, { repeat: [2, 2] }),
    felt: () => texture('felt', felt, { repeat: [3, 3] }),
    wallpaper: () => texture('wallpaper', wallpaper, { repeat: [10, 4] }),
    rug: () => texture('rug', rug),
    sky: () => texture('sky', nightSky),
    painting: () => texture('painting', painting),
    clock: () => texture('clock', clockFace),
    knit: (base, accent) => texture(`knit:${base}:${accent}`, () => knit(base, accent), { repeat: [2, 2] }),
    dot: () => texture('dot', softDot),
  };
  D3.rng = rng;
})();
