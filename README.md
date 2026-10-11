# MonEXP – Monthly money, sorted

Personal monthly expense tracker (MongoDB · Express · Angular · Node) that replaces the Google Sheet.
See `PLAN.md` for the agreed plan and decisions, and `CLAUDE.md` for the original brief.

| Folder | What's in it |
|---|---|
| `backend/` | Node + Express API, MongoDB (Mongoose) models, money calculations |
| `frontend/` | Angular 21 app – the screens |
| `sample-data.xlsx` | The old Google Sheet sample (reference only – data is now entered in the app) |

## Where to do what

| I want to… | Go to |
|---|---|
| Tick a bill paid, skip it, or **edit its name / amount / due day** | Need to pay → **Edit** on the bill |
| Log a card purchase ("Supermarket ₹321") | Credit cards → **Add a new spend** on that card |
| Add or change a card EMI (also before its 1st month) | Credit cards → **Add an EMI**, or **Edit** on the EMI |
| Add or change a plan like Dad or a gold chit, or someone paying you back | Installments → **Add a plan**, or **Edit plan** |
| Start a new month | Pick the month at the top → **Roll over** |

Plan changes apply from the month you're viewing onwards; earlier months keep their history.

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

Open http://localhost:4200 and sign in with the account from `npm run create-user` – with your password, or on the **OTP** tab with the demo code from `DEV_OTP` in `backend/.env` (no SMS/email is actually sent; remove that line to turn OTP sign-in off).
On a phone on the same Wi-Fi: run `npm start -- --host 0.0.0.0` and open `http://<your Mac's IP>:4200`.

## AI assistant (Ask MonEXP + monthly summary)

1. Get an API key at https://console.anthropic.com → **API Keys** → **Create Key**.
2. Open `backend/.env` and paste it after `ANTHROPIC_API_KEY=` (no spaces, no quotes).
3. Restart the backend (`Ctrl + C`, then `npm run dev`).

Then use the **Ask AI** button (bottom-right) or **Summarise this month** on Overview.
The model is `claude-opus-5-5` by default; add `ANTHROPIC_MODEL=claude-sonnet-5-5` to `.env` for a cheaper one.
Claude only *reads* your data through a few lookup tools – every total is calculated by the backend, not by the AI.

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
| Sign in | `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /auth/me`, `GET /auth/otp`, `POST /auth/otp/request`, `POST /auth/otp/verify` |
| A month | `GET /months/:ym` (everything + totals), `GET /months?year=`, `POST /months/:ym` (roll over / blank), `PATCH /months/:ym` (budget) |
| Bills | `POST /months/:ym/bills`, `PATCH /bills/:id`, `DELETE /bills/:id` |
| Card bills | `PUT /months/:ym/cards/:cardId/bill`, `PATCH /months/:ym/emis/:emiId`, `POST /months/:ym/cards/:cardId/spends`, `DELETE /card-spends/:id` |
| People money | `POST /months/:ym/people-entries`, `PATCH/DELETE /people-entries/:id` |
| Sudden spends | `POST /months/:ym/sudden`, `DELETE /sudden/:id` |
| Setup | `/cards`, `/emis`, `/plans`, `/people` (GET, POST, PATCH /:id, DELETE /:id) |
| Reports | `GET /years/:year`, `GET /installments?at=:ym` |
| Undo | `POST /undo/:token` (every change returns an `undoToken`) |
| AI | `GET /ai/status`, `POST /ai/chat` (server-sent events), `GET/POST /ai/summary/:ym` |
