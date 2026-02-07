
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
            console.warn("Sync paused: No active Supabase session.");
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
            // Handle "Duplicate key" as success to avoid loops
            if (error.message.includes('unique constraint') || error.code === '23505') {
                return true; 
            }
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

        if (error) console.error("Customer Sync Error", error);
        return !error;
    }
}

export const syncService = new SyncService();

setInterval(() => {
    syncService.sync();
}, 30000);

window.addEventListener('online', () => syncService.sync());
