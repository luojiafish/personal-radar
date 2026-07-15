# Personal Radar local API

Use only `http://127.0.0.1:3210`. Never expose the service to the LAN.

## Read targets and saved items

- `GET /api/watch-targets` returns enabled targets, keywords, and sources.
- `GET /api/saved-items` returns recent saved items.
- `GET /api/profile-context` returns user-authored profile context, but research must not use it to personalize or infer attributes.

Ignore disabled records unless the user explicitly asks to inspect them.

## Save a confirmed item

Call `POST /api/saved-items` only after explicit confirmation:

```json
{
  "watchTargetId": "00000000-0000-4000-8000-000000000000",
  "title": "Example source title",
  "url": "https://news.example.com/article",
  "contentExcerpt": "Visible factual excerpt",
  "selectedText": "",
  "aiSummary": "Concise summary"
}
```

Surface non-2xx status and error text exactly. Never retry a write automatically or transmit credentials, cookies, browser state, or unrelated content.

## Add a confirmed website source

Only after the user explicitly confirms adding the platform root to a target, call `POST /api/watch-targets/<target-id>/sources`:

```json
{
  "url": "https://community.example.com/topic/example",
  "name": "Example source"
}
```

The application normalizes this to the site root. Keep an exact account, topic, column, or recurring-series URL separately in private `config/curated-sources.md`. Never mutate either location while merely presenting candidates.
