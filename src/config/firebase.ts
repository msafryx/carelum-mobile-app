import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

// Placeholder Firebase configuration
// Replace these values with your actual Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyBYw_Qv0Lh-_RKv6YbpDuHh2Fbh0YkQ38U",
    authDomain: "carelum-mobile-app.firebaseapp.com",
    projectId: "carelum-mobile-app",
    storageBucket: "carelum-mobile-app.firebasestorage.app",
    messagingSenderId: "450058872130",
    appId: "1:450058872130:web:5a5e11b6bf32053e1714db"
  };

// Check if Firebase config is set up
const isFirebaseConfigured = () => {
  return (
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID"
  );
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured()) {
  try {
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    // Initialize services
    auth = getAuth(app);
    firestore = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    console.warn('Firebase is not configured. Please update src/config/firebase.ts with your Firebase credentials.');
  }
} else {
  console.warn('Firebase is not configured. Please update src/config/firebase.ts with your Firebase credentials.');
}

export { app, auth, firestore, isFirebaseConfigured, storage };
export default app;
