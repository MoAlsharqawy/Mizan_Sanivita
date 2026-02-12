
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../services/db';
import { Loader2, Printer, Scissors } from 'lucide-react';
import { Invoice } from '../types';

export default function InvoicePrint() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!id) return;
        const inv = await db.invoices.get(id);
        const sett = await db.getSettings();
        
        if (inv) {
           const cust = await db.customers.get(inv.customer_id);
           setCustomer(cust);

           // Hydrate items with product names
           const itemsWithNames = await Promise.all(inv.items.map(async (item: any) => {
               const product = await db.products.get(item.product.id);
               return { ...item, product_name: product?.name || item.product.name || 'Unknown' };
           }));
           inv.items = itemsWithNames;
           setInvoice(inv);
        }
        
        setSettings(sett);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  useEffect(() => {
      if (!loading && invoice) {
          setTimeout(() => window.print(), 500);
      }
  }, [loading, invoice]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;
  if (!invoice) return <div className="text-center p-10 font-bold text-red-500">الفاتورة غير موجودة</div>;

  const InvoiceHalf = () => (
    <div className="w-1/2 h-full flex flex-col px-8 py-6 text-xs font-sans relative" dir="rtl">
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-4 border-b-2 border-slate-800 pb-4">
         {/* Right: Invoice Info & Customer */}
         <div className="text-right w-1/3">
            {/* Invoice Meta */}
            <div className="mb-2 space-y-1">
                <p className="font-bold text-slate-800 text-sm">رقم الفاتورة: <span className="font-mono text-base">{invoice.invoice_number}</span></p>
                <p className="font-bold text-slate-600 text-[11px]">التاريخ: <span className="font-mono">{new Date(invoice.date).toLocaleDateString('en-GB')}</span></p>
            </div>
            
            <div className="border-t border-slate-300 pt-2">
                <h3 className="font-bold text-slate-500 text-[10px] mb-1">العميل:</h3>
                <p className="font-bold text-sm text-slate-900 mb-0.5">{customer?.name || 'عميل نقدي'}</p>
                <p className="text-[10px] text-slate-600">{customer?.address || ''}</p>
                <p className="text-[10px] text-slate-600 font-mono" dir="ltr">{customer?.phone || ''}</p>
            </div>
         </div>

         {/* Center: Title */}
         <div className="text-center w-1/3 pt-4">
            <div className="inline-block border-2 border-slate-900 px-8 py-2 rounded-lg bg-slate-50">
                <h1 className="font-extrabold text-xl text-slate-900">فاتورة مبيعات</h1>
            </div>
         </div>

         {/* Left: Company */}
         <div className="text-left w-1/3 pl-2">
            <h3 className="font-bold text-base text-slate-900 leading-snug" title={settings?.companyName}>{settings?.companyName}</h3>
            <div className="text-slate-600 space-y-1 mt-2 text-[10px]">
                {settings?.companyTaxNumber && (
                    <p className="flex justify-end gap-2">
                        <span>الرقم الضريبي:</span>
                        <span className="font-mono font-bold">{settings.companyTaxNumber}</span>
                    </p>
                )}
                {settings?.companyCrNumber && (
                    <p className="flex justify-end gap-2">
                        <span>السجل التجاري:</span>
                        <span className="font-mono font-bold">{settings.companyCrNumber}</span>
                    </p>
                )}
            </div>
         </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="flex-grow">
          <table className="w-full border-collapse border border-slate-300 text-center text-[10px]">
            <thead>
                <tr className="bg-slate-100 text-slate-800 print:bg-slate-200 print:text-black">
                    <th className="border border-slate-300 py-1.5 w-8">م</th>
                    <th className="border border-slate-300 py-1.5 text-right px-2">اسم الصنف</th>
                    <th className="border border-slate-300 py-1.5 w-14">السعر</th>
                    <th className="border border-slate-300 py-1.5 w-10">الكمية</th>
                    <th className="border border-slate-300 py-1.5 w-10">بونص</th>
                    <th className="border border-slate-300 py-1.5 w-10">خصم</th>
                    <th className="border border-slate-300 py-1.5 w-16">الاجمالي</th>
                </tr>
            </thead>
            <tbody>
                {invoice.items.map((item: any, index: number) => {
                    const price = item.unit_price || item.batch?.selling_price || 0;
                    const total = (item.quantity * price) * (1 - (item.discount_percentage / 100));
                    return (
                    <tr key={index} className="border-b border-slate-200">
                        <td className="border-x border-slate-300 py-1">{index + 1}</td>
                        <td className="border-x border-slate-300 py-1 text-right px-2 font-medium truncate max-w-[120px]">{item.product_name}</td>
                        <td className="border-x border-slate-300 py-1">{Number(price).toFixed(2)}</td>
                        <td className="border-x border-slate-300 py-1 font-bold">{item.quantity}</td>
                        <td className="border-x border-slate-300 py-1">{item.bonus_quantity || '-'}</td>
                        <td className="border-x border-slate-300 py-1">{item.discount_percentage > 0 ? item.discount_percentage + '%' : '-'}</td>
                        <td className="border-x border-slate-300 py-1 font-bold">{total.toFixed(2)}</td>
                    </tr>
                )})}
                {/* Empty Rows Filler */}
                {Array.from({ length: Math.max(0, 12 - invoice.items.length) }).map((_, i) => (
                     <tr key={`empty-${i}`} className="h-6 border-b border-slate-100">
                        <td className="border-x border-slate-300"></td>
                        <td className="border-x border-slate-300"></td>
                        <td className="border-x border-slate-300"></td>
                        <td className="border-x border-slate-300"></td>
                        <td className="border-x border-slate-300"></td>
                        <td className="border-x border-slate-300"></td>
                        <td className="border-x border-slate-300"></td>
                     </tr>
                ))}
            </tbody>
          </table>
      </div>

      {/* FOOTER */}
      <div className="mt-4 border-t-2 border-slate-800 pt-2 flex items-start">
          <div className="w-1/2 pr-4">
             <p className="font-bold text-slate-700 mb-1">ملاحظات:</p>
             <div className="border border-slate-300 h-16 rounded bg-slate-50 p-2 text-[9px] text-slate-500">
                استلمت البضاعة كاملة وبحالة جيدة. البضاعة المباعة لا ترد ولا تستبدل إلا بوجود أصل الفاتورة خلال 14 يوم.
             </div>
          </div>

          <div className="w-1/2 pl-2">
              <div className="flex justify-between border-b border-slate-300 py-1">
                  <span className="text-slate-600">صافي الفاتورة:</span>
                  <span className="font-bold text-sm">{Number(invoice.net_total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-300 py-1 text-slate-600">
                  <span>الحساب السابق:</span>
                  <span>{Number(invoice.previous_balance || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 bg-slate-800 text-white px-3 rounded mt-2 print:bg-black print:text-white">
                  <span className="font-bold">الإجمالي المستحق:</span>
                  <span className="font-bold text-base">{Number(invoice.final_balance || invoice.net_total).toFixed(2)}</span>
              </div>
          </div>
      </div>

      {/* BOTTOM FOOTER */}
      <div className="text-center mt-6 pt-2 border-t border-slate-200 text-[9px] text-slate-500">
          {settings?.companyAddress} {settings?.companyPhone && ` - هاتف: ${settings.companyPhone}`}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-100 min-h-screen p-8 print:p-0 font-sans">
      {/* Print Button (Hidden in Print) */}
      <div className="fixed top-6 left-6 z-50 print:hidden flex gap-2">
         <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold transition-all hover:scale-105">
            <Printer className="w-5 h-5" /> طباعة الآن
         </button>
         <button onClick={() => window.close()} className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-full shadow-xl font-bold transition-all">
            إغلاق
         </button>
      </div>

      {/* A4 Landscape Container */}
      <div className="mx-auto bg-white shadow-2xl print:shadow-none flex flex-row overflow-hidden relative" 
           style={{ width: '297mm', height: '210mm' }}>
        
        {/* Right Half (Original) */}
        <InvoiceHalf />

        {/* Separator Line */}
        <div className="h-[90%] my-auto w-0 border-r-2 border-dashed border-slate-300 relative flex items-center justify-center">
             <div className="absolute bg-white py-2 flex flex-col items-center gap-1">
                 <Scissors className="w-4 h-4 text-slate-400 rotate-90" />
                 <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap rotate-90">قص هنا</span>
             </div>
        </div>

        {/* Left Half (Copy) */}
        <InvoiceHalf />
        
        {/* Copy Labels */}
        <div className="absolute top-2 right-2 text-[9px] text-slate-300 font-bold border border-slate-200 px-1 rounded">نسخة العميل</div>
        <div className="absolute top-2 left-2 text-[9px] text-slate-300 font-bold border border-slate-200 px-1 rounded">نسخة الحفظ</div>

      </div>

      <style>{`
        @media print {
          @page { 
            size: landscape; 
            margin: 0; 
          }
          body { 
            background: white; 
            -webkit-print-color-adjust: exact; 
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
