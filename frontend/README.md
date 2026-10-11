# MonEXP – frontend (Angular 21)

Standalone components, signals, zoneless change detection and typed Reactive Forms.
All data comes from the backend through `/api` (the dev server forwards it to http://localhost:3000, see `proxy.conf.json`).

```bash
npm install
npm start          # http://localhost:4200 – the backend must be running too
npm run build      # production build into dist/
```

## Folder structure

```
src/
├── styles.scss               global entry – just @use's the partials below
├── styles/
│   ├── _tokens.scss          design tokens as CSS variables (colours, radii, shadows)
│   ├── _breakpoints.scss     SCSS breakpoints – @use 'styles/breakpoints' as bp;
│   ├── _base.scss            body, text helpers, layout helpers (.page, .grid-200 …)
│   ├── _buttons.scss         .btn, .btn--primary/--ghost/--sm, .pill, .seg, .tabs, .tick
│   ├── _forms.scss           .field, .field-label, .form-grid, .edit-box, .notice
│   ├── _cards.scss           .card, .card-head, .list-row, .stat, .kv
│   └── _chips.scss           .chip--paid/--unpaid/--overdue/--skipped, .inst-pill, .tag
└── app/
    ├── app.config.ts / app.routes.ts / app.ts
    ├── core/                 app-wide, no UI
    │   ├── api.service.ts    every backend call
    │   ├── app-store.ts      selected month + its data (signals), toast/undo, dialog state
    │   ├── models.ts         API response types
    │   ├── auth/             auth.service, guards, session interceptor
    │   ├── forms/            custom validators (rupees, emailOrMobile, …) + firstError()
    │   └── utils/format.ts   month & money helpers
    ├── shared/
    │   ├── pipes/            inr (₹1,00,000), ym (October 2026 / Oct 2026 / 11 Oct)
    │   ├── ui/               icon, progress-bar, progress-ring, avatar
    │   ├── components/       empty-month, bill-editor, card-bill-editor, emi-editor
    │   └── utils/            person-row view model, entry actions, installment colours
    ├── layout/               shell, sidebar, top-bar, page-header, month-picker,
    │                         add-expense-dialog, undo-toast
    └── features/             one folder per screen, child components inside
        ├── login
        ├── overview/         budget-card, pay-summary, still-to-pay, people-owe-you, closing-next
        ├── need-to-pay/      bill-row
        ├── credit-cards/     card-tile, card-spends, card-emi, add-emi-form, friend-emis
        ├── installments/     installment-card, plan-form
        ├── people/           person-entry-row
        ├── sudden-spends/    sudden-form
        ├── year-view/        month-bars, category-bars
        └── profile/          account-tab, cards-tab, people-tab
```

## Conventions

- Every component has its own `name.ts`, `name.html` and `name.scss` (Angular 20+ file naming, no `.component` suffix).
- No inline `style="…"` – use the global classes or the component's `.scss`. `[style.x]` is only for data-driven
  values (bar widths/heights, ring fill).
- State lives in signals. `AppStore.run(request)` sends a change, shows the "… · Undo" toast and reloads every screen.
- Forms are typed Reactive Forms (`NonNullableFormBuilder`). Validation messages come from `firstError(form, messages)`.
- Money is whole rupees: type it as `1,450` or `₹1450`; `parseNum()` turns it into a number.
