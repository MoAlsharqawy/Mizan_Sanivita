
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Users, Package, ArrowUpRight, ArrowDownLeft, Filter, Truck, Search, Briefcase } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Customer, Representative, Invoice, CashTransaction, ProductWithBatches, Supplier } from '../types';

export default function Reports() {
  const [currency, setCurrency] = useState('');
  const location = useLocation();
  
  // Data State
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allTransactions, setAllTransactions] = useState<CashTransaction[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allReps, setAllReps] = useState<Representative[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [allProducts, setAllProducts] = useState<ProductWithBatches[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]); // Using any for mock/hidden table
  
  // Date State
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  
  // Sales Filters State
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  
  // Reps Filters State
  const [selectedRepFilter, setSelectedRepFilter] = useState('');

  const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'SALES' | 'PURCHASES' | 'INVENTORY' | 'PARTNERS' | 'REPRESENTATIVES'>('FINANCIAL');

  // Fetch users for Supervisor dropdown
  const [supervisors, setSupervisors] = useState<any[]>([]);

  useEffect(() => {
    // Initial Data Load
    Promise.all([
        db.getSettings(),
        db.getInvoices(),
        db.getCashTransactions(),
        db.getCustomers(),
        db.getRepresentatives(),
        db.getSuppliers(),
        db.getProductsWithBatches(),
        db.getPurchaseInvoices()
    ]).then(([s, inv, tx, cust, rep, sup, prod, pur]) => {
        setCurrency(s.currency);
        setAllInvoices(inv);
        setAllTransactions(tx);
        setAllCustomers(cust);
        setAllReps(rep);
        setAllSuppliers(sup);
        setAllProducts(prod);
        setAllPurchases(pur);
        setSupervisors(authService.getUsers());
    });
  }, []);

  // Reset dependent filters when Supervisor changes
  useEffect(() => {
      setSelectedArea('');
      setSelectedCustomer('');
  }, [selectedSupervisor]);

  // Sync Tab with URL
  useEffect(() => {
      if (location.pathname.includes('/reports/sales')) {
          setActiveTab('SALES');
      } else if (location.pathname.includes('/reports/purchases')) {
          setActiveTab('PURCHASES');
      } else if (location.pathname.includes('/reports/representatives')) {
          setActiveTab('REPRESENTATIVES');
      }
  }, [location.pathname]);

  const handleQuickDate = (type: 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR') => {
    const now = new Date();
    let start = '';
    let end = now.toISOString().split('T')[0];

    if (type === 'TODAY') {
        start = end;
    } else if (type === 'MONTH') {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (type === 'LAST_MONTH') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (type === 'YEAR') {
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    }
    setStartDate(start);
    setEndDate(end);
  };

  // --- DATA AGGREGATION ---
  
  const financialData = useMemo(() => {
    // Filter Invoices by Date
    const invoices = allInvoices.filter(i => {
        const d = i.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });

    // 1. Total Revenue
    const revenue = invoices.reduce((acc, inv) => acc + inv.net_total, 0);

    // 2. COGS (Cost of Goods Sold)
    let cogs = 0;
    invoices.forEach(inv => {
        inv.items.forEach(item => {
            const cost = item.batch.purchase_price * item.quantity; 
            cogs += cost;
        });
    });

    // 3. Expenses
    const transactions = allTransactions.filter(tx => {
        const d = tx.date.split('T')[0];
        return d >= startDate && d <= endDate && tx.type === 'EXPENSE' && tx.category !== 'SUPPLIER_PAYMENT'; 
    });

    const expenses = transactions.reduce((acc, tx) => acc + tx.amount, 0);
    const expenseBreakdown = transactions.reduce((acc: any, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
        return acc;
    }, {});
    
    const expenseChartData = Object.keys(expenseBreakdown).map(k => ({ name: t(`cat.${k}`), value: expenseBreakdown[k] }));

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    return { revenue, cogs, expenses, grossProfit, netProfit, expenseChartData };
  }, [startDate, endDate, allInvoices, allTransactions]);

  const salesData = useMemo(() => {
    // --- STEP 1: Determine Valid Scope (Dropdown Options) ---
    
    // 1. Filter Reps by Supervisor
    const validReps = selectedSupervisor 
        ? allReps.filter(r => r.supervisor_id === selectedSupervisor)
        : allReps;
    
    const validRepCodes = validReps.map(r => r.code);

    // 2. Filter Customers by Valid Reps
    const scopedCustomers = allCustomers.filter(c => 
        c.representative_code && validRepCodes.includes(c.representative_code)
    );

    // 3. Extract Valid Areas from Scoped Customers
    const availableAreas = Array.from(new Set(scopedCustomers.map(c => c.area).filter(Boolean))).sort();

    // 4. Calculate Customers for Dropdown (Further filter by Area if selected)
    const availableCustomers = selectedArea
        ? scopedCustomers.filter(c => c.area === selectedArea)
        : scopedCustomers;


    // --- STEP 2: Filter Invoices based on Selections ---
    const invoices = allInvoices.filter(i => {
        const d = i.date.split('T')[0];
        const dateMatch = d >= startDate && d <= endDate;
        
        let customerMatch = true;
        let areaMatch = true;
        let supervisorMatch = true;
        
        // Optimize: We already have valid customers for this supervisor/area scope
        // Just check if the invoice customer is in our scoped list
        const invCustomer = allCustomers.find(c => c.id === i.customer_id);
        
        if (!invCustomer) return false;

        // Supervisor Check (Indirectly via Rep)
        if (selectedSupervisor) {
             const rep = allReps.find(r => r.code === invCustomer.representative_code);
             if (!rep || rep.supervisor_id !== selectedSupervisor) {
                 supervisorMatch = false;
             }
        }

        // Customer Check
        if (selectedCustomer) {
            customerMatch = i.customer_id === selectedCustomer;
        }

        // Area Check
        if (selectedArea) {
            areaMatch = invCustomer.area === selectedArea;
        }

        return dateMatch && customerMatch && areaMatch && supervisorMatch;
    });

    const totalFilteredRevenue = invoices.reduce((sum, inv) => sum + inv.net_total, 0);

    // Top Products & Breakdown
    const productSales: Record<string, { qty: number, total: number }> = {};
    invoices.forEach(inv => {
        inv.items.forEach(item => {
             // Use Discounted Total
             const gross = item.quantity * item.batch.selling_price;
             const net = gross * (1 - (item.discount_percentage || 0) / 100);

            if (!productSales[item.product.name]) {
                productSales[item.product.name] = { qty: 0, total: 0 };
            }
            productSales[item.product.name].qty += item.quantity;
            productSales[item.product.name].total += net;
        });
    });

    const topProducts = Object.entries(productSales)
        .map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total }))
        .sort((a, b) => b.qty - a.qty);

    // Daily Sales Trend
    const dailySales: Record<string, number> = {};
    invoices.forEach(inv => {
        const date = inv.date.split('T')[0];
        dailySales[date] = (dailySales[date] || 0) + inv.net_total;
    });
    
    const trendData = Object.entries(dailySales)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return { topProducts, trendData, count: invoices.length, availableAreas, availableCustomers, totalFilteredRevenue };
  }, [startDate, endDate, selectedCustomer, selectedArea, selectedSupervisor, allInvoices, allCustomers, allReps]);

  const purchasesData = useMemo(() => {
    const purchases = allPurchases.filter((p: any) => {
        const d = p.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });

    const totalPurchases = purchases.filter((p: any) => p.type === 'PURCHASE').reduce((acc: number, p: any) => acc + p.total_amount, 0);
    const totalReturns = purchases.filter((p: any) => p.type === 'RETURN').reduce((acc: number, p: any) => acc + p.total_amount, 0);
    const netPurchases = totalPurchases - totalReturns;

    // Purchases by Supplier
    const supplierPurchases: Record<string, number> = {};
    
    purchases.filter((p:any) => p.type === 'PURCHASE').forEach((p: any) => {
        const sName = allSuppliers.find(s => s.id === p.supplier_id)?.name || 'Unknown';
        supplierPurchases[sName] = (supplierPurchases[sName] || 0) + p.total_amount;
    });

    const topSuppliers = Object.entries(supplierPurchases)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    return { totalPurchases, totalReturns, netPurchases, topSuppliers, count: purchases.length };
  }, [startDate, endDate, allPurchases, allSuppliers]);

  const inventoryData = useMemo(() => {
     let totalStockValue = 0;
     let totalStockCost = 0;
     let lowStockCount = 0;
     let expiredCount = 0;

     allProducts.forEach(p => {
         let pQty = 0;
         p.batches.forEach(b => {
             pQty += b.quantity;
             totalStockValue += (b.quantity * b.selling_price);
             totalStockCost += (b.quantity * b.purchase_price);
             if (new Date(b.expiry_date) < new Date()) expiredCount++;
         });
         if (pQty < 10) lowStockCount++;
     });

     return { totalStockValue, totalStockCost, potentialProfit: totalStockValue - totalStockCost, lowStockCount, expiredCount };
  }, [allProducts]); // Inventory is point-in-time

  const partnersData = useMemo(() => {
      const totalReceivables = allCustomers.reduce((acc, c) => acc + (c.current_balance > 0 ? c.current_balance : 0), 0); // Assuming + balance means they owe us
      const totalPayables = allSuppliers.reduce((acc, s) => acc + (s.current_balance > 0 ? s.current_balance : 0), 0); // Assuming + balance means we owe them

      const topDebtors = [...allCustomers].sort((a, b) => b.current_balance - a.current_balance).slice(0, 5);
      
      return { totalReceivables, totalPayables, topDebtors };
  }, [allCustomers, allSuppliers]); // Partners is point-in-time

  const repsData = useMemo(() => {
      // Map Customer ID -> Rep Code
      const custToRep: Record<string, string> = {};
      allCustomers.forEach(c => { if(c.representative_code) custToRep[c.id] = c.representative_code; });

      // Filter invoices
      const invoices = allInvoices.filter(i => {
          const d = i.date.split('T')[0];
          return d >= startDate && d <= endDate;
      });

      const repStats: Record<string, { sales: number, count: number, customers: Set<string> }> = {};
      const repProducts: Record<string, Record<string, { qty: number, total: number }>> = {};

      invoices.forEach(inv => {
          const repCode = custToRep[inv.customer_id];
          if (repCode) {
              if (!repStats[repCode]) repStats[repCode] = { sales: 0, count: 0, customers: new Set() };
              repStats[repCode].sales += inv.net_total;
              repStats[repCode].count += 1;
              repStats[repCode].customers.add(inv.customer_id);

              // Product Breakdown
              if (!repProducts[repCode]) repProducts[repCode] = {};
              inv.items.forEach(item => {
                  if (!repProducts[repCode][item.product.name]) {
                      repProducts[repCode][item.product.name] = { qty: 0, total: 0 };
                  }
                  const itemNet = (item.quantity * item.batch.selling_price) * (1 - (item.discount_percentage || 0) / 100);
                  repProducts[repCode][item.product.name].qty += item.quantity;
                  repProducts[repCode][item.product.name].total += itemNet;
              });
          }
      });

      const finalData = allReps.map(r => ({
          code: r.code,
          name: r.name,
          sales: repStats[r.code]?.sales || 0,
          invoiceCount: repStats[r.code]?.count || 0,
          uniqueCustomers: repStats[r.code]?.customers.size || 0,
          products: repProducts[r.code] ? Object.entries(repProducts[r.code]).map(([pName, stats]) => ({
              name: pName,
              qty: stats.qty,
              total: stats.total
          })).sort((a,b) => b.qty - a.qty) : []
      })).sort((a, b) => b.sales - a.sales);

      return finalData;
  }, [startDate, endDate, allInvoices, allReps, allCustomers]);

  const filteredRepsData = useMemo(() => {
      if (!selectedRepFilter) return repsData;
      return repsData.filter(r => r.code === selectedRepFilter);
  }, [repsData, selectedRepFilter]);

  // COLORS
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* HEADER & FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-6">
         <div className="flex justify-between items-center">
             <div>
                 <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                     <TrendingUp className="w-7 h-7 text-blue-600" />
                     {t('nav.reports')}
                 </h1>
                 <p className="text-sm text-gray-500 mt-1">Strategic insights for management</p>
             </div>
         </div>

         <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
             <div className="flex items-center gap-2 text-slate-700 font-bold whitespace-nowrap">
                 <Filter className="w-4 h-4" />
                 {t('rep.period')}
             </div>
             
             <div className="flex items-center gap-2 w-full md:w-auto">
                 <div className="flex flex-col w-1/2 md:w-auto">
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1">{t('rep.from')}</label>
                    <input type="date" className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                 </div>
                 <div className="pt-4 text-gray-400">-</div>
                 <div className="flex flex-col w-1/2 md:w-auto">
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1">{t('rep.to')}</label>
                    <input type="date" className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                 </div>
             </div>

             <div className="w-px h-8 bg-gray-300 mx-2 hidden md:block"></div>

             <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                 <button onClick={() => handleQuickDate('TODAY')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.today')}</button>
                 <button onClick={() => handleQuickDate('MONTH')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.this_month')}</button>
                 <button onClick={() => handleQuickDate('LAST_MONTH')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.last_month')}</button>
                 <button onClick={() => handleQuickDate('YEAR')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors whitespace-nowrap">{t('rep.this_year')}</button>
             </div>
         </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto pb-2">
          {[
              { id: 'FINANCIAL', label: t('rep.tab.financial'), icon: DollarSign },
              { id: 'SALES', label: t('rep.tab.sales'), icon: TrendingUp },
              { id: 'PURCHASES', label: t('rep.tab.purchases'), icon: Truck },
              { id: 'REPRESENTATIVES', label: t('rep.tab.reps'), icon: Briefcase },
              { id: 'INVENTORY', label: t('rep.tab.inventory'), icon: Package },
              { id: 'PARTNERS', label: t('rep.tab.partners'), icon: Users },
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold transition-all whitespace-nowrap
                ${activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
              >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
              </button>
          ))}
      </div>

      {/* --- CONTENT --- */}

      {/* 1. FINANCIAL VIEW */}
      {activeTab === 'FINANCIAL' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
              
              {/* KPIS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                      <p className="text-gray-500 text-sm font-medium relative">{t('rep.total_revenue')}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-2 relative">{currency}{financialData.revenue.toLocaleString()}</h3>
                      <ArrowUpRight className="text-green-500 w-5 h-5 absolute bottom-6 right-6" />
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                      <p className="text-gray-500 text-sm font-medium relative">{t('rep.cogs')}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-2 relative">{currency}{financialData.cogs.toLocaleString()}</h3>
                      <p className="text-xs text-red-400 mt-1 relative">Direct Costs</p>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                      <p className="text-gray-500 text-sm font-medium relative">{t('rep.gross_profit')}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-2 relative">{currency}{financialData.grossProfit.toLocaleString()}</h3>
                      <p className="text-xs text-orange-400 mt-1 relative">Margin: {financialData.revenue > 0 ? ((financialData.grossProfit/financialData.revenue)*100).toFixed(1) : 0}%</p>
                  </div>

                   <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                      <p className="text-slate-300 text-sm font-medium relative">{t('rep.net_profit')}</p>
                      <h3 className="text-3xl font-bold mt-2 relative">{currency}{financialData.netProfit.toLocaleString()}</h3>
                      <div className="mt-4 text-xs text-slate-400 bg-white/10 px-2 py-1 rounded w-fit relative">
                          After Expenses: {currency}{financialData.expenses.toLocaleString()}
                      </div>
                  </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6">Financial Overview</h3>
                      <div className="h-72 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: 'Revenue', value: financialData.revenue, fill: '#10b981' },
                                    { name: 'COGS', value: financialData.cogs, fill: '#f43f5e' },
                                    { name: 'Expenses', value: financialData.expenses, fill: '#f97316' },
                                    { name: 'Net Profit', value: financialData.netProfit, fill: '#3b82f6' }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${currency}${val}`} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50} />
                                </BarChart>
                           </ResponsiveContainer>
                      </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                      <h3 className="font-bold text-gray-800 mb-6">Expense Breakdown</h3>
                      <div className="h-72 w-full">
                           {financialData.expenseChartData.length > 0 ? (
                               <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={financialData.expenseChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {financialData.expenseChartData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                               </ResponsiveContainer>
                           ) : (
                               <div className="h-full flex items-center justify-center text-gray-400 text-sm">No expense data</div>
                           )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 2. SALES VIEW (UPDATED WITH FILTERS) */}
      {activeTab === 'SALES' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               
               {/* CUSTOMER & AREA & SUPERVISOR FILTERS */}
               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Supervisor</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedSupervisor}
                            onChange={(e) => setSelectedSupervisor(e.target.value)}
                        >
                            <option value="">All Supervisors</option>
                            {supervisors.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{t('inv.customer')}</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                        >
                            <option value="">{t('rep.all_customers')}</option>
                            {salesData.availableCustomers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{t('rep.area')}</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedArea}
                            onChange={(e) => setSelectedArea(e.target.value)}
                        >
                            <option value="">{t('rep.all_areas')}</option>
                            {salesData.availableAreas.map(area => (
                                <option key={area} value={area}>{area}</option>
                            ))}
                        </select>
                    </div>

                     <button 
                        onClick={() => { setSelectedCustomer(''); setSelectedArea(''); setSelectedSupervisor(''); }}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                     >
                        Reset
                     </button>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-6 flex justify-between items-center">
                            <span>{t('dash.sales_trend')}</span>
                            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                {currency}{salesData.totalFilteredRevenue.toLocaleString()}
                            </span>
                        </h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={salesData.trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}`} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                         <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                             <Package className="w-5 h-5 text-blue-500" />
                             {t('rep.product_breakdown')}
                         </h3>
                         <div className="flex-1 overflow-y-auto pr-2">
                             <table className="w-full text-sm text-left rtl:text-right">
                                 <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                     <tr>
                                         <th className="px-3 py-2">Product</th>
                                         <th className="px-3 py-2 text-center">{t('rep.units')}</th>
                                         <th className="px-3 py-2 text-right rtl:text-left">Total</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                    {salesData.topProducts.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-3 py-2 font-medium text-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {idx + 1}
                                                    </span>
                                                    {p.name}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{p.qty}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right rtl:text-left font-bold text-gray-800">{currency}{p.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {salesData.topProducts.length === 0 && (
                                        <tr><td colSpan={3} className="text-center py-8 text-gray-400">No sales found for selection</td></tr>
                                    )}
                                 </tbody>
                             </table>
                         </div>
                    </div>
               </div>
          </div>
      )}

      {/* 3. PURCHASES VIEW */}
      {activeTab === 'PURCHASES' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                         <p className="text-gray-500 font-medium">Total Purchased</p>
                         <h3 className="text-2xl font-bold text-gray-800 mt-1">{currency}{purchasesData.totalPurchases.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm">
                         <p className="text-gray-500 font-medium">Returns</p>
                         <h3 className="text-2xl font-bold text-red-600 mt-1">-{currency}{purchasesData.totalReturns.toLocaleString()}</h3>
                    </div>
                    <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
                         <p className="text-slate-400 font-medium">Net Purchases</p>
                         <h3 className="text-3xl font-bold mt-1">{currency}{purchasesData.netPurchases.toLocaleString()}</h3>
                    </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-6">Top Suppliers (Volume)</h3>
                        {purchasesData.topSuppliers.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart layout="vertical" data={purchasesData.topSuppliers}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Bar dataKey="amount" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="h-40 flex items-center justify-center text-gray-400">No purchase data</div>
                        )}
                   </div>
               </div>
          </div>
      )}

      {/* 4. INVENTORY VIEW */}
      {activeTab === 'INVENTORY' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3">
                   <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                       <Package className="w-5 h-5" />
                   </div>
                   <p className="text-sm text-blue-800">Note: Inventory reports show current snapshot state.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg">
                        <p className="text-indigo-200 text-sm font-medium">{t('rep.stock_value')} (Selling Price)</p>
                        <h3 className="text-3xl font-bold mt-2">{currency}{inventoryData.totalStockValue.toLocaleString()}</h3>
                        <div className="mt-4 pt-4 border-t border-indigo-500/30 flex justify-between text-xs text-indigo-200">
                             <span>Based on current stock</span>
                             <span>Active Batches</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-gray-500 text-sm font-medium">Potential Profit (Value - Cost)</p>
                        <h3 className="text-3xl font-bold text-emerald-600 mt-2">{currency}{inventoryData.potentialProfit.toLocaleString()}</h3>
                        <p className="text-xs text-gray-400 mt-2">Unrealized gains in warehouse</p>
                    </div>

                     <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">{t('dash.low_stock')}</p>
                                <h3 className="text-3xl font-bold text-orange-500 mt-2">{inventoryData.lowStockCount}</h3>
                            </div>
                             <div>
                                <p className="text-gray-500 text-sm font-medium">{t('stock.expired')}</p>
                                <h3 className="text-3xl font-bold text-red-500 mt-2">{inventoryData.expiredCount}</h3>
                            </div>
                        </div>
                    </div>
               </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                     <h3 className="font-bold text-gray-800 mb-4">Inventory Valuation Details</h3>
                     <p className="text-sm text-gray-500 mb-4">Total Purchase Cost: <span className="font-bold text-gray-800">{currency}{inventoryData.totalStockCost.toLocaleString()}</span></p>
                     
                     <div className="w-full bg-gray-100 rounded-full h-4 mb-2 overflow-hidden flex">
                         <div className="bg-blue-500 h-full" style={{ width: `${(inventoryData.totalStockCost/inventoryData.totalStockValue)*100}%` }}></div>
                         <div className="bg-emerald-500 h-full flex-1"></div>
                     </div>
                     <div className="flex justify-between text-xs text-gray-500">
                         <span>Cost ({((inventoryData.totalStockCost/inventoryData.totalStockValue)*100).toFixed(0)}%)</span>
                         <span>Margin Space</span>
                     </div>
                </div>
           </div>
      )}

      {/* 5. PARTNERS VIEW */}
      {activeTab === 'PARTNERS' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3">
                   <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                       <Users className="w-5 h-5" />
                   </div>
                   <p className="text-sm text-blue-800">Note: Partner balances are current snapshots.</p>
               </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Receivables */}
                    <div className="bg-white p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-gray-500 font-medium">{t('rep.receivables')}</p>
                                 <h3 className="text-3xl font-bold text-gray-800 mt-1">{currency}{partnersData.totalReceivables.toLocaleString()}</h3>
                             </div>
                             <div className="bg-blue-50 p-2 rounded text-blue-600">
                                 <ArrowDownLeft className="w-6 h-6" />
                             </div>
                         </div>
                         <p className="text-xs text-gray-400 mt-4">Total amount customers owe you</p>
                    </div>

                    {/* Payables */}
                    <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-gray-500 font-medium">{t('rep.payables')}</p>
                                 <h3 className="text-3xl font-bold text-gray-800 mt-1">{currency}{partnersData.totalPayables.toLocaleString()}</h3>
                             </div>
                             <div className="bg-red-50 p-2 rounded text-red-600">
                                 <ArrowUpRight className="w-6 h-6" />
                             </div>
                         </div>
                         <p className="text-xs text-gray-400 mt-4">Total amount you owe suppliers</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">Top Debtors (Customers)</h3>
                     <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="p-3">Customer</th>
                                <th className="p-3">Phone</th>
                                <th className="p-3 text-right rtl:text-left">Balance Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partnersData.topDebtors.filter(c => c.current_balance > 0).map(c => (
                                <tr key={c.id} className="border-b">
                                    <td className="p-3 font-medium">{c.name}</td>
                                    <td className="p-3 text-gray-500">{c.phone}</td>
                                    <td className="p-3 text-right rtl:text-left font-bold text-red-500">{currency}{c.current_balance.toLocaleString()}</td>
                                </tr>
                            ))}
                            {partnersData.topDebtors.filter(c => c.current_balance > 0).length === 0 && (
                                <tr><td colSpan={3} className="p-4 text-center text-gray-400">No outstanding debts</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
           </div>
      )}

      {/* 6. REPRESENTATIVES VIEW */}
      {activeTab === 'REPRESENTATIVES' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
               <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100">
                   <div className="flex items-center gap-3">
                       <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                           <Briefcase className="w-5 h-5" />
                       </div>
                       <p className="text-sm text-gray-600 hidden md:block">Performance based on assigned customers.</p>
                   </div>
                   
                   <div className="w-full md:w-auto">
                        <select 
                            className="w-full md:w-64 border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedRepFilter}
                            onChange={(e) => setSelectedRepFilter(e.target.value)}
                        >
                            <option value="">{t('rep.all_reps')}</option>
                            {allReps.map(r => (
                                <option key={r.id} value={r.code}>{r.name}</option>
                            ))}
                        </select>
                   </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-6">Top Performers (Sales Volume)</h3>
                        {filteredRepsData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart layout="vertical" data={filteredRepsData.slice(0, 5)}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <Tooltip cursor={{fill: 'transparent'}} formatter={(value: any) => `${currency}${value.toLocaleString()}`} />
                                    <Bar dataKey="sales" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={30}>
                                        {filteredRepsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="h-40 flex items-center justify-center text-gray-400">No sales data</div>
                        )}
                   </div>

                   <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-6">Performance Details</h3>
                        <div className="flex-1 overflow-y-auto max-h-[300px]">
                            <table className="w-full text-sm text-left rtl:text-right">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2">{t('rep.name')}</th>
                                        <th className="px-3 py-2 text-center">{t('rep.invoice_count')}</th>
                                        <th className="px-3 py-2 text-right rtl:text-left">{t('rep.sales_volume')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRepsData.map((rep, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 font-medium">
                                                <div>{rep.name}</div>
                                                <div className="text-[10px] text-gray-400">{rep.code}</div>
                                            </td>
                                            <td className="px-3 py-2 text-center">{rep.invoiceCount}</td>
                                            <td className="px-3 py-2 text-right rtl:text-left font-bold text-slate-800">{currency}{rep.sales.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {filteredRepsData.length === 0 && (
                                        <tr><td colSpan={3} className="text-center py-8 text-gray-400">No data found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                   </div>
               </div>

                {/* PRODUCT BREAKDOWN DETAILS */}
               <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-500" />
                        {t('rep.item_details')} {selectedRepFilter ? `- ${allReps.find(r => r.code === selectedRepFilter)?.name}` : ''}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left rtl:text-right">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">{t('rep.name')}</th>
                                    <th className="px-4 py-3">{t('inv.product')}</th>
                                    <th className="px-4 py-3 text-center">{t('rep.units')}</th>
                                    <th className="px-4 py-3 text-right rtl:text-left">{t('inv.total')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRepsData.flatMap(rep => 
                                    rep.products.map((prod, pIdx) => (
                                        <tr key={`${rep.code}-${pIdx}`} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-slate-700">{rep.name}</td>
                                            <td className="px-4 py-3 text-slate-600">{prod.name}</td>
                                            <td className="px-4 py-3 text-center font-bold text-blue-600">{prod.qty}</td>
                                            <td className="px-4 py-3 text-right rtl:text-left font-bold text-slate-800">{currency}{prod.total.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                                {filteredRepsData.every(r => r.products.length === 0) && (
                                    <tr><td colSpan={4} className="text-center py-10 text-gray-400">No product sales found for this period</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
               </div>
          </div>
      )}

    </div>
  );
}
