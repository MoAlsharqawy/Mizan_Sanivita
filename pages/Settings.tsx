
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { authService, PERMISSIONS } from '../services/auth';
import { supabase } from '../services/supabase';
import { Save, RefreshCw, Building2, FileText, Settings as SettingsIcon, Users, Plus, Edit2, Trash2, X, Shield, Key, CheckSquare, Printer, Upload, Image as ImageIcon, Database, Download, Wrench, Copy, Terminal, Wifi, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { t } from '../utils/t';

export default function Settings() {
  const [settings, setSettings] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'general' | 'invoice' | 'users' | 'printer' | 'backup' | 'database'>('general');
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'CHECKING' | 'SUCCESS' | 'ERROR'>('IDLE');
  
  // Users Management State
  const [users, setUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ 
      id: '', name: '', username: '', password: '', role: 'USER',
      permissions: [] as string[]
  });

  // --- COMPLETE FRESH START SQL (UPDATED WITH ALL TABLES) ---
  const SQL_SCRIPT = `
-- ⚠️ تحذير: سيتم حذف جميع البيانات الحالية وإعادة البناء
-- 1. تنظيف (حذف الجداول القديمة)
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. إنشاء الجداول (Create Tables)

-- أ) المستخدمين (Profiles)
-- ملاحظة: بيانات الدخول (الإيميل والباسورد) مخزنة في جدول النظام auth.users
-- هذا الجدول (profiles) مخصص لبيانات الشركة الإضافية
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  subscription_tier text default 'free',
  updated_at timestamp with time zone
);

-- ب) الإعدادات (Settings)
create table public.settings (
  company_id uuid references auth.users(id) not null primary key,
  company_name text,
  company_address text,
  company_phone text,
  tax_number text,
  currency text default '$',
  logo_url text,
  updated_at timestamp with time zone
);

-- ج) المنتجات (Products)
-- نستخدم (id, company_id) كمفتاح مركب لأن المعرفات نصية ومحلية
create table public.products (
  id text not null, -- P1, P2 (Local ID)
  company_id uuid references auth.users(id) not null,
  code text,
  name text,
  purchase_price numeric,
  selling_price numeric,
  current_stock numeric default 0,
  updated_at timestamp with time zone,
  primary key (id, company_id)
);

-- د) العملاء (Customers)
create table public.customers (
  id uuid primary key,
  company_id uuid references auth.users(id) not null,
  name text,
  phone text,
  current_balance numeric default 0,
  updated_at timestamp with time zone
);

-- هـ) الفواتير (Invoices)
create table public.invoices (
  id uuid primary key,
  company_id uuid references auth.users(id) not null,
  invoice_number text,
  customer_id uuid references public.customers(id),
  date timestamp with time zone,
  total_before_discount numeric,
  total_discount numeric,
  net_total numeric,
  payment_status text,
  type text,
  updated_at timestamp with time zone
);

-- و) عناصر الفاتورة (Invoice Items)
create table public.invoice_items (
  id uuid primary key,
  company_id uuid references auth.users(id) not null,
  invoice_id uuid references public.invoices(id) on delete cascade,
  product_id text, -- ربط غير مباشر مع products.id
  batch_id text,
  quantity numeric,
  unit_price numeric,
  line_total numeric
);

-- 3. تفعيل الحماية (Enable RLS)
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- 4. سياسات الأمان (Access Policies)
-- السماح للمستخدم برؤية وتعديل بياناته فقط

-- Profiles
create policy "Users own profile" on profiles for all using ( auth.uid() = id );

-- Settings
create policy "Users own settings" on settings for all using ( auth.uid() = company_id );

-- Products
create policy "Users own products" on products for all using ( auth.uid() = company_id );

-- Customers
create policy "Users own customers" on customers for all using ( auth.uid() = company_id );

-- Invoices
create policy "Users own invoices" on invoices for all using ( auth.uid() = company_id );

-- Invoice Items
create policy "Users own items" on invoice_items for all using ( auth.uid() = company_id );

-- 5. التخزين (Storage)
insert into storage.buckets (id, name, public) 
values ('logos', 'logos', true) 
on conflict (id) do nothing;

drop policy if exists "Logos Public" on storage.objects;
drop policy if exists "Logos Upload" on storage.objects;

create policy "Logos Public" on storage.objects for select using ( bucket_id = 'logos' );
create policy "Logos Upload" on storage.objects for insert with check ( bucket_id = 'logos' AND auth.uid() = owner );
  `;

  useEffect(() => {
    db.getSettings().then(setSettings);
    // Auto-open Database tab if there is a sync error
    if (localStorage.getItem('SYS_HEALTH')) {
        setActiveTab('database');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
        setUsers(authService.getUsers());
    }
  }, [activeTab]);

  const handleSaveSettings = async () => {
    await db.updateSettings(settings);
    window.location.reload();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              setSettings({ ...settings, companyLogo: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  // ... (User Management Functions omitted for brevity, logic remains same)
  const handleOpenUserModal = (user?: any) => { setIsUserModalOpen(true); setUserForm(user || {id:'',name:'',username:'',password:'',role:'USER',permissions:[]}); };
  const handleSaveUser = () => { authService.saveUser(userForm); setUsers(authService.getUsers()); setIsUserModalOpen(false); };
  const handleDeleteUser = (id: string) => { authService.deleteUser(id); setUsers(authService.getUsers()); };
  const togglePermission = (permId: string) => { setUserForm(p => ({...p, permissions: p.permissions.includes(permId) ? p.permissions.filter(x=>x!==permId) : [...p.permissions, permId]})) };

  // BACKUP & RESTORE LOGIC
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
      alert("SQL Code Copied! Now paste it in Supabase SQL Editor.");
  };

  const handleTestConnection = async () => {
      if (!supabase) {
          alert("Supabase not configured!");
          return;
      }
      setConnectionStatus('CHECKING');
      try {
          // 1. Check Auth/Network
          const { data: { session }, error: authError } = await supabase.auth.getSession();
          if (authError) throw authError;
          if (!session) throw new Error("Not logged in. Please Log out and Log in again.");

          // 2. Check Database Access (RLS/Tables)
          const { error: dbError } = await supabase.from('profiles').select('*').limit(1);
          
          if (dbError) {
              if (dbError.code === '42P01') throw new Error("Connection OK, but TABLES MISSING. Please copy the SQL below and run it in Supabase.");
              if (dbError.code === '42501') throw new Error("Connection OK, but PERMISSION DENIED. Please copy the SQL below and run it in Supabase.");
              throw dbError;
          }

          setConnectionStatus('SUCCESS');
          localStorage.removeItem('SYS_HEALTH'); // Clear any old error flags
          window.dispatchEvent(new Event('sys-health-change'));
          alert("✅ Connected Successfully! Database is ready.");
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
      
      {/* TABS */}
      <div className="flex space-x-2 border-b border-gray-200 rtl:space-x-reverse overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <SettingsIcon className="w-4 h-4" /> {t('set.tab_general')}
          </button>
          <button onClick={() => setActiveTab('invoice')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'invoice' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <FileText className="w-4 h-4" /> {t('set.tab_invoice')}
          </button>
          <button onClick={() => setActiveTab('database')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'database' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <Terminal className="w-4 h-4" /> Cloud Setup
          </button>
          <button onClick={() => setActiveTab('backup')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'backup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
             <Database className="w-4 h-4" /> Backup
          </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        
        {/* DATABASE SETUP TAB (THE SOLUTION) */}
        {activeTab === 'database' && (
            <div className="space-y-6 animate-in fade-in">
                
                {/* Connection Status Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${connectionStatus === 'SUCCESS' ? 'bg-green-100 text-green-600' : connectionStatus === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                            <Wifi className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">Connection Status</h4>
                            <p className="text-sm text-gray-500">
                                {connectionStatus === 'SUCCESS' ? 'Connected to Supabase' : connectionStatus === 'ERROR' ? 'Connection Failed' : 'Unknown Status'}
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

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <Shield className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                    <div>
                        <h4 className="font-bold text-amber-800">Fresh Start SQL Script</h4>
                        <p className="text-sm text-amber-700 mt-1">
                            This script will <b>DROP ALL EXISTING TABLES</b> and recreate them correctly with <b>Products, Settings, and Profiles</b> tables.
                        </p>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute top-2 right-2">
                        <button onClick={copySQL} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 shadow-sm">
                            <Copy className="w-3 h-3" /> Copy SQL
                        </button>
                    </div>
                    <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto font-mono h-96 border border-slate-700">
                        {SQL_SCRIPT}
                    </pre>
                </div>
            </div>
        )}

        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                    <Building2 className="w-5 h-5" /> {t('set.company_info')}
                </h3>
                {/* ... (Existing General Settings Content) ... */}
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
                <div className="flex justify-end pt-4">
                    <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-blue-700"><Save className="w-4 h-4" /> {t('set.save')}</button>
                </div>
            </div>
        )}

        {/* INVOICE TAB */}
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

        {/* BACKUP TAB */}
        {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="font-bold text-gray-800 border-b pb-2">Data Management</h3>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleBackup} className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center hover:bg-blue-100">
                        <Download className="w-8 h-8 text-blue-600 mb-2" />
                        <span className="font-bold text-blue-800">Download Backup</span>
                    </button>
                    <label className="bg-amber-50 p-6 rounded-xl border border-amber-100 flex flex-col items-center hover:bg-amber-100 cursor-pointer">
                        <Upload className="w-8 h-8 text-amber-600 mb-2" />
                        <span className="font-bold text-amber-800">Restore Backup</span>
                        <input type="file" className="hidden" onChange={handleRestore} />
                    </label>
                </div>
                
                <div className="mt-8 pt-8 border-t">
                    <button onClick={() => { if(confirm('Reset all data?')) db.resetDatabase(); }} className="text-red-600 flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded"><RefreshCw className="w-4 h-4" /> Reset Database</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
