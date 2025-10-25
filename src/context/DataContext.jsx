import React, { createContext, useContext } from 'react';
import useFirestoreQuery from '../hooks/useFirestoreQuery';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  // Fetch data, ensuring sort fields match Firestore exactly
  const { data: orders, loading: ordersLoading } = useFirestoreQuery('orders', 'orderDate'); // Assumes 'orderDate' is a Timestamp field
  const { data: tailoringItems, loading: itemsLoading } = useFirestoreQuery('tailoringItems', 'name'); // Assumes 'name' is a String field
  const { data: workers, loading: workersLoading } = useFirestoreQuery('workers', 'name'); // Assumes 'name' is a String field
  const { data: transactions, loading: transactionsLoading } = useFirestoreQuery('transactions', 'date'); // Assumes 'date' is a Timestamp field
  const { data: additionalFees, loading: feesLoading } = useFirestoreQuery('additionalFees', 'description'); // Fetch new collection

  const value = {
    orders, ordersLoading,
    tailoringItems, itemsLoading,
    workers, workersLoading,
    transactions, transactionsLoading,
    additionalFees, feesLoading,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};