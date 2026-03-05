# Dominion 1-Day Solo — Game Rules

This is a SOLO deck-building card game. There are NO other players.
Your opponent is the "Market" — an automated system that removes cards from the supply each turn.

## Victory Conditions (ANY of these = you win)
1. Your VP >= target VP (target is 10~20, shown at game start)
2. Province supply pile reaches 0
3. 3 or more supply piles reach 0

VP is recalculated every turn from ALL your cards (deck + hand + play area + discard).

## Turn Structure
Each turn you start with: actions=1, buys=1, coins=0

1. **Action Phase** — Play action cards from hand. Each action card costs 1 action to play. Some cards grant extra actions (+action).
2. **Treasure Phase** — Play treasure cards from hand. They add coins. No action cost needed.
3. **Buy Phase** — Spend coins to buy cards from supply. Each purchase costs 1 buy. Card goes to discard pile.
4. **Cleanup** — All hand + play area cards go to discard. Draw 5 new cards. Next turn begins.

IMPORTANT: You must play treasure cards BEFORE buying. Unplayed treasures = 0 coins.

## Deck Mechanics
- Starting deck: 7 Copper + 3 Estate
- When deck is empty and you need to draw: discard pile is shuffled into a new deck
- Bought/gained cards go to discard (not hand), available after shuffle

## Market Event System (Your Solo Opponent)
After EVERY turn end, one market event fires automatically:
- **vanish**: Removes 1~2 cards from a random supply pile (weighted by remaining stock). Does NOT target curse or victory cards.
- **curse_player** (18% chance): Adds 1 Curse card (-1 VP) to your discard pile.
- **skip**: Nothing happens this turn.

You can see upcoming events on the timeline:
- T+1 (next turn): Full info — which card, how many removed
- T+2: Card name only (count hidden)
- T+3: Card type only
- T+4: Completely hidden "???"

Key insight: The market will gradually deplete the supply. Buy important cards before they vanish!

## Market Interference Cards
Some kingdom cards have special effects against the market system (marked as "행동-시장" type):
- **Militia** (cost 4): +2 coins. Reduces the NEXT market vanish count by 1.
- **Moat** (cost 2): +2 cards. REACTION — if Moat is in your hand at turn end, the next market event is skipped entirely (no supply change).
- **Bureaucrat** (cost 4): Gain Silver on top of deck. Reveals hidden info on next market events.
- **Witch** (cost 5): +2 cards. PERMANENT: every 3 turns, a skip event is inserted into the market queue.
- **Bandit** (cost 5): Gain Gold. Reduces market vanish for 3 turns AND reveals market info for 2 turns.
- **Council Room** (cost 5): +4 cards, +1 buy. WARNING: increases next market vanish by 1.

## Card Reference

### Treasure Cards (play during treasure phase for coins)
| id | cost | effect |
|---|---|---|
| copper | 0 | +1 coin |
| silver | 3 | +2 coins |
| gold | 6 | +3 coins |

### Victory Cards (worth VP at all times, but dead draws — they do nothing when in hand)
| id | cost | VP |
|---|---|---|
| estate | 2 | +1 VP |
| duchy | 5 | +3 VP |
| province | 8 | +6 VP |
| gardens | 4 | +1 VP per 10 cards you own (rounded down) |

### Curse
| id | cost | VP |
|---|---|---|
| curse | 0 | -1 VP |

### Kingdom Cards (play during action phase, costs 1 action)
| id | cost | effect |
|---|---|---|
| cellar | 2 | +1 action. Discard any number of cards from hand, then draw that many. |
| chapel | 2 | Trash up to 4 cards from hand (permanently removed from game). |
| moat | 2 | +2 cards. Reaction: if in hand at turn end, skip next market event. |
| harbinger | 3 | +1 card, +1 action. Look at discard pile, may put 1 card on top of deck. |
| merchant | 3 | +1 card, +1 action. The first time you play Silver this turn, +1 coin. |
| vassal | 3 | +2 coins. Discard top card of deck; if it's an Action, you may play it for free. |
| village | 3 | +1 card, +2 actions. |
| workshop | 3 | Gain a card from supply costing up to 4 (free, no buy needed). |
| bureaucrat | 4 | Gain Silver on top of deck. Reveal next market events. |
| militia | 4 | +2 coins. Reduce next market vanish count by 1. |
| moneylender | 4 | Trash 1 Copper from hand. If you do, +3 coins. |
| poacher | 4 | +1 card, +1 action, +1 coin. Discard 1 card per empty supply pile. |
| remodel | 4 | Trash 1 card from hand. Gain a card costing up to 2 more than trashed card. |
| smithy | 4 | +3 cards. |
| throne_room | 4 | Choose 1 action card in hand and play it twice. |
| bandit | 5 | Gain Gold. Reduce market vanish for 3 turns. Reveal market for 2 turns. |
| council_room | 5 | +4 cards, +1 buy. Market vanish count +1 next turn (drawback). |
| festival | 5 | +2 actions, +1 buy, +2 coins. |
| laboratory | 5 | +2 cards, +1 action. |
| library | 5 | Draw cards until you have 7 in hand. You may skip (discard) action cards drawn this way. |
| market | 5 | +1 card, +1 action, +1 buy, +1 coin. |
| mine | 5 | Trash 1 treasure from hand. Gain a treasure costing up to 3 more, put it in hand. |
| sentry | 5 | +1 card, +1 action. Look at top 2 cards of deck: trash, discard, or put back in any order. |
| witch | 5 | +2 cards. Permanently: every 3 turns, insert a skip into market event queue. |
| artisan | 6 | Gain a card costing up to 5 directly to hand. Then put 1 card from hand on top of deck. |

## Strategy Guide
- **Early game (turn 1-5)**: Buy Silver for economy. Use Chapel to trash Copper/Estate (deck thinning). Avoid buying victory cards.
- **Mid game (turn 5-12)**: Buy Gold, powerful action cards (Smithy, Laboratory, Festival, Market). Build engine.
- **Late game (turn 12+)**: Buy Province (6 VP) when you can afford 8 coins. Buy Duchy (3 VP) with 5 coins.
- Play ALL treasure cards before buying. More coins = better purchases.
- Action cards that give "+action" (Village, Laboratory, Festival, Market) let you chain multiple actions per turn.
- Watch the market timeline: if a card you want is about to vanish, buy it NOW.
- Use market interference cards (Militia, Moat, Witch, Bandit) to slow down market pressure.
- Deck thinning (Chapel, Remodel, Moneylender) makes your draws more consistent.
- Gardens strategy: buy many cheap cards, each 10 cards = +1 VP per Gardens.
