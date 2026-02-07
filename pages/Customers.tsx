
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Customer, Representative } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Upload, FileText, X, Printer, User, Edit2, Trash2 } from 'lucide-react';
import { readExcelFile } from '../utils/excel';
import { useNavigate, useLocation } from 'react-router-dom';

interface StatementItem {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

function Customers() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currency, setCurrency] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);

  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', phone: '', opening_balance: 0, representative_code: '', address: '', area: '' });
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
      Promise.all([
          db.getSettings(),
          db.getCustomers(),
          db.getRepresentatives(),
          db.getInvoices(),
          db.getCashTransactions()
      ]).then(([s, c, r, inv, tx]) => {
          setCurrency(s.currency);
          setCustomers(c);
          setRepresentatives(r);
          setInvoices(inv);
          setPayments(tx);
      });
  }, []);

  useEffect(() => {
    if (location.state && (location.state as any).openAdd) {
        handleOpenAdd();
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleOpenAdd = () => {
      setIsEditMode(false);
      setEditingId(null);
      setForm({ code: '', name: '', phone: '', opening_balance: 0, representative_code: '', address: '', area: '' });
      setIsOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
      setIsEditMode(true);
      setEditingId(customer.id);
      setForm({
          code: customer.code,
          name: customer.name,
          phone: customer.phone,
          opening_balance: customer.opening_balance,
          representative_code: customer.representative_code || '',
          address: customer.address || '',
          area: customer.area || ''
      });
      setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return alert("Name is required");
    if (isEditMode && editingId) {
        await db.updateCustomer(editingId, form);
    } else {
        await db.addCustomer(form);
    }
    const updated = await db.getCustomers();
    setCustomers(updated);
    setIsOpen(false);
  };

  const handleDelete = async (id: string) => {
      if (confirm("Are you sure?")) {
          await db.deleteCustomer(id);
          const updated = await db.getCustomers();
          setCustomers(updated);
      }
  };

  const handleImport = async (e: any) => {
    if(e.target.files[0]) {
      const data = await readExcelFile<any>(e.target.files[0]);
      for (const c of data) {
          await db.addCustomer({ ...c, opening_balance: c.opening_balance || 0 });
      }
      const updated = await db.getCustomers();
      setCustomers(updated);
    }
  };

  const statementData = useMemo(() => {
    if (!statementCustomer) return [];
    const items: any[] = [];
    
    invoices.filter(i => i.customer_id === statementCustomer.id).forEach(inv => {
      const isReturn = inv.type === 'RETURN';
      items.push({
        date: inv.date,
        description: `${isReturn ? 'Return' : 'Invoice'} #${inv.invoice_number}`,
        debit: isReturn ? 0 : inv.net_total, 
        credit: isReturn ? inv.net_total : 0,
        rawDate: new Date(inv.date)
      });
    });

    payments.filter(tx => tx.category === 'CUSTOMER_PAYMENT' && tx.reference_id === statementCustomer.id).forEach(pay => {
       const isRefund = pay.type === 'EXPENSE';
       items.push({
        date: pay.date,
        description: `Payment: ${pay.notes || '-'}`,
        debit: isRefund ? pay.amount : 0, 
        credit: isRefund ? 0 : pay.amount,
        rawDate: new Date(pay.date)
      });
    });

    items.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    let balance = statementCustomer.opening_balance;
    const finalStatement: StatementItem[] = [];
    finalStatement.push({ date: '', description: t('common.opening'), debit: 0, credit: 0, balance: balance });

    items.forEach(item => {
        balance = balance + item.debit - item.credit;
        finalStatement.push({
            date: item.date, description: item.description,
            debit: item.debit, credit: item.credit, balance: balance
        });
    });
    return finalStatement;
  }, [statementCustomer, invoices, payments]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('cust.title')}</h1>
        <div className="flex gap-2">
          <label className="cursor-pointer bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700">
            <Upload className="w-4 h-4" /> Import <input type="file" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"><Plus className="w-4 h-4" /> {t('cust.add')}</button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-xl border shadow-lg space-y-4 w-full max-w-lg relative">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-gray-400"><X className="w-5 h-5" /></button>
           <h3 className="font-bold text-lg">{isEditMode ? 'Edit Customer' : t('cust.add')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={t('cust.name')} />
            <input className="w-full border p-2 rounded" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder={t('cust.phone')} />
            <input className="w-full border p-2 rounded" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder={t('set.address')} />
            <select className="w-full border p-2 rounded" value={form.representative_code} onChange={e => setForm({...form, representative_code: e.target.value})}>
                <option value="">-- Select Rep --</option>
                {representatives.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
            <input type="number" className="w-full border p-2 rounded" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: +e.target.value})} placeholder={t('common.opening')} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">{t('set.save')}</button>
          </div>
        </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
            <input className="pl-4 pr-4 py-2 border rounded-lg w-full" placeholder={t('cust.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <table className="w-full text-sm text-left rtl:text-right">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr><th className="p-4">{t('cust.name')}</th><th className="p-4">{t('cust.balance')}</th><th className="p-4 text-center">{t('common.action')}</th></tr>
          </thead>
          <tbody>
            {customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-bold">{c.name}</td>
                    <td className={`p-4 font-bold ${c.current_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{currency}{c.current_balance.toFixed(2)}</td>
                    <td className="p-4 text-center flex justify-center gap-2">
                        <button onClick={() => setStatementCustomer(c)} className="text-blue-600 border px-2 py-1 rounded">Statement</button>
                        <button onClick={() => handleOpenEdit(c)} className="text-gray-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(c.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Statement Modal logic preserved from previous file content but simplified here */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-4xl h-[90vh] rounded-xl flex flex-col">
                <div className="p-4 border-b flex justify-between"><h3 className="font-bold">Statement: {statementCustomer.name}</h3><button onClick={() => setStatementCustomer(null)}>Close</button></div>
                <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-sm border-collapse">
                        <thead><tr className="bg-gray-100"><th className="border p-2">Date</th><th className="border p-2">Desc</th><th className="border p-2">Debit</th><th className="border p-2">Credit</th><th className="border p-2">Balance</th></tr></thead>
                        <tbody>{statementData.map((r, i) => <tr key={i}><td className="border p-2">{r.date ? new Date(r.date).toLocaleDateString() : ''}</td><td className="border p-2">{r.description}</td><td className="border p-2">{r.debit}</td><td className="border p-2">{r.credit}</td><td className="border p-2 font-bold">{r.balance}</td></tr>)}</tbody>
                    </table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
export default Customers;
