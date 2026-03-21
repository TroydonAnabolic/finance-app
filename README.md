# Ledger — Personal Finance Visualizer

A clean, dark-themed finance dashboard built with Next.js 15 App Router, Firebase, and Recharts.

## Features

- 🔐 **Email magic link auth** — passwordless sign in/sign up via Firebase Auth
- 💰 **Spend tracker** — log income and expenses per person
- 📊 **Dashboard** — weekly/fortnightly/monthly/yearly summaries
- 📈 **Charts** — monthly trends (area), category breakdown (donut), per-person contributions (bar)
- 👥 **Multi-person budgets** — create people, assign to budgets, track contributions
- 📁 **CSV import/export** — bulk import transactions, export to CSV
- 🔥 **Firestore** — real-time data, secure per-user rules

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Sign-in method → **Email link (passwordless)**
   - Add your domain to the Authorized domains list (e.g. `localhost`)
4. Enable **Firestore Database** (start in production mode)
5. Go to Project Settings → Your apps → Add web app → copy the config

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Firebase config values in `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 4. Deploy Firestore rules and indexes

Install Firebase CLI if needed:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project
```

Then deploy:
```bash
firebase deploy --only firestore
```

Or paste the contents of `firestore.rules` and `firestore.indexes.json` directly in the Firebase Console.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## App Structure

```
src/
├── app/
│   ├── (app)/                  # Protected routes
│   │   ├── layout.tsx          # Auth guard + sidebar layout
│   │   ├── dashboard/          # Overview with charts and stats
│   │   ├── transactions/       # Transaction list, filter, edit, CSV
│   │   ├── people/             # People cards with contributions
│   │   └── budget/             # Budget management
│   ├── auth/                   # Magic link sign in
│   ├── layout.tsx              # Root layout with providers
│   └── page.tsx                # Redirect to /dashboard or /auth
├── components/
│   ├── ui/                     # Button, Input, Card, Modal, Badge, StatCard
│   ├── charts/                 # Recharts wrappers
│   ├── layout/                 # Sidebar
│   └── modals/                 # AddTransaction, EditTransaction, AddPerson, ImportCSV
├── context/
│   ├── AuthContext.tsx         # Firebase auth state
│   └── AppContext.tsx          # Budgets, people, transactions CRUD
├── lib/
│   ├── firebase.ts             # Firebase init
│   ├── firestore.ts            # Firestore helpers
│   ├── utils.ts                # Formatting, period summaries, chart data
│   └── csv.ts                  # Papaparse import/export
└── types/
    └── index.ts                # TypeScript interfaces
```

---

## CSV Import Format

| Column | Values |
|--------|--------|
| Date | YYYY-MM-DD |
| Type | income / expense |
| Amount | numeric |
| Category | housing, food, transport, utilities, entertainment, health, clothing, education, savings, salary, freelance, investment, other |
| Description | free text |

---

## Tech Stack

- **Next.js 15** — App Router, TypeScript
- **Firebase** — Auth (email link), Firestore
- **Recharts** — AreaChart, PieChart, BarChart
- **Tailwind CSS** — custom design system
- **Papaparse** — CSV parsing
- **date-fns** — date utilities
- **react-hot-toast** — notifications
- **Lucide React** — icons
