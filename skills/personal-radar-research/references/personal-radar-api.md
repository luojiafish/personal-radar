# Personal Radar local API

Use only `http://127.0.0.1:3210`. Never expose the service to the LAN.

## Read targets and saved items

- `GET /api/watch-targets` returns enabled targets, keywords, and sources.
- `GET /api/saved-items` returns recent saved items.

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
