
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { authService } from '../services/auth';
import { t } from '../utils/t';
import { ArrowUpRight, ArrowDownLeft, X, Save, FileText, Wallet, Filter, TrendingDown, TrendingUp, PieChart as PieChartIcon, Calendar, BarChart3, Coins } from 'lucide-react';
import { CashTransactionType, CashCategory, CashTransaction, Customer, Supplier } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

function CashRegister() {
  const location = useLocation();
  const [currency, setCurrency] = useState('$');
  const [txs, setTxs] = useState<CashTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // View Mode: 'REGISTER' (Daily Operations) or 'REPORTS' (Analysis)
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'REPORTS'>('REGISTER');

  // --- REPORT STATES ---
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [reportStart, setReportStart] = useState(firstDayOfMonth);
  const [reportEnd, setReportEnd] = useState(today);

  // --- REGISTER LIST FILTERS ---
  const [listFilter, setListFilter] = useState<'ALL' | 'RECEIPT' | 'EXPENSE'>('ALL');

  // --- MODAL STATES ---
  const [isOpen, setIsOpen] = useState(false);
  const [activeType, setActiveType] = useState<CashTransactionType>(CashTransactionType.RECEIPT);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CashCategory>('OTHER');
  const [relatedId, setRelatedId] = useState('');
  const [relatedName, setRelatedName] = useState('');
  const [notes, setNotes] = useState('');

  // Initial Data Load
  useEffect(() => {
    Promise.all([
      db.getSettings(),
      db.getCashTransactions(),
      db.getCustomers(),
      db.getSuppliers()
    ]).then(([s, t, c, sup]) => {
      setCurrency(s.currency);
      setTxs(t);
      setCustomers(c);
      setSuppliers(sup);
      setUsers(authService.getUsers());
    });
  }, []);

  // --- REPORT LOGIC ---
  const reportData = useMemo(() => {
      const start = new Date(reportStart).getTime();
      const end = new Date(reportEnd).getTime() + (24 * 60 * 60 * 1000); // End of day

      let openingBalance = 0;
      let periodIncome = 0;
      let periodExpense = 0;
      const expenseCatBreakdown: Record<string, number> = {};
      const incomeCatBreakdown: Record<string, number> = {};

      txs.forEach(tx => {
          const txDate = new Date(tx.date).getTime();
          
          if (txDate < start) {
              // Calculate Opening Balance (Everything before start date)
              if (tx.type === 'RECEIPT') openingBalance += tx.amount;
              else openingBalance -= tx.amount;
          } else if (txDate >= start && txDate < end) {
              // Period Transactions
              if (tx.type === 'RECEIPT') {
                  periodIncome += tx.amount;
                  incomeCatBreakdown[tx.category] = (incomeCatBreakdown[tx.category] || 0) + tx.amount;
              } else {
                  periodExpense += tx.amount;
                  expenseCatBreakdown[tx.category] = (expenseCatBreakdown[tx.category] || 0) + tx.amount;
              }
          }
      });

      const closingBalance = openingBalance + periodIncome - periodExpense;

      // Chart Data
      const expenseChartData = Object.entries(expenseCatBreakdown).map(([name, value]) => ({ name: t(`cat.${name}`), value }));
      const incomeChartData = Object.entries(incomeCatBreakdown).map(([name, value]) => ({ name: t(`cat.${name}`), value }));

      return {
          openingBalance,
          periodIncome,
          periodExpense,
          closingBalance,
          expenseCatBreakdown,
          incomeCatBreakdown,
          expenseChartData,
          incomeChartData
      };
  }, [txs, reportStart, reportEnd]);

  // --- REGISTER STATS (Overall Snapshot) ---
  const currentStats = useMemo(() => {
      const income = txs.filter(t => t.type === 'RECEIPT').reduce((sum, t) => sum + t.amount, 0);
      const expenses = txs.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      return { income, expenses, net: income - expenses };
  }, [txs]);

  const filteredTxs = useMemo(() => {
      if (listFilter === 'ALL') return txs;
      return txs.filter(t => t.type === listFilter);
  }, [txs, listFilter]);

  // Effects
  useEffect(() => {
      if (location.state && (location.state as any).openExpense) {
          const state = location.state as any;
          setActiveType(CashTransactionType.EXPENSE);
          setCategory(state.category || 'OTHER');
          setRelatedName(state.relatedName || '');
          setNotes(state.notes || '');
          setIsOpen(true);
          window.history.replaceState({}, document.title);
      }
  }, [location]);

  useEffect(() => {
    if (!isOpen) {
        if (activeType === CashTransactionType.RECEIPT) setCategory('CUSTOMER_PAYMENT');
        else setCategory('SUPPLIER_PAYMENT');
        setRelatedId('');
        setRelatedName('');
    }
  }, [activeType, isOpen]);

  useEffect(() => {
      if (!isOpen) setRelatedId('');
  }, [category]);

  const openModal = (type: CashTransactionType) => {
    setActiveType(type);
    setAmount('');
    setNotes('');
    setIsOpen(true);
  };

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) {
      alert(t('inv.total') + ' invalid');
      return;
    }

    if (category === 'CUSTOMER_PAYMENT' && !relatedId) { alert(t('inv.select_customer')); return; }
    if (category === 'SUPPLIER_PAYMENT' && !relatedId) { alert(t('pur.select_supplier')); return; }
    if (category === 'SALARY' && !relatedName) { alert("Please select an employee"); return; }
    if (category === 'DOCTOR_COMMISSION' && !relatedName) { alert("Doctor name is required"); return; }

    let finalName = relatedName;
    if (category === 'CUSTOMER_PAYMENT') finalName = customers.find(c => c.id === relatedId)?.name || '';
    if (category === 'SUPPLIER_PAYMENT') finalName = suppliers.find(s => s.id === relatedId)?.name || '';
    
    await db.addCashTransaction({
      type: activeType,
      category: category,
      reference_id: relatedId,
      related_name: finalName,
      amount: val,
      date: new Date().toISOString(),
      notes: notes
    });
    
    db.getCashTransactions().then(setTxs);
    setIsOpen(false);
  };

  const customerOptions = useMemo(() => customers.map(c => ({ value: c.id, label: c.name, subLabel: `${currency}${c.current_balance}` })), [customers, currency]);
  const supplierOptions = useMemo(() => suppliers.map(s => ({ value: s.id, label: s.name, subLabel: `${currency}${s.current_balance}` })), [suppliers, currency]);
  const userOptions = useMemo(() => users.map(u => ({ value: u.name, label: u.name, subLabel: u.role === 'ADMIN' ? 'Manager' : 'Employee' })), [users]);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

  return (
    <div className="space-y-6 relative max-w-7xl mx-auto">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('cash.title')}</h1>
            <p className="text-sm text-gray-500">Track income, expenses, and treasury balance.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('REGISTER')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'REGISTER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <FileText className="w-4 h-4" /> Register
            </button>
            <button 
                onClick={() => setActiveTab('REPORTS')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'REPORTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <PieChartIcon className="w-4 h-4" /> Reports
            </button>
        </div>
      </div>

      {/* === REGISTER VIEW === */}
      {activeTab === 'REGISTER' && (
          <div className="space-y-6 animate-in fade-in">
                {/* Action Buttons */}
                <div className="flex gap-3 justify-end">
                    <button onClick={() => openModal(CashTransactionType.RECEIPT)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 font-bold">
                        <ArrowDownLeft className="w-5 h-5" /> {t('cash.receipt')}
                    </button>
                    <button onClick={() => openModal(CashTransactionType.EXPENSE)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 font-bold">
                        <ArrowUpRight className="w-5 h-5" /> {t('cash.expense')}
                    </button>
                </div>

                {/* 1. Summary Cards (Current Snapshot) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('cash.income')}</p>
                                <h3 className="text-2xl font-bold text-emerald-600 mt-2">{currency}{currentStats.income.toLocaleString()}</h3>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp className="w-6 h-6" /></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('cash.total_expenses')}</p>
                                <h3 className="text-2xl font-bold text-red-600 mt-2">{currency}{currentStats.expenses.toLocaleString()}</h3>
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg text-red-600"><TrendingDown className="w-6 h-6" /></div>
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full mix-blend-overlay filter blur-2xl opacity-20 -mr-8 -mt-8"></div>
                        <div className="flex justify-between items-center h-full relative z-10">
                            <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('cash.net')}</p>
                                    <h3 className={`text-3xl font-bold mt-2 ${currentStats.net < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                        {currency}{currentStats.net.toLocaleString()}
                                    </h3>
                            </div>
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Transaction List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 bg-gray-50/50 p-1 flex gap-2 overflow-x-auto">
                        {['ALL', 'RECEIPT', 'EXPENSE'].map(f => (
                            <button 
                                key={f}
                                onClick={() => setListFilter(f as any)}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all 
                                ${listFilter === f 
                                    ? (f === 'RECEIPT' ? 'border-emerald-500 text-emerald-600 bg-white' : f === 'EXPENSE' ? 'border-red-500 text-red-600 bg-white' : 'border-blue-600 text-blue-600 bg-white') 
                                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                {f === 'ALL' ? t('common.action') + ' (All)' : t(`cash.${f.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="bg-white text-gray-500 uppercase text-xs border-b">
                            <tr>
                            <th className="p-4">Ref #</th>
                            <th className="p-4 w-32">{t('common.date')}</th>
                            <th className="p-4">{t('cash.category')}</th>
                            <th className="p-4">{t('cash.entity')}</th>
                            <th className="p-4">Note</th>
                            <th className="p-4 text-right rtl:text-left">{t('inv.total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTxs.map(tx => (
                            <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 text-xs font-mono text-gray-400 font-bold">{tx.id}</td>
                                <td className="p-4 text-gray-500">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'RECEIPT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                        {t(`cat.${tx.category}`)}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 font-medium">{tx.related_name || '-'}</td>
                                <td className="p-4 text-gray-600 max-w-xs truncate" title={tx.notes}>{tx.notes}</td>
                                <td className={`p-4 text-right rtl:text-left font-bold font-mono ${tx.type === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {tx.type === 'RECEIPT' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}
                                </td>
                            </tr>
                            ))}
                            {filteredTxs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-400 flex flex-col items-center justify-center">
                                        <FileText className="w-10 h-10 mb-2 opacity-20" />
                                        {t('list.no_data')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
          </div>
      )}

      {/* === REPORTS VIEW === */}
      {activeTab === 'REPORTS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* Date Filter */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex items-center gap-2 text-slate-700 font-bold">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      {t('rep.period')}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input type="date" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                      <span className="text-gray-400">-</span>
                      <input type="date" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                  </div>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Opening Balance */}
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gray-100 rounded-bl-full -mr-4 -mt-4"></div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">{t('common.opening')}</p>
                      <h3 className="text-2xl font-bold text-gray-700">{currency}{reportData.openingBalance.toLocaleString()}</h3>
                      <p className="text-[10px] text-gray-400 mt-2">Before {new Date(reportStart).toLocaleDateString()}</p>
                  </div>

                  {/* Period Income */}
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">{t('cash.income')}</p>
                      <h3 className="text-2xl font-bold text-emerald-600">{currency}{reportData.periodIncome.toLocaleString()}</h3>
                      <p className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" /> In Range</p>
                  </div>

                  {/* Period Expense */}
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -mr-4 -mt-4"></div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">{t('cash.total_expenses')}</p>
                      <h3 className="text-2xl font-bold text-red-600">{currency}{reportData.periodExpense.toLocaleString()}</h3>
                      <p className="text-[10px] text-red-400 mt-2 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> In Range</p>
                  </div>

                  {/* Closing Balance */}
                  <div className="bg-slate-800 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600 rounded-full mix-blend-overlay filter blur-xl opacity-30 -mr-6 -mt-6"></div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Closing Balance</p>
                      <h3 className="text-2xl font-bold text-blue-200">{currency}{reportData.closingBalance.toLocaleString()}</h3>
                      <p className="text-[10px] text-slate-400 mt-2">End of {new Date(reportEnd).toLocaleDateString()}</p>
                  </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Expense Breakdown (Chart + List) */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-red-500" />
                          Expense Analysis
                      </h3>
                      
                      <div className="flex flex-col md:flex-row gap-8">
                          {/* Pie Chart */}
                          <div className="w-full md:w-1/2 h-64">
                                {reportData.expenseChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={reportData.expenseChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {reportData.expenseChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(val: number) => `${currency}${val.toLocaleString()}`} />
                                            <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{fontSize: '10px'}} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No expenses in this period</div>
                                )}
                          </div>

                          {/* List */}
                          <div className="w-full md:w-1/2 overflow-y-auto max-h-64 pr-2">
                              <table className="w-full text-sm">
                                  <tbody className="divide-y divide-gray-100">
                                      {Object.entries(reportData.expenseCatBreakdown).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([cat, val], idx) => (
                                          <tr key={cat} className="hover:bg-gray-50">
                                              <td className="py-2.5 pl-2">
                                                  <div className="flex items-center gap-2">
                                                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                                                      <span className="font-medium text-gray-700">{t(`cat.${cat}`)}</span>
                                                  </div>
                                              </td>
                                              <td className="py-2.5 text-right font-bold text-red-500 pr-2">
                                                  {currency}{val.toLocaleString()}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>

                  {/* Income Breakdown (Simplified) */}
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                          <Coins className="w-5 h-5 text-emerald-500" />
                          Income Sources
                      </h3>
                      <div className="flex-1 overflow-y-auto">
                           <table className="w-full text-sm">
                                  <tbody className="divide-y divide-gray-100">
                                      {Object.entries(reportData.incomeCatBreakdown).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([cat, val]) => (
                                          <tr key={cat} className="hover:bg-gray-50">
                                              <td className="py-3 pl-2 text-gray-700 font-medium">{t(`cat.${cat}`)}</td>
                                              <td className="py-3 text-right font-bold text-emerald-600 pr-2">
                                                  {currency}{val.toLocaleString()}
                                              </td>
                                          </tr>
                                      ))}
                                      {Object.keys(reportData.incomeCatBreakdown).length === 0 && (
                                          <tr><td colSpan={2} className="text-center py-10 text-gray-400">No income records</td></tr>
                                      )}
                                  </tbody>
                              </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Transaction Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className={`px-6 py-4 border-b flex justify-between items-center ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${activeType === CashTransactionType.RECEIPT ? 'text-emerald-800' : 'text-red-800'}`}>
                        {activeType === CashTransactionType.RECEIPT ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        {activeType === CashTransactionType.RECEIPT ? t('cash.receipt') : t('cash.expense')}
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('cash.category')}</label>
                        <select 
                            className="w-full border p-2 rounded-lg"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as CashCategory)}
                        >
                            {activeType === CashTransactionType.RECEIPT ? (
                                <>
                                    <option value="CUSTOMER_PAYMENT">{t('cat.CUSTOMER_PAYMENT')}</option>
                                    <option value="PARTNER_CONTRIBUTION">{t('cat.PARTNER_CONTRIBUTION')}</option>
                                </>
                            ) : (
                                <>
                                    <option value="SUPPLIER_PAYMENT">{t('cat.SUPPLIER_PAYMENT')}</option>
                                    <option value="SALARY">{t('cat.SALARY')}</option>
                                    <option value="DOCTOR_COMMISSION">{t('cat.DOCTOR_COMMISSION')}</option>
                                    <option value="ELECTRICITY">{t('cat.ELECTRICITY')}</option>
                                    <option value="MARKETING">{t('cat.MARKETING')}</option>
                                </>
                            )}
                            <option value="OTHER">{t('cat.OTHER')}</option>
                        </select>
                    </div>

                    {category === 'CUSTOMER_PAYMENT' && (
                        <div>
                            <SearchableSelect 
                                label={t('inv.customer')}
                                placeholder={t('inv.select_customer')}
                                options={customerOptions}
                                value={relatedId}
                                onChange={setRelatedId}
                                autoFocus={true}
                            />
                        </div>
                    )}

                    {category === 'SUPPLIER_PAYMENT' && (
                         <div>
                            <SearchableSelect 
                                label={t('inv.supplier')}
                                placeholder={t('pur.select_supplier')}
                                options={supplierOptions}
                                value={relatedId}
                                onChange={setRelatedId}
                                autoFocus={true}
                            />
                        </div>
                    )}

                    {category === 'SALARY' && (
                        <div>
                             <SearchableSelect 
                                label="Employee Name"
                                placeholder="Select Employee..."
                                options={userOptions}
                                value={relatedName}
                                onChange={setRelatedName}
                            />
                        </div>
                    )}

                    {['PARTNER_CONTRIBUTION', 'OTHER', 'DOCTOR_COMMISSION'].includes(category) && (
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">{category === 'DOCTOR_COMMISSION' ? t('deal.doctor') : t('cash.entity')}</label>
                             <input 
                                className="w-full border p-2 rounded-lg"
                                placeholder={category === 'DOCTOR_COMMISSION' ? 'Dr. Name' : 'Name / Details'}
                                value={relatedName}
                                onChange={e => setRelatedName(e.target.value)}
                             />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.total')} ({currency})</label>
                        <input 
                            type="number" 
                            className="w-full border p-2 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none border-gray-300" 
                            placeholder="0.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                        <textarea 
                            className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300" 
                            rows={3}
                            placeholder="Description..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={handleSave} 
                        className={`w-full py-3 text-white rounded-lg font-bold shadow-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity
                        ${activeType === CashTransactionType.RECEIPT ? 'bg-emerald-600' : 'bg-red-600'}`}
                    >
                        <Save className="w-5 h-5" />
                        {t('set.save')}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default CashRegister;
