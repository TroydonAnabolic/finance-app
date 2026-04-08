import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let initialized = false;

function getPrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return undefined;
  return raw.replace(/\\n/g, "\n");
}

function initializeFirebaseAdminIfNeeded() {
  if (initialized) return;
  if (getApps().length > 0) {
    initialized = true;
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    initialized = true;
    return;
  }

  initializeApp();
  initialized = true;
}

export function getAdminAuth() {
  initializeFirebaseAdminIfNeeded();
  return getAuth();
}

export function getAdminDb() {
  initializeFirebaseAdminIfNeeded();
  return getFirestore();
}

export async function verifyFirebaseBearerToken(authHeader: string | null): Promise<string> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Missing ID token");

  const decoded = await getAdminAuth().verifyIdToken(token);
  if (!decoded.uid) throw new Error("Invalid ID token");
  return decoded.uid;
}
