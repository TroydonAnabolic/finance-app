// Migrated from Azure Functions to AWS Lambda
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Types copied from Azure version
const RECURRENCE_FREQUENCIES = ["minute", "hour", "daily", "weekly", "monthly", "yearly"];

/**
 * @typedef {Object} Recurrence
 * @property {string} frequency
 * @property {number} interval
 * @property {string|null} [endsOn]
 */

/**
 * @typedef {Object} TxDoc
 * @property {number} amount
 * @property {string} category
 * @property {string} [createdAt]
 * @property {string} date
 * @property {string} [description]
 * @property {boolean} [isRecurring]
 * @property {string} [recurrenceStatus]
 * @property {string|null} [recurrenceGroupId]
 * @property {string|null} [recurrenceSourceId]
 * @property {Recurrence|null} [recurrence]
 * @property {string} type
 * @property {string} budgetId
 * @property {string} personId
 * @property {string} userId
 */

function getFirebaseApp() {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey })
    });
  }
  return initializeApp();
}

function addToDate(date, freq, interval) {
  const d = new Date(date);
  switch (freq) {
    case "minute": d.setMinutes(d.getMinutes() + interval); break;
    case "hour": d.setHours(d.getHours() + interval); break;
    case "daily": d.setDate(d.getDate() + interval); break;
    case "weekly": d.setDate(d.getDate() + 7 * interval); break;
    case "monthly": d.setMonth(d.getMonth() + interval); break;
    case "yearly": d.setFullYear(d.getFullYear() + interval); break;
  }
  return d;
}

function parseTransactionDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseEndDate(value) {
  if (!value) return null;
  const isDateOnly = !value.includes("T");
  const normalized = isDateOnly ? `${value}T23:59:59` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toStoredDateValue(nextDate, frequency) {
  if (frequency === "minute" || frequency === "hour") {
    return nextDate.toISOString();
  }
  return nextDate.toISOString().slice(0, 10);
}

export const lambdaHandler = async (event, context) => {
  getFirebaseApp();
  const db = getFirestore();
  const now = new Date();
  console.log(`[Recurring] AWS Lambda triggered at ${now.toISOString()}`);
  let txSnap;
  try {
    txSnap = await db
      .collection("transactions")
      .where("isRecurring", "==", true)
      .get();
    console.log(`[Recurring] Found ${txSnap.docs.length} recurring templates.`);
  } catch (err) {
    console.error(`[Recurring] Failed to query recurring templates: ${String(err)}`);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to query recurring templates" }) };
  }
  for (const doc of txSnap.docs) {
    const tx = doc.data();
    if (!tx.recurrence || !tx.date) {
      console.log(`[Recurring] Skip ${doc.id}: missing recurrence or date.`);
      continue;
    }
    const { frequency, interval, endsOn } = tx.recurrence;
    if (!frequency || !interval || interval < 1) {
      console.log(`[Recurring] Skip ${doc.id}: invalid recurrence settings.`);
      continue;
    }
    const lastDate = parseTransactionDate(tx.date);
    if (!lastDate) {
      console.log(`[Recurring] Skip ${doc.id}: invalid last date.`);
      continue;
    }
    const endDate = parseEndDate(endsOn);
    if (endDate && now.getTime() > endDate.getTime()) {
      console.log(`[Recurring] Skip ${doc.id}: end date already passed.`);
      continue;
    }
    const nextDate = addToDate(lastDate, frequency, interval);
    if (nextDate.getTime() > now.getTime()) {
      console.log(`[Recurring] Skip ${doc.id}: next occurrence not due yet.`);
      continue;
    }
    if (endDate && nextDate.getTime() > endDate.getTime()) {
      console.log(`[Recurring] Skip ${doc.id}: next occurrence after end date.`);
      continue;
    }
    const nextDateValue = toStoredDateValue(nextDate, frequency);
    const recurrenceGroupId = tx.recurrenceGroupId || doc.id;
    const generatedTx = {
      ...tx,
      date: nextDateValue,
      createdAt: new Date().toISOString(),
      isRecurring: false,
      recurrenceStatus: "occurrence",
      recurrenceGroupId,
      recurrence: tx.recurrence
        ? {
            frequency: tx.recurrence.frequency,
            interval: tx.recurrence.interval,
            endsOn: tx.recurrence.endsOn ?? null,
          }
        : null,
      recurrenceSourceId: doc.id,
    };
    try {
      await db.collection("transactions").add(generatedTx);
    } catch (err) {
      console.error(`[Recurring] Failed to create generated tx for ${doc.id}: ${String(err)}`);
      continue;
    }
    try {
      await doc.ref.update({
        date: nextDateValue,
        recurrenceStatus: "template",
        recurrenceGroupId,
      });
      console.log(`[Recurring] Generated and advanced template ${doc.id} to ${nextDateValue}.`);
    } catch (err) {
      console.error(`[Recurring] Generated tx but failed to update ${doc.id}: ${String(err)}`);
    }
  }
  console.log("[Recurring] AWS Lambda run complete.");
  return { statusCode: 200, body: JSON.stringify({ message: "Recurring transactions processed" }) };
};
