
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Representative, Customer } from '../types';
import { t } from '../utils/t';
import { Plus, Search, Edit2 } from 'lucide-react';

export default function Representatives() {
  const [reps, setReps] = useState<Representative[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  // Edit Mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentRepId, setCurrentRepId] = useState('');

  const [form, setForm] = useState({ code: '', name: '', phone: '' });

  useEffect(() => {
    Promise.all([db.getRepresentatives(), db.getCustomers()])
      .then(([r, c]) => {
          setReps(r);
          setCustomers(c);
      });
  }, []);

  const handleOpenAdd = () => {
      setIsEditMode(false);
      setForm({ code: '', name: '', phone: '' });
      setIsOpen(true);
  };

  const handleOpenEdit = (rep: Representative) => {
      setIsEditMode(true);
      setCurrentRepId(rep.id);
      setForm({ code: rep.code, name: rep.name, phone: rep.phone });
      setIsOpen(true);
  };

  const handleSave = async () => {
    try {
        if (isEditMode) {
             await db.updateRepresentative(currentRepId, { name: form.name, phone: form.phone }); // Code usually static
        } else {
             await db.addRepresentative(form);
        }
        db.getRepresentatives().then(setReps);
        setIsOpen(false);
    } catch (e: any) {
        alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('rep.title')}</h1>
        <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> {t('rep.add')}
        </button>
      </div>

      {isOpen && (
        <div className="bg-white p-6 rounded-xl border shadow-lg space-y-4 animate-in fade-in zoom-in duration-200">
          <h3 className="font-bold text-lg">{isEditMode ? 'Edit Representative' : t('rep.add')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('rep.code')}</label>
                <input 
                    placeholder={t('rep.code')} 
                    className="w-full border p-2 rounded bg-gray-50" 
                    value={form.code} 
                    onChange={e => setForm({...form, code: e.target.value})} 
                    disabled={isEditMode} // Disable code editing
                />
                {isEditMode && <span className="text-xs text-red-500">Code cannot be changed</span>}
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('rep.name')}</label>
                <input placeholder={t('rep.name')} className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('cust.phone')}</label>
                <input placeholder={t('cust.phone')} className="w-full border p-2 rounded" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
             <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">{t('common.action')}</button>
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('set.save')}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400 rtl:right-3 rtl:left-auto" />
            <input 
              className="pl-10 pr-4 py-2 border rounded-lg w-full rtl:pr-10 rtl:pl-4" 
              placeholder={t('cust.search')} 
              value={search} onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>
        <table className="w-full text-sm text-left rtl:text-right">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="p-4">{t('rep.code')}</th>
              <th className="p-4">{t('rep.name')}</th>
              <th className="p-4">{t('cust.phone')}</th>
              <th className="p-4 text-center">{t('rep.customers_count')}</th>
              <th className="p-4 text-center">{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {reps.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.code.includes(search)).map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-mono text-gray-500">{r.code}</td>
                <td className="p-4 font-bold">{r.name}</td>
                <td className="p-4">{r.phone}</td>
                <td className="p-4 text-center">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {customers.filter(c => c.representative_code === r.code).length}
                    </span>
                </td>
                <td className="p-4 text-center">
                    <button onClick={() => handleOpenEdit(r)} className="text-gray-500 hover:text-blue-600">
                        <Edit2 className="w-4 h-4" />
                    </button>
                </td>
              </tr>
            ))}
            {reps.length === 0 && (
                 <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">No representatives found</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
