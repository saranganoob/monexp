# MonEXP – Monthly money, sorted

A full-stack monthly expense tracker for salaried people in India. It covers bills, credit cards, EMIs, money
between friends, and daily and sudden spends, with an AI assistant you can ask questions in plain English.
I built it to replace the Google Sheet I used to run my monthly budget.

**MongoDB · Express · Angular 21 · Node.js · Claude API · WebSockets**

## Live demo

| | |
|---|---|
| **App** | https://monexp.onrender.com |
| **Demo login** | `demo@monexp.com` |
| **Password** | `Demo@2027` |

The demo account is filled with 4 months of made-up data. Feel free to tick bills, add spends and ask the AI.
It's reset from time to time, so nothing you change is permanent.

> Hosted on Render's free plan. If the app has been idle, the first visit can take 30–60 seconds while the server wakes up.

### Things to try
1. **Need to pay**: tick a bill as paid. The ring around your initials (top right) fills up as the month's bills are paid.
2. **Ask Kanakku** (bottom right): *"How much did I pay in EMIs this year?"* or *"Who still owes me money?"*
3. **Overview → Summarise this month**: an AI-written note comparing this month with last month.
4. Open the app in **two tabs** (or on your phone) and change something in one. The other updates by itself.
5. **Daily spends**: a calendar heat map of tea, meals and snacks. Tap any past day to fill in what you forgot.
6. **Profile → Menu**: drag sections into your own order. The phone's bottom bar follows it.
7. **Profile → Preferences**: light/dark mode, any accent colour, and whether daily or sudden spends come off your balance.

## Features

| Area | What it does |
|---|---|
| **Overview** | Monthly budget, *Balance left*, *Balance incl. people*, what's still to pay, who owes you, closing installments, AI monthly summary |
| **Need to pay** | Every bill grouped (cards, family, housing, subscriptions, investments, EMIs, money I owe): tick paid, skip a month, edit, swipe to mark paid on a phone |
| **Credit cards** | Each card's bill = your spends + your EMIs + friends' EMIs on that card, with itemised purchases |
| **EMIs & installments** | Monthly or yearly, from a card or the bank, for you or a friend, with "X of Y" counters. **Ongoing** plans with no end date (rent, support for parents) |
| **People** | They owe me / I owe them; friends paying you back in parts; mark received |
| **Daily spends** | Tea, meals, snacks and other small spends per day; calendar heat map; fill in past days |
| **Sudden spends · Year view** | One-off spends; budget vs spent for every month, and where the money went |
| **Ask Kanakku (AI)** | Chat about your money in plain English, with streamed replies. Each user can rename the assistant |
| **Personal settings** | Theme, accent colour (search by name, e.g. *"mango yellow"*), sidebar style, menu order, calculator, home-language hints (தமிழ் / తెలుగు / हिन्दी), all saved per account |
| **Admin** | Add or delete logins, reset passwords, switch AI on per user, see who's online. Admins never see anyone's money |
| **Everywhere** | Live sync across tabs and devices, Undo for every change, works on phone / tablet / desktop, installable as an app (PWA) |

## How it's built

| Topic | Approach |
|---|---|
| **Frontend** | Angular 21: standalone components, **signals**, **zoneless** change detection, reactive forms, lazy-loaded routes (Profile tabs are child routes), view transitions, container queries, SCSS design tokens |
| **Backend** | Node 24 + Express 5 (ES modules), Mongoose 9, REST API under `/api` |
| **Money maths** | Done in code: pure functions in `backend/src/services/compute.js`, whole rupees only (no floating-point money) |
| **AI** | Claude API via the official `@anthropic-ai/sdk`, called only from the backend. The model uses **tool calling** to read figures the server has already calculated, so it explains numbers instead of adding them up. Responses **stream** over server-sent events; the system prompt uses **prompt caching**; the admin decides who gets AI |
| **Live sync** | A WebSocket per signed-in user (`/api/live`). After any change, the user's other open pages reload their data |
| **Data isolation** | Every money document has an `owner`. `AsyncLocalStorage` + a Mongoose plugin add the signed-in user to every query automatically, so one user's data can never leak to another |
| **Security** | bcrypt passwords, JWT in an httpOnly cookie, rate-limited sign-in, security headers (CSP), input validation, no secrets in the browser |
| **Tests** | 66 automated tests (Node test runner + Supertest): calculations, API, per-user isolation, admin, live updates, AI with a fake client |
| **Hosting** | Render (app) + MongoDB Atlas (database), both on free plans; auto-deploys from GitHub |

## Run it locally

Needs **Node 24**, **npm 11** and **MongoDB** running locally.

```bash
git clone <this repo> && cd monEXP
cd backend && npm install && cp .env.example .env    # then set JWT_SECRET in .env
npm run create-user                                  # your login (the first login is the admin)
cd ../frontend && npm install && cd ..
```

Run in two terminal tabs, from the project folder:

```bash
npm run dev     # API: http://localhost:3000/api (restarts on code changes)
```

```bash
npm run web     # website: http://localhost:4200
```

**Optional: AI.** Put your Claude API key (from https://console.anthropic.com) in `backend/.env` as
`ANTHROPIC_API_KEY=…`, and choose a model with `ANTHROPIC_MODEL` (e.g. `claude-haiku-5-5` for low cost).
Restart the backend.

**Optional: demo data.** Create a non-admin login (Admin page, or `npm run create-user`), then fill it with
4 months of realistic made-up data:

```bash
npm run seed-demo -- --user demo@monexp.com --yes
```

Running it again resets the demo. It refuses admin logins, so real data can't be wiped by mistake.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` / `npm run web` | Run the API / the website locally |
| `npm test` | Run the 66 backend tests (uses separate test databases) |
| `npm run create-user` | Add a login, or reset a password |
| `npm run seed-demo -- --yes` | Fill (or reset) the demo login with 4 months of made-up data |
| `npm run backup` / `npm run restore` | Save / restore all data as a JSON file |
| `npm run build` / `npm start` | Production build / run (what Render uses) |

Settings (`backend/.env` locally, Render → Environment when live): `MONGODB_URI`, `JWT_SECRET`,
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `MAX_USERS` (default 25), `DEV_OTP` (local demo OTP only).
Deployment steps are in **[DEPLOY.md](DEPLOY.md)**.

## Project structure

| Folder | What's in it |
|---|---|
| `backend/src/` | Express app, routes, Mongoose models, money calculations, Claude assistant (`services/ai/`), live updates |
| `backend/test/` | Tests and their sample data (`fixtures/`, made-up names) |
| `backend/scripts/` | create-user, seed-demo, backup, restore |
| `frontend/src/app/` | `features/` = one folder per page, `layout/` = shell, sidebar, top bar, dialogs, `core/` = services and shared logic, `shared/` = reusable UI |

## API overview

All routes are under `/api` and need a signed-in user (except `/health` and sign-in). Months are written as
`2026-10`; money is whole rupees; every change returns an `undoToken`.

| Area | Routes |
|---|---|
| Sign-in & account | `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /auth/me`, `PATCH /auth/prefs`, `POST /auth/password` |
| Months | `GET /months/:ym`, `POST /months/:ym` (roll over / blank), `PATCH /months/:ym` (budget) |
| Bills & spends | `POST /months/:ym/bills`, `PATCH/DELETE /bills/:id`, `POST /months/:ym/sudden`, `POST /months/:ym/cards/:cardId/spends` |
| People | `POST /months/:ym/people-entries`, `PATCH/DELETE /people-entries/:id` |
| Daily spends | `GET /daily?ym=`, `PUT /daily/:date` |
| Setup | `/cards`, `/emis`, `/plans`, `/people` (GET, POST, PATCH, DELETE) |
| Reports | `GET /years/:year`, `GET /installments?at=:ym` |
| AI | `POST /ai/chat` (server-sent events), `GET/POST /ai/summary/:ym` |
| Admin | `GET/POST /admin/users`, `PATCH /admin/users/:id/ai`, `POST /admin/users/:id/password`, `DELETE /admin/users/:id` |
| Live | WebSocket `/api/live` |

---

Built by **Sarangan E**: [LinkedIn](https://linkedin.com/in/sarangane)
