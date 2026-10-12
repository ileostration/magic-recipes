# Photo sourcing guide

Photos come from Unsplash (Unsplash License: free to use, hot-linking the Unsplash CDN URL is expected). Use the `mcp__Unsplash__search_photos` tool (load it first with ToolSearch `select:mcp__Unsplash__search_photos` if it is not loaded).

For each recipe:

1. Search the dish name, `per_page` 6, `orientation` "portrait" (the book shows photos in a tall frame; landscape is acceptable if nothing portrait fits).
2. Read each result's `description` and `alt_description` and pick the photo that clearly shows **the actual dish** (not an ingredient, not a different dish, not a restaurant exterior, not a person). Reject photos whose text names another dish. If nothing fits, search again with a simpler or alternative name (e.g. "tortilla española" → "spanish omelette", "jiaozi" → "chinese dumplings", "pho bo" → "pho"). Try up to three queries. Only if all fail, pick the closest honest match and set `"uncertain": true`.
3. Record it in a JSON array as:

```json
{
  "id": "<recipe id>",
  "url": "<urls.regular>",
  "thumb": "<urls.small>",
  "alt": "<alt_description or description>",
  "credit": { "name": "<user.name>", "link": "<user.links.html>?utm_source=grimoire_of_delicacies&utm_medium=referral" },
  "page": "<links.html>?utm_source=grimoire_of_delicacies&utm_medium=referral"
}
```

Every recipe in your list must have an entry. Do not invent URLs: copy them from tool results exactly.
