
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { authService, PERMISSIONS } from '../services/auth';
import { supabase } from '../services/supabase';
import { Save, RefreshCw, Building2, FileText, Settings as SettingsIcon, Users, Plus, Edit2, Trash2, X, Shield, Key, CheckSquare, Printer, Upload, Image as ImageIcon, Database, Download, Wrench, Copy, Terminal, Wifi, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { t } from '../utils/t';

export default function Settings() {
  const [settings, setSettings] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'general' | 'invoice' | 'database'>('general');
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'CHECKING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [sysHealth, setSysHealth] = useState<string | null>(null);

  useEffect(() => {
      const health = localStorage.getItem('SYS_HEALTH');
      setSysHealth(health);
      if (health) {
          setActiveTab('database');
      }
  }, []);

  // --- FINAL PRODUCTION SQL SCRIPT (v2 - Fixes Auth 500 Error) ---
  const SQL_SCRIPT = `
-- ⚡ MIZAN ONLINE: ULTIMATE FIX SCRIPT (v2)
-- Run this in Supabase SQL Editor.

-- 0. FIX AUTHENTICATION ERRORS (CRITICAL)
-- Removes broken triggers that cause "Error 500" when adding users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- 1. EXTENSIONS
create extension if not exists moddatetime schema extensions;

-- 2. TABLES & RLS
-- Drops existing tables to ensure clean schema compatible with the app
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.cash_transactions CASCADE;
DROP TABLE IF EXISTS public.purchase_invoices CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.representatives CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- SETTINGS
create table public.settings (
  company_id uuid not null primary key,
  company_name text,
  company_address text,
  company_phone text,
  tax_number text,
  currency text default 'SAR',
  logo_url text,
  invoice_template text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table settings enable row level security;
create policy "Allow Auth" on settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- WAREHOUSES
create table public.warehouses (
  id uuid primary key,
  company_id uuid not null,
  name text,
  is_default boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table warehouses enable row level security;
create policy "Allow Auth" on warehouses for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- REPS
create table public.representatives (
  id uuid primary key,
  company_id uuid not null,
  code text,
  name text,
  phone text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table representatives enable row level security;
create policy "Allow Auth" on representatives for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- SUPPLIERS
create table public.suppliers (
  id uuid primary key,
  company_id uuid not null,
  code text,
  name text,
  phone text,
  contact_person text,
  current_balance numeric default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table suppliers enable row level security;
create policy "Allow Auth" on suppliers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- CUSTOMERS
create table public.customers (
  id uuid primary key,
  company_id uuid not null,
  representative_code text,
  code text,
  name text,
  phone text,
  area text,
  address text,
  current_balance numeric default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table customers enable row level security;
create policy "Allow Auth" on customers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- PRODUCTS
create table public.products (
  id text not null,
  company_id uuid not null,
  code text,
  name text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (id, company_id)
);
alter table products enable row level security;
create policy "Allow Auth" on products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- BATCHES
create table public.batches (
  id uuid primary key,
  company_id uuid not null,
  product_id text,
  warehouse_id text,
  batch_number text,
  selling_price numeric,
  purchase_price numeric,
  quantity numeric,
  expiry_date timestamp with time zone,
  status text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table batches enable row level security;
create policy "Allow Auth" on batches for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- INVOICES
create table public.invoices (
  id uuid primary key,
  company_id uuid not null,
  invoice_number text,
  customer_id uuid, 
  date timestamp with time zone,
  total_before_discount numeric,
  total_discount numeric,
  net_total numeric,
  payment_status text,
  type text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table invoices enable row level security;
create policy "Allow Auth" on invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- INVOICE ITEMS
create table public.invoice_items (
  id uuid primary key,
  company_id uuid not null,
  invoice_id uuid references public.invoices(id) on delete cascade,
  product_id text,
  batch_id text,
  quantity numeric,
  bonus_quantity numeric default 0,
  unit_price numeric,
  discount_percentage numeric default 0,
  line_total numeric
);
alter table invoice_items enable row level security;
create policy "Allow Auth" on invoice_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- PURCHASE INVOICES
create table public.purchase_invoices (
  id uuid primary key,
  company_id uuid not null,
  invoice_number text,
  supplier_id uuid,
  date timestamp with time zone,
  total_amount numeric,
  paid_amount numeric,
  type text,
  items jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
alter table purchase_invoices enable row level security;
create policy "Allow Auth" on purchase_invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- CASH TRANSACTIONS
create table public.cash_transactions (
  id text not null,
  company_id uuid not null,
  type text,
  category text,
  amount numeric,
  reference_id text,
  related_name text,
  date timestamp with time zone,
  notes text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (id, company_id)
);
alter table cash_transactions enable row level security;
create policy "Allow Auth" on cash_transactions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- DEALS
create table public.deals (
  id uuid primary key,
  company_id uuid not null,
  doctor_name text,
  representative_code text,
  cycles jsonb,
  customer_ids jsonb,
  created_at timestamp with time zone
);
alter table deals enable row level security;
create policy "Allow Auth" on deals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3. TRIGGERS (Auto-update 'updated_at')
create trigger handle_updated_at before update on settings for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on warehouses for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on representatives for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on suppliers for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on customers for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on products for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on batches for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on invoices for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on purchase_invoices for each row execute procedure moddatetime (updated_at);
create trigger handle_updated_at before update on cash_transactions for each row execute procedure moddatetime (updated_at);

-- 4. STORAGE BUCKET
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;
drop policy if exists "Logos Public" on storage.objects;
drop policy if exists "Logos Upload" on storage.objects;
create policy "Logos Public" on storage.objects for select using ( bucket_id = 'logos' );
create policy "Logos Upload" on storage.objects for insert with check ( bucket_id = 'logos' );
  `;

  useEffect(() => {
    db.getSettings().then(setSettings);
  }, []);

  const handleSaveSettings = async () => {
    await db.updateSettings(settings);
    window.location.reload();
  };

  const handleBackup = async () => {
      const data = await db.exportDatabase();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mizan_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const content = event.target?.result as string;
                  if (confirm("WARNING: This will overwrite all current data. Are you sure?")) {
                      await db.importDatabase(content);
                      window.location.reload();
                  }
              } catch (err) { alert("Error reading file."); }
          };
          reader.readAsText(file);
      }
  };

  const copySQL = () => {
      navigator.clipboard.writeText(SQL_SCRIPT);
      alert("✅ SQL Copied! Go to Supabase SQL Editor and run it to fix Auth & Database errors.");
  };

  const handleTestConnection = async () => {
      if (!supabase) {
          alert("Supabase not configured!");
          return;
      }
      setConnectionStatus('CHECKING');
      try {
          const { data: { session }, error: authError } = await supabase.auth.getSession();
          if (authError) throw authError;
          if (!session) throw new Error("Not logged in. Please log in first.");

          const { error: dbError } = await supabase.from('settings').select('*').limit(1);
          
          if (dbError) {
              if (dbError.code === '42P01') throw new Error("Tables Missing. Please run the SQL script.");
              if (dbError.code === '42501') throw new Error("Permission Denied (403). Please run the SQL script to fix policies.");
              throw dbError;
          }

          setConnectionStatus('SUCCESS');
          localStorage.removeItem('SYS_HEALTH');
          setSysHealth(null);
          window.dispatchEvent(new Event('sys-health-change'));
          alert("✅ Connected Successfully!");
      } catch (e: any) {
          setConnectionStatus('ERROR');
          alert(`❌ Connection Issue: ${e.message}`);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('set.title')}</h1>
      </div>
      
      <div className="flex space-x-2 border-b border-gray-200 rtl:space-x-reverse overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <SettingsIcon className="w-4 h-4" /> {t('set.tab_general')}
          </button>
          <button onClick={() => setActiveTab('invoice')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'invoice' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <FileText className="w-4 h-4" /> {t('set.tab_invoice')}
          </button>
          <button onClick={() => setActiveTab('database')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'database' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <Terminal className="w-4 h-4" /> Cloud Setup {sysHealth && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
          </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        
        {activeTab === 'database' && (
            <div className="space-y-6 animate-in fade-in">
                
                {/* Status Bar */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${connectionStatus === 'SUCCESS' ? 'bg-green-100 text-green-600' : connectionStatus === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                            <Wifi className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">Connection Status</h4>
                            <p className="text-sm text-gray-500">
                                {connectionStatus === 'SUCCESS' ? 'Connected to Supabase' : connectionStatus === 'ERROR' ? 'Connection Failed' : sysHealth ? 'Issues Detected' : 'Unknown Status'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleTestConnection} 
                        disabled={connectionStatus === 'CHECKING'}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {connectionStatus === 'CHECKING' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Test Connection
                    </button>
                </div>

                {/* Setup Instructions */}
                <div className={`border rounded-lg p-4 flex items-start gap-3 ${sysHealth ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                    <Shield className={`w-6 h-6 shrink-0 mt-1 ${sysHealth ? 'text-red-600' : 'text-blue-600'}`} />
                    <div>
                        <h4 className={`font-bold ${sysHealth ? 'text-red-800' : 'text-blue-800'}`}>
                            {sysHealth === 'PERMISSION_DENIED' ? 'Fix Permission Errors (403)' : 'Database Initialization & Auth Fixes'}
                        </h4>
                        <p className={`text-sm mt-1 ${sysHealth ? 'text-red-700' : 'text-blue-700'}`}>
                            {sysHealth 
                                ? 'The system is unable to sync because policies are blocking access. Run the SQL script below to fix permissions.' 
                                : 'Copy this script and run it in the Supabase SQL Editor. It sets up the schema and fixes "Error 500" when adding users.'}
                        </p>
                    </div>
                </div>

                {/* SQL Code Block */}
                <div className="relative">
                    <div className="absolute top-2 right-2 z-10">
                        <button onClick={copySQL} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                            <Copy className="w-3 h-3" /> Copy SQL Script
                        </button>
                    </div>
                    <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto font-mono h-96 border border-slate-700 shadow-inner relative">
                        {SQL_SCRIPT}
                    </pre>
                </div>
            </div>
        )}

        {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                    <Building2 className="w-5 h-5" /> {t('set.company_info')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.company_name')}</label>
                        <input className="w-full border p-2 rounded-lg" value={settings.companyName || ''} onChange={e => setSettings({...settings, companyName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('set.phone')}</label>
                        <input className="w-full border p-2 rounded-lg" value={settings.companyPhone || ''} onChange={e => setSettings({...settings, companyPhone: e.target.value})} />
                    </div>
                </div>
                
                <div className="mt-8 border-t pt-6">
                    <h3 className="font-bold text-gray-800 mb-4">Backup & Restore</h3>
                    <div className="flex gap-4">
                        <button onClick={handleBackup} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2">
                            <Download className="w-4 h-4" /> Backup Data
                        </button>
                        <label className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer">
                            <Upload className="w-4 h-4" /> Restore Data
                            <input type="file" className="hidden" onChange={handleRestore} />
                        </label>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700"><Save className="w-4 h-4" /> {t('set.save')}</button>
                </div>
            </div>
        )}

        {activeTab === 'invoice' && (
             <div className="space-y-6 animate-in fade-in">
                 <h3 className="font-bold text-gray-800 border-b pb-2">Invoice Template</h3>
                 <div className="flex gap-4">
                     {[1,2,3].map(i => (
                         <div key={i} onClick={() => setSettings({...settings, invoiceTemplate: String(i)})} className={`border-2 p-4 rounded cursor-pointer ${settings.invoiceTemplate == i ? 'border-blue-500 bg-blue-50' : ''}`}>
                             Template {i}
                         </div>
                     ))}
                 </div>
                 <div className="flex justify-end pt-4"><button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg"><Save className="w-4 h-4" /> Save</button></div>
             </div>
        )}
      </div>
    </div>
  );
}
