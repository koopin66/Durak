function canBeat(attackCard, defenseCard, trumpSuit) {
    if (defenseCard.suit === attackCard.suit) {
        return defenseCard.rank > attackCard.rank;
    }
    return defenseCard.suit === trumpSuit && attackCard.suit !== trumpSuit;
}
function tableRanks(table) {
    const ranks = new Set();
    for (const pair of table) {
        ranks.add(pair.attack.rank);
        if (pair.defense) ranks.add(pair.defense.rank);
    }
    return ranks;
}
function canAttackWith(card, table) {
    return table.length === 0 ||
    tableRanks(table).has(card.rank);
}
