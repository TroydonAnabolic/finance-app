import {app, InvocationContext, Timer} from "@azure/functions";
import {initializeApp, cert, getApps, App} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

type RecurrenceFrequency =
  | "minute"
  | "hour"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

type Recurrence = {
  frequency: RecurrenceFrequency;
  interval: number;
  endsOn?: string | null;
};

type TxDoc = {
  amount: number;
  category: string;
  createdAt?: string;
  date: string;
  description?: string;
  isRecurring?: boolean;
  recurrenceStatus?: "one_time" | "template" | "occurrence";
  recurrenceGroupId?: string | null;
  recurrenceSourceId?: string | null;
  recurrence?: Recurrence | null;
  type: "income" | "expense";
  budgetId: string;
  personId: string;
  userId: string;
  [key: string]: unknown;
};

function getFirebaseApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  // Falls back to default credentials when running in an environment
  // where ADC is configured.
  return initializeApp();
}

function addToDate(date: Date, freq: RecurrenceFrequency, interval: number): Date {
  const d = new Date(date);
  switch (freq) {
  case "minute":
    d.setMinutes(d.getMinutes() + interval);
    break;
  case "hour":
    d.setHours(d.getHours() + interval);
    break;
  case "daily":
    d.setDate(d.getDate() + interval);
    break;
  case "weekly":
    d.setDate(d.getDate() + 7 * interval);
    break;
  case "monthly":
    d.setMonth(d.getMonth() + interval);
    break;
  case "yearly":
    d.setFullYear(d.getFullYear() + interval);
    break;
  }
  return d;
}

function parseTransactionDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseEndDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const isDateOnly = !value.includes("T");
  const normalized = isDateOnly ? `${value}T23:59:59` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toStoredDateValue(nextDate: Date, frequency: RecurrenceFrequency): string {
  if (frequency === "minute" || frequency === "hour") {
    return nextDate.toISOString();
  }
  return nextDate.toISOString().slice(0, 10);
}

export async function processRecurringTransactions(
  _timer: Timer,
  context: InvocationContext
): Promise<void> {
  getFirebaseApp();
  const db = getFirestore();
  const now = new Date();

  context.log(`[Recurring] Azure scheduler triggered at ${now.toISOString()}`);

  let txSnap;
  try {
    txSnap = await db
      .collection("transactions")
      .where("isRecurring", "==", true)
      .get();

    context.log(`[Recurring] Found ${txSnap.docs.length} recurring templates.`);
  } catch (err) {
    context.error(`[Recurring] Failed to query recurring templates: ${String(err)}`);
    return;
  }

  for (const doc of txSnap.docs) {
    const tx = doc.data() as TxDoc;

    if (!tx.recurrence || !tx.date) {
      context.log(`[Recurring] Skip ${doc.id}: missing recurrence or date.`);
      continue;
    }

    const {frequency, interval, endsOn} = tx.recurrence;
    if (!frequency || !interval || interval < 1) {
      context.log(`[Recurring] Skip ${doc.id}: invalid recurrence settings.`);
      continue;
    }

    const lastDate = parseTransactionDate(tx.date);
    if (!lastDate) {
      context.log(`[Recurring] Skip ${doc.id}: invalid last date.`);
      continue;
    }

    const endDate = parseEndDate(endsOn);
    if (endDate && now.getTime() > endDate.getTime()) {
      context.log(`[Recurring] Skip ${doc.id}: end date already passed.`);
      continue;
    }

    const nextDate = addToDate(lastDate, frequency, interval);
    if (nextDate.getTime() > now.getTime()) {
      context.log(`[Recurring] Skip ${doc.id}: next occurrence not due yet.`);
      continue;
    }

    if (endDate && nextDate.getTime() > endDate.getTime()) {
      context.log(`[Recurring] Skip ${doc.id}: next occurrence after end date.`);
      continue;
    }

    const nextDateValue = toStoredDateValue(nextDate, frequency);
    const recurrenceGroupId = tx.recurrenceGroupId || doc.id;

    // Generated transaction should be a normal transaction (not another template)
    // to avoid exponential growth of recurring documents.
    const generatedTx: TxDoc = {
      ...tx,
      date: nextDateValue,
      createdAt: new Date().toISOString(),
      isRecurring: false,
      recurrenceStatus: "occurrence",
      recurrenceGroupId,
      recurrence: null,
      recurrenceSourceId: doc.id,
    };

    try {
      await db.collection("transactions").add(generatedTx);
    } catch (err) {
      context.error(`[Recurring] Failed to create generated tx for ${doc.id}: ${String(err)}`);
      continue;
    }

    try {
      await doc.ref.update({
        date: nextDateValue,
        recurrenceStatus: "template",
        recurrenceGroupId,
      });
      context.log(`[Recurring] Generated and advanced template ${doc.id} to ${nextDateValue}.`);
    } catch (err) {
      context.error(`[Recurring] Generated tx but failed to update ${doc.id}: ${String(err)}`);
    }
  }

  context.log("[Recurring] Azure scheduler run complete.");
}

app.timer('processRecurringTransactions', {
    schedule: '0 */1 * * * *',
    handler: processRecurringTransactions
});
