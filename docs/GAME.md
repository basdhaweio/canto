# The game (Journey)

Same model as Forge: XP, levels and titles, a streak with freezes, daily and weekly quests, an epic quest per unit, stats and achievements. Everything is computed from what the app already stores — card schedules, the per-day activity log, exercise answers, dialogue practice and lessons — so existing history counts, and nothing is double-counted. `progress.seen` only remembers what has already been celebrated. Code: `js/game.js` (rules), `js/journey.js` (page).

## XP

| Action | XP |
|---|---|
| Card graded (flashcards, quiz, quick quiz, widget Grade) | 2 |
| New word learned (a card's first grade) | 5 |
| Quiz answer: right / close (tones off) / wrong | 4 / 2 / 1 |
| Typed answer with every tone right | +2 |
| Exercise item finished | 5 |
| Dialogue run-through or role-play, every line revealed (once a day per dialogue) | 15 |
| Lesson marked done in Sessions | 50 |
| Daily quest / all four (perfect day) | 20 / +40 |
| Weekly quest / all five (perfect week) | 60 / +120 |
| Unit epic steps | 30–150 each |
| Achievements | 10–400 each |

Days before the game started only have review counts, so they earn the per-card XP; words already learned earn their +5 as "earlier" XP.

## Levels and titles

Level *n* needs 100 × (*n*−1)² XP. Titles: 1 Newcomer 新手, 5 Tourist 游客, 10 Neighbour 街坊, 15 Regular 熟客, 20 Local 本地人, 25 Chatterbox 吹水佬, 30 Storyteller 讲古佬, 40 Scholar 学者, 50 Master 师傅, 65 Legend 传奇, 80 Mythic 神级.

## Streak

A day is active once you grade or answer 10 cards, finish 3 exercise items, practise a dialogue or have your lesson. Every 7 active days banks a freeze (max 2); a missed day spends one instead of breaking the streak. Coming back after 4+ days earns the Comeback achievement.

## Quests

- **Daily** (targets in Settings): review 20 cards, learn 10 new words (met automatically when nothing new is left), answer 15 quiz questions, clear your due cards.
- **Weekly** (Monday–Sunday): study 5 days; answer 60 quiz questions at 80%+; practise 2 dialogues; do 10 exercise items; have your lesson.
- **Unit epics**, one per unit with flashcards: meet every Set 1 word, every Set 2 word, the unit's particles (and numbers in Unit 2); practise every dialogue; finish every exercise; ace a unit-only quiz (20+ questions, 90% right first time); 80% of the unit's word cards mature.

## Stats

Vocabulary, Particles and Numbers grow as their cards are learned and mature (each deck reaches about level 20 when fully mature). Tones grow with typed answers where every tone is right; Dialogue with run-throughs and line cards; Grammar with exercise items and grammar-example cards.

## Celebrations

Level-ups, achievements, epic steps and perfect days/weeks pop a card with confetti; quests finished show a toast. They wait until a flashcard session or quiz ends so they never interrupt an answer. The first time the game loads, one card summarises what your history already earned.
