# The Recipe Book

A frosted-glass recipe book lying in a wind-blown meadow. Click it and it floats, opens, and turns to a recipe chosen for you. Linger on a recipe and the book learns what you like; hurry past and it changes its mind, until a crystal ball rises and asks what you are really hungry for.

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

`js/recommend.js` is a precision-first engine over explicit tags (`data/taxonomy.json`). Every recipe carries a `dish`, 1 to 4 `flavors`, defining `mains`, a `category` and a `cuisine`. The reader's **seed** is the last recipe they stayed on for at least 10 seconds, or their last crystal-ball search. Candidates fall into three strict tiers:

| Tier | Rule | Example for a chocolate cake |
| --- | --- | --- |
| A | same dish and a shared taste | red velvet cake, chocolate lava cake |
| B | same taste family, different dish, same sweet-or-savoury group | brownies, chocolate cookies, hot chocolate |
| C | same dish, other taste | strawberry shortcake, carrot cake |

Nothing looser than tier C is ever shown. Quick flips (leaving before 10 seconds) walk the tiers in sets of three. On the tenth quick flip, or when the tiers run out, the crystal ball appears. Reading a recipe resets the walk and re-seeds from that recipe. Searching re-seeds from the query and the same tier logic applies to the results.

Tunables live at the top of `js/recommend.js`: `DWELL_MS` (10 000), `SET_SIZE` (3), `BALL_AT` (10).

Reading history lives in `localStorage` only (`js/history.js`). The Credits panel has a **Forget my history** button.

## Recipe data

- `data/batch-*.json` are the hand-written source files: 100 popular dishes from around the world. Ingredient lists are plain facts; methods are written in our own words with the real process, temperatures and timings. See `data/RECIPE_GUIDE.md` for the schema and the copyright rules.
- `node tools/build-data.mjs` validates every tag against the taxonomy and writes `data/recipes.js`, which the site imports. Run it after editing any batch file.
- `node tools/check-wiki.mjs` checks each recipe's `wiki` title against the live Wikibooks API and reports missing pages and available photos. With `--bake` it writes the photo URL and credit into the batch files; rebuild afterwards. The titles were set from memory and have not yet been verified online.

### Live recipes

The crystal ball also searches the [Wikibooks Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents) through the public MediaWiki API (`js/wikibooks.js`). Its text is CC BY-SA 4.0 and each live recipe page in the book links back to its source and names the licence. Photos are hot-linked from Wikimedia Commons with the author and licence shown under the picture. Bundled recipes that name a Cookbook page borrow that page's photo the same way.

The site needs to reach these hosts for the live features: `en.wikibooks.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, plus `fonts.googleapis.com` and `fonts.gstatic.com` for type. Without them the book still works with its bundled recipes and placeholder tints.

## The meadow

`js/grass.js` draws one `InstancedMesh` of a tapered blade (three.js, vendored in `js/vendor/`) duplicated 34 000 to 90 000 times depending on the device. Wind is value noise in the vertex shader, the pointer pushes blades aside, and daisies and dew sparkles are one `Points` draw. The whole scene is a handful of draw calls and a few megabytes of GPU memory. When the book fills the screen the render loop stops and the canvas is hidden; it comes back when you return to the title page or close the book.

The glass pages are plain CSS gradients and an inline SVG noise texture, with the animated sheen painted only on the two faces you are looking at.

## Layout

```
index.html           page shell, crystal ball, credits panel
css/book.css         all styling
js/main.js           boot
js/book.js           book state machine, page turning, pagination, crystal ball wiring
js/recommend.js      tiered recommendation engine
js/tagger.js         text -> taxonomy tags (for searches and live pages)
js/wikibooks.js      Wikibooks Cookbook API client
js/history.js        localStorage memory
js/grass.js          three.js meadow
data/                taxonomy, recipe batches, generated recipes.js
tools/               build and link-check scripts
```

## Credits

three.js is MIT licensed (`js/vendor/THREE-LICENSE`). Type: Marcellus, Pinyon Script and Crimson Pro via Google Fonts.
