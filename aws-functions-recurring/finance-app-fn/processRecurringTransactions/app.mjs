// Migrated from Azure Functions to AWS Lambda
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const RECURRENCE_FREQUENCIES = new Set(["minute", "hour", "daily", "weekly", "monthly", "yearly"]);
const MAX_GENERATED_PER_TEMPLATE = 350;
const MAX_LOOP_GUARD = 50000;
const TRUTHY_VALUES = new Set(["1", "true", "yes", "y", "on"]);

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

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseBooleanFlag(value) {
  if (value === true) return true;
  if (typeof value === "string") {
    return TRUTHY_VALUES.has(value.trim().toLowerCase());
  }
  return false;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < 1) return null;
  return parsed;
}

function getInvocationOptions(event) {
  const eventPayload = event && typeof event === "object" ? event : {};
  const bodyPayload = parseJsonObject(eventPayload.body);
  const detailPayload = eventPayload.detail && typeof eventPayload.detail === "object"
    ? eventPayload.detail
    : {};

  const rebuildAllRecurring =
    parseBooleanFlag(eventPayload.rebuildAllRecurring) ||
    parseBooleanFlag(bodyPayload.rebuildAllRecurring) ||
    parseBooleanFlag(detailPayload.rebuildAllRecurring) ||
    parseBooleanFlag(eventPayload.recreateAllRecurring) ||
    parseBooleanFlag(bodyPayload.recreateAllRecurring) ||
    parseBooleanFlag(detailPayload.recreateAllRecurring);

  const configuredMax =
    parsePositiveInteger(eventPayload.maxGeneratedPerTemplate) ||
    parsePositiveInteger(bodyPayload.maxGeneratedPerTemplate) ||
    parsePositiveInteger(detailPayload.maxGeneratedPerTemplate) ||
    MAX_GENERATED_PER_TEMPLATE;

  return {
    rebuildAllRecurring,
    maxGeneratedPerTemplate: Math.min(configuredMax, MAX_GENERATED_PER_TEMPLATE),
  };
}

function buildOccurrenceDocId(templateId, dueDateValue) {
  const safeDate = dueDateValue.replace(/[^0-9A-Za-z_-]/g, "_");
  return `rec_${templateId}_${safeDate}`;
}

function parseTransactionDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseEndDate(value) {
  if (!value || typeof value !== "string") return null;
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
  try {
    const now = new Date();
    const invocationOptions = getInvocationOptions(event);
    const rebuildAllRecurring = invocationOptions.rebuildAllRecurring;
    const maxGeneratedPerTemplate = invocationOptions.maxGeneratedPerTemplate;

    console.log(`[Recurring] AWS Lambda triggered at ${now.toISOString()}`);
    console.log(`[Recurring] Mode=${rebuildAllRecurring ? "rebuild_all" : "incremental"}; maxGeneratedPerTemplate=${maxGeneratedPerTemplate}.`);

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
    let generatedTotal = 0;
    let skippedExistingTotal = 0;
    let templatesHitCap = 0;

    for (const doc of txSnap.docs) {
      let templateResult = null;
      try {
        templateResult = await db.runTransaction(async (firestoreTx) => {
          const freshSnap = await firestoreTx.get(doc.ref);
          if (!freshSnap.exists) {
            return { generatedCount: 0, skippedExistingCount: 0, processedCursorDate: null, hitCap: false, skippedReason: "template_missing" };
          }

          const tx = freshSnap.data();
          if (!tx || !tx.recurrence || (!tx.date && !tx.recurrenceCursorDate)) {
            return { generatedCount: 0, skippedExistingCount: 0, processedCursorDate: null, hitCap: false, skippedReason: "invalid_template_data" };
          }

          const isTemplate = tx.recurrenceStatus === "template" && tx.recurrenceSourceId == null && tx.isRecurring === true;
          if (!isTemplate) {
            return { generatedCount: 0, skippedExistingCount: 0, processedCursorDate: null, hitCap: false, skippedReason: "not_template" };
          }

          const normalizedFrequency = normalizeFrequency(tx.recurrence.frequency);
          const parsedInterval = Number.parseInt(String(tx.recurrence.interval), 10);
          if (!normalizedFrequency || Number.isNaN(parsedInterval) || parsedInterval < 1) {
            return { generatedCount: 0, skippedExistingCount: 0, processedCursorDate: null, hitCap: false, skippedReason: "invalid_recurrence_config" };
          }

          const cursorSourceDate = rebuildAllRecurring ? tx.date : (tx.recurrenceCursorDate || tx.date);
          const lastDate = parseTransactionDate(cursorSourceDate);
          if (!lastDate) {
            return { generatedCount: 0, skippedExistingCount: 0, processedCursorDate: null, hitCap: false, skippedReason: "invalid_cursor_date" };
          }

          const endDate = parseEndDate(tx.recurrence.endsOn);
          if (endDate && lastDate.getTime() >= endDate.getTime()) {
            return { generatedCount: 0, skippedExistingCount: 0, processedCursorDate: null, hitCap: false, skippedReason: "cursor_at_or_past_end_date" };
          }

          const recurrenceGroupId = tx.recurrenceGroupId || doc.id;
          const existingOccurrenceDates = new Set();
          if (rebuildAllRecurring) {
            const existingOccurrencesSnap = await firestoreTx.get(
              txCollection.where("recurrenceSourceId", "==", doc.id)
            );
            for (const occurrenceDoc of existingOccurrencesSnap.docs) {
              const occurrenceDate = occurrenceDoc.data()?.date;
              if (typeof occurrenceDate === "string" && occurrenceDate) {
                existingOccurrenceDates.add(occurrenceDate);
              }
            }
          }

          let generatedCount = 0;
          let skippedExistingCount = 0;
          let processedCursorDate = null;
          let hitCap = false;
          const plannedCreates = [];

          let cursorDate = new Date(lastDate);
          let guard = 0;
          while (guard < MAX_LOOP_GUARD) {
            const nextDueDate = addToDate(cursorDate, normalizedFrequency, parsedInterval);
            if (endDate && nextDueDate.getTime() > endDate.getTime()) {
              break;
            }
            if (nextDueDate.getTime() > now.getTime()) {
              break;
            }

            const dueDateValue = toStoredDateValue(nextDueDate, normalizedFrequency);

            if (rebuildAllRecurring && existingOccurrenceDates.has(dueDateValue)) {
              skippedExistingCount += 1;
              processedCursorDate = dueDateValue;
              cursorDate = nextDueDate;
              guard += 1;
              continue;
            }

            const occurrenceRef = txCollection.doc(buildOccurrenceDocId(doc.id, dueDateValue));
            const occurrenceSnap = await firestoreTx.get(occurrenceRef);
            if (occurrenceSnap.exists) {
              skippedExistingCount += 1;
              processedCursorDate = dueDateValue;
              cursorDate = nextDueDate;
              guard += 1;
              continue;
            }

            if (generatedCount >= maxGeneratedPerTemplate) {
              hitCap = true;
              break;
            }

            plannedCreates.push({ occurrenceRef, dueDateValue });
            generatedCount += 1;
            processedCursorDate = dueDateValue;
            cursorDate = nextDueDate;
            guard += 1;
          }

          for (const plannedCreate of plannedCreates) {
            const generatedTx = {
              ...tx,
              date: plannedCreate.dueDateValue,
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

            firestoreTx.create(plannedCreate.occurrenceRef, generatedTx);
          }

          if (guard >= MAX_LOOP_GUARD) {
            console.warn(`[Recurring] Guard limit reached for template ${doc.id}; stopping processing early.`);
          }

          if (processedCursorDate) {
            firestoreTx.update(doc.ref, {
              isRecurring: true,
              recurrenceStatus: "template",
              recurrenceSourceId: null,
              recurrenceGroupId,
              recurrenceCursorDate: processedCursorDate,
              recurrence: {
                frequency: normalizedFrequency,
                interval: parsedInterval,
                endsOn: tx.recurrence.endsOn ?? null,
              },
            });
          }

          return {
            generatedCount,
            skippedExistingCount,
            processedCursorDate,
            hitCap,
            skippedReason: null,
          };
        });
      } catch (err) {
        console.error(`[Recurring] Failed to process ${doc.id}: ${String(err)}`);
        continue;
      }

      if (!templateResult || templateResult.skippedReason) {
        console.log(`[Recurring] Skip ${doc.id}: ${templateResult?.skippedReason || "not_due_or_no_changes"}.`);
        continue;
      }

      generatedTotal += templateResult.generatedCount;
      skippedExistingTotal += templateResult.skippedExistingCount;
      if (templateResult.hitCap) {
        templatesHitCap += 1;
      }

      if (templateResult.generatedCount > 0) {
        console.log(
          `[Recurring] Generated ${templateResult.generatedCount} occurrence(s) for ${doc.id}; ` +
          `advanced recurrence cursor to ${templateResult.processedCursorDate}.`
        );
      } else if (templateResult.processedCursorDate) {
        console.log(
          `[Recurring] No new occurrence needed for ${doc.id}; cursor evaluated through ${templateResult.processedCursorDate}.`
        );
      } else {
        console.log(`[Recurring] Skip ${doc.id}: not due.`);
      }

      if (templateResult.hitCap) {
        console.warn(
          `[Recurring] Template ${doc.id} hit per-run cap (${maxGeneratedPerTemplate}). ` +
          `Invoke again to continue backfilling.`
        );
      }
    }

    console.log("[Recurring] AWS Lambda run complete.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Recurring transactions processed",
        mode: rebuildAllRecurring ? "rebuild_all" : "incremental",
        templatesScanned: txSnap.docs.length,
        generatedOccurrences: generatedTotal,
        skippedExistingOccurrences: skippedExistingTotal,
        templatesHitCap,
      })
    };
  } catch (err) {
    console.error(`[Recurring] Top-level error: ${err && err.stack ? err.stack : String(err)}`);
    return { statusCode: 500, body: JSON.stringify({ error: "Top-level error", details: String(err) }) };
  }
};
