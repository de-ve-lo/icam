# Shop Ops Polish — Free Calculator Customers, Due-Date Short, Print Ledger, C/O Labels, UI Restyle, Unified Icon

**Date:** 2026-10-21
**Status:** Approved design (awaiting user review of this written spec)
**App:** Installment Management (Electron + vanilla JS + SQLite)
**Branch:** `260929-feat-shop-installment-redesign`
**HEAD at design time:** `5d75b55`

## Problem

Seven related shop-ops gaps, plus one identity gap:

1. Installment Calculator lists every customer, including people who already have an installment purchase or a cash sale (even fully paid or closed).
2. Outstanding / Short / Current still treat an unpaid installment as Current until the 1st of the next month. On 21-10-2026 a leftover of 100 against 16700 that is already due must show Short 100 / Current 0.
3. Customer Statement picker is a long unfiltered `<select>`.
4. There is no one-click Print Ledger for a customer's full identity, schedules, payments, and Short / Current / Remaining.
5. UI still looks like a teal-on-white admin skin. Target look is the first screenshot: dark navy sidebar, white content, pastel KPI cards, rounded charts, airy spacing. Screenshots are visual reference only, not new features.
6. Desktop shortcut and taskbar must both use `assets/icon.ico`. Print windows omit the icon. `index.html` has no favicon.
7. Customer rows often show only `account_no - name`. Duplicate names are hard to tell apart. Guarantor names must appear with ` C/O ` (spaces on both sides) after the customer name.

## Goals

- Calculator customer dropdown: only customers who have never been used for any installment purchase or cash sale.
- One due-date rule for report Short / Current: unpaid becomes Short when `due_date <= as-of`. Current is unpaid in the as-of month whose `due_date > as-of`. Leftover still rolls onto the next installment on the 1st of the next month (reconcile unchanged).
- Statement picker has a search field that filters the list as the user types.
- Print Ledger button on each installment search result and on the open customer header. One preview: identity, all schedules, payments, Short / Current / Remaining. Shared print preview + Save PDF.
- Restyle existing shell with CSS tokens. Keep every screen and feature.
- Window, taskbar, desktop shortcut, print windows, and favicon all use `assets/icon.ico`.
- Shared customer identity helper: `Ali Khan C/O Ahmed C/O Bilal`. Used anywhere the user picks or identifies a customer.

## Non-goals

- React, Tauri, SMS APIs, Drive OAuth, Excel, GST.
- Changing `original_amount` after create.
- Mixing two purchases into one schedule UI/print/search row.
- Changing when leftover **rolls** (still 1st of next month via `isMonthPassed`).
- Rebuilding pages or adding screens.
- Version bump (stay `1.0.0`).
- Redesigning the ICO artwork (file already has 16–256 sizes).
- New inline styles; currency remains `Rs.`.

## Shared laws

### Report Short / Current (as-of local `YYYY-MM-DD`)

Compare **full dates**, not year-month.

- **Short:** unpaid leftover `max(0, original − paid)` on installments whose `due_date <= as-of`. Due today is Short.
- **Current:** unpaid leftover on installments whose due year-month **equals** the as-of year-month **and** `due_date > as-of` (still upcoming later this month).
- **Total (due-to-contact):** Short + Current.
- Future months (due year-month after as-of) are never in Short, Current, or Total.
- Hide a customer on contact lists when Total is 0.

Worked example (user-provided):

- Schedule started 02-08-2026, installment 8350. Two dues sitting in October = 16700.
- Paid 8300 on 08-10-2026, then 8300 via Pay Remaining.
- As of 21-10-2026: Short = 100, Current = 0.
- On 01-11-2026 the leftover 100 still rolls onto the November installment in the schedule UI (`reconcile` / `isMonthPassed` unchanged).

### Reconcile vs reports (do not conflate)

| Concern | Rule | Helper |
| --- | --- | --- |
| Schedule display shift / leftover roll | Due year-month **strictly before** as-of year-month | Keep `isMonthPassed`; `reconcile()` unchanged |
| Outstanding, dues, dashboard pending/overdue, statement headline, defaulters, aging, Print Ledger totals | `due_date <= as-of` is Short | New `isDueOrPast(dueDate, asOfDate)` |

`isMonthPassed` tests stay. Report tests change.

### Book remaining (schedules / Print Ledger remaining)

`max(0, sum(original) − sum(paid))` including future months. Never used as the contact-list amount.

### Customer identity with C/O

```
{customer_name} C/O {guarantor1} C/O {guarantor2}
```

- Literal ` C/O ` (space, C, /, O, space) before **each** guarantor name.
- No guarantors → customer name only. Empty guarantor names skipped.
- Account number stays a separate field or prefix (`A-12 — Ali Khan C/O Ahmed`), never inside the C/O chain.
- Guarantor order = `guarantors.id` ascending (insert order).

### Calculator eligibility

A customer is **free** only when **all** of:

- Zero non-deleted `customer_purchases` rows (active, completed, or closed — any history counts).
- Zero `cash_sales` rows with that `customer_id`.

Deleted purchases (`is_deleted = 1`) do not block. Walk-in cash sales (`customer_id` null) do not block anyone.

### Date-range law (unchanged from 2026-10-11 spec)

As-of reports use picker **end date** only. Period reports use start–end. Upcoming window is today → today+30.

---

## 1. Engine: due-date Short

**File:** `src/renderer/scripts/installment-engine.js`

Add:

```js
isDueOrPast(dueDate, asOfDate) {
  const due = String(dueDate || '').slice(0, 10);
  const asOf = String(asOfDate || '').slice(0, 10);
  if (!due || !asOf) return false;
  return due <= asOf;
}
```

**Change `totalShort(rows, asOfDate)`** to skip rows unless `isDueOrPast`. Do not use `isMonthPassed` here.

**Change `currentUnpaid(rows, asOfDate)`:**

- Same as-of year-month filter as today.
- Skip `status === 'paid' | 'settled'` and leftover ≤ 0.
- **Also skip** rows where `isDueOrPast` is true (those belong in Short).
- Result: Current is only unpaid later-this-month dues.

`customerDueSummary`, `groupCustomerDues`, `buildReceivableCustomerRows` keep the same return shape. They pick up the new Short/Current automatically.

`customerDueSummary.due_date`: first unpaid **current** row (later this month), else first **short** row (`isDueOrPast` and leftover > 0), else null.

**Do not change** `isMonthPassed` or `reconcile()`.

**SQL call sites that still filter Short with year-month** must switch to `due_date <= asOf`:

- `src/renderer/scripts/database.js` — `getOverdueInstallments`, `getOverdueItems`, dashboard fallback overdue count.
- `src/renderer/scripts/reports.js` — Defaulters, Overdue Aging, Upcoming headline short rows, any `strftime('%Y-%m', i.due_date) < strftime('%Y-%m', ?)` used to mean Short.

Prefer loading leftover rows and grouping through `InstallmentEngine` instead of duplicating the date rule in SQL. Where SQL is kept as a prefilter, use `i.due_date <= ?` with the as-of `YYYY-MM-DD`.

Dashboard:

- Pending Amount = `groupCustomerDues` Total (new Short+Current) + cash `due_amount`.
- Overdue Customers = grouped rows with `short > 0` (now includes due-today leftover).

Dues Reminders Overdue tab uses `getOverdueItems` with the new date rule.

---

## 2. Calculator: free customers only

**File:** `src/renderer/scripts/database.js`

Replace calculator's use of `getCustomers()` / `getCustomersWithoutActivePurchase()`. Add:

```js
static async getCustomersNeverSold() {
  return await this.query(`
    SELECT c.* FROM customers c
    WHERE c.id NOT IN (
      SELECT customer_id FROM customer_purchases
      WHERE customer_id IS NOT NULL
        AND (is_deleted = 0 OR is_deleted IS NULL)
    )
    AND c.id NOT IN (
      SELECT customer_id FROM cash_sales
      WHERE customer_id IS NOT NULL
    )
    ORDER BY c.created_at DESC
  `);
}
```

**File:** `src/renderer/scripts/calculator.js`

- `initialize()` loads `getCustomersNeverSold()`.
- Dropdown option text uses the C/O identity helper (section 7).
- After a plan is created, reload the free list so that customer disappears.
- Empty list: keep "Choose Customer" + Add New Customer. No fake rows.

Cash Sales customer dropdown still lists all customers (not part of this filter).

Keep `getCustomersWithoutActivePurchase` if anything else still calls it; do not reuse it for the calculator (it only excludes `status = 'active'`).

---

## 3. Statement picker search

**File:** `src/renderer/scripts/reports.js` — `promptCustomerId()`

Keep the existing small modal. Add a text input **above** the `<select>`:

- Placeholder: `Search name, account, phone, CNIC, guarantor`.
- On `input`, filter the in-memory customer list (case-insensitive) against `customer_name`, `account_no`, `phone`, `cnic_no`, and concatenated guarantor names.
- Rebuild `<select>` options from matches. If zero matches, show one disabled option `No matches`.
- Options use the C/O identity helper.
- Generate still reads the selected id. Cancel / close still resolves `null`.

Receivable customer picker (`promptReceivableCustomers`) gets the same search field and C/O labels so the two pickers behave the same.

Load guarantors once when opening the modal (`SELECT customer_id, name FROM guarantors ORDER BY id`) and group in memory. Do not N+1.

---

## 4. Print Ledger

**Where the button appears**

1. Open customer header footer in `renderCustomerInfo` — next to Print First Schedule: `Print Ledger`.
2. Each installment search-result card — in `result-summary-actions` and again in expanded `result-actions`: `Print Ledger`.
3. Enabled even when the customer has no installments (print identity + empty schedules + empty payments).

**Click handler** `InstallmentManager.printLedger(customerId)`

Load:

- Customer row + guarantors + photo (same optional photo path as statement).
- All non-deleted purchases with stock/product identifiers.
- All non-deleted installments for those purchases, grouped with `InstallmentEngine.groupByPurchase` (one table per purchase, never mixed).
- All non-deleted payments for the customer (`type` payment or null), oldest first.
- `customerDueSummary` as of **today local** (`Utils.toLocalDateString(new Date())`).
- Book remaining via `InstallmentEngine.totals`.

**Preview content** (one document, shared `Utils` print preview + Save PDF):

1. Shop header (`Utils.shopPrintHeaderHtml()`).
2. Title `Customer Ledger`.
3. Identity: account, C/O name, CNIC, phone, address, guarantor phones if present.
4. Headline: Short, Current, Total (as of today), Book remaining.
5. Each purchase: heading (item + identifier), schedule table (`#`, Due Date, Amount, Paid, Status, Remaining).
6. Payments table: Date, Amount, Receipt, Notes.
7. If no purchases: `No installment schedule.` If no payments: `No payments.`

Search-result Print Ledger must **not** require Select / close the modal first. It loads by `customerId` independently of `this.currentCustomer`.

Do not add a new IPC channel. Use existing `print-preview-pdf` / `Utils` preview modal.

---

## 5. UI restyle (tokens only)

**Files:** `src/renderer/styles/main.css`, `src/renderer/styles/components.css`. No HTML structure rewrite.

Target (first screenshot): dark navy sidebar, white content, pastel KPI cards, rounded charts, airy spacing.

`:root` token updates:

```css
--sidebar-bg: #0f172a;
--sidebar-text: #cbd5e1;
--sidebar-active-bg: rgba(255, 255, 255, 0.08);
--sidebar-active-text: #ffffff;
--background-color: #f4f7fb;
--card-background: #ffffff;
--primary-color: #2563eb;
--primary-hover: #1d4ed8;
--border-radius: 16px;
--shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
```

KPI / `.dashboard-card`:

- White card, larger radius, more padding and gap.
- Icon tiles use **pastel** fills (not the teal gradient): soft blue `#dbeafe`, mint `#d1fae5`, peach `#ffedd5`, lavender `#ede9fe`, rotating by card index.
- Icon glyph color is a matching darker shade, not white-on-teal.
- Numbers stay `--text-primary`. Muted labels stay `--text-secondary`.

Charts (dashboard canvas wrappers): `border-radius: 16px`, extra padding, white card, light border.

Sidebar: keep collapse / hamburger. Active nav: light translucent pill, white label. Hover: slightly lighter navy. Header stays light/white above the sidebar.

Do not change copy, section list, or unrelated table columns. Allowed markup edits are only those required by sections 3, 4, 6, and 7 (statement search input, Print Ledger buttons, favicon link, customers-table Name column).

Keep Font Awesome. Keep `Segoe UI` / system-ui (no new webfont).

---

## 6. Unified icon

**File already used:** `assets/icon.ico` (multi-size). Do not redraw.

| Surface | Change |
| --- | --- |
| Main `BrowserWindow` | Always `icon: path.join(__dirname, '../assets/icon.ico')` (drop the win32/png split so Windows taskbar and Linux window match). |
| Print / preview `BrowserWindow` in `loadPrintWindow` | Same `icon` path. |
| `package.json` `build.win.icon` / NSIS installer/uninstaller/header icons | Already `assets/icon.ico`. Leave. Desktop shortcut comes from NSIS `createDesktopShortcut` + that icon. |
| `src/renderer/index.html` | `<link rel="icon" href="../../assets/icon.ico">` so the renderer tab matches. |

No `icon.png` requirement after this. If `assets/icon.png` exists, leave the file; stop referencing it.

---

## 7. Customer identity helper (C/O)

**File:** `src/renderer/scripts/utils.js`

```js
static formatCustomerIdentity(customer, guarantors) {
  const name = String((customer && customer.customer_name) || '').trim() || 'Customer';
  const parts = (guarantors || [])
    .map((g) => String((g && g.name) || '').trim())
    .filter(Boolean);
  if (!parts.length) return name;
  return name + parts.map((g) => ` C/O ${g}`).join('');
}
```

`formatCustomerOption(customer, guarantors)` for dropdowns:

```
{account_no} — {formatCustomerIdentity(...)}
```

If `account_no` is empty, identity only.

**Data:** add `Database.getGuarantorsByCustomerIds(ids)` → `Map<customerId, {id, name, phone}[]>`, one `WHERE customer_id IN (...)` query. Callers attach guarantors before render. Do not query per row.

**Must use the helper**

- Installment search results (`account_no - name` line) and expanded compact header.
- Open customer header Name field.
- Global search customer rows.
- Calculator `<select>`.
- Cash sale customer `<select>`.
- Statement + receivable pickers.
- Customers table: insert a Name column (C/O string) after Account No. The table currently has no name column; this is the one table-column change in this spec.
- Customer view modal title/name.
- Dues, Outstanding, Receivable, Defaulters, Aging, Upcoming, Customer-wise Collection, cash overdue lists — the name cell.
- Print Ledger identity, Customer Statement customer line, schedule print header name.
- WhatsApp templates that already pass `name` should pass the C/O string so the clerk sees the same label.

**Must not use it**

- Receipts that legally need the customer's own name only may keep `customer_name` on the "Customer" line **and** still print guarantors in a separate Guarantors block if one already exists. Print Ledger always uses the C/O string.
- Internal logs / console.

Escape HTML at the render site the same way neighboring strings are escaped.

---

## 8. Testing

**`tests/installment-engine.test.js`**

Keep all `isMonthPassed` / `reconcile` month-roll cases. They still expect due `2026-10-02` to stay display-current through `2026-10-31` and roll on `2026-11-01`.

Replace report-summary cases:

- Unpaid due `2026-10-02`, as-of `2026-10-21` → `{ short: leftover, current: 0, kind: 'short' }`.
- Unpaid due `2026-10-25`, as-of `2026-10-21` → `{ short: 0, current: leftover, kind: 'current' }`.
- Unpaid due `2026-10-21`, as-of `2026-10-21` → Short (due today).
- User scenario: two October dues totaling 16700, paid 16600, as-of `2026-10-21` → Short 100, Current 0.
- `fourBy10k()` as-of `2026-01-15`: Short 10000 (due 01-01 already past), Current 0.
- `fourBy10k()` as-of `2026-02-01`: Short 20000 (Jan due + Feb-01 due today), Current 0, kind `'short'`.
- Later-this-month unpaid + past unpaid → `kind: 'both'`.
- Fully paid → total 0, omitted from `groupCustomerDues`.

**New `tests/customer-identity.test.js`**

- No guarantors → name only.
- One → `Ali Khan C/O Ahmed`.
- Two → `Ali Khan C/O Ahmed C/O Bilal`.
- Blank guarantor name skipped.
- Missing customer name → `Customer`.
- Spaces: assert the substring `' C/O '` (leading and trailing space) around each separator.

**New `tests/free-customers.test.js`** (string/source or small SQL fixture if the suite already boots SQLite; otherwise assert `getCustomersNeverSold` SQL text includes both `customer_purchases` and `cash_sales` exclusions). Prefer a real query test if `tests/` already opens the schema; otherwise source assertion is enough.

**`tests/report-collections.test.js`:** do not regress collection-date behavior.

Run `node --check` on touched JS, then `npm test`.

---

## 9. Implementation order

1. Engine `isDueOrPast` + `totalShort` / `currentUnpaid` + tests.
2. SQL overdue/defaulter/aging/dashboard filters.
3. `formatCustomerIdentity` + `getGuarantorsByCustomerIds` + wire every name surface.
4. `getCustomersNeverSold` + calculator dropdown.
5. Statement + receivable search field.
6. Print Ledger.
7. CSS token restyle.
8. Icon path + favicon + print window icon.
9. `node --check`, `npm test`, commit. Rebuild installer / GitHub `v1.0.0` asset only if the user asks.

---

## 10. Constraints carried forward

- Shortage display shift; `original_amount` never changes after create.
- Partial pay stays on that row until the due month fully passes (`reconcile`).
- Search by account, CNIC, stock no, engine, chassis, IMEI, serial, reg, guarantor name/phone/CNIC.
- Unsigned NSIS OK. Product version `1.0.0`.
- Credits: Developed By POVDEV | povdev.com | WhatsApp: @wpfahad | Email: mypovdev@gmail.com.
- Dual CNIC photos already shipped; do not reopen.
- Cash collections stay on `cash_sale_collections.collection_date` (commit `5d75b55`).

## 11. Files to touch

- `src/renderer/scripts/installment-engine.js`
- `src/renderer/scripts/utils.js`
- `src/renderer/scripts/database.js`
- `src/renderer/scripts/calculator.js`
- `src/renderer/scripts/installments.js`
- `src/renderer/scripts/reports.js`
- `src/renderer/scripts/dues-reminders.js`
- `src/renderer/scripts/cash-sales.js`
- `src/renderer/scripts/customers.js`
- `src/renderer/scripts/main.js`
- `src/renderer/scripts/dashboard.js` (only if overdue/pending labels need no markup change; stats already flow from Database)
- `src/renderer/styles/main.css`
- `src/renderer/styles/components.css`
- `src/renderer/index.html`
- `src/main.js`
- `tests/installment-engine.test.js`
- `tests/customer-identity.test.js` (new)
- `tests/free-customers.test.js` (new)

`package.json` icons already point at `assets/icon.ico` — no change unless a path is wrong.
