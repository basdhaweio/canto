# Home-screen flashcard widget (KWGT)

A KWGT widget that shows one Canto card at a time. Tap the card to flip it, tap **Next** for another card, tap **Grade** to open that exact card in the Canto app and grade it into your schedule. Same approach as the library widget: the site publishes small JSON files and the widget reads them. Nothing on the phone talks back to GitHub.

## What the site publishes

`https://basdhaweio.github.io/canto/widget/<deck>.json`, built by `tools/build_widget.py` (validate fails if they're stale):

| Deck file | Cards |
|---|---|
| `all.json` | Every flashcard: vocabulary-slide words, particles & endings, numbers |
| `unit-1.json` … `unit-8.json` | One unit (both sets, its particles; Unit 2 includes numbers) |
| `particles.json` | Particles & endings |
| `numbers.json` | Numbers (numeral on the front) |
| `decks.json` | The list above with card counts |

Each deck: `{"deck", "title", "n", "cards": [{"k", "f1", "f2", "b1", "b2", "tag"}]}` — `f1`/`f2` front (big line, small line), `b1`/`b2` back, `tag` like "U3 · Set 1", `k` the app's card key. Cards are in a fixed shuffled order.

The app route `#/q/<k>` (e.g. `…/canto/#/q/u3-v012:f`) opens that single card, lets you flip and grade it, then offers the day's due cards.

## Build it in KWGT (one time, ~10 minutes)

1. Long-press the home screen → Widgets → KWGT → pick a **4×2** (or 4×3) size. Tap the empty widget to open the editor.
2. **Globals tab** → add three **Text** globals:

   | Name | Value |
   |---|---|
   | `src` | `https://basdhaweio.github.io/canto/widget/all.json` |
   | `i` | `0` |
   | `f` | `-1` |

   `src` is the deck (swap `all` for `unit-8`, `particles`, `numbers`, …). `i` is the card showing. `f` is the card whose answer is showing — when it equals `i` the back is visible, so moving to the next card hides the answer automatically.

3. **Items tab** → add a **Stack Group** (vertical). Inside it add these **Text** items (paste each formula as the text):

   | Item | Formula | Suggested size |
   |---|---|---|
   | Tag | `$wg(gv(src), json, ".cards[" + gv(i) + "].tag")$` | small, muted |
   | Front | `$wg(gv(src), json, ".cards[" + gv(i) + "].f1")$` | large (the characters) |
   | Front 2 | `$wg(gv(src), json, ".cards[" + gv(i) + "].f2")$` | medium (Jyutping) |
   | Back | `$if(gv(f) = gv(i), wg(gv(src), json, ".cards[" + gv(i) + "].b1"), "tap to flip")$` | medium |
   | Back 2 | `$if(gv(f) = gv(i), wg(gv(src), json, ".cards[" + gv(i) + "].b2"), "")$` | small, muted |

4. Below them add a horizontal **Stack Group** with two Text items: `Next ›` and `Grade`.

5. **Touch** actions (select the item → Touch tab → add a Single tap action):

   | Item | Action | Setting |
   |---|---|---|
   | The vertical stack (the card) | **Switch Global** | Global `f`, value `$gv(i)$` |
   | `Next ›` | **Switch Global** | Global `i`, value `$mu(rnd, 0, wg(gv(src), json, ".n") - 1)$` |
   | `Grade` | **Open Link** | `$"https://basdhaweio.github.io/canto/#/q/" + wg(gv(src), json, ".cards[" + gv(i) + "].k")$` |

   Switch Global on a **Text** global sets it to the formula's value at the moment you tap — that's what makes flip and next work.

6. Save (disk icon). Style to taste: the app's colours are background `#0f1318`, card `#161c24`, accent `#c8974a`, muted text `#8a9bb0`.

## Notes

- **Grading only counts in the app.** Flipping and Next in the widget are practice; your schedule lives inside Canto on this phone, so tap **Grade** for cards you want scheduled. With Canto installed from Chrome, the link opens the installed app, not a browser tab.
- **Due cards:** the widget can't see which cards are due (that would need Canto's sync, which is on the roadmap). For due-first practice, long-press the Canto icon → **Review**.
- **New units** appear in the widget automatically once they're pushed — the deck files are rebuilt with the content. KWGT caches downloads; if a new unit doesn't show, open the widget editor and back out, or wait for its next refresh.
- **Offline:** KWGT keeps the last downloaded deck, so the widget still works without a connection; Grade needs the app, which also works offline.

## If something doesn't work

- **Blank text:** the formula is missing a double quote — every URL and JSON path in `wg()` must be in quotes. Check `src` has no trailing space.
- **Next always shows the same card:** make sure `i` is a **Text** global (not Number) and the action is Switch Global with the formula as the value.
- **Grade does nothing:** some KWGT versions don't evaluate formulas in Open Link. Use the action **Launch App → Canto** instead (you'll land on the home screen rather than the exact card).

## App icon shortcuts

Long-press the installed Canto icon for **Review**, **Particles**, **Numbers** and **Dictionary**. Drag any of them onto the home screen to pin it as its own icon.
