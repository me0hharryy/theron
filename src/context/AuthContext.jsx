import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth'; // Ensure correct imports
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import Spinner from '../components/ui/Spinner';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ role: 'owner', name: 'Demo Owner' }); // Default state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async (currentUser) => {
      // Example path: 'users/{userId}' - Adjust if your structure is different
      const userDocRef = doc(db, `users`, currentUser.uid);
      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserData({ id: userDoc.id, ...userDoc.data() });
        } else {
          console.log("No specific user document found in Firestore, using default.");
          // Fallback to default if no specific role/name found
          setUserData({ role: 'owner', name: currentUser.email || 'Demo User' });
        }
      } catch (error) {
        console.error("Error fetching user data from Firestore:", error);
        setUserData({ role: 'owner', name: 'Error User' }); // Indicate error state
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true); // Ensure loading is true at the start of state change
      setUser(currentUser);
      if (currentUser) {
        // Fetch specific data only for non-anonymous users with an email
        // Adjust condition based on your auth methods (e.g., phone auth)
        if (!currentUser.isAnonymous && currentUser.email) {
          await fetchUserData(currentUser);
        } else {
           // Provide a default for anonymous or users without expected data
           setUserData({ role: 'employee', name: 'Guest User' }); // Example default
        }
      } else {
        setUserData(null); // Clear user data on logout
      }
      setLoading(false);
    });

     // Decide if you want automatic anonymous sign-in or force login
     // if (!auth.currentUser) {
     //   signInAnonymously(auth).catch(console.error);
     // }


    return () => unsubscribe(); // Cleanup subscription
  }, []); // Empty dependency array means this runs once on mount

  if (loading) {
    return (
      // DIRECTLY APPLIED THEME: Light off-white bg
      <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA]">
        <Spinner />
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, userData, loading }}>{children}</AuthContext.Provider>;
};