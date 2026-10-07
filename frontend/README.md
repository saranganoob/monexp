# MonEXP – frontend (Angular 21)

Screens rebuilt from `design/web-app/Main.dc.html`. Talks to the backend through `/api`
(the dev server forwards `/api` to http://localhost:3000 – see `proxy.conf.json`).

```bash
npm install
npm start          # http://localhost:4200 – the backend must be running too
npm run build      # production build into dist/
```

| Folder | What's in it |
|---|---|
| `src/app/core` | API calls, sign-in, shared state (`store.ts`), ₹ formatting helpers |
| `src/app/layout` | Sidebar + header, "Add expense" dialog, Undo toast |
| `src/app/pages` | One folder per screen |
| `src/app/shared` | Pieces used on several screens (empty month, card bill editor, people rows) |
