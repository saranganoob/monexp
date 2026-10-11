# MonEXP – Project Brief for Claude Code

This file summarizes decisions made with the owner (Sarangan) in a separate planning chat.
Read it fully before doing anything. If something here conflicts with what the owner says
in this session, the owner's latest instruction wins.

---

## 1. What we are building

**MonEXP** ("Monthly money, sorted") is a personal monthly expense tracker that replaces
the owner's Google Sheet. It is a full-stack **MEAN** web app (MongoDB, Express, Angular,
Node.js) with **AI features powered by the Claude API**.

- Primary user: the owner (single user for v1 unless the owner says otherwise).
- Currency: Indian Rupees (₹), Indian number formatting (e.g. ₹61,833, ₹1,00,000).
- Must work well on desktop and on a phone browser (responsive).

---

## 2. Owner's machine (already set up – do not reinstall)

MacBook Air M4 (Apple Silicon, arm64), zsh shell.

| Tool | Version | Notes |
|---|---|---|
| Node.js | v24.15.0 | Use this version. Homebrew also installed Node 26 as a mongosh dependency, but `node` resolves to v24 – keep it that way. |
| npm | 11.12.1 | |
| Angular CLI | 21.2.9 | |
| MongoDB Community | 9.0.2 | Installed via `mongodb/brew` tap, runs as a brew service (auto-starts at login). Default URL: `mongodb://localhost:27017` |
| mongosh | 2.13.0 | |
| Git | 2.39.5 (Apple) | |
| VS Code | 1.137.0 | `code` command enabled |
| Homebrew | 5.1.8 | |

---

## 3. Design (source of truth for the UI)

The UI design was created in Claude Design: an interactive web-app prototype.

- Design link: https://claude.ai/artifact/GsuFqnvtyhouChQwtDHned
- The design's prototype files (`design/` folder) were **removed on 11 Oct 2026** at the owner's
  request – the Angular app in `frontend/` is now the reference for layout, colours and wording.

Match the design closely: layout, spacing, colors, typography, card styles, and wording.

### Layout
- Left sidebar with logo "MonEXP – Monthly money, sorted" and navigation:
  **Overview**, **Need to pay** (shows a badge with the count of unpaid bills),
  **EMIs & plans**, **People**, **Sudden spends**, **Year view**.
- Top of each page: page title, a **month + year selector** with previous/next arrows,
  and a **"+ Sudden spend"** button.
- On phones the sidebar should collapse (e.g. into a bottom nav or menu).

### Overview screen (from the design)
- **Monthly budget card** (dark blue): shows the month's budget (e.g. ₹66,000), editable
  in place. "Edit anytime – every total below recalculates."
- **Balance left** = Budget − To pay this month − Sudden spends.
- **Balance incl. people** = Balance left + what people owe you − what you owe others.
- **To pay this month**: total amount, with counts and amounts for **Paid**, **Unpaid**,
  **Skipped**, and a progress bar ("69% of this month's bills are paid").
- **Still to pay**: list of unpaid bills, each with name, note, amount, and a
  **"Mark paid"** button; "See all bills" link.
- **People owe you**: list of people with pending amounts and a **"Mark received"**
  button; total pending shown in the header.
- **Installment plans**: each plan with a progress bar and "X of Y" installments paid;
  "Open tracker" link.

### Other screens
Need to pay, EMIs & plans, People, Sudden spends and Year view follow the same visual
style. Use the design images for their details. If a screen isn't in the design, propose
a layout consistent with the design and ask the owner before building it.

---

## 4. Data

The owner currently tracks everything in a Google Sheet. A sample of its structure
(column headers + a few rows with sensitive values changed) is in `sample-data.csv`.

- Design the MongoDB collections around the **real sheet structure** plus the design.
  Likely entities: monthly budgets, recurring bills, monthly bill status
  (paid / unpaid / skipped), EMIs / installment plans, people (owed to / owed by),
  sudden spends.
- **Import:** v1 = one-time CSV import of the sheet (owner exports CSV from Google Sheets).
  Ongoing Google Sheets sync is *not* in v1 unless the owner asks.
- Amounts: store as integers (rupees, or paise if decimals are needed). Avoid
  floating-point money math.

---

## 5. AI features (Claude API)

Pick only these for v1:

1. **Ask MonEXP** – a chat panel where the owner asks questions in plain English, e.g.
   "How much did I pay in EMIs this year?" or "Which month had the most sudden spends?"
2. **Monthly summary** – a short AI-written summary of the month, e.g. comparing to the
   previous month and flagging overspending.

Implementation rules:
- Call the Claude API **only from the Node backend** using the official SDK
  (`@anthropic-ai/sdk`). The Angular app never talks to Claude directly.
- API key lives in `backend/.env` as `ANTHROPIC_API_KEY`. Never hard-code it, log it, or
  commit it. The owner will paste the key into `.env` themselves.
- Check https://docs.claude.com for current model names and SDK usage instead of guessing.
- Do the **math in code / MongoDB aggregations**, then give Claude the computed figures to
  explain. Don't rely on the model to add up raw transactions.
- Stream responses for the chat if practical.

Later (not v1): auto-categorizing sudden spends, receipt scanning, budget alerts.

---

## 6. Project structure (suggested)

```
MonEXP/
├── CLAUDE.md
├── sample-data.csv    # Google Sheet structure sample
├── backend/           # Node + Express + MongoDB (Mongoose) + Claude SDK
└── frontend/          # Angular 21 app
```

Include a root `README.md` explaining how to run everything, a `.gitignore`
(node_modules, .env, build output), and a `backend/.env.example` with placeholder values.

---

## 7. How to work with the owner

- **Plan first.** Before writing code, read this file and
  `sample-data.csv`, then propose a build plan: collections and fields, API endpoints,
  Angular pages/components, and the phases below. **Wait for approval.**
- **Build in phases**, and after each one tell the owner exactly how to run and test it:
  1. Backend: Express server, MongoDB connection, models, REST APIs.
  2. Frontend: Angular screens matching the design (with sample data).
  3. Connect frontend to backend + CSV import of the Google Sheet data.
  4. AI features (Ask MonEXP, monthly summary).
- Ask before installing new global tools or making big structural changes.
- Explain things simply; the owner knows Angular but prefers clear step-by-step guidance.
- Use git: initialize a repo and commit at the end of each working phase (no pushing to
  any remote unless asked).

---

## 8. Open questions to confirm with the owner

- Single user, or a simple login (e.g. for family members)?
- How recurring bills work month to month: do they auto-copy into each new month?
- How EMIs advance: auto-increment "X of Y" when marked paid?
- Should unspent balance carry over to the next month?
- Any categories for sudden spends?
