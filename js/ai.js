function cardWeight(card) {
    return card.rank + (card.suit === state.trumpSuit ? 100 : 0);
}
// level: 'easy' — ходит наугад, 'normal' — экономит сильные карты, 'hard' — ещё и активнее подкидывает.
function botMove(level = 'normal') {
    const me = currentActor();
    if (me < 0 || !state.players[me].isBot) return;
    const hand = [...state.players[me].hand].sort((a,b) => cardWeight(a) - cardWeight(b));
    const pick = options => level === 'easy'
        ? options[Math.floor(Math.random() * options.length)]
        : options[0];
    if (me === defenderIndex()) {
        const idx = state.table.findIndex(p => !p.defense);
        const card = pick(hand.filter(c => canBeat(state.table[idx].attack, c, state.trumpSuit)));
        if (card) defend(card, idx);
        else takeCards();
        return;
    }
    if (state.table.length < state.maxAttacks) {
        const limit = level === 'hard' ? 13 : 11;
        const options = hand.filter(c => canAttackWith(c, state.table) &&
            (state.table.length === 0 || state.deck.length === 0 || cardWeight(c) <= limit ||
             (level === 'hard' && state.taking && c.suit !== state.trumpSuit)));
        const skipThrowIn = level === 'easy' && state.table.length > 0 && Math.random() < 0.5;
        const card = skipThrowIn ? null : pick(options);
        if (card) {attack(card); return;}
    }
    endRound();
}
