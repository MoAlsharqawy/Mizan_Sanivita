
import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { QueueItem } from '../types';

// Matches the ID in auth.ts - Enforces Single Tenant Mode
const SHARED_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

class SyncService {
    private isSyncing = false;

    async sync() {
        if (this.isSyncing || !isSupabaseConfigured() || !navigator.onLine) return;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        this.isSyncing = true;
        
        try {
            // Process queue items one by one to ensure order
            const pendingItems = await db.queue.where('status').equals('PENDING').limit(50).toArray();
            
            for (const item of pendingItems) {
                await this.processItem(item, SHARED_COMPANY_ID);
            }

        } catch (error) {
            console.error('❌ SYNC CYCLE ERROR:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async processItem(item: QueueItem, companyId: string) {
        try {
            let error: any = null;
            const payload = item.payload;

            // --- 1. SETTINGS ---
            if (item.action_type === 'UPDATE_SETTINGS') {
                const { error: err } = await supabase.from('settings').upsert({
                    company_id: companyId,
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

            // --- 2. PRODUCTS ---
            else if (item.action_type === 'CREATE_PRODUCT' || item.action_type === 'UPDATE_PRODUCT') {
                const { error: err } = await supabase.from('products').upsert({
                    id: payload.id,
                    company_id: companyId,
                    code: payload.code,
                    name: payload.name,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }
            
            // --- 3. BATCHES & STOCK ---
            else if (item.action_type === 'CREATE_BATCH' || item.action_type === 'ADJUST_STOCK') {
                let batchData = payload;
                // If it's an adjustment, we need the latest state of the batch from local DB
                if (item.action_type === 'ADJUST_STOCK') {
                    const localBatch = await db.batches.get(payload.batchId);
                    if (localBatch) batchData = localBatch;
                    else {
                        // Batch might be deleted locally? Skip.
                        await db.queue.update(item.id!, { status: 'SKIPPED' });
                        return;
                    }
                }

                const { error: err } = await supabase.from('batches').upsert({
                    id: batchData.id,
                    company_id: companyId,
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

            // --- 4. PARTNERS (Customers & Suppliers) ---
            else if (item.action_type === 'CREATE_CUSTOMER' || item.action_type === 'UPDATE_CUSTOMER') {
                const { error: err } = await supabase.from('customers').upsert({
                    id: payload.id,
                    company_id: companyId,
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
            else if (item.action_type === 'CREATE_SUPPLIER') {
                const { error: err } = await supabase.from('suppliers').upsert({
                    id: payload.id,
                    company_id: companyId,
                    code: payload.code,
                    name: payload.name,
                    phone: payload.phone,
                    contact_person: payload.contact_person,
                    current_balance: payload.current_balance,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- 5. STAFF & WAREHOUSES ---
            else if (item.action_type === 'CREATE_REP' || item.action_type === 'UPDATE_REP') {
                const { error: err } = await supabase.from('representatives').upsert({
                    id: payload.id,
                    company_id: companyId,
                    code: payload.code,
                    name: payload.name,
                    phone: payload.phone,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }
            else if (item.action_type === 'CREATE_WAREHOUSE') {
                const { error: err } = await supabase.from('warehouses').upsert({
                    id: payload.id,
                    company_id: companyId,
                    name: payload.name,
                    is_default: payload.is_default,
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- 6. TRANSACTIONS ---
            else if (item.action_type === 'CREATE_CASH_TX') {
                const { error: err } = await supabase.from('cash_transactions').upsert({
                    id: payload.id,
                    company_id: companyId,
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

            // --- 7. SALES INVOICES (COMPLEX) ---
            else if (item.action_type === 'CREATE_INVOICE') {
                // A. Insert/Update Invoice Header
                const { error: invErr } = await supabase.from('invoices').upsert({
                    id: payload.id,
                    company_id: companyId,
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
                
                if (invErr) {
                    error = invErr;
                } else if (payload.items && payload.items.length > 0) {
                    // B. Handle Invoice Items
                    // Strategy: Delete existing items for this invoice to prevent duplicates on update, then insert fresh.
                    await supabase.from('invoice_items').delete().eq('invoice_id', payload.id);

                    const itemsPayload = payload.items.map((LineItem: any) => ({
                        id: crypto.randomUUID(), // Generate new UUID for the SQL row
                        company_id: companyId,
                        invoice_id: payload.id,
                        product_id: LineItem.product.id,
                        batch_id: LineItem.batch.id,
                        quantity: LineItem.quantity,
                        bonus_quantity: LineItem.bonus_quantity || 0,
                        unit_price: LineItem.unit_price || 0,
                        discount_percentage: LineItem.discount_percentage || 0,
                        line_total: 0 // Calculated on fly usually, but schema has it
                    }));
                    
                    const { error: itemsErr } = await supabase.from('invoice_items').insert(itemsPayload);
                    if (itemsErr) {
                        console.warn("Items sync warning:", itemsErr);
                        // We don't block the whole sync if items fail, but it's risky.
                    }
                }
            } 
            
            // --- 8. PURCHASE INVOICES ---
            else if (item.action_type === 'CREATE_PURCHASE') {
                const { error: err } = await supabase.from('purchase_invoices').upsert({
                    id: payload.id,
                    company_id: companyId,
                    invoice_number: payload.invoice_number,
                    supplier_id: payload.supplier_id,
                    date: payload.date,
                    total_amount: payload.total_amount,
                    paid_amount: payload.paid_amount,
                    type: payload.type,
                    items: payload.items, // Stored as JSONB in SQL for simplicity in purchases
                    updated_at: new Date().toISOString()
                });
                error = err;
            }

            // --- 9. DEALS ---
            else if (item.action_type === 'CREATE_DEAL' || item.action_type === 'UPDATE_DEAL') {
                const { error: err } = await supabase.from('deals').upsert({
                    id: payload.id,
                    company_id: companyId,
                    doctor_name: payload.doctorName,
                    representative_code: payload.representativeCode,
                    customer_ids: payload.customerIds,
                    cycles: payload.cycles, // JSONB
                    created_at: payload.createdAt || new Date().toISOString()
                });
                error = err;
            }

            // --- ERROR HANDLING & COMPLETION ---
            if (error) {
                console.error(`❌ Sync Failed [${item.action_type}]:`, error);
                
                // Specific checks for "Table not found" or "Permission denied"
                if (error.code === '42P01') { // undefined_table
                    localStorage.setItem('SYS_HEALTH', 'MISSING_TABLES');
                    window.dispatchEvent(new Event('sys-health-change'));
                } else if (error.code === '42501') { // insufficient_privilege
                    localStorage.setItem('SYS_HEALTH', 'PERMISSION_DENIED');
                    window.dispatchEvent(new Event('sys-health-change'));
                }

                // If fatal error, mark failed and retry later
                await db.queue.update(item.id!, { 
                    status: 'FAILED', 
                    error_log: JSON.stringify(error),
                    retries: (item.retries || 0) + 1 
                });
            } else {
                console.log(`✅ Synced: ${item.action_type}`);
                
                // If we successfully synced, clear any health flags
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

// Trigger sync on load, online, and focus
setInterval(() => syncService.sync(), 5000); 
window.addEventListener('online', () => syncService.sync());
window.addEventListener('focus', () => syncService.sync());
