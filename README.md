# Ledger - Personal Finance Visualizer

A dark-themed personal finance dashboard built with Next.js 15 App Router, Firebase, Tailwind CSS, and Recharts.

## What The App Does

- Passwordless auth with Firebase email magic links.
- Budget-scoped finance tracking across multiple people.
- Transaction lifecycle management: add, edit, delete, bulk delete, import/export.
- Recurring transaction templates and generated occurrences.
- Split-aware debt tracking between two people.
- Per-person cash asset tracking.
- Dashboard analytics with period summaries and charts.
- In-app Help page for user-facing feature guidance.

## Core Features

### Authentication

- Firebase Auth with email link sign-in/sign-up.
- Protected app routes under `src/app/(app)`.
- Unauthenticated users are redirected to `/auth`.

### Budget Management

- Multiple budgets per user.
- Active budget selector in sidebar.
- All people, transactions, and analytics are scoped to the active budget.

### People

- Add and manage people in each budget.
- Person color is used in charts and transaction chips.
- Contribution analytics are computed per person.
- Includes a Debt Tracker panel for who-owes-who tracking.
- Includes a Cash Assets section with editable starting cash per person.

### Debt Tracker (Who Owes Who)

- Located on the People page.
- Configure:
  - Who owes
  - Who is owed
  - Starting debt already owed
- Split-aware auto-calculation from completed expense transactions:
  - Shared 50/50 splits are handled automatically.
  - If creditor paid debtor's share, debt increases.
  - If debtor paid creditor's share, debt decreases.
- Shows contribution gap between the two selected people.
- Includes a repayment input to reduce the debt baseline.
- Saved per budget in browser local storage.

### Cash Assets

- Starting cash is editable per person and saved per budget in local storage.
- Cash movement from completed transactions:
  - Income adds to the assigned person.
  - Expenses subtract from `Paid by person`.
- Total cash asset = starting cash + calculated cash movement.

### Transactions

- Add income and expense transactions.
- Fields include category, person, amount, description, date/date-time.
- New split-aware fields:
  - `Paid by person`
  - `Split type` (`shared_equal` or `personal`)
- Edit transaction modal supports recurring and series-aware edits.
- Delete single transaction or bulk delete selected rows.
- CSV import/export.
- Customizable table columns (show/hide).
- Manual refresh control for reloading latest data.

### Transaction View Modes

Transactions page includes a mode dropdown:

- `Completed` (default): shows transactions that have occurred.
- `Upcoming`: shows future transactions only.
- `All`: shows both completed and upcoming.

Recurring behavior in Upcoming/All:

- Recurring templates are not shown directly in `Upcoming`.
- Exactly one next upcoming occurrence is shown per recurring template.
- If a stored future occurrence exists, the earliest one is shown.
- If none exists yet, a synthetic next occurrence is computed from recurrence rules.
- Synthetic rows are labeled `Next scheduled` in the Description column.

### Recurring Transactions

- Supported frequencies: minute, hour, daily, weekly, monthly, yearly.
- Recurrence model includes:
  - `recurrenceStatus` (`one_time`, `template`, `occurrence`)
  - `recurrenceGroupId`
  - `recurrenceSourceId`
  - `recurrence` (`frequency`, `interval`, `endsOn`)
- Edit scopes for recurring series:
  - This transaction only
  - This and future transactions
  - All transactions in series

### Dashboard And Charts

- Period summaries: weekly, fortnightly, monthly, yearly.
- Stat cards: income, expenses, net.
- Charts:
  - Monthly trends
  - Category breakdown
  - Person contributions

### Help Page

- In-app help route at `/help`.
- Sidebar includes a `Help` navigation item.
- Help page explains workflows, filters, recurring logic, debt tracking, and cash assets.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication -> Sign-in method -> Email link (passwordless)
4. Add local/dev domains to authorized domains (for example, localhost)
5. Enable Firestore Database
6. Create a Web App in Project Settings and copy config values

### 3. Configure environment variables

Create `.env.local` and set:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 4. Firestore rules and indexes

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore
```

Or apply `firestore.rules` and `firestore.indexes.json` in Firebase Console.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## App Navigation

- `/dashboard`: analytics and charts.
- `/transactions`: transaction table and controls.
- `/people`: people management, debt tracker, cash assets.
- `/budget`: budget management.
- `/help`: in-app feature documentation.

## App Structure

```text
src/
  app/
    (app)/
      layout.tsx
      dashboard/
      transactions/
      people/
      budget/
      help/
    auth/
    layout.tsx
    page.tsx
  components/
    ui/
    charts/
    layout/
    modals/
  context/
    AuthContext.tsx
    AppContext.tsx
  lib/
    firebase.ts
    firestore.ts
    utils.ts
    csv.ts
  types/
    index.ts
```

## CSV Import Format

| Column | Values |
|--------|--------|
| Date | `YYYY-MM-DD` |
| Type | `income` or `expense` |
| Amount | numeric |
| Category | `housing`, `food`, `transport`, `utilities`, `entertainment`, `health`, `clothing`, `education`, `savings`, `salary`, `freelance`, `investment`, `other` |
| Description | free text |
| PaidBy (optional) | Person name or person ID |
| SplitType (optional) | `shared_equal`, `shared`, `50/50`, or `personal` |

## Recurring Processor Notes

- The repository contains scheduled recurring processing logic in AWS function code under `aws-functions-recurring`.
- Recurring templates produce occurrence transactions over time.
- Transaction page logic can compute synthetic next upcoming rows for UI visibility when no future occurrence has been persisted yet.

## Tech Stack

- Next.js 15 (App Router + TypeScript)
- Firebase Auth + Firestore
- Tailwind CSS
- Recharts
- Papaparse
- date-fns
- react-hot-toast
- Lucide React
