# MonEXP – updates backlog

Ideas and requests waiting to be built. Each item gets a short plan and the owner's go-ahead before any code is written.

| # | Item | Status |
|---|---|---|
| 1 | Purchases for friends on my credit card | ✅ Built (11 Nov 2026) – "Bought for a friend" on Credit cards |
| 2 | Daily spending limit | ✅ Built (11 Nov 2026) – Profile → Preferences → Daily limit |

---

## 1. Purchases for friends on my credit card

**Decided with the owner:** when extra charges are entered, **"Friend pays"** is ticked by default.

**Example:** Deepak bought a phone using my Flipkart Axis card because of the card discount, and he has to pay me back.

- Add a **"Bought for a friend"** entry: friend name, item, amount, which card it was charged to, and date.
- Two repayment types:
  - **One-time:** the friend owes the full amount.
  - **EMI:** if the purchase was converted to EMI on my card, the friend repays me the same installment each month.
    Track "X of Y paid", like existing installments.
- Optional field for **extra card charges** (EMI interest, processing fee + GST), with a choice of whether the
  friend pays them or I absorb them.
- It should show up in **People** (what the friend owes me), in **Credit cards** (the card bill or EMI includes it),
  and count in **"Balance incl. people"** on the Overview.
- **"Mark received"** for each repayment, with the pending amount updating automatically.

## 2. Daily spending limit

**Decided with the owner:** a **per-day** limit for **Daily spends only** – Sudden spends don't change.
**Off by default.** Exceeding it only shows a red dot / short note (design below).

Original request:

- A setting to **enable or disable** the limit. When disabled, nothing changes from today.
- When enabled, the user sets the **limit amount** and can change it anytime.
- Exceeding the limit **never blocks** adding a spend. It only shows a **small red dot** on the "Sudden spends"
  nav item and next to the spends total, plus a short note like **"₹1,200 over limit"**.
- ~~Open question: per day or per month?~~ → **Per day.**

**Proposed design when today goes over the limit:**
- Today's card: a slim bar under "Total today" that fills towards the limit (theme colour → amber from 80% → red when over),
  and a note **"₹80 over today's ₹300 limit"**.
- Calendar: days that went over get a **small red dot** in the corner.
- ~~Menu: a small red dot on "Daily spends"~~ – removed at the owner's request.
- Stats: "**3 days over limit** this month".
- Setting: Profile → Preferences → **Daily limit**: Off / On + amount (e.g. ₹300), changeable anytime.
