
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Deal, DealTarget, DealCycle, Representative, Customer, ProductWithBatches, Invoice } from '../types';
import { t } from '../utils/t';
import { Award, Plus, Search, DollarSign, CheckSquare, Square, X, BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Wallet, ArrowRight, Edit2, Package, Target, Banknote, RefreshCcw, Star, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Deals() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState('');
  
  const [deals, setDeals] = useState<Deal[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allProducts, setAllProducts] = useState<ProductWithBatches[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    Promise.all([
        db.getSettings(),
        db.getDeals(),
        db.getRepresentatives(),
        db.getCustomers(),
        db.getProductsWithBatches(),
        db.getInvoices()
    ]).then(([s, d, r, c, p, inv]) => {
        setCurrency(s.currency);
        setDeals(d);
        setRepresentatives(r);
        setCustomers(c);
        setAllProducts(p);
        setInvoices(inv);
    });
  }, []);

  // Modal State (Create/Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  
  // Renew Modal State
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewDealId, setRenewDealId] = useState<string | null>(null);
  const [renewAmount, setRenewAmount] = useState('');
  // New: Renew Targets
  const [renewTargets, setRenewTargets] = useState<DealTarget[]>([]);
  
  const [form, setForm] = useState<{ doctorName: string; representativeCode: string; customerIds: string[]; productTargets: DealTarget[]; amount: string }>({
      doctorName: '',
      representativeCode: '',
      customerIds: [],
      productTargets: [],
      amount: ''
  });

  // Search in Modal
  const [custSearch, setCustSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');

  // Expanded Deal State (for stats)
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);

  const handleOpenNew = () => {
      setEditingDealId(null);
      setForm({ doctorName: '', representativeCode: '', customerIds: [], productTargets: [], amount: '' });
      setIsModalOpen(true);
  };

  const handleOpenEdit = (deal: Deal, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingDealId(deal.id);
      // For editing, we look at the current cycle (index 0) for targets
      const currentTargets = deal.cycles[0]?.productTargets || [];
      
      setForm({
          doctorName: deal.doctorName,
          representativeCode: deal.representativeCode,
          customerIds: deal.customerIds,
          productTargets: currentTargets,
          amount: '' 
      });
      setIsModalOpen(true);
  };

  const handleOpenRenew = (deal: Deal, e: React.MouseEvent) => {
      e.stopPropagation();
      setRenewDealId(deal.id);
      setRenewAmount('');
      // Pre-fill targets from the current cycle (index 0) so the user can modify them
      const currentTargets = deal.cycles[0]?.productTargets || [];
      setRenewTargets([...currentTargets]); // Clone
      setIsRenewModalOpen(true);
  };

  // Helper for toggle products in Renew Mode
  const toggleRenewProduct = (id: string) => {
      setRenewTargets(prev => {
          const exists = prev.find(p => p.productId === id);
          if (exists) {
              return prev.filter(p => p.productId !== id);
          } else {
              return [...prev, { productId: id, targetQuantity: 0 }];
          }
      });
  };

  const updateRenewTargetQty = (id: string, qty: number) => {
      setRenewTargets(prev => prev.map(p => 
          p.productId === id ? { ...p, targetQuantity: qty } : p
      ));
  };

  const handleRenewDeal = async () => {
      if (!renewDealId) return;
      const amount = parseFloat(renewAmount);
      if (isNaN(amount) || amount < 0) {
          alert("Invalid Amount");
          return;
      }
      
      try {
          await db.renewDeal(renewDealId, amount, renewTargets);
          db.getDeals().then(setDeals);
          setIsRenewModalOpen(false);
          setRenewDealId(null);
          setRenewAmount('');
          setRenewTargets([]);
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleSave = async () => {
      if (!form.doctorName || !form.representativeCode) {
          alert(t('deal.doctor') + " & " + t('rep.title') + " required");
          return;
      }
      
      if (editingDealId) {
          // Update Mode
          await db.updateDeal(editingDealId, {
              doctorName: form.doctorName,
              representativeCode: form.representativeCode,
              customerIds: form.customerIds,
              productTargets: form.productTargets
          });
      } else {
          // Create Mode
          const { amount, ...dealData } = form;
          // Pass amount to DB to trigger auto-deduction if present
          await db.addDeal(dealData, parseFloat(amount) || 0);
      }
      
      db.getDeals().then(setDeals);
      setIsModalOpen(false);
      setForm({ doctorName: '', representativeCode: '', customerIds: [], productTargets: [], amount: '' });
      setEditingDealId(null);
  };

  const toggleCustomer = (id: string) => {
      setForm(prev => {
          if (prev.customerIds.includes(id)) {
              return { ...prev, customerIds: prev.customerIds.filter(c => c !== id) };
          } else {
              return { ...prev, customerIds: [...prev.customerIds, id] };
          }
      });
  };

  const toggleProduct = (id: string) => {
      setForm(prev => {
          const exists = prev.productTargets.find(p => p.productId === id);
          if (exists) {
              return { ...prev, productTargets: prev.productTargets.filter(p => p.productId !== id) };
          } else {
              return { ...prev, productTargets: [...prev.productTargets, { productId: id, targetQuantity: 0 }] }; // Default 0
          }
      });
  };

  const updateTargetQty = (id: string, qty: number) => {
      setForm(prev => ({
          ...prev,
          productTargets: prev.productTargets.map(p => 
              p.productId === id ? { ...p, targetQuantity: qty } : p
          )
      }));
  };

  const calculateCycleStats = (deal: Deal, cycle: DealCycle, startDate: string, endDate?: string) => {
      const start = new Date(startDate).getTime();
      const end = endDate ? new Date(endDate).getTime() : Date.now();

      const cycleInvoices = invoices.filter(inv => {
          const invDate = new Date(inv.date).getTime();
          return deal.customerIds.includes(inv.customer_id) && invDate >= start && invDate < end;
      });

      let totalSales = 0;
      let totalProfit = 0;
      let totalSoldUnits = 0;
      let relevantSales = 0;

      // Use the cycle's specific targets
      const cycleTargets = cycle.productTargets || [];

      cycleInvoices.forEach(inv => {
          // Find items relevant to this cycle's targets
          const relevantItems = inv.items.filter(item => 
              cycleTargets.length === 0 || cycleTargets.some(t => t.productId === item.product.id)
          );

          if (relevantItems.length > 0) {
              relevantItems.forEach(item => {
                  const unitPrice = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
                  const grossSales = item.quantity * unitPrice;
                  const discountAmount = grossSales * ((item.discount_percentage || 0) / 100);
                  const netSales = grossSales - discountAmount;

                  const totalQty = item.quantity + item.bonus_quantity;
                  const cost = totalQty * item.batch.purchase_price;
                  const profit = netSales - cost;

                  relevantSales += netSales;
                  totalProfit += profit;
                  totalSoldUnits += totalQty;
              });
          }
          totalSales += inv.net_total;
      });

      const effectiveRevenue = cycleTargets.length > 0 ? relevantSales : totalSales;
      
      return { effectiveRevenue, totalProfit, totalSoldUnits };
  };

  const getDealData = (deal: Deal) => {
      // 1. Calculate Aggregated Global Stats
      let globalProfit = 0;
      let globalRevenue = 0;
      let globalPaid = 0;
      let globalSoldUnits = 0;
      let totalTargetUnits = 0; // Sum of all targets across all cycles
      
      deal.cycles.forEach(c => globalPaid += c.amount);

      // 2. Prepare Cycle-Specific Data
      const cyclesData = deal.cycles.map((cycle, index) => {
          const endDate = index === 0 ? undefined : deal.cycles[index-1].startDate;
          
          const stats = calculateCycleStats(deal, cycle, cycle.startDate, endDate);
          
          globalProfit += stats.totalProfit;
          globalRevenue += stats.effectiveRevenue;
          globalSoldUnits += stats.totalSoldUnits;
          
          // Accumulate Targets
          const cycleTargetTotal = (cycle.productTargets || []).reduce((sum, t) => sum + t.targetQuantity, 0);
          totalTargetUnits += cycleTargetTotal;

          return {
              cycleId: cycle.id,
              startDate: cycle.startDate,
              endDate: endDate,
              amountPaid: cycle.amount,
              ...stats,
              cycleTargetTotal,
              productTargets: cycle.productTargets,
              isCurrent: index === 0
          };
      });

      // Evaluate Rating
      const roiFactor = globalPaid > 0 ? (globalProfit / globalPaid) : 0;
      let rating: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT' = 'FAIR';
      
      if (globalPaid === 0 && globalProfit > 0) rating = 'EXCELLENT';
      else if (roiFactor < 1) rating = 'POOR';
      else if (roiFactor < 3) rating = 'FAIR';
      else if (roiFactor < 5) rating = 'GOOD';
      else rating = 'EXCELLENT';

      return { globalProfit, globalRevenue, globalPaid, globalSoldUnits, totalTargetUnits, cyclesData, rating };
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()));
  const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.code.includes(prodSearch));

  // Current active targets to display in list (from the first cycle)
  const getCurrentTargets = (deal: Deal) => deal.cycles[0]?.productTargets || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Award className="w-7 h-7 text-blue-600" />
                {t('deal.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage long-term agreements and doctor performance cycles.</p>
        </div>
        <button onClick={handleOpenNew} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 shadow-sm">
            <Plus className="w-5 h-5" /> {t('deal.add')}
        </button>
      </div>

      {/* DEALS LIST */}
      <div className="grid grid-cols-1 gap-6">
          {deals.map(deal => {
              const repName = representatives.find(r => r.code === deal.representativeCode)?.name || 'Unknown';
              const data = getDealData(deal);
              const isExpanded = expandedDealId === deal.id;
              
              const currentCycleTargets = getCurrentTargets(deal);
              const currentTargetSum = currentCycleTargets.reduce((a,b) => a+b.targetQuantity, 0);

              // Rating Badge
              const ratingColors = {
                  'POOR': 'bg-red-100 text-red-700 border-red-200',
                  'FAIR': 'bg-amber-100 text-amber-700 border-amber-200',
                  'GOOD': 'bg-blue-100 text-blue-700 border-blue-200',
                  'EXCELLENT': 'bg-emerald-100 text-emerald-700 border-emerald-200'
              };

              return (
                  <div key={deal.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all group">
                      
                      {/* CARD HEADER (Always Visible) */}
                      <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}>
                          {/* Left: Info */}
                          <div className="flex items-center gap-4 flex-1">
                              <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm shrink-0">
                                  <Award className="w-7 h-7" />
                              </div>
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h3 className="text-xl font-bold text-gray-800">{deal.doctorName}</h3>
                                      <button onClick={(e) => handleOpenEdit(deal, e)} className="text-gray-400 hover:text-blue-600 p-1 rounded-lg">
                                          <Edit2 className="w-4 h-4" />
                                      </button>
                                  </div>
                                  <div className="text-sm text-gray-500 flex flex-wrap items-center gap-3 mt-1">
                                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {t('cust.rep')}: <span className="font-medium text-gray-700">{repName}</span></span>
                                      <span className="hidden sm:inline text-gray-300">|</span>
                                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600">{deal.customerIds.length} {t('deal.linked_cust')}</span>
                                      {currentTargetSum > 0 && (
                                          <>
                                            <span className="hidden sm:inline text-gray-300">|</span>
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                                                <Target className="w-3 h-3" /> Current Target: {currentTargetSum}
                                            </span>
                                          </>
                                      )}
                                  </div>
                              </div>
                          </div>
                          
                          {/* Right: Summary Stats */}
                          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                              <div className="text-right hidden sm:block">
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Total Profit</p>
                                  <p className={`text-lg font-bold ${data.globalProfit > 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                                      {currency}{data.globalProfit.toLocaleString()}
                                  </p>
                              </div>
                              
                              <div className={`px-3 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 ${ratingColors[data.rating]}`}>
                                  {data.rating === 'EXCELLENT' && <Star className="w-3 h-3 fill-current" />}
                                  {data.rating}
                              </div>

                              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </div>
                      </div>

                      {/* EXPANDED CONTENT */}
                      {isExpanded && (
                          <div className="bg-slate-50 border-t border-gray-200 p-6 animate-in fade-in slide-in-from-top-2">
                              
                              {/* 1. Global Summary Card */}
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-8 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 opacity-5 rounded-bl-full pointer-events-none"></div>
                                  
                                  <div className="flex justify-between items-center mb-4 relative z-10">
                                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                          <BarChart3 className="w-5 h-5 text-blue-600" />
                                          {t('deal.total_summary')}
                                      </h4>
                                      <button 
                                        onClick={(e) => handleOpenRenew(deal, e)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
                                      >
                                          <RefreshCcw className="w-4 h-4" /> {t('deal.renew')}
                                      </button>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                          <p className="text-xs text-slate-500 font-bold uppercase">{t('deal.paid')}</p>
                                          <p className="text-xl font-bold text-red-500 mt-1">{currency}{data.globalPaid.toLocaleString()}</p>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                          <p className="text-xs text-slate-500 font-bold uppercase">{t('deal.profit')}</p>
                                          <p className="text-xl font-bold text-emerald-600 mt-1">{currency}{data.globalProfit.toLocaleString()}</p>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                          <p className="text-xs text-slate-500 font-bold uppercase">{t('deal.units_vs_target')}</p>
                                          <p className="text-xl font-bold text-blue-600 mt-1">
                                              {data.globalSoldUnits} <span className="text-xs text-slate-400">/ {data.totalTargetUnits}</span>
                                          </p>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                          <p className="text-xs text-slate-500 font-bold uppercase">{t('deal.evaluation')}</p>
                                          <div className={`mt-1 inline-flex px-2 py-0.5 rounded text-sm font-bold ${ratingColors[data.rating]}`}>
                                              {data.rating}
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              {/* 2. Cycles History */}
                              <div>
                                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                      <Calendar className="w-4 h-4" /> {t('deal.cycle_history')}
                                  </h4>
                                  
                                  <div className="space-y-4 relative">
                                      {/* Vertical Line */}
                                      <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200"></div>

                                      {data.cyclesData.map((cycle, idx) => (
                                          <div key={cycle.cycleId} className={`relative pl-14 transition-all duration-300 ${cycle.isCurrent ? 'scale-100' : 'scale-95 opacity-80 hover:opacity-100 hover:scale-100'}`}>
                                              {/* Timeline Dot */}
                                              <div className={`absolute left-4 top-6 w-4 h-4 rounded-full border-4 border-white shadow-sm z-10 ${cycle.isCurrent ? 'bg-blue-600 ring-4 ring-blue-50' : 'bg-gray-400'}`}></div>
                                              
                                              <div className={`bg-white border rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm ${cycle.isCurrent ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'}`}>
                                                  
                                                  <div className="flex-1">
                                                      <div className="flex items-center gap-2 mb-1">
                                                          <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${cycle.isCurrent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                              {cycle.isCurrent ? t('deal.current_cycle') : `${t('deal.prev_cycle')}`}
                                                          </span>
                                                          <span className="text-xs text-gray-400">
                                                              {new Date(cycle.startDate).toLocaleDateString()} — {cycle.endDate ? new Date(cycle.endDate).toLocaleDateString() : 'Now'}
                                                          </span>
                                                      </div>
                                                      <div className="text-sm font-medium text-slate-700">
                                                          Commission Paid: <span className="text-red-500 font-bold">{currency}{cycle.amountPaid.toLocaleString()}</span>
                                                      </div>
                                                      
                                                      {/* Cycle Targets Tooltip/List */}
                                                      <div className="mt-2 text-xs text-gray-500">
                                                          <span className="font-bold">Targets: </span>
                                                          {cycle.productTargets && cycle.productTargets.length > 0 ? (
                                                              cycle.productTargets.map((t, i) => {
                                                                  const pName = allProducts.find(p => p.id === t.productId)?.name || 'Product';
                                                                  return <span key={i} className="inline-block bg-slate-100 px-1.5 py-0.5 rounded mr-1 mb-1">{pName} ({t.targetQuantity})</span>
                                                              })
                                                          ) : (
                                                              <span className="italic">No targets set</span>
                                                          )}
                                                      </div>
                                                  </div>

                                                  <div className="flex gap-6 text-sm shrink-0">
                                                      <div className="text-center">
                                                          <p className="text-[10px] text-gray-400 uppercase font-bold">Revenue</p>
                                                          <p className="font-bold text-slate-800">{currency}{cycle.effectiveRevenue.toLocaleString()}</p>
                                                      </div>
                                                      <div className="text-center">
                                                          <p className="text-[10px] text-gray-400 uppercase font-bold">Profit</p>
                                                          <p className={`font-bold ${cycle.totalProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                              {currency}{cycle.totalProfit.toLocaleString()}
                                                          </p>
                                                      </div>
                                                      <div className="text-center">
                                                          <p className="text-[10px] text-gray-400 uppercase font-bold">Units</p>
                                                          <p className="font-bold text-blue-600">{cycle.totalSoldUnits} / {cycle.cycleTargetTotal}</p>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                          </div>
                      )}
                  </div>
              );
          })}
          {deals.length === 0 && (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                  <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t('deal.no_deals')}</p>
              </div>
          )}
      </div>

      {/* RENEW MODAL */}
      {isRenewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-0 relative flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b flex justify-between items-center">
                      <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                          <RefreshCcw className="w-5 h-5 text-blue-600" />
                          {t('deal.renew')}
                      </h3>
                      <button onClick={() => setIsRenewModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                  <div className="p-6 space-y-5 overflow-y-auto flex-1">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">{t('deal.renew_amount')}</label>
                          <div className="relative">
                              <input 
                                  type="number"
                                  className="w-full border border-gray-300 rounded-lg p-3 pl-8 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
                                  placeholder="0.00"
                                  value={renewAmount}
                                  onChange={e => setRenewAmount(e.target.value)}
                                  autoFocus
                              />
                              <div className="absolute left-3 top-3.5 text-gray-400 pointer-events-none">{currency}</div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">This will be deducted from cash immediately.</p>
                      </div>

                      {/* TARGET PRODUCTS MODIFICATION FOR RENEWAL */}
                      <div className="border-t pt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                            Targets for New Cycle
                            <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded text-xs">
                                {renewTargets.length === 0 ? 'All Products' : `${renewTargets.length} Selected`}
                            </span>
                        </label>
                        <div className="relative mb-2">
                             <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                             <input 
                                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                                placeholder={t('deal.search_prod')}
                                value={prodSearch}
                                onChange={e => setProdSearch(e.target.value)}
                             />
                        </div>
                        <div className="h-48 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-2 space-y-1">
                            {filteredProducts.map(p => {
                                const target = renewTargets.find(t => t.productId === p.id);
                                const isSelected = !!target;
                                
                                return (
                                    <div 
                                        key={p.id} 
                                        className={`flex items-center gap-3 p-2 rounded transition-colors ${isSelected ? 'bg-purple-50 border border-purple-200' : 'hover:bg-white border border-transparent'}`}
                                    >
                                        <div onClick={() => toggleRenewProduct(p.id)} className="cursor-pointer flex items-center gap-3 flex-1 min-w-0">
                                            {isSelected ? <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate text-sm">{p.name}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">{p.code}</div>
                                            </div>
                                        </div>
                                        
                                        {/* Quantity Input if Selected */}
                                        {isSelected && (
                                            <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-200">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    className="w-16 h-8 border border-purple-300 rounded text-center text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                                    value={target?.targetQuantity || 0}
                                                    onChange={(e) => updateRenewTargetQty(p.id, parseInt(e.target.value) || 0)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="Qty"
                                                />
                                                <span className="text-[10px] text-gray-500">{t('deal.qty_box')}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Adjust targets for this new cycle only. Previous cycle targets remain unchanged.</p>
                    </div>
                  </div>

                  <div className="p-5 border-t bg-gray-50 rounded-b-xl">
                      <button 
                          onClick={handleRenewDeal}
                          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                      >
                          Confirm Renewal
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="font-bold text-lg text-gray-800">{editingDealId ? t('deal.edit') : t('deal.add')}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('deal.doctor')}</label>
                        <input 
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. Dr. Ahmed Ali"
                            value={form.doctorName}
                            onChange={e => setForm({...form, doctorName: e.target.value})}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('rep.title')}</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={form.representativeCode}
                            onChange={e => setForm({...form, representativeCode: e.target.value})}
                        >
                            <option value="">-- {t('deal.select_rep')} --</option>
                            {representatives.map(r => (
                                <option key={r.id} value={r.code}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {!editingDealId && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('deal.amount')}</label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={e => setForm({...form, amount: e.target.value})}
                                />
                                <div className="absolute left-3 top-2.5 text-gray-400 pointer-events-none text-sm">{currency}</div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">{t('deal.initial_help')}</p>
                        </div>
                    )}

                    {/* TARGET PRODUCTS SELECTION WITH QTY */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                            {t('deal.target_label')}
                            <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded text-xs">
                                {form.productTargets.length === 0 ? t('stock.new').replace('+ ', 'All ') : `${form.productTargets.length} Selected`}
                            </span>
                        </label>
                        <div className="relative mb-2">
                             <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                             <input 
                                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                                placeholder={t('deal.search_prod')}
                                value={prodSearch}
                                onChange={e => setProdSearch(e.target.value)}
                             />
                        </div>
                        <div className="h-48 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-2 space-y-1">
                            {filteredProducts.map(p => {
                                const target = form.productTargets.find(t => t.productId === p.id);
                                const isSelected = !!target;
                                
                                return (
                                    <div 
                                        key={p.id} 
                                        className={`flex items-center gap-3 p-2 rounded transition-colors ${isSelected ? 'bg-purple-50 border border-purple-200' : 'hover:bg-white border border-transparent'}`}
                                    >
                                        <div onClick={() => toggleProduct(p.id)} className="cursor-pointer flex items-center gap-3 flex-1 min-w-0">
                                            {isSelected ? <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate text-sm">{p.name}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">{p.code}</div>
                                            </div>
                                        </div>
                                        
                                        {/* Quantity Input if Selected */}
                                        {isSelected && (
                                            <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-200">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    className="w-16 h-8 border border-purple-300 rounded text-center text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                                    value={target?.targetQuantity || 0}
                                                    onChange={(e) => updateTargetQty(p.id, parseInt(e.target.value) || 0)}
                                                    onClick={(e) => e.stopPropagation()} // Prevent toggling when clicking input
                                                    placeholder="Qty"
                                                />
                                                <span className="text-[10px] text-gray-500">{t('deal.qty_box')}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{t('deal.target_help')}</p>
                    </div>

                    {/* CUSTOMER SELECTION */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                            {t('deal.select_cust')}
                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">{form.customerIds.length} Selected</span>
                        </label>
                        <div className="relative mb-2">
                             <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                             <input 
                                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                                placeholder={t('deal.search_pharm')}
                                value={custSearch}
                                onChange={e => setCustSearch(e.target.value)}
                             />
                        </div>
                        <div className="h-32 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-2 space-y-1">
                            {filteredCustomers.map(c => {
                                const isSelected = form.customerIds.includes(c.id);
                                return (
                                    <div 
                                        key={c.id} 
                                        onClick={() => toggleCustomer(c.id)}
                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-100 border-blue-200 text-blue-900' : 'hover:bg-white text-gray-700'}`}
                                    >
                                        {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{c.name}</div>
                                            <div className="text-[10px] text-gray-500">{c.area}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">{t('common.close')}</button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-all">{editingDealId ? t('deal.update') : t('deal.save')}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
