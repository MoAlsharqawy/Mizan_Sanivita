
import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { QueueItem } from '../types';
import { authService } from './auth';

/**
 * The Sync Engine
 * Handles pushing local offline changes to the Supabase server.
 */

class SyncService {
    private isSyncing = false;

    // Helper to get current company ID from AUTHENTICATED session
    // In single-tenant mode, Company ID === User ID
    private async getEffectiveCompanyId(): Promise<string | null> {
        if (!supabase) return null;
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.id || null;
    }

    async sync() {
        if (this.isSyncing || !isSupabaseConfigured() || !navigator.onLine) return;
        
        // 1. Check Authentication
        const companyId = await this.getEffectiveCompanyId();
        if (!companyId) {
            console.log('Skipping sync: No active Supabase session.');
            return;
        }

        this.isSyncing = true;
        console.log('🔄 Sync Started for ID:', companyId);

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
                await this.processItem(item, companyId);
            }

        } catch (error) {
            console.error('❌ Sync Error:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async processItem(item: QueueItem, companyId: string) {
        try {
            let success = false;

            if (item.retries && item.retries > 5) {
                await db.queue.update(item.id!, { status: 'FAILED', error_log: 'Max retries exceeded' });
                return;
            }

            if (item.action_type === 'CREATE_INVOICE') {
                success = await this.pushInvoiceDirect(item.payload, companyId);
            } else if (item.action_type === 'UPDATE_CUSTOMER') {
                success = await this.pushCustomerUpdate(item.payload, companyId);
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

    // Direct Table Insertion Strategy (Bypassing complex RPCs for single-tenant reliability)
    private async pushInvoiceDirect(invoice: any, companyId: string, isRetry = false): Promise<boolean> {
        if (!supabase) return false;
        
        // 1. Upsert Invoice
        const { error: invError } = await supabase.from('invoices').upsert({
            id: invoice.id,
            company_id: companyId, // FORCE INJECT REAL ID
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
             // Handle Missing Profile / Permission Error (RLS)
             if ((invError.code === '42501' || invError.message.includes('profiles')) && !isRetry) {
                 console.warn("Permission Error (RLS). Attempting to repair account profile...");
                 const { data: { user } } = await supabase.auth.getUser();
                 if (user && user.email) {
                     await authService.ensureAccountSetup(user.id, user.email);
                     // Retry once
                     return this.pushInvoiceDirect(invoice, companyId, true);
                 }
             }

             // Catch FK error (Missing Customer)
             if (invError.code === '23503') {
                 console.warn("Direct Insert FK Error. Retrying customer sync...");
                 const localCustomer = await db.customers.get(invoice.customer_id);
                 if (localCustomer && await this.pushCustomerUpdate(localCustomer, companyId)) {
                     // Retry self
                     return this.pushInvoiceDirect(invoice, companyId, true);
                 }
             }
             console.error('Direct Sync Invoice Error', invError);
             return false;
        }

        // 2. Upsert Items (Delete old items first to handle updates purely)
        await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
        
        const itemsPayload = invoice.items.map((item: any) => ({
            id: crypto.randomUUID(),
            company_id: companyId, // FORCE INJECT REAL ID
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

    private async pushCustomerUpdate(customer: any, companyId: string): Promise<boolean> {
        if (!supabase) return false;
        
        const { error } = await supabase
            .from('customers')
            .upsert({
                id: customer.id,
                company_id: companyId, // FORCE INJECT REAL ID
                name: customer.name,
                phone: customer.phone,
                current_balance: customer.current_balance,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error("Customer Sync Error", error);
            // Auto repair profile if RLS fails here too
            if (error.code === '42501') {
                 const { data: { user } } = await supabase.auth.getUser();
                 if (user && user.email) await authService.ensureAccountSetup(user.id, user.email);
            }
            return false;
        }
        return true;
    }
}

export const syncService = new SyncService();

// Aggressive sync interval
setInterval(() => {
    syncService.sync();
}, 10000);

window.addEventListener('online', () => syncService.sync());
