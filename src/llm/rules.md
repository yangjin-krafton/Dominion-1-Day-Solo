# Dominion Solo - LLM Player Rules

## Goal
Reach the target VP (victory points) or exhaust Province pile or 3+ supply piles.

## Turn Flow
1. **Action Phase**: Play action cards (each costs 1 action). Start with 1 action/turn.
2. **Treasure Phase**: Play treasure cards to gain coins.
3. **Buy Phase**: Buy cards from supply (each costs 1 buy). Start with 1 buy/turn.
4. **Cleanup**: All hand + played cards -> discard. Draw 5 new cards. Reset actions=1, buys=1, coins=0.

## Deck Mechanics
- Starting deck: 7 Copper + 3 Estate (shuffled)
- When deck empty: shuffle discard -> new deck
- Cards cycle: deck -> hand -> play -> discard -> (shuffle) -> deck

## Victory Points
- Estate: +1 VP, Duchy: +3 VP, Province: +6 VP, Curse: -1 VP
- Gardens: +1 VP per 10 cards you own (floor)
- VP recalculated each turn from ALL cards (deck+hand+play+discard)

## Market Event System (Solo Opponent)
After each turn, one market event fires. Events modify supply to create pressure.
- **vanish**: Remove 1-2 cards from a supply pile (weighted by stock)
- **curse_player**: Add 1 curse to your discard (18% chance)
- **skip**: Nothing happens

Timeline preview (fog-of-war):
- T+1: Full info (card name + count)
- T+2: Card name only
- T+3: Type only
- T+4: Hidden "???"

## Market Interference Cards
These kingdom cards fight back against market pressure:
- **Militia**: coin+2, reduces next vanish count by 1
- **Moat**: draw+2, if held at turn end -> skip next market event
- **Bureaucrat**: gain Silver to deck top, reveal T+1/T+2 events fully
- **Witch**: draw+2, every 3 turns insert a skip event (permanent)
- **Bandit**: gain Gold, 3-turn vanish reduction, 2-turn reveal

## Card Reference

### Treasure
| id | name | cost | effect |
|---|---|---|---|
| copper | Copper | 0 | +1 coin |
| silver | Silver | 3 | +2 coins |
| gold | Gold | 6 | +3 coins |

### Victory
| id | name | cost | VP |
|---|---|---|---|
| estate | Estate | 2 | +1 |
| duchy | Duchy | 5 | +3 |
| province | Province | 8 | +6 |
| gardens | Gardens | 4 | +1 per 10 cards |

### Curse
| id | name | cost | VP |
|---|---|---|---|
| curse | Curse | 0 | -1 |

### Kingdom Cards
| id | name | cost | effect |
|---|---|---|---|
| cellar | Cellar | 2 | +1 action. Discard any number, draw that many. |
| chapel | Chapel | 2 | Trash up to 4 cards from hand. |
| moat | Moat | 2 | +2 cards. Reaction: delays market event 1 turn. |
| harbinger | Harbinger | 3 | +1 card, +1 action. Put 1 card from discard on top of deck. |
| merchant | Merchant | 3 | +1 card, +1 action. First Silver played this turn: +1 coin. |
| vassal | Vassal | 3 | +2 coins. Reveal top deck card; if Action, may play it free. |
| village | Village | 3 | +1 card, +2 actions. |
| workshop | Workshop | 3 | Gain a card costing up to 4. |
| bureaucrat | Bureaucrat | 4 | Gain Silver on deck top. Reveal market T+1/T+2. |
| gardens | Gardens | 4 | Victory: +1 VP per 10 cards owned. |
| militia | Militia | 4 | +2 coins. Reduce next market vanish by 1. |
| moneylender | Moneylender | 4 | Trash a Copper for +3 coins. |
| poacher | Poacher | 4 | +1 card, +1 action, +1 coin. Discard 1 per empty supply pile. |
| remodel | Remodel | 4 | Trash a card, gain one costing up to 2 more. |
| smithy | Smithy | 4 | +3 cards. |
| throne_room | Throne Room | 4 | Choose an action in hand, play it twice. |
| bandit | Bandit | 5 | Gain Gold. 3-turn market vanish reduction, 2-turn reveal. |
| council_room | Council Room | 5 | +4 cards, +1 buy. Market vanish +1 next turn. |
| festival | Festival | 5 | +2 actions, +1 buy, +2 coins. |
| laboratory | Laboratory | 5 | +2 cards, +1 action. |
| library | Library | 5 | Draw until 7 cards in hand. May skip action cards. |
| market | Market | 5 | +1 card, +1 action, +1 buy, +1 coin. |
| mine | Mine | 5 | Trash a treasure, gain treasure costing up to 3 more to hand. |
| sentry | Sentry | 5 | +1 card, +1 action. Look at top 2: trash/discard/reorder. |
| witch | Witch | 5 | +2 cards. Every 3 turns, insert skip event (permanent). |
| artisan | Artisan | 6 | Gain card costing up to 5 to hand. Put 1 hand card on deck. |

## Strategy Tips
- **Early** (turn 1-4): Buy Silver to build economy. Chapel to thin Coppers/Estates.
- **Mid** (turn 5-10): Buy Gold, strong action cards (Smithy, Laboratory, Market, Festival).
- **Late** (turn 10+): Buy Province (8 coins) and Duchy (5 coins) for VP.
- Avoid buying too many Victory cards early (they clog your deck with dead draws).
- Use +action cards (Village, Festival, Laboratory) to chain multiple actions per turn.
- Watch the market timeline: buy threatened cards before they vanish.
- Militia/Moat/Witch protect against market pressure.
- Thin your deck (Chapel, Remodel) for more consistent draws.
