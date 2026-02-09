
import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { QueueItem } from '../types';

class SyncService {
    private isSyncing = false;

    async sync() {
        if (this.isSyncing || !isSupabaseConfigured() || !navigator.onLine) return;
        
        // 1. Authenticate
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            console.log('Sync aborted: User not logged in');
            return;
        }
        const userId = session.user.id; // This IS the company_id

        this.isSyncing = true;
        console.log(`🚀 Starting Sync for User: ${userId}`);

        try {
            const pendingItems = await db.queue.where('status').equals('PENDING').limit(20).toArray();
            
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
            let error = null;

            if (item.action_type === 'CREATE_INVOICE') {
                // Prepare Payload - Strip extraneous fields
                const inv = item.payload;
                
                // 1. Sync Customer First (Ensure FK exists)
                const customer = await db.customers.get(inv.customer_id);
                if (customer) {
                    await supabase.from('customers').upsert({
                        id: customer.id,
                        company_id: userId,
                        name: customer.name,
                        phone: customer.phone,
                        current_balance: customer.current_balance,
                        updated_at: new Date().toISOString()
                    });
                }

                // 2. Sync Invoice
                const { error: invErr } = await supabase.from('invoices').upsert({
                    id: inv.id,
                    company_id: userId,
                    invoice_number: inv.invoice_number,
                    customer_id: inv.customer_id,
                    date: inv.date,
                    total_before_discount: inv.total_before_discount,
                    total_discount: inv.total_discount,
                    net_total: inv.net_total,
                    payment_status: inv.payment_status,
                    type: inv.type,
                    updated_at: new Date().toISOString()
                });
                if (invErr) error = invErr;

                // 3. Sync Items
                if (!error && inv.items && inv.items.length > 0) {
                    const itemsPayload = inv.items.map((LineItem: any) => ({
                        id: crypto.randomUUID(),
                        company_id: userId,
                        invoice_id: inv.id,
                        product_id: LineItem.product.id,
                        batch_id: LineItem.batch.id,
                        quantity: LineItem.quantity,
                        unit_price: LineItem.unit_price || 0,
                        line_total: 0 // Calculate if needed, optional
                    }));
                    
                    // We don't stop on item error, just log it, to prevent invoice loop
                    const { error: itemsErr } = await supabase.from('invoice_items').insert(itemsPayload);
                    if (itemsErr) console.warn("Items sync warning:", itemsErr);
                }
            } 
            
            else if (item.action_type === 'UPDATE_CUSTOMER') {
                const { error: custErr } = await supabase.from('customers').upsert({
                    id: item.payload.id,
                    company_id: userId,
                    name: item.payload.name,
                    phone: item.payload.phone,
                    current_balance: item.payload.current_balance,
                    updated_at: new Date().toISOString()
                });
                error = custErr;
            }

            if (error) {
                console.error(`Supabase Refused Item ${item.id}:`, error);
                await db.queue.update(item.id!, { 
                    status: 'FAILED', 
                    error_log: JSON.stringify(error),
                    retries: (item.retries || 0) + 1 
                });
            } else {
                console.log(`✅ Item ${item.id} Synced!`);
                await db.queue.update(item.id!, { status: 'SYNCED', error_log: undefined });
            }

        } catch (e: any) {
            console.error('Local Sync Logic Error:', e);
        }
    }
}

export const syncService = new SyncService();
setInterval(() => syncService.sync(), 5000);
window.addEventListener('online', () => syncService.sync());
