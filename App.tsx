import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewInvoice from './pages/NewInvoice';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import CashRegister from './pages/CashRegister';
import Settings from './pages/Settings';
import PurchaseInvoice from './pages/PurchaseInvoice';
import PurchaseLog from './pages/PurchaseLog';
import Representatives from './pages/Representatives';
import Warehouses from './pages/Warehouses';
import Reports from './pages/Reports';
import Deals from './pages/Deals';
import ActivityLogPage from './pages/ActivityLog';
import Login from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/*" element={
           <ProtectedRoute>
             <Layout>
               <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/reports/sales" element={<Reports />} />
                  <Route path="/reports/purchases" element={<Reports />} />
                  <Route path="/reports/representatives" element={<Reports />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/invoice/new" element={<NewInvoice />} />
                  <Route path="/invoice/edit/:id" element={<NewInvoice />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/representatives" element={<Representatives />} />
                  <Route path="/warehouses" element={<Warehouses />} />
                  <Route path="/purchases/new" element={<PurchaseInvoice type="PURCHASE" />} />
                  <Route path="/purchases/return" element={<PurchaseInvoice type="RETURN" />} />
                  <Route path="/purchases/log" element={<PurchaseLog />} />
                  <Route path="/cash" element={<CashRegister />} />
                  <Route path="/deals" element={<Deals />} />
                  <Route path="/activity-log" element={<ActivityLogPage />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
               </Routes>
             </Layout>
           </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
};

export default App;