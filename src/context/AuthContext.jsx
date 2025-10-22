import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import Spinner from '../components/ui/Spinner';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ role: 'owner' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const attemptSignIn = async (user) => {
      const userDocRef = doc(db, `users`, user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        setUserData({ id: userDoc.id, ...userDoc.data() });
      } else {
        setUserData({ role: 'owner', name: 'Demo Owner' });
      }
    };

    const handleAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        await attemptSignIn(currentUser);
      }
      setLoading(false);
    });

    handleAuth();
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, userData, loading }}>{children}</AuthContext.Provider>;
};
