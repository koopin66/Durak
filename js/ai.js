function cardWeight(card) {
    return card.rank + (card.suit === state.trumpSuit ? 100 : 0);
}
function botMove() {
    const me = currentActor();
    if (me < 0 || !state.players[me].isBot) return;
    const hand = [...state.players[me].hand].sort((a,b) => cardWeight(a) - cardWeight(b));
    if (me === defenderIndex()) {
        const idx = state.table.findIndex(p => !p.defense);
        const card = hand.find(c => canBeat(state.table[idx].attack, c, state.trumpSuit));
        if (card) defend(card, idx);
        else takeCards();
        return;
    }
    if (state.table.length < state.maxAttacks) {
        const card = hand.find(c => canAttackWith(c, state.table) &&
        (state.table.length === 0 || state.deck.length === 0 || cardWeight(c) <= 11)
    );
    if (card) {attack(card); return;}
    }
    endRound();
}