import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, getCollectionPath } from '../firebase';
import { useAuth } from '../context/AuthContext';

const useFirestoreQuery = (collectionName, sortField = "name") => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let unsubscribe = () => {};
    try {
      const collectionRef = collection(db, getCollectionPath(collectionName));
      const q = query(collectionRef, orderBy(sortField, sortField.includes("date") ? "desc" : "asc"));
      
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setData(items);
        setLoading(false);
      }, (error) => {
        console.error(`Error fetching ${collectionName}: `, error);
        setLoading(false);
      });
    } catch (error) {
      console.error("Error setting up Firestore listener: ", error);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [collectionName, user, sortField]);

  return { data, loading };
};

export default useFirestoreQuery;
