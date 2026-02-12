
import React, { useState, useEffect } from 'react';
import { db, SystemSettings } from '../services/db'; // Ensure paths are correct based on your structure
import { supabase } from '../services/supabase';
import { 
  Save, Building2, FileText, Settings as SettingsIcon, 
  Wifi, Shield, Database, Download, Upload, 
  Trash2, Monitor, Printer, Globe, CreditCard, 
  CheckCircle2, AlertTriangle, RefreshCw, Copy, 
  ChevronRight, LayoutDashboard, Terminal 
} from 'lucide-react';

// --- SQL SCRIPT (Preserved for System Health) ---
const SQL_SCRIPT = `
-- ⚡ MIZAN ONLINE: ULTIMATE FIX SCRIPT (v4 - Atomic Transactions)
-- Run this in Supabase SQL Editor.

-- 1. CLEANUP
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.upsert_full_invoice;

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

-- 2. EXTENSIONS
create extension if not exists moddatetime schema extensions;

-- 3. TABLES CREATION
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

create table public.warehouses (
  id uuid primary key,
  company_id uuid not null,
  name text,
  is_default boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.representatives (
  id uuid primary key,
  company_id uuid not null,
  code text,
  name text,
  phone text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

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

create table public.products (
  id text not null,
  company_id uuid not null,
  code text,
  name text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (id, company_id)
);

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

create table public.deals (
  id uuid primary key,
  company_id uuid not null,
  doctor_name text,
  representative_code text,
  cycles jsonb,
  customer_ids jsonb,
  created_at timestamp with time zone
);

create table public.activity_logs (
  id uuid primary key,
  company_id uuid not null,
  user_id text,
  user_name text,
  action text,
  entity text,
  details text,
  timestamp timestamp with time zone
);

-- 4. SECURITY & PERMISSIONS
alter table settings enable row level security;
alter table warehouses enable row level security;
alter table representatives enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table products enable row level security;
alter table batches enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table purchase_invoices enable row level security;
alter table cash_transactions enable row level security;
alter table deals enable row level security;
alter table activity_logs enable row level security;

create policy "Enable All" on settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on warehouses for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on representatives for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on suppliers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on customers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on batches for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on invoice_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on purchase_invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on cash_transactions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on deals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Enable All" on activity_logs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. ATOMIC INVOICE UPSERT FUNCTION (RPC)
-- This ensures invoice header + items are saved together or failed together.
CREATE OR REPLACE FUNCTION upsert_full_invoice(invoice_data jsonb, items_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Upsert Header
  INSERT INTO invoices (
    id, company_id, invoice_number, customer_id, date, 
    total_before_discount, total_discount, net_total, 
    payment_status, type, updated_at
  ) VALUES (
    (invoice_data->>'id')::uuid,
    (invoice_data->>'company_id')::uuid,
    invoice_data->>'invoice_number',
    (invoice_data->>'customer_id')::uuid,
    (invoice_data->>'date')::timestamptz,
    (invoice_data->>'total_before_discount')::numeric,
    (invoice_data->>'total_discount')::numeric,
    (invoice_data->>'net_total')::numeric,
    invoice_data->>'payment_status',
    invoice_data->>'type',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    total_before_discount = EXCLUDED.total_before_discount,
    total_discount = EXCLUDED.total_discount,
    net_total = EXCLUDED.net_total,
    payment_status = EXCLUDED.payment_status,
    updated_at = now();

  -- 2. Delete existing items for this invoice (to handle updates cleanly)
  DELETE FROM invoice_items WHERE invoice_id = (invoice_data->>'id')::uuid;

  -- 3. Insert new items from JSON array
  IF jsonb_array_length(items_data) > 0 THEN
    INSERT INTO invoice_items (
      id, company_id, invoice_id, product_id, batch_id, 
      quantity, bonus_quantity, unit_price, discount_percentage, line_total
    )
    SELECT 
      (x->>'id')::uuid,
      (x->>'company_id')::uuid,
      (x->>'invoice_id')::uuid,
      x->>'product_id',
      x->>'batch_id',
      (x->>'quantity')::numeric,
      COALESCE((x->>'bonus_quantity')::numeric, 0),
      (x->>'unit_price')::numeric,
      COALESCE((x->>'discount_percentage')::numeric, 0),
      COALESCE((x->>'line_total')::numeric, 0)
    FROM jsonb_array_elements(items_data) x;
  END IF;
END;
$$;

-- 6. TRIGGERS
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

-- 7. STORAGE
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;
drop policy if exists "Logos Public" on storage.objects;
drop policy if exists "Logos Upload" on storage.objects;
create policy "Logos Public" on storage.objects for select using ( bucket_id = 'logos' );
create policy "Logos Upload" on storage.objects for insert with check ( bucket_id = 'logos' );
`;

// Types for UI Sections
type SettingsSection = 'general' | 'preferences' | 'invoice' | 'data' | 'system';

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [settings, setSettings] = useState<SystemSettings | any>({});
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'CHECKING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [sysHealth, setSysHealth] = useState<string | null>(null);

  // Load Settings on Mount
  useEffect(() => {
    const loadData = async () => {
      const data = await db.getSettings();
      setSettings(data);
      const health = localStorage.getItem('SYS_HEALTH');
      setSysHealth(health);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await db.updateSettings(settings);
      // Simulate network delay for UX
      setTimeout(() => {
        setLoading(false);
        alert("✅ تم حفظ الإعدادات بنجاح");
      }, 800);
    } catch (e) {
      setLoading(false);
      alert("❌ حدث خطأ أثناء الحفظ");
    }
  };

  const handleTestConnection = async () => {
      if (!supabase) { alert("Supabase not configured!"); return; }
      setConnectionStatus('CHECKING');
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Not logged in.");
          const { error } = await supabase.from('settings').select('company_id').limit(1);
          if (error) {
              if (error.code === '42P01') throw new Error("Tables Missing (42P01). Run SQL.");
              if (error.code === '42501') throw new Error("Permission Denied (403). Run SQL.");
              throw error;
          }
          
          setConnectionStatus('SUCCESS');
          localStorage.removeItem('SYS_HEALTH');
          setSysHealth(null);
      } catch (e: any) {
          setConnectionStatus('ERROR');
          alert(`Connection Error: ${e.message || 'Unknown error'}`);
      }
  };

  // --- UI COMPONENTS ---

  const SidebarItem = ({ id, icon: Icon, label, danger = false }: any) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all mb-1
        ${activeSection === id 
          ? (danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200') 
          : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
      <Icon className={`w-5 h-5 ${activeSection === id ? (danger ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'}`} />
      {label}
      {activeSection === id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50/50 gap-6 p-6">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-6">
          <div className="mb-6 px-2">
            <h2 className="text-xl font-bold text-gray-800">الإعدادات</h2>
            <p className="text-xs text-gray-500 mt-1">إدارة النظام والتفضيلات</p>
          </div>
          
          <nav className="space-y-1">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2 mt-2">عام</div>
            <SidebarItem id="general" icon={Building2} label="معلومات الشركة" />
            <SidebarItem id="preferences" icon={Monitor} label="المظهر واللغة" />
            
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2 mt-6">المبيعات</div>
            <SidebarItem id="invoice" icon={FileText} label="قوالب الفواتير" />
            
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2 mt-6">النظام</div>
            <SidebarItem id="system" icon={Terminal} label="الربط السحابي" />
            <SidebarItem id="data" icon={Database} label="النسخ الاحتياطي" danger />
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
          
          {/* Header */}
          <div className="border-b px-8 py-6 flex justify-between items-center bg-white rounded-t-2xl">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeSection === 'general' && 'معلومات الشركة'}
                {activeSection === 'preferences' && 'تفضيلات النظام'}
                {activeSection === 'invoice' && 'إعدادات الفواتير'}
                {activeSection === 'data' && 'إدارة البيانات'}
                {activeSection === 'system' && 'حالة النظام والسحابة'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">قم بتعديل وتخصيص إعدادات التطبيق الخاصة بك</p>
            </div>
            
            {activeSection !== 'system' && activeSection !== 'data' && (
              <button 
                onClick={handleSave} 
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-md shadow-blue-200 transition-all active:scale-95 disabled:opacity-70"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التغييرات
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-8">
            
            {/* --- 1. GENERAL --- */}
            {activeSection === 'general' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Logo Section */}
                <div className="flex items-start gap-6 pb-8 border-b border-gray-100">
                  <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400">
                    {settings.companyLogo ? (
                       <img src={settings.companyLogo} className="w-full h-full object-contain rounded-2xl" />
                    ) : (
                       <Building2 className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">شعار الشركة</h3>
                    <p className="text-sm text-gray-500 mb-3">يظهر هذا الشعار في ترويسة الفواتير والتقارير.</p>
                    <div className="flex gap-3">
                      <button className="text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
                        رفع صورة جديدة
                      </button>
                      {settings.companyLogo && (
                        <button className="text-sm text-red-600 hover:text-red-700 px-2">حذف</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">اسم الشركة / المتجر</label>
                    <input 
                      type="text" 
                      value={settings.companyName || ''}
                      onChange={e => setSettings({...settings, companyName: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                      placeholder="مثال: مؤسسة الميزان التجارية"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">رقم الهاتف الرسمي</label>
                    <input 
                      type="text" 
                      value={settings.companyPhone || ''}
                      onChange={e => setSettings({...settings, companyPhone: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">العنوان التفصيلي</label>
                    <textarea 
                      rows={2}
                      value={settings.companyAddress || ''}
                      onChange={e => setSettings({...settings, companyAddress: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">الرقم الضريبي</label>
                    <input 
                      type="text" 
                      value={settings.companyTaxNumber || ''}
                      onChange={e => setSettings({...settings, companyTaxNumber: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- 2. PREFERENCES --- */}
            {activeSection === 'preferences' && (
               <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3 mb-4">
                            <Globe className="w-5 h-5 text-purple-600" />
                            <h3 className="font-semibold text-gray-900">اللغة والعملة</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">لغة الواجهة</label>
                                <select className="w-full p-2 rounded border bg-white">
                                    <option value="ar">العربية</option>
                                    <option value="en">English (Coming Soon)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">العملة الافتراضية</label>
                                <input 
                                  value={settings.currency || 'ج.م'} 
                                  onChange={e => setSettings({...settings, currency: e.target.value})}
                                  className="w-full p-2 rounded border bg-white" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3 mb-4">
                            <Printer className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-semibold text-gray-900">إعدادات الطباعة</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">حجم الورق الافتراضي</label>
                                <div className="flex gap-2">
                                    {['A4', 'A5', 'THERMAL'].map(size => (
                                        <button 
                                            key={size}
                                            onClick={() => setSettings({...settings, printerPaperSize: size})}
                                            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${settings.printerPaperSize === size ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                  </div>
               </div>
            )}

            {/* --- 3. INVOICE --- */}
            {activeSection === 'invoice' && (
              <div className="animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    {id: '1', name: 'الكلاسيكي', color: 'bg-blue-50 border-blue-200'},
                    {id: '2', name: 'المودرن', color: 'bg-emerald-50 border-emerald-200'},
                    {id: '3', name: 'الحراري', color: 'bg-orange-50 border-orange-200'}
                  ].map((tpl) => (
                    <div 
                      key={tpl.id}
                      onClick={() => setSettings({...settings, invoiceTemplate: tpl.id})}
                      className={`relative cursor-pointer group rounded-xl border-2 transition-all duration-300 p-6 flex flex-col items-center gap-4 hover:shadow-lg
                        ${settings.invoiceTemplate === tpl.id ? `border-blue-600 ring-2 ring-blue-100 ${tpl.color}` : 'border-gray-200 bg-white hover:border-gray-300'}
                      `}
                    >
                      <div className="w-24 h-32 bg-white rounded shadow-sm border border-gray-200 flex flex-col p-2 gap-1 items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                         {/* Mock Preview Lines */}
                         <div className="w-full h-2 bg-gray-200 rounded-full" />
                         <div className="w-2/3 h-2 bg-gray-200 rounded-full" />
                         <div className="w-full mt-4 h-12 bg-gray-100 rounded" />
                      </div>
                      <div className="text-center">
                        <h4 className={`font-bold ${settings.invoiceTemplate === tpl.id ? 'text-blue-800' : 'text-gray-600'}`}>{tpl.name}</h4>
                        {settings.invoiceTemplate === tpl.id && <span className="text-xs text-blue-600 font-medium">نشط حالياً</span>}
                      </div>
                      
                      {settings.invoiceTemplate === tpl.id && (
                        <div className="absolute top-3 right-3 bg-blue-600 text-white p-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- 4. DATA MANAGEMENT --- */}
            {activeSection === 'data' && (
              <div className="space-y-6 animate-in fade-in">
                
                <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between shadow-sm">
                   <div className="flex gap-4 items-center">
                      <div className="p-3 bg-green-100 text-green-700 rounded-lg"><Download className="w-6 h-6" /></div>
                      <div>
                        <h4 className="font-bold text-gray-900">تصدير قاعدة البيانات (Backup)</h4>
                        <p className="text-sm text-gray-500">حفظ نسخة احتياطية من جميع بياناتك محلياً.</p>
                      </div>
                   </div>
                   <button 
                     onClick={async () => {
                        const data = await db.exportDatabase();
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `mizan_backup_${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                     }}
                     className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                   >
                     تحميل النسخة
                   </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between shadow-sm">
                   <div className="flex gap-4 items-center">
                      <div className="p-3 bg-blue-100 text-blue-700 rounded-lg"><Upload className="w-6 h-6" /></div>
                      <div>
                        <h4 className="font-bold text-gray-900">استعادة البيانات (Restore)</h4>
                        <p className="text-sm text-gray-500">استرجاع البيانات من ملف JSON سابق.</p>
                      </div>
                   </div>
                   <label className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium cursor-pointer">
                     رفع ملف
                     <input type="file" className="hidden" onChange={(e) => {
                        if(e.target.files && e.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                                if(confirm("سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟")) {
                                    await db.importDatabase(ev.target?.result as string);
                                    window.location.reload();
                                }
                            };
                            reader.readAsText(e.target.files[0]);
                        }
                     }} />
                   </label>
                </div>

                <div className="mt-8 pt-8 border-t border-red-100">
                  <h3 className="text-red-700 font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> منطقة الخطر
                  </h3>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-red-900">تصفير النظام بالكامل</h4>
                      <p className="text-sm text-red-700 mt-1">سيتم حذف جميع الفواتير، المنتجات، والعملاء من هذا الجهاز. لا يمكن التراجع عن هذا الإجراء.</p>
                    </div>
                    <button 
                       onClick={async () => {
                           if(confirm("تحذير نهائي: هل أنت متأكد من حذف كل شيء؟")) {
                               await db.resetDatabase();
                           }
                       }}
                       className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-sm whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4 inline-block ml-2" />
                      حذف كل البيانات
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- 5. SYSTEM & CLOUD --- */}
            {activeSection === 'system' && (
               <div className="space-y-6 animate-in fade-in">
                  
                  {/* Status Card */}
                  <div className={`rounded-xl border p-6 flex items-center justify-between
                      ${connectionStatus === 'SUCCESS' ? 'bg-green-50 border-green-200' : 
                        connectionStatus === 'ERROR' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${connectionStatus === 'SUCCESS' ? 'bg-green-200 text-green-700' : 'bg-white text-gray-500'}`}>
                              <Wifi className="w-6 h-6" />
                          </div>
                          <div>
                              <h3 className="font-bold text-gray-900">حالة الاتصال بالسيرفر</h3>
                              <p className="text-sm text-gray-600">
                                  {connectionStatus === 'SUCCESS' ? 'متصل بنجاح بقاعدة البيانات' : 
                                   connectionStatus === 'ERROR' ? 'فشل الاتصال - تأكد من الإنترنت أو الإعدادات' : 'لم يتم التحقق بعد'}
                              </p>
                          </div>
                      </div>
                      <button onClick={handleTestConnection} disabled={connectionStatus === 'CHECKING'} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50">
                          {connectionStatus === 'CHECKING' ? 'جاري الفحص...' : 'فحص الاتصال'}
                      </button>
                  </div>

                  {/* Fix Script Widget */}
                  <div className="bg-slate-900 rounded-xl overflow-hidden text-slate-300 shadow-xl">
                      <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-slate-700">
                          <div className="flex items-center gap-3">
                              <Terminal className="w-5 h-5 text-emerald-400" />
                              <span className="font-mono font-bold text-white">System Repair Script (v4)</span>
                          </div>
                          <button 
                            onClick={() => {
                                navigator.clipboard.writeText(SQL_SCRIPT);
                                alert("تم نسخ الكود! توجه إلى Supabase > SQL Editor لتنفيذه.");
                            }}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                          >
                              <Copy className="w-3 h-3" /> نسخ الكود
                          </button>
                      </div>
                      <div className="p-6">
                          <p className="text-sm text-slate-400 mb-4">
                              استخدم هذا السكربت لإصلاح مشاكل الصلاحيات (Permission Denied) أو الجداول المفقودة.
                              <br />
                              <span className="text-yellow-500 font-bold">تنبيه:</span> سيقوم هذا السكربت بإعادة هيكلة قاعدة البيانات السحابية.
                          </p>
                          <div className="relative group">
                              <pre className="h-48 overflow-y-auto text-xs font-mono bg-black/30 p-4 rounded border border-slate-700">
                                  {SQL_SCRIPT}
                              </pre>
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none" />
                          </div>
                      </div>
                  </div>

               </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
