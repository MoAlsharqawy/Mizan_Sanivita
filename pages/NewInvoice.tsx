
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Customer, ProductWithBatches, CartItem, BatchStatus, Warehouse } from '../types';
import { Plus, Trash2, Save, AlertCircle, Calculator, Package, Users, ArrowLeft, ChevronDown, Printer, Settings as SettingsIcon, Check, X, Eye, RotateCcw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '../utils/t';
import SearchableSelect, { SearchableSelectRef } from '../components/SearchableSelect';

interface InvoiceSettings {
    enableManualPrice: boolean;
    enableDiscount: boolean;
    showCostInfo: boolean; 
}

function NewInvoice() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashPayment, setCashPayment] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceSettings>(() => {
      const saved = localStorage.getItem('invoice_settings');
      return saved ? JSON.parse(saved) : { enableManualPrice: false, enableDiscount: true, showCostInfo: false };
  });

  useEffect(() => {
      localStorage.setItem('invoice_settings', JSON.stringify(invoiceConfig));
  }, [invoiceConfig]);

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [bonus, setBonus] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [manualPrice, setManualPrice] = useState<number>(0);

  const customerRef = useRef<SearchableSelectRef>(null);
  const productRef = useRef<SearchableSelectRef>(null);
  const batchRef = useRef<HTMLSelectElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const bonusRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);

  const [currency, setCurrency] = useState('');

  // Initial Data Loading
  useEffect(() => {
    db.getSettings().then(s => setCurrency(s.currency));
    db.getCustomers().then(setCustomers);
    db.getProductsWithBatches().then(setProducts);
    db.getWarehouses().then(ws => {
        setWarehouses(ws);
        const def = ws.find(w => w.is_default);
        if(def) setSelectedWarehouse(def.id);
    });
    
    if (id) {
      db.getInvoices().then(invoices => {
          const invoice = invoices.find(i => i.id === id);
          if (invoice) {
            setSelectedCustomer(invoice.customer_id);
            if (invoice.items) setCart(invoice.items);
            if (invoice.type === 'RETURN') setIsReturnMode(true);
          }
      });
    } else {
        setTimeout(() => customerRef.current?.focus(), 100);
    }
  }, [id]);

  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if (e.key === '+' || e.key === 'Add') {
              e.preventDefault();
              productRef.current?.focus();
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const availableBatches = useMemo(() => {
    if (!selectedProduct || !selectedWarehouse) return [];
    const prod = products.find(p => p.id === selectedProduct);
    if (!prod) return [];
    return prod.batches.filter(b => {
      const isExpired = new Date(b.expiry_date) < new Date();
      return b.warehouse_id === selectedWarehouse && (isReturnMode || b.quantity > 0) && !isExpired && b.status === BatchStatus.ACTIVE;
    });
  }, [selectedProduct, selectedWarehouse, products, isReturnMode]);

  useEffect(() => {
      if (availableBatches.length > 0 && !selectedBatch) {
          if(availableBatches.length === 1) {
              setSelectedBatch(availableBatches[0].id);
              setManualPrice(availableBatches[0].selling_price);
              setTimeout(() => {
                  if (invoiceConfig.enableManualPrice) {
                      priceRef.current?.focus();
                      priceRef.current?.select();
                  } else {
                      qtyRef.current?.focus();
                      qtyRef.current?.select();
                  }
              }, 50);
          } else {
              batchRef.current?.focus();
          }
      }
  }, [availableBatches, selectedBatch, invoiceConfig.enableManualPrice]);

  const activeProduct = products.find(p => p.id === selectedProduct);
  const activeBatch = availableBatches.find(b => b.id === selectedBatch);

  const handleBatchChange = (batchId: string) => {
      setSelectedBatch(batchId);
      const b = availableBatches.find(x => x.id === batchId);
      if (b) setManualPrice(b.selling_price);
  };

  const addItemToCart = () => {
    if (!activeProduct || !activeBatch) return;
    const totalQty = qty + bonus;
    if (!isReturnMode && totalQty > activeBatch.quantity) {
      alert(`${t('inv.insufficient_stock')}! ${t('stock.total')}: ${activeBatch.quantity}`);
      return;
    }
    const finalPrice = invoiceConfig.enableManualPrice ? manualPrice : activeBatch.selling_price;
    const newItem: CartItem = {
      product: activeProduct,
      batch: activeBatch,
      quantity: qty,
      bonus_quantity: bonus,
      discount_percentage: invoiceConfig.enableDiscount ? discount : 0,
      unit_price: finalPrice
    };
    setCart([...cart, newItem]);
    
    setSelectedProduct('');
    setSelectedBatch('');
    setQty(1);
    setBonus(0);
    setDiscount(0);
    setManualPrice(0);
    setTimeout(() => productRef.current?.focus(), 50);
  };

  const removeItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartItem = (index: number, field: keyof CartItem, value: number) => {
      const newCart = [...cart];
      const item = newCart[index];
      const safeValue = isNaN(value) || value < 0 ? 0 : value;
      if (!isReturnMode && (field === 'quantity' || field === 'bonus_quantity')) {
          const newQty = field === 'quantity' ? safeValue : item.quantity;
          const newBonus = field === 'bonus_quantity' ? safeValue : item.bonus_quantity;
          if (newQty + newBonus > item.batch.quantity) {
              alert(`${t('inv.insufficient_stock')}! Max: ${item.batch.quantity}`);
              return; 
          }
      }
      newCart[index] = { ...item, [field]: safeValue };
      setCart(newCart);
  };

  const totals = useMemo(() => {
    let totalGross = 0, totalDiscount = 0;
    cart.forEach(item => {
      const price = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
      const gross = item.quantity * price;
      const disc = gross * (item.discount_percentage / 100);
      totalGross += gross;
      totalDiscount += disc;
    });
    
    const cust = customers.find(c => c.id === selectedCustomer);
    const previousBalance = cust ? cust.current_balance : 0;
    const net = totalGross - totalDiscount;
    const totalDue = isReturnMode ? (previousBalance - net) : (previousBalance + net);

    return { gross: totalGross, discount: totalDiscount, net, previousBalance, totalDue };
  }, [cart, selectedCustomer, customers, isReturnMode]);

  const handleCheckout = async (print: boolean = false) => {
    if (!selectedCustomer) {
      setError(t('inv.select_customer'));
      customerRef.current?.focus();
      return;
    }
    if (cart.length === 0) {
      setError(t('inv.empty_cart'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 600));
      let result;
      if (id) {
        result = await db.updateInvoice(id, selectedCustomer, cart, cashPayment);
      } else {
        result = await db.createInvoice(selectedCustomer, cart, cashPayment, isReturnMode);
      }
      if (result.success) {
        if (print && result.id) {
            // Redirect to print page directly
            window.location.href = `/#/print/invoice/${result.id}`;
        } else {
            navigate('/invoices');
        }
      } else {
        setError(result.message);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabToCash = (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
          e.preventDefault();
          if (!id) {
             cashRef.current?.focus();
             cashRef.current?.select();
          }
      }
  };

  const customerOptions = customers.map(c => ({
      value: c.id, label: c.name, subLabel: `${c.phone}`
  }));

  const productOptions = products.map(p => ({
      value: p.id, label: p.name,
      subLabel: `${p.code} | Stock: ${p.batches.reduce((a,b) => a+b.quantity, 0)}`
  }));

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate('/invoices')} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
             </button>
             <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                 {id ? `${t('inv.update')}` : t('nav.new_invoice')}
                 {isReturnMode && <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-bold border border-red-200">Return Mode</span>}
             </h1>
          </div>
          
          <div className="flex items-center gap-3">
              {!id && (
                  <button 
                    onClick={() => { setIsReturnMode(!isReturnMode); setCart([]); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border
                    ${isReturnMode ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                      <RotateCcw className="w-4 h-4" />
                      {isReturnMode ? 'Returns Active' : 'Sales Return'}
                  </button>
              )}
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
              >
                  <SettingsIcon className="w-5 h-5" />
              </button>
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                   <span className="text-xs font-bold text-slate-500 uppercase">Items</span>
                   <span className="text-lg font-bold text-blue-600">{cart.length}</span>
              </div>
          </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 h-full items-start">
        
        {/* LEFT: Item Selection & Cart */}
        <div className="flex-1 flex flex-col space-y-6 w-full">
          
          {/* Item Adder */}
          <div className={`bg-white p-6 rounded-2xl shadow-card border relative transition-colors ${isReturnMode ? 'border-red-100' : 'border-slate-100'}`}>
             <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full rounded-tr-2xl pointer-events-none ${isReturnMode ? 'bg-red-50' : 'bg-blue-50'}`}></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isReturnMode ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isReturnMode ? <RotateCcw className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    {isReturnMode ? 'Add Return Item' : t('inv.add_product')}
                 </h3>
                 <div className="relative">
                     <select 
                        className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg p-2.5 pr-8 font-medium cursor-pointer hover:bg-slate-100"
                        value={selectedWarehouse}
                        onChange={e => { setSelectedWarehouse(e.target.value); setSelectedBatch(''); }}
                      >
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                 </div>
            </div>
            
            <div className="mb-4 relative z-50">
                <SearchableSelect
                    ref={productRef}
                    label={t('inv.product')}
                    placeholder="Type to search product name or code..."
                    options={productOptions}
                    value={selectedProduct}
                    onChange={(val) => { setSelectedProduct(val); setSelectedBatch(''); }}
                    className="w-full"
                />
            </div>

            <div className="grid grid-cols-12 gap-4 relative z-0 items-end">
              <div className="col-span-12 md:col-span-4 xl:col-span-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.batch')}</label>
                <select 
                  ref={batchRef}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
                  value={selectedBatch}
                  onChange={e => handleBatchChange(e.target.value)}
                  disabled={!selectedProduct}
                  onKeyDown={(e) => {
                      if(e.key === 'Enter') { 
                          e.preventDefault(); 
                          if(invoiceConfig.enableManualPrice) priceRef.current?.focus();
                          else qtyRef.current?.focus(); 
                      }
                  }}
                >
                  <option value="">{t('inv.select_batch')}</option>
                  {availableBatches.map(b => (
                    <option key={b.id} value={b.id}>{b.batch_number} (Exp: {b.expiry_date.split('T')[0]})</option>
                  ))}
                </select>
                {activeBatch && (
                    <div className="text-[10px] mt-1 text-slate-500 px-1 flex justify-between items-center">
                        <span>Qty: <b>{activeBatch.quantity}</b></span>
                        {!invoiceConfig.enableManualPrice && !invoiceConfig.showCostInfo && (
                            <span>Price: <b>{currency}{activeBatch.selling_price}</b></span>
                        )}
                        {(invoiceConfig.enableManualPrice || invoiceConfig.showCostInfo) && (
                            <span className="text-red-500">Cost: {currency}{activeBatch.purchase_price}</span>
                        )}
                    </div>
                )}
              </div>

              {invoiceConfig.enableManualPrice && (
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price</label>
                    <input 
                      ref={priceRef} type="number" min="0"
                      className="w-full bg-white border border-orange-300 text-orange-700 text-sm rounded-lg p-2.5 font-bold"
                      value={manualPrice}
                      onChange={e => setManualPrice(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => e.key === 'Enter' ? (e.preventDefault(), qtyRef.current?.focus(), qtyRef.current?.select()) : handleTabToCash(e)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
              )}

              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.qty')}</label>
                <input 
                  ref={qtyRef} type="number" min="1"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg p-2.5 text-center font-bold"
                  value={qty}
                  onChange={e => setQty(parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === 'Enter' ? (e.preventDefault(), bonusRef.current?.focus(), bonusRef.current?.select()) : handleTabToCash(e)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('inv.bonus')}</label>
                <input 
                  ref={bonusRef} type="number" min="0"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg p-2.5 text-center"
                  value={bonus}
                  onChange={e => setBonus(parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          e.preventDefault();
                          if (invoiceConfig.enableDiscount) {
                              discountRef.current?.focus();
                              discountRef.current?.select();
                          } else {
                              addItemToCart();
                          }
                      } else {
                          handleTabToCash(e);
                      }
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              
              {invoiceConfig.enableDiscount && (
               <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Disc %</label>
                <input 
                  ref={discountRef} type="number" min="0" max="100"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg p-2.5 text-center text-red-500"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === 'Enter' ? (e.preventDefault(), addItemToCart()) : handleTabToCash(e)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              )}

              <div className="col-span-12 md:col-span-2 flex items-end">
                  <button 
                    onClick={addItemToCart}
                    disabled={!selectedBatch || qty <= 0}
                    className={`w-full h-[42px] text-white rounded-lg flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95
                    ${isReturnMode ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                   >
                     {isReturnMode ? <RotateCcw className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                   </button>
              </div>
            </div>
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex-1 min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">{t('inv.product')}</th>
                    <th className="px-6 py-4 text-center">{t('inv.price')}</th>
                    <th className="px-6 py-4 text-center w-24">{t('inv.qty')}</th>
                    <th className="px-6 py-4 text-center w-24">{t('inv.bonus')}</th>
                    {invoiceConfig.enableDiscount && <th className="px-6 py-4 text-center w-24">{t('inv.discount')}</th>}
                    <th className="px-6 py-4 text-right rtl:text-left">{t('inv.total')}</th>
                    <th className="px-6 py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={invoiceConfig.enableDiscount ? 7 : 6} className="px-6 py-20 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                            {isReturnMode ? <RotateCcw className="w-12 h-12 mb-3 opacity-20" /> : <Package className="w-12 h-12 mb-3 opacity-20" />}
                            <p className="text-sm font-medium">{t('inv.empty_cart')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => {
                       const price = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
                       const gross = item.quantity * price;
                       const val = gross - (gross * (item.discount_percentage / 100));
                       return (
                        <tr key={idx} className={`hover:bg-blue-50/30 transition-colors group ${isReturnMode ? 'bg-red-50/20' : ''}`}>
                          <td className="px-6 py-4">
                              <div className="font-semibold text-slate-800">{item.product.name}</div>
                              <div className="text-xs text-slate-400 font-mono mt-0.5">{item.batch.batch_number}</div>
                          </td>
                          <td className="px-6 py-4 text-center text-slate-600">
                              {currency}{price}
                              {item.unit_price !== undefined && item.unit_price !== item.batch.selling_price && <span className="text-[9px] block text-orange-500">(Manual)</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input 
                                type="number" className="w-16 text-center border border-gray-200 rounded p-1 text-sm font-bold outline-none focus:border-blue-500"
                                value={item.quantity} onChange={(e) => updateCartItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                             <input 
                                type="number" className="w-16 text-center border border-gray-200 rounded p-1 text-sm font-bold text-gray-500 outline-none focus:border-blue-500"
                                value={item.bonus_quantity} onChange={(e) => updateCartItem(idx, 'bonus_quantity', parseInt(e.target.value) || 0)}
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                          </td>
                          {invoiceConfig.enableDiscount && (
                              <td className="px-6 py-4 text-center">
                                  <input 
                                    type="number" className="w-16 text-center border border-gray-200 rounded p-1 text-sm text-red-500 outline-none focus:border-blue-500"
                                    value={item.discount_percentage} onChange={(e) => updateCartItem(idx, 'discount_percentage', parseFloat(e.target.value) || 0)}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                              </td>
                          )}
                          <td className="px-6 py-4 text-right rtl:text-left font-bold text-slate-800">{currency}{val.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                       );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Customer & Summary */}
        <div className="w-full xl:w-[400px] flex flex-col space-y-6 shrink-0">
          <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 relative z-20">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Users className="w-5 h-5" /></div>
              {t('inv.customer')}
            </h3>
            <div className="space-y-4">
              <SearchableSelect 
                  ref={customerRef}
                  label={t('inv.select_customer')}
                  placeholder="Type Name or Phone..."
                  options={customerOptions}
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                  onComplete={() => productRef.current?.focus()}
              />
              {selectedCustomer && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-sm">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-indigo-600 font-bold">Current Balance</span>
                      <span className={`font-bold ${customers.find(c => c.id === selectedCustomer)?.current_balance! > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {currency}{customers.find(c => c.id === selectedCustomer)?.current_balance}
                      </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`bg-slate-900 text-white p-8 rounded-2xl shadow-2xl flex-1 flex flex-col relative overflow-hidden ${isReturnMode ? 'bg-red-950' : 'bg-slate-900'}`}>
            <h3 className="font-bold mb-6 flex items-center gap-2 relative z-10">
              <Calculator className={`w-5 h-5 ${isReturnMode ? 'text-red-400' : 'text-blue-400'}`} />
              {isReturnMode ? 'Return Summary' : t('inv.payment_summary')}
            </h3>
            <div className="space-y-4 flex-1 relative z-10">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{t('inv.prev_balance')}</span>
                <span className={`font-mono font-bold ${totals.previousBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {currency}{totals.previousBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{t('inv.net_total')}</span>
                <span className={`font-mono font-bold ${isReturnMode ? 'text-red-400' : 'text-white'}`}>
                    {isReturnMode ? '-' : '+'}{currency}{totals.net.toFixed(2)}
                </span>
              </div>
              
              <div className="my-6 border-t border-slate-700"></div>

              <div className="flex justify-between items-end">
                <span className="text-lg font-bold text-slate-200">{t('inv.grand_total')}</span>
                <span className={`text-4xl font-bold tracking-tight ${totals.totalDue > 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {currency}{totals.totalDue.toFixed(2)}
                </span>
              </div>

              <div className="mt-8 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                    {id ? 'Cash Paid (Locked)' : (isReturnMode ? 'Cash Refunded' : t('inv.cash_paid'))}
                </label>
                <div className="relative">
                  <input 
                    ref={cashRef} type="number"
                    disabled={!!id}
                    className={`w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-3 pl-4 font-bold text-lg placeholder-slate-600 outline-none ${!!id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="0.00"
                    value={cashPayment}
                    onChange={e => setCashPayment(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="flex justify-between text-xs mt-3">
                  <span className="text-slate-400">{t('inv.new_balance')}</span>
                  <span className={`font-bold ${(totals.totalDue - cashPayment) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {currency}{(totals.totalDue - cashPayment).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {error && <div className="mt-4 p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm relative z-10"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

            <div className="flex gap-3 mt-6">
                <button onClick={() => handleCheckout(true)} disabled={isSubmitting || cart.length === 0} className={`flex-1 bg-white border-2 font-bold py-4 rounded-xl shadow-lg flex justify-center items-center disabled:opacity-50 transition-all relative z-10 ${isReturnMode ? 'border-red-600 text-red-600' : 'border-blue-600 text-blue-600'}`}><Printer className="w-5 h-5 mr-2" /> {t('inv.save_print')}</button>
                <button onClick={() => handleCheckout(false)} disabled={isSubmitting || cart.length === 0} className={`flex-[2] text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center disabled:opacity-50 transition-all relative z-10 ${isReturnMode ? 'bg-red-600' : 'bg-blue-600'}`}>{isSubmitting ? <span className="loader mr-2"></span> : <><Save className="w-5 h-5 mr-2" />{isReturnMode ? 'Process Return' : t('inv.finalize')}</>}</button>
            </div>
          </div>
        </div>
      </div>
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b">
                      <h3 className="font-bold text-gray-800">Invoice Settings</h3>
                      <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4 space-y-4">
                      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${(!invoiceConfig.enableManualPrice && invoiceConfig.enableDiscount) ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}`} onClick={() => setInvoiceConfig({ enableManualPrice: false, enableDiscount: true, showCostInfo: false })}>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${(!invoiceConfig.enableManualPrice && invoiceConfig.enableDiscount) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>{(!invoiceConfig.enableManualPrice && invoiceConfig.enableDiscount) && <Check className="w-3 h-3" />}</div>
                          <div><div className="font-bold text-sm text-gray-800">Standard</div><div className="text-xs text-gray-500">Fixed price + Discount</div></div>
                      </label>
                      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${(invoiceConfig.enableManualPrice && !invoiceConfig.enableDiscount) ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}`} onClick={() => setInvoiceConfig({ enableManualPrice: true, enableDiscount: false, showCostInfo: false })}>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${(invoiceConfig.enableManualPrice && !invoiceConfig.enableDiscount) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>{(invoiceConfig.enableManualPrice && !invoiceConfig.enableDiscount) && <Check className="w-3 h-3" />}</div>
                          <div><div className="font-bold text-sm text-gray-800">Manual Price</div><div className="text-xs text-gray-500">Enter price manually</div></div>
                      </label>
                  </div>
                  <div className="p-4 bg-gray-50 border-t flex justify-end">
                      <button onClick={() => setShowSettings(false)} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm">Done</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
export default NewInvoice;
