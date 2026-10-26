# MonEXP – Monthly money, sorted

A personal monthly expense tracker that replaces the Google Sheet – bills, credit cards, EMIs,
people who owe you (and whom you owe), sudden spends and a year view, with an AI assistant.
Built with **MongoDB · Express · Angular · Node** (MEAN) and the **Claude API**.

**Live:** https://monexp.onrender.com · Currency: Indian rupees (₹1,00,000 formatting)

See `PLAN.md` for the decisions behind the app, `DEPLOY.md` for putting it live, and `CLAUDE.md` for the original brief.

## Features

| Area | What you get |
|---|---|
| **Overview** | Monthly budget (edit in place), Balance left, Balance incl. people, what's still to pay, who owes you, closing installments, AI monthly summary |
| **Need to pay** | Every bill grouped (cards, family, housing, subscriptions, investments, **EMIs & installments**, **Money I owe**) – tick paid, skip a month, edit, swipe right on a phone to mark paid |
| **Credit cards** | Each card's bill = your spends + your EMIs + friends' EMIs; itemised purchases ("Supermarket ₹321") |
| **EMIs & installments** | Monthly **or yearly**, paid from a card **or bank / cash**, for you or a friend; can have started in the past – earlier payments are counted automatically |
| **People** | They owe me / I owe them; friends' EMIs show up here to mark received; "I owe them" also appears in Need to pay |
| **Sudden spends · Year view** | One-off spends; budget vs spent per month and where the money went |
| **Ask MonEXP (AI)** | Ask questions in plain English; every number comes from the app's own calculations |
| **Accounts** | Each login has its **own separate data**; change password in Profile |
| **Admin** (first account only) | Add friends' logins, reset passwords, see who's online – never their money. Max 25 logins (`MAX_USERS`) |
| **Look & feel** | Glass design, light / dark, any accent colour, home-language hints (தமிழ் / తెలుగు / हिन्दी) – saved per user |
| **Everywhere** | Live updates across tabs and devices, Undo for every change, loaders + Retry if the connection drops, works on desktop / tablet / phone, installable on the phone home screen |

## Where to do what

| I want to… | Go to |
|---|---|
| Tick a bill paid, skip it, or edit its name / amount / due day | **Need to pay** → tick, **Skip month** or **Edit** (on a phone: swipe the bill right) |
| Add a bill, sudden spend, or money owed (several in a row) | **Add expense** (top right) – tick **Add another after saving** |
| Log a card purchase ("Supermarket ₹321") | **Credit cards** → **Add a new spend** on that card |
| Add an EMI or installment (monthly / yearly, card or bank, mine or a friend's) | **Credit cards → Add EMI** (or **Add EMI to this card**), or **Installments → Add installment** |
| Add someone paying you back in parts, or a payment listed under a group | **Installments** → **Add a plan with its own group** |
| Mark money you owe as paid back | **Need to pay → Money I owe** (tick it) or **People → I owe them** |
| Start a new month | Pick the month at the top → **Roll over** or **Start a blank month** |
| Theme, accent colour, home language | **Profile → Preferences** (website only) |
| Add cards or people | **Profile → Credit cards / People** (website only) |
| Add a friend's login | **Admin** (website only, first account) |
| Install on the phone | iPhone: Safari → Share → **Add to Home Screen** · Android: Chrome → ⋮ → **Install app** |

Plan changes apply from the month you're viewing onwards; earlier months keep their history.
In the installed phone app, Profile and Admin are hidden – use the website for those.

## Profile & settings

Open **Profile** from the button at the top right (website only – it's hidden in the installed phone app).
Everything here is saved to **your own account**, so it follows you to every device and other logins never see it.

| Tab | What you can do | Good to know |
|---|---|---|
| **Account** | Change the **email** or **mobile number** you sign in with, **Sign out**, and **Change password** (current password + new one twice, at least 8 characters) | Keep at least one of email / mobile. Forgot your password? Ask the admin to reset it (Admin → Reset password) |
| **Preferences** | **Theme:** Light or Dark · **Accent colour:** 8 ready-made colours or any colour from the palette (rainbow circle), with a preview and *Back to blue* · **Home language:** None, தமிழ், తెలుగు or हिन्दी | Text on the accent colour is adjusted automatically so it stays readable. Home language adds a small hint under "They owe me" / "I owe them" – the app itself stays in English |
| **Credit cards** | **Add a card** (name, last 4 digits, network), **Edit**, **Mark closed / Reopen**, **Delete** | Only the last 4 digits are stored – never the full number or CVV. A card used in bills or EMIs can't be deleted (to keep history) – mark it closed instead. A new card's bill is added to the month you're viewing |
| **People** | **Add a person** (name, relationship, phone, UPI ID, note), **Edit**, **Delete**; see what each person owes you / you owe them and what's been received | People here appear in the pickers for "They owe me", "I owe them" and friends' EMIs (Add expense can also add someone new on the spot). A person linked to an EMI or plan can’t be deleted until that EMI or plan is removed |

### Admin (first account only)

**Admin** in the left menu (website only):

1. **Add a friend:** email and/or mobile + a temporary password → **Add login**, then send them the line it shows (site, login, password).
   They get their own **empty** tracker and can change the password in Profile → Account.
2. **Logins table:** created date, last sign-in, and a green dot when someone has MonEXP open right now.
3. **Reset password:** for anyone who forgot theirs.

The admin never sees anyone's money – only who can sign in. Up to **25 logins** in total (change `MAX_USERS` in Render → Environment).

## Requirements

Node 24, npm 11, MongoDB running locally (`brew services list` should show `mongodb-community started`).

## First-time setup (on your Mac)

```bash
cd backend
npm install
cp .env.example .env        # then set JWT_SECRET (a long random string)
npm run create-user         # creates your login (asks for email + password) – the first login is the admin
npm run seed                # optional: loads sample months Jan–Oct 2026 into the first login
cd ../frontend
npm install
```

## Run it (two terminal tabs, from the project folder)

```bash
npm run dev                 # backend API – http://localhost:3000/api (restarts on code changes)
```

```bash
npm run web                 # website – http://localhost:4200
```

Sign in with the account from `npm run create-user` – with your password, or on the **OTP** tab with the
demo code from `DEV_OTP` in `backend/.env` (no SMS/email is sent; remove that line to turn OTP off – it's
always off on the live site). Check http://localhost:3000/api/health shows `{"ok":true}`.
On a phone on the same Wi-Fi: in `frontend/` run `npm start -- --host 0.0.0.0`, then open `http://<your Mac's IP>:4200`.

## AI assistant (Ask MonEXP + monthly summary)

1. Get an API key at https://console.anthropic.com → **API Keys** → **Create Key** (needs credit).
2. Open `backend/.env` and paste it after `ANTHROPIC_API_KEY=` (no spaces, no quotes). On the live site,
   add it in Render → **Environment**.
3. Restart the backend.

Use the **Ask AI** button (bottom right) or **Summarise this month** on Overview. The model is
`claude-opus-5-5` by default; set `ANTHROPIC_MODEL=claude-sonnet-5-5` for a cheaper one. Claude only *reads*
your data through lookup tools – every total is calculated by the backend, not by the AI.

## Putting it live

See **[DEPLOY.md](DEPLOY.md)** – Render (app) + MongoDB Atlas (database), both on free plans.
Render deploys automatically on every push to the `MonExp-Main` branch (other branches are not deployed).
`npm run build` builds everything; `npm start` runs the API and serves the website on one address.

## Backups

The free Atlas plan has no automatic backups – take one every week or so:

```bash
MONGODB_URI="<your Atlas connection string>" npm run backup
```

It writes `backups/monexp-<date>.json` (not in git – keep it private). To put one back:
`MONGODB_URI="..." npm run restore -- backups/monexp-<date>.json --yes` (this **replaces** that database's data).

## Tests

```bash
npm test
```

Backend tests (calculations, API, separate data per user, admin, live updates, AI with a fake client)
use separate `monexp_test*` databases, so your data is never touched.

## Useful commands (from the project folder)

| Command | What it does |
|---|---|
| `npm run dev` / `npm run web` | Run the backend / the website locally |
| `npm test` | Run the backend tests |
| `npm run create-user` | Add a login, or reset a password (same email again). Add `MONGODB_URI="…"` in front for the live database |
| `npm run seed -- --force` | Wipe the first login's money data and reload the sample months (`--user email` for another login) |
| `npm run backup` / `npm run restore` | Save / restore all data (see Backups) |
| `npm run build` / `npm start` | Production build / run (what Render uses) |

Settings live in `backend/.env` locally and in Render → **Environment** live: `MONGODB_URI`, `JWT_SECRET`,
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `MAX_USERS` (default 25), `DEV_OTP` (local only).

## Project structure

| Folder | What's in it |
|---|---|
| `backend/` | Node + Express API (JavaScript, ES modules), Mongoose models, money calculations (`src/services/compute.js`, `src/lib/installments.js`), Claude assistant (`src/services/ai/`), tests |
| `frontend/` | Angular 21 app – standalone components, signals, reactive forms; `src/app/features/` = one folder per page, `core/` = services and shared logic, `shared/` = reusable pieces, `styles/` = design tokens |
| `sample-data.xlsx` | The old Google Sheet sample (reference only) |

## API overview

All routes are under `/api` and need you to be signed in (except `/health` and the sign-in routes).
Months are written as `2026-10`. Money is always whole rupees. Every change returns an `undoToken`.

| Area | Routes |
|---|---|
| Sign in & account | `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /auth/me`, `PATCH /auth/prefs` (theme, accent, home language), `POST /auth/password`, `GET /auth/otp`, `POST /auth/otp/request`, `POST /auth/otp/verify` |
| A month | `GET /months/:ym` (everything + totals), `GET /months?year=`, `POST /months/:ym` (roll over / blank), `PATCH /months/:ym` (budget) |
| Bills | `POST /months/:ym/bills`, `PATCH /bills/:id`, `DELETE /bills/:id` |
| Card bills & EMIs this month | `PUT /months/:ym/cards/:cardId/bill`, `POST /months/:ym/cards/:cardId/spends`, `DELETE /card-spends/:id`, `PATCH /months/:ym/emis/:emiId` (amount, received, paid) |
| People money | `POST /months/:ym/people-entries`, `PATCH/DELETE /people-entries/:id` |
| Sudden spends | `POST /months/:ym/sudden`, `DELETE /sudden/:id` |
| Setup | `/cards`, `/emis` (monthly / yearly, card or bank), `/plans`, `/people` – GET, POST, PATCH /:id, DELETE /:id |
| Reports | `GET /years/:year`, `GET /installments?at=:ym` |
| Undo | `POST /undo/:token` |
| AI | `GET /ai/status`, `POST /ai/chat` (server-sent events), `GET/POST /ai/summary/:ym` |
| Admin (admin only) | `GET /admin/users`, `POST /admin/users`, `POST /admin/users/:id/password` |
| Live updates | WebSocket `/api/live` – tells your other open pages to reload after a change |
