# MonEXP – Monthly money, sorted

Personal monthly expense tracker (MongoDB · Express · Angular · Node) that replaces the Google Sheet.
See `PLAN.md` for the agreed plan and decisions, and `CLAUDE.md` for the original brief.

| Folder | What's in it |
|---|---|
| `backend/` | Node + Express API, MongoDB (Mongoose) models, money calculations |
| `frontend/` | Angular 21 app – the screens |
| `design/` | Design reference only – not part of the app |
| `sample-data.xlsx` | Sample of the Google Sheet (Jan–Oct 2026) |

## Requirements

Node 24, npm 11, MongoDB running locally (`brew services list` should show `mongodb-community started`).

You can run `npm run dev` (backend), `npm run web` (website), `npm test`, `npm run seed` and `npm run create-user` from the project folder too.

## Backend – first-time setup

```bash
cd backend
npm install
cp .env.example .env        # then set JWT_SECRET (a long random string)
npm run seed                # loads the sample months Jan–Oct 2026
npm run create-user         # creates your login (asks for email + password)
```

## Run the backend

```bash
cd backend
npm run dev                 # restarts automatically when code changes
```

The API runs at http://localhost:3000/api – check http://localhost:3000/api/health shows `{"ok":true}`.
To try requests, open `backend/requests.http` in VS Code with the **REST Client** extension.

## Run the website

Needs the backend running at the same time (two terminal tabs).

```bash
cd frontend
npm install                 # first time only
npm start
```

Open http://localhost:4200 and sign in with the account from `npm run create-user`.
On a phone on the same Wi-Fi: run `npm start -- --host 0.0.0.0` and open `http://<your Mac's IP>:4200`.

## Tests

```bash
cd backend
npm test
```

Tests use a separate `monexp_test` database, so your data is never touched.

## Useful commands

| Command (in `backend/`) | What it does |
|---|---|
| `npm run seed -- --force` | Wipes all money data and reloads the sample months (your login is kept) |
| `npm run create-user` | Run again with the same email to change your password |

## API overview

All routes are under `/api` and need you to be signed in (except `/health` and `/auth/login`).
Months are written as `2026-10`. Money is always whole rupees.

| Area | Routes |
|---|---|
| Sign in | `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /auth/me` |
| A month | `GET /months/:ym` (everything + totals), `GET /months?year=`, `POST /months/:ym` (roll over / blank), `PATCH /months/:ym` (budget) |
| Bills | `POST /months/:ym/bills`, `PATCH /bills/:id`, `DELETE /bills/:id` |
| Card bills | `PUT /months/:ym/cards/:cardId/bill`, `PATCH /months/:ym/emis/:emiId` |
| People money | `POST /months/:ym/people-entries`, `PATCH/DELETE /people-entries/:id` |
| Sudden spends | `POST /months/:ym/sudden`, `DELETE /sudden/:id` |
| Setup | `/cards`, `/emis`, `/plans`, `/people` (GET, POST, PATCH /:id, DELETE /:id) |
| Reports | `GET /years/:year`, `GET /installments?at=:ym` |
| Undo | `POST /undo/:token` (every change returns an `undoToken`) |
