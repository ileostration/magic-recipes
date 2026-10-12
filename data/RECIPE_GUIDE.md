# Recipe data guide

Every recipe is one JSON object. A batch file is a JSON array of these objects. Use only the vocabulary in `data/taxonomy.json` for `category`, `dish`, `flavors`, `mains`, `method`, `cuisine` and `diet`.

## Copyright rules (non-negotiable)

- Ingredient lists are facts. Write them as plain items with quantities, metric first then imperial in brackets where useful, e.g. `"200 g (1 cup) caster sugar"`. No brand names.
- Method steps must be written in your own words. Do not copy, paraphrase line by line, or lightly reword any published recipe. Describe the process as you would explain it to a friend. Keep the real process, oven temperatures (give both °C and °F), pan sizes and timings. Do not invent unusual techniques.
- No headnotes, stories or quotes from any source. The `intro` is one original sentence about the dish.
- Do not write an image URL. Leave `image` as `null`; images are resolved later from open-licence sources.

## Fields

```json
{
  "id": "chocolate-cake",
  "title": "Chocolate Cake",
  "origin": "United States",
  "cuisine": "american",
  "category": "dessert",
  "dish": "cake",
  "flavors": ["chocolate"],
  "mains": ["flour", "cocoa", "egg", "butter", "sugar"],
  "method": ["baked"],
  "diet": ["vegetarian"],
  "serves": "Serves 10",
  "time": "1 hour 10 minutes",
  "difficulty": "easy",
  "hue": 20,
  "wiki": "Cookbook:Chocolate_Cake",
  "image": null,
  "intro": "A soft, deeply cocoa-flavoured layer cake with a glossy ganache.",
  "ingredients": ["225 g (1¾ cups) plain flour", "..."],
  "steps": ["Heat the oven to 180 °C (350 °F) and line two 20 cm round tins.", "..."]
}
```

- `id`: lowercase kebab-case, unique.
- `cuisine`: one value. `category`: one value. `dish`: one value, the most specific that fits.
- `flavors`: 1 to 4 values, the dominant tastes. `mains`: 2 to 6 values, the defining ingredients. `method`: 1 to 2 values.
- `diet`: zero or more flags that are true for the recipe as written.
- `difficulty`: `easy`, `medium` or `hard`.
- `hue`: a number 0 to 360, the dominant colour of the finished dish as a hue (browns 20 to 35, golden 40 to 50, greens 90 to 130, reds 0 to 12, creams 45 to 55, pinks 340 to 350). Used for the placeholder tint.
- `wiki`: the Wikibooks Cookbook page title in the form `Cookbook:Name_With_Underscores` if you are confident such a page exists for this dish, otherwise `null`. When unsure, prefer `null`.
- `ingredients`: 5 to 16 items. `steps`: 4 to 10 steps, each 1 to 3 sentences, each a complete action.
- `time`: total time as text, e.g. `"45 minutes"` or `"2 hours 30 minutes"`.
