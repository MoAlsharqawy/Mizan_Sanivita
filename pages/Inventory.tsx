
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { readExcelFile } from '../utils/excel';
import { PlusCircle, RotateCcw, ArrowRightLeft, X, PackagePlus, Search, Edit2, FileText, Trash2, ArrowUpRight, ArrowDownLeft, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Batch, Product, ProductWithBatches, Warehouse } from '../types';

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [settings, setSettings] = useState<any>({});
  
  const [searchTerm, setSearchTerm] = useState('');

  // Transfer Modal State
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [transferQty, setTransferQty] = useState(0);
  const [targetWarehouse, setTargetWarehouse] = useState('');

  // Stock Adjustment Modal State
  const [adjustModal, setAdjustModal] = useState<{ isOpen: boolean; batch: Batch | null }>({ isOpen: false, batch: null });
  const [adjustType, setAdjustType] = useState<'ADD' | 'SUBTRACT'>('SUBTRACT');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Product History Card State
  const [cardModal, setCardModal] = useState<{ isOpen: boolean; product: Product | null }>({ isOpen: false, product: null });
  const [productHistory, setProductHistory] = useState<any[]>([]);

  // Add/Edit Product Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  
  const [addForm, setAddForm] = useState({
      code: '', name: '', 
      batch_number: '', quantity: 1, 
      purchase_price: 0, selling_price: 0, 
      expiry_date: new Date().toISOString().split('T')[0]
  });

  const refreshData = async () => {
      const p = await db.getProductsWithBatches();
      const w = await db.getWarehouses();
      const s = await db.getSettings();
      setProducts(p);
      setWarehouses(w);
      setSettings(s);
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
        openAddModal();
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Load history when card modal opens
  useEffect(() => {
      if (cardModal.isOpen && cardModal.product) {
          const loadHistory = async () => {
              const pid = cardModal.product!.id;
              const invoices = await db.getInvoices();
              const history: any[] = [];
              const customers = await db.getCustomers();

              invoices.forEach(inv => {
                  const item = inv.items.find(i => i.product.id === pid);
                  if (item) {
                      const customerName = customers.find(c => c.id === inv.customer_id)?.name || 'Unknown';
                      const totalQty = item.quantity + item.bonus_quantity;
                      history.push({
                          date: inv.date,
                          type: inv.type, // SALE or RETURN
                          invoice_number: inv.invoice_number,
                          customer: customerName,
                          qty: totalQty
                      });
                  }
              });
              setProductHistory(history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
          };
          loadHistory();
      }
  }, [cardModal.isOpen, cardModal.product]);

  const currency = settings.currency || '';

  const openAddModal = () => {
      setIsEditMode(false);
      setAddForm({
        code: '', name: '', 
        batch_number: '', quantity: 1, 
        purchase_price: 0, selling_price: 0, 
        expiry_date: new Date().toISOString().split('T')[0]
    });
    setIsAddOpen(true);
  };

  const openEditModal = (p: Product) => {
      setIsEditMode(true);
      setEditProductId(p.id);
      setAddForm({
          code: p.code, name: p.name,
          batch_number: '', quantity: 0, purchase_price: 0, selling_price: 0, expiry_date: '' 
      });
      setIsAddOpen(true);
  };

  const handleImport = async (e: any) => {
    if(e.target.files[0]) {
      const data = await readExcelFile<any>(e.target.files[0]);
      for (const row of data) {
          await db.addProduct(
              {code: row.code, name: row.name}, 
              {batch_number: row.batch, quantity: row.qty, selling_price: row.price, purchase_price: 0, expiry_date: new Date().toISOString()}
          );
      }
      refreshData();
    }
  };

  const handleSaveProduct = async () => {
      if (!addForm.name || !addForm.code) {
          alert("Name and Code are required");
          return;
      }

      if (isEditMode && editProductId) {
          await db.updateProduct(editProductId, { name: addForm.name, code: addForm.code });
      } else {
          if(!addForm.batch_number) {
             alert("Batch number is required for new items");
             return;
          }
          await db.addProduct(
            { code: addForm.code, name: addForm.name },
            { 
                batch_number: addForm.batch_number, 
                quantity: addForm.quantity, 
                purchase_price: addForm.purchase_price, 
                selling_price: addForm.selling_price, 
                expiry_date: new Date(addForm.expiry_date).toISOString() 
            }
          );
      }
      
      refreshData();
      setIsAddOpen(false);
  };

  const openTransferModal = (batch: Batch) => {
      setTransferQty(0);
      setTargetWarehouse('');
      setTransferModal({ isOpen: true, batch });
  };

  const handleTransfer = async () => {
      if (!transferModal.batch || !targetWarehouse || transferQty <= 0) return;
      const res = await db.transferStock(transferModal.batch.id, targetWarehouse, transferQty);
      if (res.success) {
          refreshData();
          setTransferModal({ isOpen: false, batch: null });
      } else {
          alert(res.message);
      }
  };

  const openAdjustModal = (batch: Batch) => {
      setAdjustQty(0);
      setAdjustType('SUBTRACT');
      setAdjustReason('');
      setAdjustModal({ isOpen: true, batch });
  };

  const handleAdjustment = async () => {
      if (!adjustModal.batch || adjustQty <= 0 || !adjustReason) return;
      const qty = adjustType === 'ADD' ? adjustQty : -adjustQty;
      const res = await db.adjustStock(adjustModal.batch.id, qty, adjustReason);
      if (res.success) {
          refreshData();
          setAdjustModal({ isOpen: false, batch: null });
      } else {
          alert(res.message);
      }
  };

  const handleDeleteProduct = async (id: string) => {
      if (confirm("Are you sure you want to delete this product? All stock and history for this item will be removed from display.")) {
          await db.deleteProduct(id);
          refreshData();
      }
  };

  const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('stock.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">Manage items, batches, and warehouse transfers.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
            <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
                <PackagePlus className="w-4 h-4" />
                {t('stock.new')}
            </button>
            <div className="h-10 w-px bg-slate-200 mx-1 hidden md:block"></div>
            <button onClick={() => navigate('/purchases/new')} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all">
                <PlusCircle className="w-4 h-4" />
                {t('stock.purchase')}
            </button>
            <button onClick={() => navigate('/purchases/return')} className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-all">
                <RotateCcw className="w-4 h-4" />
                {t('stock.return')}
            </button>
            
            <label className="cursor-pointer bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-all">
                {t('stock.import')}
                <input type="file" className="hidden" onChange={handleImport} />
            </label>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
         <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
         <input 
            type="text" 
            placeholder="Search products by name or code..." 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
         />
      </div>

      {/* Product List */}
      <div className="grid gap-8">
        {filteredProducts.map(product => {
          const totalQty = product.batches.reduce((sum, b) => sum + b.quantity, 0);
          return (
            <div key={product.id} className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden group">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center group-hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                        {product.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            {product.name}
                            <button onClick={() => openEditModal(product)} className="text-slate-400 hover:text-blue-600 p-1 rounded-full transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        </h3>
                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{product.code}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{t('stock.total')}</p>
                        <span className={`text-xl font-bold ${totalQty < 10 ? 'text-amber-500' : 'text-slate-800'}`}>{totalQty}</span>
                    </div>
                    <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-4"
                        title="Delete Product"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50/30">
                        <tr>
                        <th className="px-6 py-3 font-medium">{t('stock.batch')}</th>
                        <th className="px-6 py-3 font-medium">{t('stock.warehouse')}</th>
                        <th className="px-6 py-3 font-medium">{t('stock.expiry')}</th>
                        <th className="px-6 py-3 font-medium text-right rtl:text-left">{t('stock.cost')}</th>
                        <th className="px-6 py-3 font-medium text-right rtl:text-left">{t('stock.price')}</th>
                        <th className="px-6 py-3 font-medium text-right rtl:text-left">{t('stock.qty')}</th>
                        <th className="px-6 py-3 font-medium text-center">{t('common.action')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {product.batches.map(batch => {
                        const wName = warehouses.find(w => w.id === batch.warehouse_id)?.name || 'Unknown';
                        const isExpired = new Date(batch.expiry_date) < new Date();
                        return (
                        <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-slate-600 flex items-center gap-2">
                                {batch.batch_number}
                                {isExpired && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold">EXP</span>}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500">
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">{wName}</span>
                            </td>
                            <td className={`px-6 py-4 ${isExpired ? 'text-red-500 font-bold' : 'text-slate-600'}`}>{new Date(batch.expiry_date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-right rtl:text-left text-slate-400">{currency}{batch.purchase_price}</td>
                            <td className="px-6 py-4 text-right rtl:text-left font-medium text-slate-800">{currency}{batch.selling_price}</td>
                            <td className="px-6 py-4 text-right rtl:text-left">
                                <span className={`font-bold ${batch.quantity === 0 ? 'text-slate-300' : 'text-slate-800'}`}>{batch.quantity}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button 
                                        onClick={() => setCardModal({ isOpen: true, product: product })}
                                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                                        title="Product History Card"
                                    >
                                        <FileText className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => openTransferModal(batch)}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                        title={t('stock.transfer')}
                                    >
                                        <ArrowRightLeft className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => openAdjustModal(batch)}
                                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 p-2 rounded-lg transition-colors"
                                        title="Stock Adjustment (Audit)"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        )})}
                    </tbody>
                    </table>
                </div>
            </div>
          )
        })}
        {filteredProducts.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <p className="text-slate-400 mb-2">No products found matching "{searchTerm}"</p>
                <button onClick={openAddModal} className="text-blue-600 font-medium hover:underline">Add New Product</button>
            </div>
        )}
      </div>

      {/* Product Card Modal (History) */}
      {cardModal.isOpen && cardModal.product && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                              <FileText className="w-5 h-5 text-indigo-600" />
                              حركة الصنف (Item Card)
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">{cardModal.product.name} <span className="font-mono text-xs bg-white border px-1 rounded ml-1">{cardModal.product.code}</span></p>
                      </div>
                      <button onClick={() => setCardModal({isOpen: false, product: null})} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-0">
                      <table className="w-full text-sm text-left rtl:text-right">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-xs sticky top-0 shadow-sm">
                              <tr>
                                  <th className="px-6 py-3">التاريخ</th>
                                  <th className="px-6 py-3">نوع الحركة</th>
                                  <th className="px-6 py-3">رقم الفاتورة</th>
                                  <th className="px-6 py-3">العميل</th>
                                  <th className="px-6 py-3 text-center">الكمية</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {productHistory.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-6 py-4 text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                                      <td className="px-6 py-4">
                                          {row.type === 'SALE' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                  <ArrowUpRight className="w-3 h-3" /> مبيعات
                                              </span>
                                          ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                                                  <ArrowDownLeft className="w-3 h-3" /> مرتجع
                                              </span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 font-mono text-slate-500">{row.invoice_number}</td>
                                      <td className="px-6 py-4 font-medium text-slate-800">{row.customer}</td>
                                      <td className={`px-6 py-4 text-center font-bold ${row.type === 'RETURN' ? 'text-red-600' : 'text-slate-800'}`}>
                                          {row.qty}
                                      </td>
                                  </tr>
                              ))}
                              {productHistory.length === 0 && (
                                  <tr>
                                      <td colSpan={5} className="py-12 text-center text-slate-400">لا توجد حركات مسجلة لهذا الصنف</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
                  
                  <div className="p-4 border-t bg-slate-50 text-right text-xs text-slate-400">
                      Product History Log
                  </div>
              </div>
          </div>
      )}

      {/* Transfer Modal */}
      {transferModal.isOpen && transferModal.batch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg">{t('stock.transfer_title')}</h3>
                    <button onClick={() => setTransferModal({isOpen: false, batch: null})} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-900 border border-blue-100">
                        <p className="font-bold text-lg mb-1">{products.find(p => p.id === transferModal.batch?.product_id)?.name}</p>
                        <div className="flex justify-between text-blue-700 mt-2">
                             <span>Batch: <b>{transferModal.batch.batch_number}</b></span>
                             <span>Avail: <b>{transferModal.batch.quantity}</b></span>
                        </div>
                        <p className="text-xs mt-1 text-blue-500">Source: {warehouses.find(w => w.id === transferModal.batch?.warehouse_id)?.name}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.to_warehouse')}</label>
                        <select 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                            value={targetWarehouse} 
                            onChange={e => setTargetWarehouse(e.target.value)}
                        >
                            <option value="">-- Select Destination --</option>
                            {warehouses.filter(w => w.id !== transferModal.batch?.warehouse_id).map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.transfer_qty')}</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg" 
                            value={transferQty} 
                            onChange={e => setTransferQty(Number(e.target.value))}
                            max={transferModal.batch.quantity}
                            min={1}
                        />
                    </div>

                    <button 
                        onClick={handleTransfer}
                        disabled={!targetWarehouse || transferQty <= 0 || transferQty > transferModal.batch.quantity}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
                    >
                        Confirm Transfer
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustModal.isOpen && adjustModal.batch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-orange-100 bg-orange-50">
                    <h3 className="font-bold text-orange-800 text-lg flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" /> Stock Adjustment
                    </h3>
                    <button onClick={() => setAdjustModal({isOpen: false, batch: null})} className="text-orange-400 hover:text-orange-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 border border-slate-100">
                        <p className="font-bold text-lg mb-1">{products.find(p => p.id === adjustModal.batch?.product_id)?.name}</p>
                        <div className="flex justify-between text-slate-500 mt-2">
                             <span>Batch: <b>{adjustModal.batch.batch_number}</b></span>
                             <span>Current Qty: <b>{adjustModal.batch.quantity}</b></span>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setAdjustType('SUBTRACT')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adjustType === 'SUBTRACT' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Subtract (Damage/Loss)
                        </button>
                        <button 
                            onClick={() => setAdjustType('ADD')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adjustType === 'ADD' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Add (Found/Audit)
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Quantity to Adjust</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-lg" 
                            value={adjustQty} 
                            onChange={e => setAdjustQty(Number(e.target.value))}
                            min={1}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Reason</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" 
                            placeholder="e.g. Broken bottle, Expired, Theft"
                            value={adjustReason} 
                            onChange={e => setAdjustReason(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleAdjustment}
                        disabled={adjustQty <= 0 || !adjustReason}
                        className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-bold hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-900/20"
                    >
                        Confirm Adjustment
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Manual Add/Edit Product Modal */}
      {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-5 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          <PackagePlus className="w-5 h-5 text-blue-500" />
                          {isEditMode ? 'Edit Product' : t('stock.new')}
                      </h3>
                      <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-8 space-y-6 overflow-y-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('inv.product')} Name</label>
                                <input className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="e.g. Panadol Extra 500mg" autoFocus />
                          </div>
                          <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Product Code</label>
                                <input className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={addForm.code} onChange={e => setAddForm({...addForm, code: e.target.value})} placeholder="e.g. 1001" />
                          </div>
                          
                          {/* Batches only editable on creation for now */}
                          {!isEditMode && (
                              <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Batch Number</label>
                                    <input className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={addForm.batch_number} onChange={e => setAddForm({...addForm, batch_number: e.target.value})} placeholder="e.g. B-2024-001" />
                                </div>
                                
                                <div className="h-px bg-slate-100 col-span-1 md:col-span-2 my-2"></div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.qty')}</label>
                                    <input type="number" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.quantity} onChange={e => setAddForm({...addForm, quantity: +e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.expiry')}</label>
                                    <input type="date" className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.expiry_date} onChange={e => setAddForm({...addForm, expiry_date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.cost')}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-400 font-bold">{currency}</span>
                                        <input type="number" className="w-full border border-slate-200 p-3 pl-8 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={addForm.purchase_price} onChange={e => setAddForm({...addForm, purchase_price: +e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('stock.price')}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-400 font-bold">{currency}</span>
                                        <input type="number" className="w-full border border-slate-200 p-3 pl-8 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" value={addForm.selling_price} onChange={e => setAddForm({...addForm, selling_price: +e.target.value})} />
                                    </div>
                                </div>
                              </>
                          )}
                      </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button onClick={() => setIsAddOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors">Cancel</button>
                        <button onClick={handleSaveProduct} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95">
                            {isEditMode ? 'Update Product' : 'Save Product'}
                        </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
export default Inventory;
