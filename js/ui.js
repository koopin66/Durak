const $ = id => document.getElementById(id);
let botTimer = null;
let overTimer = null;
let view3d = false;
let opponent = loadOpponent();

function loadOpponent() {
  try {
    const saved = localStorage.getItem('durak-opponent');
    if (saved && OPPONENTS[saved]) return saved;
  } catch (e) { /* хранилище недоступно — берём по умолчанию */ }
  return 'grandpa';
}

function cardHTML(card, extraClass = '') {
  const r = RANK_NAMES[card.rank];
  const classes = [
    'card',
    isRed(card) ? 'red' : '',
    card.suit === state.trumpSuit ? 'is-trump' : '',
    extraClass,
  ].join(' ');

  return `<div class="${classes}" data-id="${card.id}">
            <span class="corner top">${r}<br>${card.suit}</span>
            <span class="center">${card.suit}</span>
            <span class="corner bottom">${r}<br>${card.suit}</span>
          </div>`;
}
function plural(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'карта';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'карты';
  return 'карт';
}

let shownOnTable = new Set();

function sortHand(hand) {
  return [...hand].sort((a, b) =>
    (a.suit === state.trumpSuit) - (b.suit === state.trumpSuit) ||
    SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) ||
    a.rank - b.rank
  );
}

function isPlayable(card) {
  if (currentActor() !== 0) return false;
  if (state.attacker === 0) {
    return state.table.length < state.maxAttacks && canAttackWith(card, state.table);
  }
  const open = state.table.find(p => !p.defense);
  return !!open && canBeat(open.attack, card, state.trumpSuit);
}

// 2D-стол — запасной вариант, если WebGL недоступен.
function render2D() {
  const actor = currentActor();
  $('bot-hand').innerHTML = state.players[1].hand.map(() => '<div class="card back"></div>').join('');
  $('bot-hand').classList.toggle('active', actor === 1);

  if (state.deck.length > 0) {
    $('deck').innerHTML =
      cardHTML(state.trumpCard, 'trump') +
      (state.deck.length > 1 ? '<div class="card back"></div>' : '') +
      `<span class="deck-count">${state.deck.length}</span>`;
  } else {
    $('deck').innerHTML =
      `<div class="trump-suit ${isRed(state.trumpCard) ? 'red' : ''}">${state.trumpSuit}</div>`;
  }

  const enter = card => (shownOnTable.has(card.id) ? '' : 'enter');
  $('table').innerHTML = state.table.map(p =>
    `<div class="pair">
       ${cardHTML(p.attack, enter(p.attack))}
       ${p.defense ? cardHTML(p.defense, 'defense ' + enter(p.defense)) : ''}
     </div>`
  ).join('');
  shownOnTable = new Set();
  for (const p of state.table) {
    shownOnTable.add(p.attack.id);
    if (p.defense) shownOnTable.add(p.defense.id);
  }

  $('my-hand').innerHTML = sortHand(state.players[0].hand)
    .map(c => cardHTML(c, isPlayable(c) ? 'playable' : ''))
    .join('');
  $('my-hand').classList.toggle('my-turn', actor === 0);
}

function measureView() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    handBottom: $('status').getBoundingClientRect().top - 6,
  };
}

function render(opts = {}) {
  const actor = currentActor();
  const myAttack = actor === 0 && state.attacker === 0;
  const myDefense = actor === 0 && defenderIndex() === 0;
  const opp = OPPONENTS[opponent];

  const botCards = state.players[1].hand.length;
  $('bot-name').textContent = opp.name;
  $('bot-avatar').textContent = opp.emoji;
  $('bot-count').textContent = `${botCards} ${plural(botCards)}`;
  $('trump-badge').innerHTML =
    `<span class="trump-label">Козырь</span> <b class="${isRed(state.trumpCard) ? 'red' : ''}">${state.trumpSuit}</b>` +
    `<span class="deck-left">${state.deck.length ? `в колоде ${state.deck.length}` : 'колода пуста'}</span>`;

  $('take-btn').disabled = !myDefense;
  $('done-btn').disabled = !(myAttack && state.table.length > 0);
  $('done-btn').textContent = state.taking && state.attacker === 0 ? 'Забирай' : 'Бито';

  let text;
  if (state.over) text = state.message;
  else if (actor === 1) text = `${opp.name} думает…`;
  else if (myDefense) text = 'Отбейтесь или нажмите «Беру»';
  else if (state.table.length === 0) text = 'Ваш ход — выберите карту';
  else if (state.taking) text = `${opp.name} берёт. Подкиньте или нажмите «Забирай»`;
  else text = 'Подкиньте карту или нажмите «Бито»';
  $('status').textContent = text;
  $('status').classList.toggle('status--mine', actor === 0);
  $('result').textContent = state.message;

  if (view3d) {
    Scene3D.setView(measureView());
    Scene3D.sync(state, {
      newGame: !!opts.newGame,
      botActed: !!opts.botActed,
      myHand: sortHand(state.players[0].hand),
      playable: isPlayable,
      myTurn: actor === 0,
    });
    Scene3D.setThinking(actor === 1);
  } else {
    render2D();
  }
}

function react(mood, lineKey, duration) {
  const line = lineKey ? opponentLine(opponent, lineKey) : '';
  if (view3d) Scene3D.react(mood, line, duration);
  else if (line) showBubble2D(line);
}

let bubbleTimer = null;
function showBubble2D(text) {
  const b = $('bubble');
  b.textContent = text;
  b.classList.add('show', 'bubble--2d');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), 2000);
}

function onGameOver() {
  const meEmpty = state.players[0].hand.length === 0;
  const botEmpty = state.players[1].hand.length === 0;
  if (meEmpty && botEmpty) {
    react('surprised', 'draw', 3);
  } else if (meEmpty) {
    react('lose', 'lose', 60);
    if (view3d) Scene3D.celebrate();
    Sound.win();
  } else {
    react('win', 'win', 60);
    Sound.lose();
  }
  $('result-sub').textContent = meEmpty && !botEmpty
    ? `${OPPONENTS[opponent].name} остался в дураках`
    : botEmpty && !meEmpty ? 'Повезёт в следующий раз!' : 'Боевая ничья';
  clearTimeout(overTimer);
  overTimer = setTimeout(() => $('overlay').classList.remove('hidden'), view3d ? 1600 : 400);
}

function afterAction(opts = {}) {
  const wasOver = state.over;
  checkGameOver();
  render(opts);
  if (!wasOver && state.over) onGameOver();
  scheduleBot();
}

function snapshot() {
  return {
    table: state.table.length,
    defenses: state.table.filter(p => p.defense).length,
    taking: state.taking,
  };
}

// Что сделал бот — по разнице состояний до и после хода.
function botEvent(before) {
  if (before.table > 0 && state.table.length === 0) return before.taking ? 'give' : 'done';
  if (!before.taking && state.taking) return 'take';
  if (state.table.filter(p => p.defense).length > before.defenses) return 'defend';
  if (state.table.length > before.table) return 'attack';
  return null;
}

function scheduleBot() {
  clearTimeout(botTimer);
  const actor = currentActor();
  if (actor >= 0 && state.players[actor].isBot) {
    botTimer = setTimeout(() => {
      const before = snapshot();
      botMove(OPPONENTS[opponent].level);
      const evt = botEvent(before);
      if (evt === 'take') react('lose', 'take', 1.4);
      else if (evt === 'done' || evt === 'give') react('happy', evt, 1.2);
      else if (evt === 'defend') react('happy', Math.random() < 0.35 ? 'defend' : null, 1);
      else if (evt === 'attack' && Math.random() < 0.3) react(null, 'attack');
      afterAction({ botActed: true });
    }, view3d ? 950 : 700);
  }
}

function startGame() {
  clearTimeout(botTimer); // иначе старый таймер бота «сходит» в новой игре
  clearTimeout(overTimer);
  $('overlay').classList.add('hidden');
  newGame();
  if (view3d) Scene3D.react('idle', null);
  afterAction({ newGame: true });
  setTimeout(() => { if (!state.over) react(null, 'start'); }, view3d ? 1400 : 300);
}

function playCard(id) {
  if (!state || state.over || currentActor() !== 0) return false;
  const card = state.players[0].hand.find(c => c.id === id);
  if (!card || !isPlayable(card)) { Sound.error(); return false; }
  if (state.attacker === 0) attack(card);
  else defend(card, state.table.findIndex(p => !p.defense));
  afterAction();
  return true;
}

// ---------- Выбор соперника ----------
function renderOpponents() {
  $('opponents').innerHTML = Object.entries(OPPONENTS).map(([id, o]) =>
    `<button class="opponent ${id === opponent ? 'selected' : ''}" data-id="${id}">
       <span class="opponent-emoji">${o.emoji}</span>
       <span class="opponent-name">${o.name}</span>
       <span class="opponent-level level-${o.level}">${{ easy: 'Легко', normal: 'Средне', hard: 'Сложно' }[o.level]}</span>
       <span class="opponent-about">${o.about}</span>
     </button>`
  ).join('');
}

function openStart() {
  clearTimeout(botTimer);
  clearTimeout(overTimer);
  $('overlay').classList.add('hidden');
  renderOpponents();
  $('start').classList.remove('hidden');
  document.body.classList.add('in-menu');
  if (view3d) Scene3D.standUp();
}

function sitAndPlay() {
  Sound.click();
  $('start').classList.add('hidden');
  document.body.classList.remove('in-menu');
  if (view3d) Scene3D.sitDown(startGame);
  else startGame();
}

$('opponents').addEventListener('click', e => {
  const el = e.target.closest('.opponent');
  if (!el) return;
  opponent = el.dataset.id;
  try { localStorage.setItem('durak-opponent', opponent); } catch (err) { /* ничего */ }
  Sound.click();
  renderOpponents();
  if (view3d) {
    Scene3D.setCharacter(opponent);
    Scene3D.react('happy', opponentLine(opponent, 'start'), 1.2);
  }
});

$('my-hand').addEventListener('click', e => {
  const el = e.target.closest('.card');
  if (!el || currentActor() !== 0) return;
  if (!playCard(el.dataset.id)) {
    el.classList.add('shake'); // «нельзя» — карта трясётся
    setTimeout(() => el.classList.remove('shake'), 300);
  }
});

function updateSoundBtn() {
  $('sound-btn').textContent = Sound.muted ? '🔇' : '🔊';
  $('sound-btn').setAttribute('aria-label', Sound.muted ? 'Включить звук' : 'Выключить звук');
}

$('take-btn').addEventListener('click', () => {
  if (takeCards()) { Sound.click(); react('happy', 'playerTake', 1.4); afterAction(); }
});
$('done-btn').addEventListener('click', () => { if (endRound()) { Sound.click(); afterAction(); } });
$('new-game-btn').addEventListener('click', () => { Sound.click(); startGame(); });
$('again-btn').addEventListener('click', () => { Sound.click(); startGame(); });
$('change-btn').addEventListener('click', openStart);
$('bot-avatar').addEventListener('click', openStart);
$('play-btn').addEventListener('click', sitAndPlay);
$('sound-btn').addEventListener('click', () => { Sound.toggle(); updateSoundBtn(); Sound.click(); });
updateSoundBtn();

view3d = Scene3D.init($('scene'), {
  character: opponent,
  onCard: playCard,
  onCardMove: () => Sound.card(),
  onResize: () => { if (state) { Scene3D.setView(measureView()); Scene3D.relayout(); } },
});
document.body.classList.add(view3d ? 'mode-3d' : 'mode-2d');
openStart();
