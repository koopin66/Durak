const $ = id => document.getElementById(id);
let botTimer = null;

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

function render() {
  const actor = currentActor();
  const myAttack = actor === 0 && state.attacker === 0;
  const myDefense = actor === 0 && defenderIndex() === 0;

  const botCards = state.players[1].hand.length;
  $('bot-count').textContent = `${botCards} ${plural(botCards)}`;
  $('trump-badge').innerHTML =
    `Козырь <b class="${isRed(state.trumpCard) ? 'red' : ''}">${state.trumpSuit}</b>`;

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

  $('take-btn').disabled = !myDefense;
  $('done-btn').disabled = !(myAttack && state.table.length > 0);
  $('done-btn').textContent = state.taking && state.attacker === 0 ? 'Забирай' : 'Бито';

  let text;
  if (state.over) text = state.message;
  else if (actor === 1) text = 'Бот думает…';
  else if (myDefense) text = 'Отбейтесь или нажмите «Беру»';
  else if (state.table.length === 0) text = 'Ваш ход — выберите карту';
  else if (state.taking) text = 'Бот берёт. Подкиньте или нажмите «Забирай»';
  else text = 'Подкиньте карту или нажмите «Бито»';
  $('status').textContent = text;
  $('status').classList.toggle('status--mine', actor === 0);

  $('overlay').classList.toggle('hidden', !state.over);
  $('result').textContent = state.message;
}
function afterAction() {
  checkGameOver();
  render();
  scheduleBot();
}

function scheduleBot() {
  clearTimeout(botTimer);
  const actor = currentActor();
  if (actor >= 0 && state.players[actor].isBot) {
    botTimer = setTimeout(() => { botMove(); afterAction(); }, 700);
  }
}

function startGame() {
  clearTimeout(botTimer); // иначе старый таймер бота «сходит» в новой игре
  newGame();
  afterAction();
}

$('my-hand').addEventListener('click', e => {
  const el = e.target.closest('.card');
  if (!el || currentActor() !== 0) return;

  const card = state.players[0].hand.find(c => c.id === el.dataset.id);
  if (!isPlayable(card)) {
    el.classList.add('shake'); // «нельзя» — карта трясётся
    setTimeout(() => el.classList.remove('shake'), 300);
    return;
  }

  if (state.attacker === 0) attack(card);
  else defend(card, state.table.findIndex(p => !p.defense));
  afterAction();
});

$('take-btn').addEventListener('click', () => { if (takeCards()) afterAction(); });
$('done-btn').addEventListener('click', () => { if (endRound()) afterAction(); });
$('new-game-btn').addEventListener('click', startGame);
$('again-btn').addEventListener('click', startGame);
startGame();