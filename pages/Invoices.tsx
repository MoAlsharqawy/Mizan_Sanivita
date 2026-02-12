
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { db } from '../services/db';
import { Invoice, PaymentStatus, Customer } from '../types';
import { FileText, Search, Eye, Edit, X, Printer, Receipt, Scissors, Filter, PlusCircle, RotateCcw, FileDown, Trash2, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { t, isRTL } from '../utils/t';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currency, setCurrency] = useState('');
  const [settings, setSettings] = useState<any>({});
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'SALE' | 'RETURN'>('ALL');
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    // Load Data Async
    Promise.all([
        db.getInvoices(),
        db.getCustomers(),
        db.getSettings()
    ]).then(([inv, cust, set]) => {
        setInvoices(inv);
        setCustomers(cust);
        setSettings(set);
        setCurrency(set.currency);
        
        // Auto Print Logic after data load
        if (location.state && (location.state as any).autoPrintId) {
            const id = (location.state as any).autoPrintId;
            handlePrint(id);
            window.history.replaceState({}, document.title);
        }
    });
  }, [location]);

  const handleDelete = async (id: string) => {
      if (confirm('هل أنت متأكد من إلغاء الفاتورة؟ سيتم عكس المخزون وحساب العميل.')) {
          await db.deleteInvoice(id);
          const updated = await db.getInvoices();
          setInvoices(updated);
      }
  };

  const handlePrint = (id: string) => {
      // Open the specific print route in a new window/tab
      window.open(`/#/print/invoice/${id}`, '_blank');
  };

  const filtered = useMemo(() => {
      return invoices.filter(inv => {
        const matchSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase());
        const matchType = filterType === 'ALL' || inv.type === filterType;
        const matchCustomer = filterCustomer === '' || inv.customer_id === filterCustomer;
        return matchSearch && matchType && matchCustomer;
      });
  }, [invoices, search, filterType, filterCustomer]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedInvoices = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const rtl = isRTL();
  const customerOptions = useMemo(() => [
      { value: '', label: rtl ? 'كل العملاء' : 'All Customers' },
      ...customers.map(c => ({ value: c.id, label: c.name }))
  ], [customers, rtl]);

  useEffect(() => setCurrentPage(1), [search, filterType, filterCustomer]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('list.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and view your sales history</p>
        </div>
        <button onClick={() => navigate('/invoice/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2">
            <PlusCircle className="w-5 h-5" /><span>{t('nav.new_invoice')}</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative group flex-1 w-full">
                <Search className="absolute rtl:right-3 ltr:left-3 top-3 h-5 w-5 text-slate-400" />
                <input type="text" placeholder={t('list.search')} className="rtl:pr-10 ltr:pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 w-full outline-none" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 w-full lg:w-auto overflow-x-auto">
                {['ALL', 'SALE', 'RETURN'].map(t => (
                    <button key={t} onClick={() => setFilterType(t as any)} className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filterType === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
                ))}
          </div>
          <div className="w-full lg:w-72 relative">
              <SearchableSelect placeholder={rtl ? "فلتر بالعميل..." : "Filter by Customer..."} options={customerOptions} value={filterCustomer} onChange={setFilterCustomer} className="w-full" />
          </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left rtl:text-right min-w-[900px]">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                <tr>
                <th className="px-6 py-4 font-bold w-32">#</th>
                <th className="px-6 py-4 font-bold w-24">Type</th>
                <th className="px-6 py-4 font-bold w-32">{t('cash.date')}</th>
                <th className="px-6 py-4 font-bold">{t('common.customer')}</th>
                <th className="px-6 py-4 font-bold text-right rtl:text-left w-32">{t('inv.total')}</th>
                <th className="px-6 py-4 font-bold text-center w-32">{t('list.status')}</th>
                <th className="px-6 py-4 font-bold text-center w-32">{t('common.action')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {paginatedInvoices.map(inv => {
                const customerName = customers.find(c => c.id === inv.customer_id)?.name || 'Unknown';
                const isReturn = inv.type === 'RETURN';
                return (
                    <tr key={inv.id} className={`hover:bg-slate-50/80 transition-colors group ${isReturn ? 'bg-red-50/10' : ''}`}>
                    <td className="px-6 py-4 font-mono font-medium text-slate-600">{inv.invoice_number}</td>
                    <td className="px-6 py-4">
                        {isReturn ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200"><RotateCcw className="w-3 h-3" /> Return</span> : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100"><ArrowUpRight className="w-3 h-3" /> Sale</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{customerName}</td>
                    <td className={`px-6 py-4 text-right rtl:text-left font-bold ${isReturn ? 'text-red-600' : 'text-slate-900'}`}>{currency}{inv.net_total.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${inv.payment_status === PaymentStatus.PAID ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : inv.payment_status === PaymentStatus.PARTIAL ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {inv.payment_status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handlePrint(inv.id)} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600"><Printer className="w-4 h-4" /></button>
                            {!isReturn && <button onClick={() => navigate(`/invoice/edit/${inv.id}`)} className="p-2 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-600 rounded-lg"><Edit className="w-4 h-4" /></button>}
                            <button onClick={() => handleDelete(inv.id)} className="p-2 bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </td>
                    </tr>
                );
                })}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
export default Invoices;
