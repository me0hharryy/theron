import React, { createContext, useContext } from 'react';
import useFirestoreQuery from '../hooks/useFirestoreQuery';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { data: orders, loading: ordersLoading } = useFirestoreQuery('orders', 'orderDate');
  const { data: tailoringItems, loading: itemsLoading } = useFirestoreQuery('tailoringItems', 'name');
  const { data: workers, loading: workersLoading } = useFirestoreQuery('workers', 'name');
  const { data: transactions, loading: transactionsLoading } = useFirestoreQuery('transactions', 'date');

  const value = {
    orders, ordersLoading,
    tailoringItems, itemsLoading,
    workers, workersLoading,
    transactions, transactionsLoading,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
