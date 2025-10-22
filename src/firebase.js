import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-theron-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyAkpKOOXAQpRmPiqECURXh9tE_Lzzs9mnI",
    authDomain: "theron-007.firebaseapp.com",
    projectId: "theron-007",
    storageBucket: "theron-007.firebasestorage.app",
    messagingSenderId: "569768443311",
    appId: "1:569768443311:web:2c0fd0923cf4ae7fd9c35a",
    measurementId: "G-VZDL7EKED4"
};

const app = initializeApp(firebaseConfig, appId);
const auth = getAuth(app);
const db = getFirestore(app);

const getCollectionPath = (path) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated for data access.");
  return `artifacts/${appId}/public/data/${path}`;
};

export { auth, db, getCollectionPath };
