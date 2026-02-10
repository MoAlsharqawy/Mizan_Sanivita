
import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { QueueItem } from '../types';

class SyncService {
    private isSyncing = false;

    async sync() {
        if (this.isSyncing || !isSupabaseConfigured() || !navigator.onLine) return;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            return;
        }
        const userId = session.user.id; 

        this.isSyncing = true;
        
        try {
            const pendingItems = await db.queue.where('status').equals('PENDING').limit(50).toArray();
            
            for (const item of pendingItems) {
                await this.processItem(item, userId);
            }

        } catch (error) {
            console.error('❌ CRITICAL SYNC ERROR:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async processItem(item: QueueItem, userId: string) {
        try {
            let error: any = null;
            const payload = item.payload;

            // --- PRODUCTS ---
            if (item.action_type === 'CREATE_PRODUCT' || item.action_type === 'UPDATE_PRODUCT') {
                const { error: err } = await supabase.from('products').upsert({
                    id: payload.id,
                    company_id: userId,
                    code: payload.code,
                    name: payload.name,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }
            
            // --- BATCHES ---
            else if (item.action_type === 'CREATE_BATCH' || item.action_type === 'ADJUST_STOCK') {
                // ADJUST_STOCK payload might be { batchId, quantity }. If so, fetch full batch from DB first.
                let batchData = payload;
                if (item.action_type === 'ADJUST_STOCK') {
                    const localBatch = await db.batches.get(payload.batchId);
                    if(localBatch) batchData = localBatch;
                    else return; // Batch missing? Skip
                }

                const { error: err } = await supabase.from('batches').upsert({
                    id: batchData.id,
                    company_id: userId,
                    product_id: batchData.product_id,
                    warehouse_id: batchData.warehouse_id,
                    batch_number: batchData.batch_number,
                    quantity: batchData.quantity,
                    purchase_price: batchData.purchase_price,
                    selling_price: batchData.selling_price,
                    expiry_date: batchData.expiry_date,
                    status: batchData.status,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- CUSTOMERS ---
            else if (item.action_type === 'CREATE_CUSTOMER' || item.action_type === 'UPDATE_CUSTOMER') {
                const { error: err } = await supabase.from('customers').upsert({
                    id: payload.id,
                    company_id: userId,
                    code: payload.code,
                    name: payload.name,
                    phone: payload.phone,
                    address: payload.address,
                    area: payload.area,
                    representative_code: payload.representative_code,
                    current_balance: payload.current_balance,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- SUPPLIERS ---
            else if (item.action_type === 'CREATE_SUPPLIER') {
                const { error: err } = await supabase.from('suppliers').upsert({
                    id: payload.id,
                    company_id: userId,
                    code: payload.code,
                    name: payload.name,
                    phone: payload.phone,
                    contact_person: payload.contact_person,
                    current_balance: payload.current_balance,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- REPRESENTATIVES ---
            else if (item.action_type === 'CREATE_REP' || item.action_type === 'UPDATE_REP') {
                const { error: err } = await supabase.from('representatives').upsert({
                    id: payload.id,
                    company_id: userId,
                    code: payload.code,
                    name: payload.name,
                    phone: payload.phone,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- WAREHOUSES ---
            else if (item.action_type === 'CREATE_WAREHOUSE') {
                const { error: err } = await supabase.from('warehouses').upsert({
                    id: payload.id,
                    company_id: userId,
                    name: payload.name,
                    is_default: payload.is_default,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- CASH TRANSACTIONS ---
            else if (item.action_type === 'CREATE_CASH_TX') {
                const { error: err } = await supabase.from('cash_transactions').upsert({
                    id: payload.id,
                    company_id: userId,
                    type: payload.type,
                    category: payload.category,
                    amount: payload.amount,
                    reference_id: payload.reference_id,
                    related_name: payload.related_name,
                    date: payload.date,
                    notes: payload.notes,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- DEALS ---
            else if (item.action_type === 'CREATE_DEAL' || item.action_type === 'UPDATE_DEAL') {
                const { error: err } = await supabase.from('deals').upsert({
                    id: payload.id,
                    company_id: userId,
                    doctor_name: payload.doctorName,
                    representative_code: payload.representativeCode,
                    customer_ids: payload.customerIds, // Supabase handles array as jsonb
                    cycles: payload.cycles, // Jsonb
                    created_at: payload.createdAt || new Date().toISOString()
                });
                error = err;
            }

            // --- SALES INVOICES ---
            else if (item.action_type === 'CREATE_INVOICE') {
                // 1. Invoice Header
                const { error: invErr } = await supabase.from('invoices').upsert({
                    id: payload.id,
                    company_id: userId,
                    invoice_number: payload.invoice_number,
                    customer_id: payload.customer_id,
                    date: payload.date,
                    total_before_discount: payload.total_before_discount,
                    total_discount: payload.total_discount,
                    net_total: payload.net_total,
                    payment_status: payload.payment_status,
                    type: payload.type,
                    updated_at: new Date().toISOString()
                });
                if (invErr) error = invErr;

                // 2. Invoice Items
                if (!error && payload.items && payload.items.length > 0) {
                    const itemsPayload = payload.items.map((LineItem: any) => ({
                        id: crypto.randomUUID(), // New ID for item row
                        company_id: userId,
                        invoice_id: payload.id,
                        product_id: LineItem.product.id,
                        batch_id: LineItem.batch.id,
                        quantity: LineItem.quantity,
                        bonus_quantity: LineItem.bonus_quantity || 0,
                        unit_price: LineItem.unit_price || 0,
                        discount_percentage: LineItem.discount_percentage || 0,
                        line_total: 0 // Calculated on DB or view
                    }));
                    
                    const { error: itemsErr } = await supabase.from('invoice_items').insert(itemsPayload);
                    if (itemsErr) console.warn("Items sync warning:", itemsErr);
                }
            } 
            
            // --- PURCHASE INVOICES ---
            else if (item.action_type === 'CREATE_PURCHASE') {
                const { error: err } = await supabase.from('purchase_invoices').upsert({
                    id: payload.id,
                    company_id: userId,
                    invoice_number: payload.invoice_number,
                    supplier_id: payload.supplier_id,
                    date: payload.date,
                    total_amount: payload.total_amount,
                    paid_amount: payload.paid_amount,
                    type: payload.type,
                    items: payload.items, // JSONB
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            else if (item.action_type === 'UPDATE_SETTINGS') {
                const { error: err } = await supabase.from('settings').upsert({
                    company_id: userId,
                    company_name: payload.companyName,
                    company_address: payload.companyAddress,
                    company_phone: payload.companyPhone,
                    tax_number: payload.companyTaxNumber,
                    currency: payload.currency,
                    logo_url: payload.companyLogo,
                    invoice_template: payload.invoiceTemplate,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- ERROR HANDLING ---
            if (error) {
                console.error(`Sync Failed for ${item.action_type}:`, error);
                
                if (error.code === '42P01') { // Missing Tables
                    localStorage.setItem('SYS_HEALTH', 'MISSING_TABLES');
                    window.dispatchEvent(new Event('sys-health-change'));
                } else if (error.code === '42501') { // RLS / Permission
                    localStorage.setItem('SYS_HEALTH', 'PERMISSION_DENIED');
                    window.dispatchEvent(new Event('sys-health-change'));
                }

                await db.queue.update(item.id!, { 
                    status: 'FAILED', 
                    error_log: JSON.stringify(error),
                    retries: (item.retries || 0) + 1 
                });
            } else {
                console.log(`✅ Synced: ${item.action_type}`);
                if (localStorage.getItem('SYS_HEALTH')) {
                    localStorage.removeItem('SYS_HEALTH');
                    window.dispatchEvent(new Event('sys-health-change'));
                }
                await db.queue.update(item.id!, { status: 'SYNCED', error_log: undefined });
            }

        } catch (e: any) {
            console.error('Local Sync Logic Error:', e);
        }
    }
}

export const syncService = new SyncService();
// Aggressive sync for testing
setInterval(() => syncService.sync(), 3000); 
window.addEventListener('online', () => syncService.sync());
window.addEventListener('focus', () => syncService.sync());
