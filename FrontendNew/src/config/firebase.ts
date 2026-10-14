import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Only initialize Firebase when a valid projectId is present.
// Without it the SDK throws at module load time, crashing the whole app.
const isFirebaseConfigured = Boolean(firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let auth: Auth;
let db: Firestore;
let analytics: unknown = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);

  if (typeof window !== "undefined") {
    // Lazy-load analytics so it never blocks the initial render
    import("firebase/analytics").then(({ getAnalytics }) => {
      analytics = getAnalytics(app!);
    }).catch(() => {
      // analytics is non-critical — silently ignore if it fails
    });
  }
} else {
  // Stub out the Firebase services so imports in the rest of the codebase
  // don't need to change.  JWT auth via our FastAPI backend is the primary
  // auth path; Firebase is optional / future.
  auth = {
    currentUser: null,
    onAuthStateChanged: (_observer: unknown) => () => {},
    signOut: () => Promise.resolve(),
  } as unknown as Auth;

  db = {} as unknown as Firestore;
}

export const googleProvider = new GoogleAuthProvider();
export { auth, db, analytics };
export default app;
