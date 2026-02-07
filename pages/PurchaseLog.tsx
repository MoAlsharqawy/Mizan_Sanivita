
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { PurchaseInvoice, Supplier, ProductWithBatches } from '../types';
import { t } from '../utils/t';
import { FileText, Search, Trash2, ArrowUpRight, ArrowDownLeft, Eye, X, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PurchaseLog() {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState('');
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  useEffect(() => {
    Promise.all([
      db.getSettings(),
      db.getPurchaseInvoices(),
      db.getSuppliers(),
      db.getProductsWithBatches()
    ]).then(([s, inv, sup, p]) => {
      setCurrency(s.currency);
      setInvoices(inv);
      setSuppliers(sup);
      setProducts(p);
    });
  }, []);

  const handleDelete = (id: string) => {
    if (confirm(t('user.delete_confirm'))) {
      db.deletePurchaseInvoice(id).then(() => {
          db.getPurchaseInvoices().then(setInvoices);
      });
    }
  };

  const filtered = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    suppliers.find(s => s.id === inv.supplier_id)?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            {t('nav.purchase_log')}
        </h1>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="relative max-w-sm">
            <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
            <input 
              className="pl-10 pr-4 py-2 border rounded-lg w-full rtl:pr-10 rtl:pl-4 focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder={t('list.search')}
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left rtl:text-right">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="p-4">#</th>
              <th className="p-4">{t('ware.type')}</th>
              <th className="p-4">{t('common.date')}</th>
              <th className="p-4">{t('inv.supplier')}</th>
              <th className="p-4 text-right rtl:text-left">{t('inv.total')}</th>
              <th className="p-4 text-center">{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => {
                const supplierName = suppliers.find(s => s.id === inv.supplier_id)?.name || 'Unknown';
                const isReturn = inv.type === 'RETURN';
                return (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-mono text-gray-600">{inv.invoice_number}</td>
                        <td className="p-4">
                            {isReturn ? (
                                <span className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded w-fit">
                                    <ArrowDownLeft className="w-3 h-3" /> {t('stock.return')}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-blue-600 font-bold text-xs bg-blue-50 px-2 py-1 rounded w-fit">
                                    <ArrowUpRight className="w-3 h-3" /> {t('stock.purchase')}
                                </span>
                            )}
                        </td>
                        <td className="p-4 text-gray-500">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="p-4 font-medium">{supplierName}</td>
                        <td className="p-4 text-right rtl:text-left font-bold text-slate-800">{currency}{inv.total_amount.toLocaleString()}</td>
                        <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                                <button onClick={() => setSelectedInvoice(inv)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                    <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(inv.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                );
            })}
            {filtered.length === 0 && (
                <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">{t('list.no_data')}</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-gray-800">
                          {selectedInvoice.type === 'RETURN' ? t('pur.return_title') : t('pur.title')} #{selectedInvoice.invoice_number}
                      </h3>
                      <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <div className="flex justify-between mb-6">
                          <div>
                              <p className="text-sm text-gray-500">{t('inv.supplier')}</p>
                              <p className="font-bold text-lg text-gray-800">{suppliers.find(s => s.id === selectedInvoice.supplier_id)?.name}</p>
                          </div>
                          <div className="text-right rtl:text-left">
                              <p className="text-sm text-gray-500">{t('common.date')}</p>
                              <p className="font-bold">{new Date(selectedInvoice.date).toLocaleDateString()}</p>
                          </div>
                      </div>

                      <table className="w-full text-sm text-left rtl:text-right mb-6">
                          <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                              <tr>
                                  <th className="p-3">{t('inv.product')}</th>
                                  <th className="p-3">{t('inv.batch')}</th>
                                  <th className="p-3 text-center">{t('inv.qty')}</th>
                                  <th className="p-3 text-right rtl:text-left">{t('stock.cost')}</th>
                                  <th className="p-3 text-right rtl:text-left">{t('inv.total')}</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {selectedInvoice.items.map((item, idx) => {
                                  const pName = products.find(p => p.id === item.product_id)?.name || 'Unknown Item';
                                  return (
                                      <tr key={idx}>
                                          <td className="p-3 font-medium">{pName}</td>
                                          <td className="p-3 font-mono text-xs">{item.batch_number}</td>
                                          <td className="p-3 text-center">{item.quantity}</td>
                                          <td className="p-3 text-right rtl:text-left">{currency}{item.cost_price}</td>
                                          <td className="p-3 text-right rtl:text-left font-bold">{currency}{(item.quantity * item.cost_price).toFixed(2)}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>

                      <div className="flex justify-end border-t pt-4">
                          <div className="text-right rtl:text-left w-1/2">
                              <div className="flex justify-between mb-2">
                                  <span className="text-gray-500">{t('inv.total')}</span>
                                  <span className="font-bold text-xl">{currency}{selectedInvoice.total_amount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">{t('inv.cash_paid')}</span>
                                  <span className="font-medium text-green-600">{currency}{selectedInvoice.paid_amount.toLocaleString()}</span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
