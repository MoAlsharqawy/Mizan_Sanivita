
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseItem, Supplier, ProductWithBatches, Warehouse } from '../types';
import { Plus, Save, ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';

interface Props {
  type: 'PURCHASE' | 'RETURN';
}

function PurchaseInvoice({ type }: Props) {
  const navigate = useNavigate();
  const isReturn = type === 'RETURN';
  
  const [currency, setCurrency] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [cashPaid, setCashPaid] = useState<number>(0);
  
  // Item Form
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selProd, setSelProd] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [sell, setSell] = useState(0);
  const [expiry, setExpiry] = useState('');

  // Async Load
  useEffect(() => {
    Promise.all([
      db.getSettings(),
      db.getSuppliers(),
      db.getProductsWithBatches(),
      db.getWarehouses()
    ]).then(([s, sup, p, w]) => {
      setCurrency(s.currency);
      setSuppliers(sup);
      setProducts(p);
      setWarehouses(w);
      const def = w.find(x => x.is_default);
      if(def) setSelectedWarehouse(def.id);
    });
  }, []);

  // Auto-fill product data on select
  useEffect(() => {
    if (selProd) {
      const p = products.find(x => x.id === selProd);
      if (p && p.batches.length > 0) {
        // Pre-fill with last batch data if available
        const lastBatch = p.batches[p.batches.length-1];
        setCost(lastBatch.purchase_price);
        setSell(lastBatch.selling_price);
        if (isReturn) {
            setBatchNo(lastBatch.batch_number);
        }
      }
    }
  }, [selProd, products, isReturn]);

  const addItem = () => {
    if (!selProd || !batchNo || qty <= 0 || cost < 0 || !selectedWarehouse) return;
    
    // For return, ensure user doesn't return more than what's available (Simple UI check)
    if (isReturn) {
        const p = products.find(x => x.id === selProd);
        const b = p?.batches.find(x => x.batch_number === batchNo && x.warehouse_id === selectedWarehouse);
        if (!b) {
            alert("Batch not found for this product in the selected warehouse!");
            return;
        }
        if (qty > b.quantity) {
            alert(`Cannot return more than stock! Available: ${b.quantity}`);
            return;
        }
    }

    setCart([...cart, {
      product_id: selProd,
      warehouse_id: selectedWarehouse,
      batch_number: batchNo,
      quantity: qty,
      cost_price: cost,
      selling_price: sell,
      expiry_date: expiry || new Date().toISOString()
    }]);

    // Reset form
    setSelProd('');
    setBatchNo('');
    setQty(1);
  };

  const removeItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!selectedSupplier || cart.length === 0) return;
    const res = await db.createPurchaseInvoice(selectedSupplier, cart, cashPaid, isReturn);
    if (res.success) {
      alert(res.message);
      navigate('/inventory');
    } else {
      alert(res.message);
    }
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);

  // Prepare Options
  const supplierOptions = useMemo(() => suppliers.map(s => ({
    value: s.id,
    label: s.name,
    subLabel: `${currency}${s.current_balance}`
  })), [suppliers, currency]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="flex items-center gap-3">
             <button onClick={() => navigate('/inventory')} className="p-2 hover:bg-white rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
             </button>
             <h1 className="text-2xl font-bold text-gray-800">
                 {isReturn ? t('pur.return_title') : t('pur.title')}
             </h1>
       </div>

       <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
           {/* Supplier Select */}
           <SearchableSelect 
              label={t('inv.supplier')}
              options={supplierOptions}
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              placeholder={t('pur.select_supplier')}
           />

           {/* Add Item Form */}
           <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
               <div className="md:col-span-2">
                   <label className="block text-xs font-bold text-gray-500 mb-1">{t('inv.product')}</label>
                   <select className="w-full p-2 border rounded" value={selProd} onChange={e => setSelProd(e.target.value)}>
                       <option value="">-- Select Product --</option>
                       {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                   </select>
               </div>
               <div className="md:col-span-1">
                   <label className="block text-xs font-bold text-gray-500 mb-1">{t('inv.batch')}</label>
                   <input className="w-full p-2 border rounded" value={batchNo} onChange={e => setBatchNo(e.target.value)} placeholder="Batch" />
               </div>
               <div className="md:col-span-1">
                   <label className="block text-xs font-bold text-gray-500 mb-1">{t('stock.expiry')}</label>
                   <input type="date" className="w-full p-2 border rounded" value={expiry} onChange={e => setExpiry(e.target.value)} />
               </div>
               <div className="md:col-span-1">
                   <label className="block text-xs font-bold text-gray-500 mb-1">{t('stock.cost')}</label>
                   <input type="number" className="w-full p-2 border rounded" value={cost} onChange={e => setCost(+e.target.value)} />
               </div>
               <div className="md:col-span-1 flex items-end">
                   <button onClick={addItem} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-bold">
                       <Plus className="w-5 h-5 mx-auto" />
                   </button>
               </div>
           </div>
           
           {/* Cart List */}
           <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                   <tr>
                       <th className="p-3">Product</th>
                       <th className="p-3">Batch</th>
                       <th className="p-3">Qty</th>
                       <th className="p-3">Cost</th>
                       <th className="p-3">Total</th>
                       <th className="p-3 w-10"></th>
                   </tr>
               </thead>
               <tbody>
                   {cart.map((item, idx) => {
                       const pName = products.find(p => p.id === item.product_id)?.name;
                       return (
                           <tr key={idx} className="border-b">
                               <td className="p-3 font-medium">{pName}</td>
                               <td className="p-3">{item.batch_number}</td>
                               <td className="p-3">{item.quantity}</td>
                               <td className="p-3">{currency}{item.cost_price}</td>
                               <td className="p-3 font-bold">{currency}{item.quantity * item.cost_price}</td>
                               <td className="p-3">
                                   <button onClick={() => removeItem(idx)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                               </td>
                           </tr>
                       );
                   })}
               </tbody>
           </table>

           <div className="flex justify-end gap-4 items-center pt-4 border-t">
               <div className="text-right">
                   <p className="text-sm text-gray-500">Total Amount</p>
                   <p className="text-2xl font-bold text-blue-600">{currency}{totalAmount.toFixed(2)}</p>
               </div>
           </div>
            
            <div className="flex justify-end gap-4 items-center">
                 <div className="w-48">
                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('inv.cash_paid')}</label>
                    <input type="number" className="w-full p-2 border rounded font-bold" value={cashPaid} onChange={e => setCashPaid(+e.target.value)} />
                 </div>
                 <button onClick={save} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2 h-fit mt-5">
                    <Save className="w-5 h-5" />
                    {isReturn ? t('pur.return_submit') : t('pur.submit')}
                </button>
            </div>

       </div>
    </div>
  );
}

export default PurchaseInvoice;
