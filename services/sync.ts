
import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { QueueItem } from '../types';

/**
 * The Sync Engine
 * Handles pushing local offline changes to the Supabase server.
 */

class SyncService {
    private isSyncing = false;

    async sync() {
        if (this.isSyncing || !isSupabaseConfigured() || !navigator.onLine) return;
        
        // CRITICAL CHECK: Do we have a valid session?
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return;
        }

        // Check if local user has company_id before trying to sync to avoid RPC errors
        const userStr = localStorage.getItem('user');
        if (!userStr) return;
        const user = JSON.parse(userStr);
        if (!user.company_id) {
            // User is logged in but profile/company setup isn't complete on local device yet
            return;
        }

        this.isSyncing = true;
        console.log('🔄 Sync Started...');

        try {
            // 1. Get Pending Items
            const pendingItems = await db.queue
                .where('status')
                .equals('PENDING')
                .limit(50) 
                .toArray();

            if (pendingItems.length === 0) {
                this.isSyncing = false;
                return;
            }

            // 2. Process Items
            for (const item of pendingItems) {
                await this.processItem(item);
            }

        } catch (error) {
            console.error('❌ Sync Error:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async processItem(item: QueueItem) {
        try {
            let success = false;

            // Simple exponential backoff or retry limit check
            if (item.retries && item.retries > 5) {
                await db.queue.update(item.id!, { status: 'FAILED', error_log: 'Max retries exceeded' });
                return;
            }

            if (item.action_type === 'CREATE_INVOICE') {
                success = await this.pushInvoice(item.payload);
            } else if (item.action_type === 'UPDATE_CUSTOMER') {
                success = await this.pushCustomerUpdate(item.payload);
            }

            if (success) {
                await db.queue.update(item.id!, { status: 'SYNCED' });
            } else {
                await db.queue.update(item.id!, { 
                    retries: (item.retries || 0) + 1,
                });
            }

        } catch (err: any) {
            console.error(`Failed to process queue item ${item.id}:`, err);
            await db.queue.update(item.id!, { 
                error_log: err.message || 'Unknown error',
                retries: (item.retries || 0) + 1
            });
        }
    }

    private async pushInvoice(invoice: any): Promise<boolean> {
        if (!supabase) return false;

        const payload = {
            p_invoice_id: invoice.id,
            p_customer_id: invoice.customer_id,
            p_invoice_number: invoice.invoice_number,
            p_date: invoice.date,
            p_type: invoice.type,
            p_net_total: invoice.net_total,
            p_items: invoice.items.map((item: any) => ({
                product_id: item.product.id,
                batch_id: item.batch.id,
                quantity: item.quantity,
                bonus_quantity: item.bonus_quantity,
                unit_price: item.unit_price || item.batch.selling_price,
                discount_percentage: item.discount_percentage,
                total: (item.quantity * (item.unit_price || item.batch.selling_price)) * (1 - (item.discount_percentage/100))
            }))
        };

        const { error } = await supabase.rpc('sync_invoice_transaction', payload);

        if (error) {
            console.error('RPC Error:', error);

            // --- HANDLING 1: Foreign Key Violation (Missing Customer) ---
            // Code 23503: insert or update on table "invoices" violates foreign key constraint
            if (error.code === '23503') {
                console.warn(`Sync failed due to missing dependency (Customer: ${invoice.customer_id}). Attempting JIT sync...`);
                
                // 1. Fetch Customer from Local DB
                const localCustomer = await db.customers.get(invoice.customer_id);
                
                if (localCustomer) {
                    // 2. Force Sync Customer
                    const custSuccess = await this.pushCustomerUpdate(localCustomer);
                    
                    if (custSuccess) {
                        console.log("JIT Customer Sync Successful. Retrying Invoice Sync...");
                        // 3. Recursive Retry (One level deep effectively)
                        return this.pushInvoice(invoice);
                    }
                } else {
                    console.error("Critical: Referenced customer not found in local DB.");
                }
                return false; // Fail this attempt so it retries later
            }
            
            // --- HANDLING 2: Idempotency (Duplicates) ---
            // Code 23505: Duplicate Key
            // We treat this as success to unblock queue
            if (
                error.code === '23505' || 
                error.message?.toLowerCase().includes('unique') || 
                error.message?.toLowerCase().includes('duplicate')
            ) {
                console.warn(`Sync for invoice ${invoice.invoice_number} treated as success (Duplicate/Idempotent).`);
                return true; 
            }

            // --- HANDLING 3: Missing RPC Function ---
            // Code PGRST202: Function not found
            // Fallback to direct table inserts
            if (
                error.code === 'PGRST202' || 
                error.message?.includes('function not found') || 
                (error as any).status === 404
            ) {
                console.warn('Backend RPC missing. Attempting direct table insert fallback...');
                return this.pushInvoiceDirect(invoice);
            }

            return false;
        }

        return true;
    }

    // Fallback method for direct table insertion
    private async pushInvoiceDirect(invoice: any): Promise<boolean> {
        if (!supabase) return false;
        
        // 1. Upsert Invoice
        const { error: invError } = await supabase.from('invoices').upsert({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            customer_id: invoice.customer_id,
            date: invoice.date,
            total_before_discount: invoice.total_before_discount,
            total_discount: invoice.total_discount,
            net_total: invoice.net_total,
            payment_status: invoice.payment_status,
            type: invoice.type,
            updated_at: new Date().toISOString()
        });
        
        if (invError) {
             // Catch FK error here too for direct insert
             if (invError.code === '23503') {
                 console.warn("Direct Insert FK Error. Retrying customer sync...");
                 const localCustomer = await db.customers.get(invoice.customer_id);
                 if (localCustomer && await this.pushCustomerUpdate(localCustomer)) {
                     return this.pushInvoiceDirect(invoice);
                 }
             }
             console.error('Direct Sync Invoice Error', invError);
             return false;
        }

        // 2. Upsert Items
        // First clean up existing items for this invoice to prevent duplicates/orphans on update
        await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
        
        const itemsPayload = invoice.items.map((item: any) => ({
            invoice_id: invoice.id,
            product_id: item.product.id,
            batch_id: item.batch.id,
            quantity: item.quantity,
            bonus_quantity: item.bonus_quantity,
            unit_price: item.unit_price || item.batch.selling_price,
            discount_percentage: item.discount_percentage,
            line_total: (item.quantity * (item.unit_price || item.batch.selling_price)) * (1 - (item.discount_percentage/100))
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsPayload);
        
        if (itemsError) {
            console.error('Direct Sync Items Error', itemsError);
            return false;
        }

        return true;
    }

    private async pushCustomerUpdate(customer: any): Promise<boolean> {
        if (!supabase) return false;
        
        // This relies on RLS policies allowing update to own company customers
        const { error } = await supabase
            .from('customers')
            .upsert({
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                current_balance: customer.current_balance,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error("Customer Sync Error", error);
            return false;
        }
        return true;
    }
}

export const syncService = new SyncService();

setInterval(() => {
    syncService.sync();
}, 30000);

window.addEventListener('online', () => syncService.sync());
