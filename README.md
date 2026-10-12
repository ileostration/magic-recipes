# The Grimoire of Delicacies

A white-marble grimoire resting on a fur-thick meadow seen from above. Click it and it floats and opens on its chant page; turn that page and the reader takes over: a flat two-column page with page-turn transitions, a glass menu at the foot, bookmarks, notes you can write and draw on, and a crystal ball that answers in its own words.

The site is two scenes. Scene one (landing) owns the Three.js meadow and the 3D book; scene two (reader) is plain DOM, so the meadow is switched off entirely while you read and nothing 3D runs behind the pages. Closing the book returns to scene one with the book closed.

Everything runs in the browser as static files. No accounts, no server, no paid services.

## Run it

Any static file server works:

```
python3 -m http.server 8000
```

then open http://localhost:8000/. Opening `index.html` straight from disk also works in most browsers, because the recipe data ships as an ES module rather than a fetched JSON file.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In the repository settings, open **Pages**, choose **Deploy from a branch**, pick your branch and the `/ (root)` folder.
3. The site appears at `https://<user>.github.io/<repo>/`. The `.nojekyll` file is already in place so nothing is rewritten.

GitHub Pages is free for non-commercial sites, which this is.

## How the book chooses recipes

`js/recommend.js` blends two signals. The first is a precision-first engine over explicit tags (`data/taxonomy.json`). The second is a scikit-learn nearest-neighbour table (`data/similar.json`, built offline by `tools/similarity.py` from TF-IDF over tags and ingredient words) that orders candidates within each tier and can lift a confident neighbour into a tier. Every recipe carries a `dish`, 1 to 4 `flavors`, defining `mains`, a `category` and a `cuisine`. The reader's **seed** is the last recipe they stayed on for at least 10 seconds, or their last crystal-ball search. Candidates fall into three strict tiers:

| Tier | Rule | Example for a chocolate cake |
| --- | --- | --- |
| A | same dish and a shared taste | red velvet cake, chocolate lava cake |
| B | same taste family, different dish, same sweet-or-savoury group | brownies, chocolate cookies, hot chocolate |
| C | same dish, other taste | strawberry shortcake, carrot cake |

Nothing looser than tier C is ever shown. Quick flips (leaving before 10 seconds) walk the tiers in sets of three. On the tenth quick flip, or when the tiers run out, the crystal ball appears. Reading a recipe resets the walk and re-seeds from that recipe. Searching re-seeds from the query and the same tier logic applies to the results.

Tunables live at the top of `js/recommend.js`: `DWELL_MS` (10 000), `SET_SIZE` (3), `BALL_AT` (10).

**Goals.** A search such as "bodybuilding recipes", "high protein" or "gym" switches the reader into a goal. The pool then narrows to recipes whose estimated nutrition fits the goal (bodybuilding: at least 40 g protein and roughly 380 to 700 kcal per serving, or recipes tagged `goal: ["bodybuilding"]`). A pill at the top of the page shows the active goal and clears it on click.

**Opening page.** With history, the book opens to the recipe that best matches the reader's recency-weighted taste profile; without it, to a crowd-pleaser.

**Nutrition.** `python3 tools/nutrition.py` estimates calories, protein, carbohydrates, sugar, fat and fibre per serving from each ingredient line using a compact per-100 g table, and writes `data/nutrition.json`. The label page after each recipe shows the figures as estimates.

**Bookmarks and notes.** The ribbon flush with the top of every page bookmarks a recipe (or press `b`). The glass menu's first item opens the bookmark ring: cards on a turning wheel (drag or scroll; past ten cards the wheel wraps around the whole list), or, with the wand, a table-of-contents list with page turns. Every recipe ends with a notes page: tap the lines to type, drag to draw with a finger, pen or mouse; both save as you go. The menu's pen item opens the planner, one cell per note, searchable by what you wrote and by what you drew (drawings are labelled in the browser by a Quick, Draw! doodle classifier fetched once from a CDN).

Reading history lives in `localStorage` only (`js/history.js`). The Credits panel has a **Forget my history** button.

## Recipe data

- `data/batch-*.json` are the hand-written source files: 100 popular dishes from around the world. Ingredient lists are plain facts; methods are written in our own words with the real process, temperatures and timings. See `data/RECIPE_GUIDE.md` for the schema and the copyright rules.
- `data/images-*.json` hold one Unsplash photo per recipe (URL, photographer, links). Seven dishes have no clear match on Unsplash and are marked `"uncertain": true`: Korean fried chicken, massaman curry, beef bourguignon, coq au vin, feijoada, bobotie, bulgogi and matcha mille crêpe cake use the closest honest photo.
- `assets/cards/` are the thirty tarot cards shown around the crystal (beef, cake, chicken, fish, rice and soup suits); each names a dish in the book. `data/batch-cards.json` holds the eleven recipes written so every card leads somewhere.
- `assets/orn/` are the engraved acanthus ornaments (corners, head and tail pieces) lifted from the owner's filigree reference sheet, recoloured gold; every page frame is built from them.
- Build order after editing data: `python3 tools/nutrition.py`, `python3 tools/similarity.py` (needs `pip install scikit-learn numpy`), then `node tools/build-data.mjs`, which validates every tag, merges photos, nutrition and neighbours, and writes `data/recipes.js`.
- `node tools/check-wiki.mjs` checks each recipe's `wiki` title against the live Wikibooks API and reports missing pages and available photos. With `--bake` it writes the photo URL and credit into the batch files; rebuild afterwards. The titles were set from memory and have not yet been verified online.

### Live recipes

The crystal ball also searches the [Wikibooks Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents) through the public MediaWiki API (`js/wikibooks.js`). Its text is CC BY-SA 4.0 and each live recipe page in the book links back to its source and names the licence. Photos are hot-linked from Wikimedia Commons with the author and licence shown under the picture. Bundled recipes that name a Cookbook page borrow that page's photo the same way.

The site needs to reach these hosts for the live features: `en.wikibooks.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, plus `fonts.googleapis.com` and `fonts.gstatic.com` for type. Without them the book still works with its bundled recipes and placeholder tints.

## The meadow

`js/grass.js` draws one `InstancedMesh` of a tapered blade (three.js, vendored in `js/vendor/`) duplicated 36 000 to 96 000 times depending on the device over gently rolling ground, seen from above. Wind is value noise in the vertex shader, the pointer pushes blades aside, and golden dew sparkles are one `Points` draw. When the book fills the screen the render loop stops, the canvas is hidden and its drawing buffer is shrunk to a single pixel, so the meadow costs nothing per frame and almost no GPU memory until you return to the title page or close the book. It also pauses while the tab is hidden.

Page turns are real leaves: a temporary 3D element lifts off one column carrying the old page on its front, reveals the page beneath as it rises, and lands on the other column showing the new page on its back; only then does the column beneath take the content over (`js/flipbook.js`). Between recipes three leaves turn in a short cascade.

The marble pages use four procedurally generated vein textures (`assets/marble-*.webp`); every page picks one at random with a random offset, so no two pages share a pattern. Phoenician letters drift up from the margins now and then (`Noto Sans Phoenician`). The crystal ball is a volumetric fragment shader (`js/crystal.js`): rays refract into a glass sphere and march through 3D noise, so the glow ribbons sit at real depths; its text is laid on a cylinder in CSS 3D. It runs only while the ball is open.

## Layout

```
index.html           page shell, crystal ball, credits panel
css/book.css         all styling
js/main.js           boot
js/book.js           book state machine, page turning, pagination, crystal ball wiring
js/recommend.js      tiered recommendation engine
js/tagger.js         text -> taxonomy tags (for searches and live pages)
js/wikibooks.js      Wikibooks Cookbook API client
js/landing.js        scene one: meadow + 3D book, chant page
js/reader.js         scene two: recipe reader, notes pad wiring, bookmarks
js/flipbook.js       two-column page with page-turn transitions (shared by reader and views)
js/pages.js          page markup and pagination
js/views.js          bookmark ring / list, notes planner and search
js/ball.js           crystal overlay: messages inside the sphere, tarot cards, asking
js/crystal.js        volumetric glass-sphere shader + 3D curved text
js/sketch.js         drawing on the notes pad, doodle recognition
js/history.js        localStorage memory: reads, searches, goal, bookmarks, notes
js/grass.js          three.js meadow with book weight and ground texture
assets/              marble textures, ground texture, tarot cards
data/                taxonomy, recipe batches, generated recipes.js
tools/               build and link-check scripts
```

## Credits

three.js is MIT licensed (`js/vendor/THREE-LICENSE`). Photos from Unsplash under the Unsplash License, credited under each picture. Type: Caesar Dressing, Afacad Flux and Noto Sans Phoenician via Google Fonts.
