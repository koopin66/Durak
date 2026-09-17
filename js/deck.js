const SUITS = ['♠', '♣', '♥', '♦'];
const RANKS = [6, 7, 8 ,9, 10, 11, 12, 13, 14];
const RANK_NAMES = {6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'В', 12: 'Д', 13: 'К', 14: 'Т'};
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({suit, rank, id: suit + rank});
        }
    }
    return deck;
}
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function isRed(card) {
    return card.suit === '♥' || card.suit === '♦'; 
}