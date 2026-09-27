import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Set VITE_USE_FIREBASE_EMULATOR=true (see .env.example) to point this app at the
// local Auth + Firestore emulators started by `npm run emulators` (see firebase.json)
// instead of the real project. Off by default, so production behavior is unchanged.
const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

let firestoreDb: Firestore;
if (USE_EMULATOR) {
  // Plain (non-persistent) cache under the emulator: a persistent IndexedDB cache
  // would otherwise survive emulator restarts and can serve stale/nonexistent
  // documents across independent test runs.
  firestoreDb = getFirestore(app);
} else {
  try {
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (e) {
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;

if (USE_EMULATOR) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

