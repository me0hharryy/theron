import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// --- IMPORTANT ---
// Replace placeholders with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAkpKOOXAQpRmPiqECURXh9tE_Lzzs9mnI",
    authDomain: "theron-007.firebaseapp.com",
    projectId: "theron-007",
    storageBucket: "theron-007.firebasestorage.app",
    messagingSenderId: "569768443311",
    appId: "1:569768443311:web:2c0fd0923cf4ae7fd9c35a",
    measurementId: "G-VZDL7EKED4"
};
// --- END OF IMPORTANT SECTION ---

const appInstanceName = 'TheronERP_App_Instance';
let app;
try {
    app = initializeApp(firebaseConfig, appInstanceName);
} catch (e) {
    console.error("Firebase initialization error:", e);
    app = initializeApp(firebaseConfig); // Fallback
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- CORRECTED getCollectionPath ---
// Function to generate paths for collections *under* a specific user's document.
const getCollectionPath = (relativePath) => {
  const currentUser = auth.currentUser;

  // Require a fully authenticated user for accessing user-specific data
  if (!currentUser || currentUser.isAnonymous) {
      console.error("Attempted data access without full authentication. Path:", relativePath);
      // Option 1: Throw error to prevent access
      throw new Error("User must be fully authenticated for data access.");

      // Option 2: Return a shared path for demos (less secure for real data)
      // console.warn("User not fully authenticated, accessing shared demo path for:", relativePath);
      // return `theronDemoData/shared/${relativePath}`; // Example shared path (3 segments - VALID)
  }
  const uid = currentUser.uid;

  // **Correct Structure:** users/{userId}/{collectionName}
  // This has 3 segments, which is VALID for a collection reference.
  return `users/${uid}/${relativePath}`;
};
// --- END CORRECTION ---


export { auth, db, storage, getCollectionPath };