
import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Loader2 } from 'lucide-react';

// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewInvoice = lazy(() => import('./pages/NewInvoice'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const CashRegister = lazy(() => import('./pages/CashRegister'));
const Settings = lazy(() => import('./pages/Settings'));
const PurchaseInvoice = lazy(() => import('./pages/PurchaseInvoice'));
const PurchaseLog = lazy(() => import('./pages/PurchaseLog'));
const Representatives = lazy(() => import('./pages/Representatives'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const Reports = lazy(() => import('./pages/Reports'));
const Deals = lazy(() => import('./pages/Deals'));
const ActivityLogPage = lazy(() => import('./pages/ActivityLog'));
const Login = lazy(() => import('./pages/Login'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          <Suspense fallback={<div className="h-screen w-full bg-slate-900" />}>
            <Login />
          </Suspense>
        } />
        
        <Route path="/*" element={
           <ProtectedRoute>
             <Layout>
               <Suspense fallback={<PageLoader />}>
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
               </Suspense>
             </Layout>
           </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
};

export default App;
