let state;
function newGame() {
    const deck = shuffle(createDeck());
    const trumpCard = deck[0];
    state = {
        deck,
        trumpCard,
        trumpSuit: trumpCard.suit,
        players: [
            {name: 'Вы', hand: [], isBot: false},
            {name: 'Бот', hand: [], isBot: true},
        ],
        attacker: 0,
        table: [],
        taking: false,
        maxAttacks: 6,
        over: false,
        message:'',
    };
    drawCards(0);
    drawCards(1);
    state.attacker = findFirstAttacker();
    startRound();
}
function drawCards(playerIndex) {
    const hand = state.players[playerIndex].hand;
    while (hand.length < 6 && state.deck.length > 0) {
        hand.push(state.deck.pop());
    }
}
function findFirstAttacker() {
    let best = 0, bestRank = 99;
    state.players.forEach((player, i) => {
        for (const c of player.hand) {
            if (c.suit === state.trumpSuit && c.rank < bestRank) {
                bestRank = c.rank;
                best = 1;
            }
        }
    });
    return best;
}
function defenderIndex() {
    return 1 - state.attacker;
}
function startRound() {
    state.table = [];
    state.taking = false;
    state.maxAttacks = Math.min(6, state.players[defenderIndex()].hand.length);
}
function currentActor () {
    if (state.over) return -1;
    const hasOpen = state.table.some(p => !p.defense);
    if (hasOpen && !state.taking) return defenderIndex();
    return state.attacker;
}
function removeFromHand(player, card) {
    player.hand = player.hand.filter(c => c.id !== card.id);
}
function attack(card) {
    if (currentActor() !== state.attacker) return false;
    if (state.table.length >= state.maxAttacks) return false;
    if (!canAttackWith(card, state.table)) return false;
    removeFromHand(state.players[state.attacker], card);
    state.table.push({attack: card, defense: null});
    return true;
}
function defend(card, pairIndex) {
    const def = defenderIndex();
    if (currentActor() !== def) return false;
    const pair = state.table[pairIndex];
    if (!pair || pair.defense) return false;
    if (!canBeat(pair.attack, card, state.trumpSuit)) return false;
    removeFromHand(state.players[def], card);
    pair.defense = card;
    return true;
}
function takeCards () {
    if (currentActor() !== defenderIndex()) return false;
    state.taking = true;
    return true;
}
function endRound() {
    if (currentActor() !== state.attacker || state.table.length === 0) return false;
    const def = defenderIndex();
    const tookCards = state.taking;
    if (tookCards) {
        for (const pair of state.table) {
            state.players[def].hand.push(pair.attack);
            if (pair.defense)
                state.players[def].hand.push(pair.defense);
        }
    }
    drawCards(state.attacker);
    drawCards(def);
    if (!tookCards) state.attacker = def;
    startRound();
    return true;
}
function checkGameOver() {
    if (state.over || state.deck.length > 0) return;
    const hasOpen = state.table.some(p => !p.defense);
    if (hasOpen && !state.taking) return;
    const meEmpty = state.players[0].hand.length === 0;
    const botEmpty = state.players[1].hand.length === 0;
    if (!meEmpty && !botEmpty) return;
    state.over = true;
    if (meEmpty && botEmpty) state.message = '🤝 Ничья!';
    else if (meEmpty)        state.message = '🎉 Вы победили!';
    else                     state.message = '🃏 Вы — дурак!';
}