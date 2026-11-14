import { getApp, getApps, initializeApp, FirebaseError, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { configValue, isWebApiKey, resolveFirebaseConfig } from './utils/firebaseConfig';

const firebaseConfig = {
  apiKey: configValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: configValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: configValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: configValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: configValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: configValue(import.meta.env.VITE_FIREBASE_APP_ID),
};
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
export let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
let initialization: Promise<void> | undefined;
export function initializeFirebase(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      if (!isFirebaseConfigured) return; // Keep the welcome screen usable before setup.
      const config = await resolveFirebaseConfig(firebaseConfig);
      if (!isWebApiKey(config.apiKey)) throw new FirebaseError('auth/invalid-api-key', 'Invalid Firebase web API key format.');
      app = getApps().length ? getApp() : initializeApp(config);
      auth = getAuth(app);
      db = getFirestore(app);
    })().catch(error => { initialization = undefined; throw error; });
  }
  return initialization;
}
