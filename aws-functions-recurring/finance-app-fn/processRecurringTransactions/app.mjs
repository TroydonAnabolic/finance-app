// Migrated from Azure Functions to AWS Lambda
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const RECURRENCE_FREQUENCIES = new Set(["minute", "hour", "daily", "weekly", "monthly", "yearly"]);

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
 * @property {string|null} [recurrenceCursorDate]
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

function normalizeFrequency(value) {
  if (!value || typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "minutes": return "minute";
    case "hours": return "hour";
    case "day": return "daily";
    case "week": return "weekly";
    case "month": return "monthly";
    case "year": return "yearly";
    default:
      return RECURRENCE_FREQUENCIES.has(normalized) ? normalized : null;
  }
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

function getLatestDueDate(lastDate, frequency, interval, now, endDate) {
  let dueDate = addToDate(lastDate, frequency, interval);
  if (endDate && dueDate.getTime() > endDate.getTime()) {
    return null;
  }
  if (dueDate.getTime() > now.getTime()) {
    return null;
  }

  // Coalesce missed runs to a single occurrence at the latest due slot.
  let latestDueDate = dueDate;
  while (true) {
    const nextCandidate = addToDate(latestDueDate, frequency, interval);
    if (endDate && nextCandidate.getTime() > endDate.getTime()) {
      break;
    }
    if (nextCandidate.getTime() > now.getTime()) {
      break;
    }
    latestDueDate = nextCandidate;
  }

  return latestDueDate;
}

export const lambdaHandler = async (event, context) => {
  try {
    const now = new Date();
    console.log(`[Recurring] AWS Lambda triggered at ${now.toISOString()}`);
    const app = getFirebaseApp();
    const db = getFirestore(app);
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
    const txCollection = db.collection("transactions");

    for (const doc of txSnap.docs) {
      let processedDateValue = null;
      try {
        await db.runTransaction(async (firestoreTx) => {
          const freshSnap = await firestoreTx.get(doc.ref);
          if (!freshSnap.exists) {
            return;
          }

          const tx = freshSnap.data();
          if (!tx || !tx.recurrence || (!tx.date && !tx.recurrenceCursorDate)) {
            return;
          }

          const isTemplate = tx.recurrenceStatus === "template" && tx.recurrenceSourceId == null && tx.isRecurring === true;
          if (!isTemplate) {
            return;
          }

          const normalizedFrequency = normalizeFrequency(tx.recurrence.frequency);
          const parsedInterval = Number.parseInt(String(tx.recurrence.interval), 10);
          if (!normalizedFrequency || Number.isNaN(parsedInterval) || parsedInterval < 1) {
            return;
          }

          const cursorSourceDate = tx.recurrenceCursorDate || tx.date;
          const lastDate = parseTransactionDate(cursorSourceDate);
          if (!lastDate) {
            return;
          }

          const endDate = parseEndDate(tx.recurrence.endsOn);
          if (endDate && now.getTime() > endDate.getTime()) {
            return;
          }

          const dueDate = getLatestDueDate(lastDate, normalizedFrequency, parsedInterval, now, endDate);
          if (!dueDate) {
            return;
          }

          const dueDateValue = toStoredDateValue(dueDate, normalizedFrequency);
          const recurrenceGroupId = tx.recurrenceGroupId || doc.id;
          const generatedTx = {
            ...tx,
            date: dueDateValue,
            createdAt: new Date().toISOString(),
            isRecurring: false,
            recurrenceStatus: "occurrence",
            recurrenceGroupId,
            recurrenceCursorDate: null,
            recurrence: {
              frequency: normalizedFrequency,
              interval: parsedInterval,
              endsOn: tx.recurrence.endsOn ?? null,
            },
            recurrenceSourceId: doc.id,
          };

          const newTxRef = txCollection.doc();
          firestoreTx.create(newTxRef, generatedTx);
          firestoreTx.update(doc.ref, {
            isRecurring: true,
            recurrenceStatus: "template",
            recurrenceSourceId: null,
            recurrenceGroupId,
            recurrenceCursorDate: dueDateValue,
            recurrence: generatedTx.recurrence,
          });

          processedDateValue = dueDateValue;
        });
      } catch (err) {
        console.error(`[Recurring] Failed to process ${doc.id}: ${String(err)}`);
        continue;
      }

      if (processedDateValue) {
        console.log(`[Recurring] Generated occurrence for ${doc.id}; advanced recurrence cursor to ${processedDateValue}.`);
      } else {
        console.log(`[Recurring] Skip ${doc.id}: not due, invalid config, or already processed.`);
      }
    }
    console.log("[Recurring] AWS Lambda run complete.");
    return { statusCode: 200, body: JSON.stringify({ message: "Recurring transactions processed" }) };
  } catch (err) {
    console.error(`[Recurring] Top-level error: ${err && err.stack ? err.stack : String(err)}`);
    return { statusCode: 500, body: JSON.stringify({ error: "Top-level error", details: String(err) }) };
  }
};
