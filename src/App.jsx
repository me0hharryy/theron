import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import PrivateRoute from './components/auth/PrivateRoute';
import PublicRoute from './components/auth/PublicRoute';
import AdditionalFeesPage from './pages/fees/AdditionalFeesPage';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrderListPage from './pages/orders/OrderListPage';
import OrderFormPage from './pages/orders/OrderFormPage';
import MastersPage from './pages/masters/MastersPage';
import WorkersPage from './pages/workers/WorkersPage';
import WorkerDetailPage from './pages/workers/WorkerDetailPage'; 
import LedgerPage from './pages/ledger/LedgerPage';
import ReportsPage from './pages/ReportsPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/" element={
            <PrivateRoute>
              <DataProvider>
                <MainLayout />
              </DataProvider>
            </PrivateRoute>
          }>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="orders" element={<OrderListPage />} />
          <Route path="orders/new" element={<OrderFormPage />} />
          <Route path="orders/edit/:orderId" element={<OrderFormPage />} />
          <Route path="masters" element={<MastersPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="workers/:workerId" element={<WorkerDetailPage />} /> 
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="fees" element={<AdditionalFeesPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;