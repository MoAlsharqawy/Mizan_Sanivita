
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ActivityLog } from '../types';
import { ShieldAlert, Search, Filter } from 'lucide-react';
import { t } from '../utils/t';

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    db.getActivityLogs().then(setLogs);
  }, []);

  const filteredLogs = logs.filter(log => {
      const matchSearch = 
        log.details.toLowerCase().includes(search.toLowerCase()) || 
        log.userName.toLowerCase().includes(search.toLowerCase());
      
      const matchType = filterType === 'ALL' || log.entity === filterType;
      
      return matchSearch && matchType;
  });

  const getActionColor = (action: string) => {
      switch(action) {
          case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
          case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
          case 'ADJUSTMENT': return 'bg-orange-100 text-orange-700 border-orange-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-indigo-600" />
                {t('log.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('log.subtitle')}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
             <Search className="absolute top-2.5 w-4 h-4 text-gray-400 ltr:left-3 rtl:right-3" />
             <input 
                className="w-full ltr:pl-9 rtl:pr-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('list.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
             />
          </div>
          <select 
            className="p-2 border rounded-lg outline-none bg-white"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
              <option value="ALL">{t('log.all_entities')}</option>
              <option value="INVOICE">Invoices</option>
              <option value="STOCK">Stock/Inventory</option>
              <option value="CUSTOMER">Customers</option>
              <option value="CASH">Cash</option>
              <option value="PRODUCT">Products</option>
          </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm text-left rtl:text-right">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                      <th className="p-4">{t('log.timestamp')}</th>
                      <th className="p-4">{t('log.user')}</th>
                      <th className="p-4">{t('log.action')}</th>
                      <th className="p-4">{t('log.entity')}</th>
                      <th className="p-4">{t('log.details')}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                          <td className="p-4 text-gray-500 font-mono text-xs" dir="ltr">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="p-4 font-bold text-gray-700">{log.userName}</td>
                          <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold border ${getActionColor(log.action)}`}>
                                  {log.action}
                              </span>
                          </td>
                          <td className="p-4 font-medium text-gray-600">{log.entity}</td>
                          <td className="p-4 text-gray-800">{log.details}</td>
                      </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t('list.no_data')}</td></tr>
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
}
