# MonEXP – Agreed build plan

Approved by the owner on 8 Oct 2026. Where this file and CLAUDE.md disagree, this file wins
(it records the owner's later decisions).

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Login | Single user, email (or mobile) + password. **Update 11 Oct 2026:** also "Sign in with OTP" by email or mobile – demo only: no SMS/email is sent, the fixed code in `DEV_OTP` (backend/.env) is accepted; empty = OTP off. |
| 2 | New month | Empty month shows **"Roll over from <previous month>"**: copies all bills as unpaid, drops closed cards, lets you tick pending people-items to carry over. "Start a blank month" also available. |
| 3 | Installments | "X of Y" is calculated from the plan's start month, not counted by clicks. |
| 4 | Leftover balance | Not carried into next month. Year view shows total "Left over". |
| 5 | Sudden-spend categories | Not in v1. |
| 6 | Screens | Follow the **design**: Overview, Need to pay, Credit cards, Installments, People, Sudden spends, Year view, Profile. Header button is **"Add expense"** (bill / sudden spend / they owe me / I owe them). |
| 7 | AI monthly summary | A card on the Overview page. |
| 8 | Apple Watch EMI | ₹0/month for now (amount is inside Flipkart Axis "my spends"). |
| 9 | May "Kodai Trip" ₹5,000 | Counted in May's total (the sheet left it out). |
| 10 | Sudden spend "paid by Gokul" | Kept as a note only. |
| 11 | Data | Sample sheet is test data. Frontend uses the backend's seeded data directly (no separate mocks). |
| 12 | Ports / DB | API on 3000, Angular on 4200, MongoDB database `monexp`. |

## Money rules (match the design)

- All amounts are whole rupees (integers).
- Credit-card bill = my spends + my card EMIs + friends' card EMIs.
- **Balance left** = budget − (bills to pay − friends' card EMIs) − sudden spends not paid by card.
- **Balance incl. people** = balance left + money people owe you − money you owe (all entries for the month, not yet "moved").
- Skipped bills don't count. A plan-linked bill (Dad, Gold chit) disappears once its plan has finished.

## Phases

1. Backend: Express, MongoDB models, calculations, REST APIs, seed data, tests.
2. Frontend: Angular screens matching the design, using the backend.
3. Ready for real data (changed 11 Oct 2026 – **the Google Sheet / Excel import was dropped**;
   the owner enters data in the app):
   - Edit any bill: name, amount, category, due day, note.
   - Manage installment plans (Dad, gold chit, someone paying back) on the Installments page.
   - Edit card EMI details: item, who it's for, total months, start month (also before it starts).
   - Itemised card spends: each spend (what, amount, date) listed under its card.
   - Tests, git commit, instructions.
   Not in v1: "start fresh" button, backup/restore.
4. AI: Ask MonEXP chat (streaming) + monthly summary, via the Claude API from the backend.
   Model `claude-opus-5-5` by default (set `ANTHROPIC_MODEL` in backend/.env to change it).
   Read-only tools (get_month, get_year, get_installments, get_people, find_payments) – all maths
   in compute.js. Chat history isn't stored; summaries are cached per month and marked out of date
   when the figures change.
