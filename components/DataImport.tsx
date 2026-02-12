
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

type ImportType = 'PRODUCTS' | 'CUSTOMERS';

export const DataImport = () => {
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // 1. Generate and Download Templates
  const downloadTemplate = (type: ImportType) => {
    let data: any[] = [];
    let fileName = '';

    if (type === 'PRODUCTS') {
      fileName = 'template_products.xlsx';
      data = [{ 
        code: 'P001', 
        name: 'Item Name Example', 
        cost_price: 100, 
        selling_price: 150, 
        initial_stock: 50 
      }];
    } else if (type === 'CUSTOMERS') {
      fileName = 'template_customers.xlsx';
      data = [{ 
        name: 'Customer Name', 
        phone: '0500000000', 
        address: 'City - Street', 
        opening_balance: 0 
      }];
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, fileName);
  };

  // 2. Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: ImportType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setLogs([]);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        await processData(data, type);
      } catch (error: any) {
        console.error(error);
        setLogs(prev => [...prev, `❌ Error reading file: ${error.message}`]);
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  // 3. Insert Data into DB
  const processData = async (data: any[], type: ImportType) => {
    let successCount = 0;
    let failCount = 0;

    setLogs(prev => [...prev, `⏳ Processing ${data.length} records...`]);

    try {
      if (type === 'PRODUCTS') {
        await (db as any).transaction('rw', [db.products, db.batches, db.queue], async () => {
          for (const row of data) {
            if (!row.name || !row.code) { failCount++; continue; }
            
            const p = {
              code: String(row.code),
              name: String(row.name),
              cost_price: Number(row.cost_price || 0),
              selling_price: Number(row.selling_price || 0),
            };
            
            // Generate a random batch for initial stock
            await db.addProduct(p, { 
                batch_number: 'INIT-' + row.code, 
                quantity: Number(row.initial_stock || 0),
                purchase_price: p.cost_price,
                selling_price: p.selling_price,
                expiry_date: new Date().toISOString() // Default expiry to today if not provided
            });
            successCount++;
          }
        });
      } 
      else if (type === 'CUSTOMERS') {
        await (db as any).transaction('rw', [db.customers, db.queue], async () => {
          for (const row of data) {
            if (!row.name) { failCount++; continue; }
            await db.addCustomer({
                name: String(row.name),
                phone: String(row.phone || ''),
                address: String(row.address || ''),
                opening_balance: Number(row.opening_balance || 0),
                code: 'C-' + Math.floor(Math.random() * 100000).toString().padStart(6, '0')
            });
            successCount++;
          }
        });
      }

      setLogs(prev => [...prev, `✅ Finished! Success: ${successCount} | Skipped/Failed: ${failCount}`]);
    } catch (err: any) {
      setLogs(prev => [...prev, `❌ Unexpected Error: ${err.message}`]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Products Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold text-gray-900 text-lg">Import Products</h3>
                <p className="text-sm text-gray-500">Upload Excel file with columns: code, name, cost_price, selling_price, initial_stock.</p>
            </div>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={() => downloadTemplate('PRODUCTS')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
                <Download className="w-4 h-4" /> Download Template
            </button>
            
            <label className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Uploading...' : 'Upload Excel'}
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, 'PRODUCTS')} disabled={importing} />
            </label>
        </div>
      </div>

      {/* Customers Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold text-gray-900 text-lg">Import Customers</h3>
                <p className="text-sm text-gray-500">Upload Excel file with columns: name, phone, address, opening_balance.</p>
            </div>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={() => downloadTemplate('CUSTOMERS')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
                <Download className="w-4 h-4" /> Download Template
            </button>
            
            <label className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg cursor-pointer hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all active:scale-95 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Uploading...' : 'Upload Excel'}
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, 'CUSTOMERS')} disabled={importing} />
            </label>
        </div>
      </div>

      {/* Operation Logs */}
      {logs.length > 0 && (
          <div className="bg-slate-900 text-slate-300 p-5 rounded-xl text-xs font-mono max-h-48 overflow-y-auto shadow-inner border border-slate-700">
              <h4 className="text-white font-bold mb-2 uppercase tracking-wider text-[10px]">Operation Log</h4>
              {logs.map((log, i) => (
                  <div key={i} className="mb-1.5 border-b border-slate-800 pb-1 last:border-0">{log}</div>
              ))}
          </div>
      )}

    </div>
  );
};
