
import Dexie, { Table } from 'dexie';
import {
  Product,
  Batch,
  Customer,
  Supplier,
  Invoice,
  PurchaseInvoice,
  PurchaseItem,
  CashTransaction,
  BatchStatus,
  PaymentStatus,
  CashTransactionType,
  ProductWithBatches,
  CartItem,
  Representative,
  Warehouse,
  Deal,
  DealTarget,
  DealCycle,
  ActivityLog,
  QueueItem,
  SyncStatus
} from '../types';
import { authService } from './auth';

export interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyTaxNumber: string;
  companyLogo?: string;
  currency: string;
  language: string;
  invoiceTemplate: '1' | '2' | '3';
  printerPaperSize: 'A4' | 'A5' | 'THERMAL';
}

const DEFAULT_SETTINGS: SystemSettings = {
    companyName: 'Mizan Sales',
    companyAddress: 'Cairo, Egypt',
    companyPhone: '01559550481',
    companyTaxNumber: '123-456-789',
    companyLogo: '',
    currency: 'ج.م',
    language: 'ar',
    invoiceTemplate: '1',
    printerPaperSize: 'A4'
};

class MizanDatabase extends Dexie {
    products!: Table<Product>;
    batches!: Table<Batch>;
    customers!: Table<Customer>;
    suppliers!: Table<Supplier>;
    representatives!: Table<Representative>;
    warehouses!: Table<Warehouse>;
    invoices!: Table<Invoice>;
    purchaseInvoices!: Table<PurchaseInvoice>;
    cashTransactions!: Table<CashTransaction>;
    deals!: Table<Deal>;
    activityLogs!: Table<ActivityLog>;
    settings!: Table<SystemSettings & { id: string }>;
    queue!: Table<QueueItem>;

    constructor() {
        super('MizanOnlineDB');
        (this as any).version(1).stores({
            products: 'id, code, name',
            batches: 'id, product_id, warehouse_id, batch_number, status',
            customers: 'id, code, name, representative_code',
            suppliers: 'id, code, name',
            representatives: 'id, code, name',
            warehouses: 'id, name',
            invoices: 'id, invoice_number, customer_id, date, type',
            purchaseInvoices: 'id, invoice_number, supplier_id, date',
            cashTransactions: 'id, type, category, date',
            deals: 'id, representativeCode',
            activityLogs: 'id, action, entity, timestamp',
            settings: 'id',
            queue: '++id, status, client_transaction_id'
        });
        (this as any).on('populate', () => this.seedData());
    }

    private async seedData() {
        await this.warehouses.bulkAdd([
            { id: 'W1', name: 'Main Store', is_default: true },
            { id: 'W2', name: 'Van 1', is_default: false },
            { id: 'W3', name: 'Van 2', is_default: false }
        ]);

        const products = [
            { id: 'P1', code: 'P001', name: 'Paracetamol 500mg' },
            { id: 'P2', code: 'P002', name: 'Amoxicillin 250mg' },
            { id: 'P3', code: 'P003', name: 'Ibuprofen 400mg' },
            { id: 'P4', code: 'P004', name: 'Vitamin C 1000mg' },
            { id: 'P5', code: 'P005', name: 'Omeprazole 20mg' },
        ];
        await this.products.bulkAdd(products);

        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        await this.batches.bulkAdd(products.map((p, idx) => ({
            id: `B${idx}`,
            product_id: p.id,
            warehouse_id: 'W1',
            batch_number: `BATCH-${100+idx}`,
            selling_price: 10 + idx * 5,
            purchase_price: 5 + idx * 2,
            quantity: 1000,
            expiry_date: future.toISOString(),
            status: BatchStatus.ACTIVE
        })));

        await this.settings.add({ ...DEFAULT_SETTINGS, id: 'config' });
    }

    async addToQueue(actionType: string, payload: any): Promise<void> {
        await this.queue.add({
            client_transaction_id: crypto.randomUUID(),
            action_type: actionType,
            payload: payload,
            status: 'PENDING',
            created_at: new Date().toISOString(),
            retries: 0
        });
    }
    
    async clearQueue(): Promise<void> {
        await this.queue.clear();
    }

    async getSettings(): Promise<SystemSettings> {
        const conf = await this.settings.get('config');
        return conf || DEFAULT_SETTINGS;
    }

    async updateSettings(s: SystemSettings) {
        await this.settings.put({ ...s, id: 'config' });
        await this.logActivity('UPDATE', 'STOCK', 'Updated system settings');
    }

    async logActivity(action: ActivityLog['action'], entity: ActivityLog['entity'], details: string) {
        const user = authService.getCurrentUser();
        await this.activityLogs.add({
            id: crypto.randomUUID(),
            userId: user?.id || 'SYSTEM',
            userName: user?.name || 'System',
            action,
            entity,
            details,
            timestamp: new Date().toISOString()
        });
    }

    async getProductsWithBatches(): Promise<ProductWithBatches[]> {
        const products = await this.products.toArray();
        const allBatches = await this.batches.toArray();
        return products.map(p => ({
            ...p,
            batches: allBatches.filter(b => b.product_id === p.id)
        }));
    }

    async getCustomers() { return this.customers.toArray(); }
    async getSuppliers() { return this.suppliers.toArray(); }
    async getRepresentatives() { return this.representatives.toArray(); }
    async getWarehouses() { return this.warehouses.toArray(); }
    async getInvoices() { return this.invoices.orderBy('date').reverse().toArray(); }
    async getPurchaseInvoices() { return this.purchaseInvoices.orderBy('date').reverse().toArray(); }
    async getCashTransactions() { return this.cashTransactions.orderBy('date').reverse().toArray(); }
    async getDeals() { return this.deals.toArray(); }
    async getActivityLogs() { return this.activityLogs.orderBy('timestamp').reverse().limit(1000).toArray(); }

    async getCashBalance(): Promise<number> {
        const txs = await this.cashTransactions.toArray();
        return txs.reduce((acc, t) => t.type === CashTransactionType.RECEIPT ? acc + t.amount : acc - t.amount, 0);
    }

    async createInvoice(customerId: string, items: CartItem[], cashPaid: number, isReturn: boolean = false): Promise<{ success: boolean; message: string; id?: string }> {
        return (this as any).transaction('rw', [this.invoices, this.batches, this.customers, this.cashTransactions, this.activityLogs, this.queue], async () => {
            const customer = await this.customers.get(customerId);
            if (!customer) throw new Error("Customer not found");

            const id = crypto.randomUUID();
            const invoice_number = await this.generateSequence(isReturn ? 'SR' : 'S', 'invoices', 'invoice_number');
            let totalGross = 0, totalDiscount = 0;

            for (const item of items) {
                const batch = await this.batches.get(item.batch.id);
                if (!batch) throw new Error(`Batch not found: ${item.batch.batch_number}`);
                
                const totalQty = item.quantity + item.bonus_quantity;
                if (!isReturn) {
                    if (batch.quantity < totalQty) throw new Error(`Insufficient stock for ${item.product.name}`);
                    await this.batches.update(batch.id, { quantity: batch.quantity - totalQty });
                } else {
                    await this.batches.update(batch.id, { quantity: batch.quantity + totalQty });
                }

                const sellingPrice = item.unit_price !== undefined ? item.unit_price : item.batch.selling_price;
                const gross = item.quantity * sellingPrice;
                const discount = gross * (item.discount_percentage / 100);
                totalGross += gross;
                totalDiscount += discount;
            }

            const netTotal = totalGross - totalDiscount;
            const previousBalance = customer.current_balance;
            const newBalance = previousBalance + (isReturn ? -netTotal : netTotal);
            await this.customers.update(customerId, { current_balance: newBalance });

            const invoice: Invoice = {
                id, invoice_number, customer_id: customerId, date: new Date().toISOString(),
                total_before_discount: totalGross, total_discount: totalDiscount, net_total: netTotal,
                previous_balance: previousBalance, final_balance: newBalance,
                payment_status: cashPaid >= netTotal ? PaymentStatus.PAID : cashPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID,
                items, type: isReturn ? 'RETURN' : 'SALE'
            };
            await this.invoices.add(invoice);

            if (cashPaid > 0) {
                await this.addCashTransactionInternal({
                    type: isReturn ? CashTransactionType.EXPENSE : CashTransactionType.RECEIPT,
                    category: 'CUSTOMER_PAYMENT',
                    reference_id: customerId,
                    related_name: customer.name,
                    amount: cashPaid,
                    date: new Date().toISOString(),
                    notes: `${isReturn ? 'Refund' : 'Payment'} for Invoice #${invoice_number}`
                });
            }

            await this.addToQueue('CREATE_INVOICE', invoice);
            return { success: true, message: 'Saved successfully', id };
        }).catch((e: any) => ({ success: false, message: e.message }));
    }

    async createPurchaseInvoice(supplierId: string, items: PurchaseItem[], paidAmount: number, isReturn: boolean): Promise<{ success: boolean; message: string }> {
        return (this as any).transaction('rw', [this.purchaseInvoices, this.batches, this.suppliers, this.cashTransactions, this.activityLogs, this.queue], async () => {
            const supplier = await this.suppliers.get(supplierId);
            if (!supplier) throw new Error("Supplier not found");

            const id = crypto.randomUUID();
            const invoice_number = await this.generateSequence(isReturn ? 'PR' : 'P', 'purchaseInvoices', 'invoice_number');
            let totalAmount = 0;

            for (const item of items) {
                totalAmount += item.quantity * item.cost_price;
                const existingBatch = await this.batches.where({ product_id: item.product_id, warehouse_id: item.warehouse_id, batch_number: item.batch_number }).first();

                if (isReturn) {
                    if (!existingBatch || existingBatch.quantity < item.quantity) throw new Error(`Insufficient stock in batch ${item.batch_number}`);
                    await this.batches.update(existingBatch.id, { quantity: existingBatch.quantity - item.quantity });
                } else {
                    if (existingBatch) {
                        await this.batches.update(existingBatch.id, {
                            quantity: existingBatch.quantity + item.quantity,
                            purchase_price: item.cost_price,
                            selling_price: item.selling_price
                        });
                    } else {
                        await this.batches.add({
                            id: crypto.randomUUID(), product_id: item.product_id, warehouse_id: item.warehouse_id,
                            batch_number: item.batch_number, quantity: item.quantity,
                            purchase_price: item.cost_price, selling_price: item.selling_price,
                            expiry_date: item.expiry_date, status: BatchStatus.ACTIVE
                        });
                    }
                }
            }

            const invoiceEffect = isReturn ? -totalAmount : totalAmount;
            const newBalanceBeforePayment = supplier.current_balance + invoiceEffect;
            await this.suppliers.update(supplierId, { current_balance: newBalanceBeforePayment });

            if (paidAmount > 0) {
                 const type = isReturn ? CashTransactionType.RECEIPT : CashTransactionType.EXPENSE;
                 await this.addCashTransactionInternal({
                    type,
                    category: 'SUPPLIER_PAYMENT',
                    reference_id: supplierId,
                    related_name: supplier.name,
                    amount: paidAmount,
                    date: new Date().toISOString(),
                    notes: `${isReturn ? 'Refund' : 'Payment'} for Invoice #${invoice_number}`
                });
            }

            await this.purchaseInvoices.add({
                id, invoice_number, supplier_id: supplierId, date: new Date().toISOString(),
                total_amount: totalAmount, paid_amount: paidAmount, type: isReturn ? 'RETURN' : 'PURCHASE', items
            });

            return { success: true, message: 'Saved successfully' };
        }).catch((e: any) => ({ success: false, message: e.message }));
    }

    async adjustStock(batchId: string, adjustmentQty: number, reason: string): Promise<{ success: boolean, message: string }> {
        return (this as any).transaction('rw', [this.batches, this.activityLogs, this.queue], async () => {
            const batch = await this.batches.get(batchId);
            if (!batch) throw new Error("Batch not found");
            const newQty = batch.quantity + adjustmentQty;
            if (newQty < 0) throw new Error("Stock cannot be negative");
            await this.batches.update(batchId, { quantity: newQty });
            await this.logActivity('ADJUSTMENT', 'STOCK', `Batch ${batch.batch_number}: ${adjustmentQty > 0 ? '+' : ''}${adjustmentQty}. ${reason}`);
            return { success: true, message: 'Stock adjusted' };
        }).catch((e: any) => ({ success: false, message: e.message }));
    }

    async transferStock(batchId: string, targetWarehouseId: string, quantity: number): Promise<{ success: boolean; message: string }> {
        return (this as any).transaction('rw', [this.batches, this.activityLogs, this.queue], async () => {
            const sourceBatch = await this.batches.get(batchId);
            if (!sourceBatch) throw new Error("Source Batch Not Found");
            if (sourceBatch.quantity < quantity) throw new Error("Insufficient Quantity");

            await this.batches.update(batchId, { quantity: sourceBatch.quantity - quantity });
            // Check if exact batch exists in target
            const targetBatch = await this.batches.where({ product_id: sourceBatch.product_id, warehouse_id: targetWarehouseId, batch_number: sourceBatch.batch_number }).first();
            
            if (targetBatch) {
                await this.batches.update(targetBatch.id, { quantity: targetBatch.quantity + quantity });
            } else {
                await this.batches.add({
                    ...sourceBatch, id: crypto.randomUUID(), warehouse_id: targetWarehouseId, quantity: quantity
                });
            }
            return { success: true, message: 'Transfer Successful' };
        }).catch((e: any) => ({ success: false, message: e.message }));
    }

    async addDeal(d: Partial<Deal>, initialAmount: number) {
        return (this as any).transaction('rw', [this.deals, this.cashTransactions, this.activityLogs], async () => {
             const id = crypto.randomUUID();
             const cycle: DealCycle = {
                 id: crypto.randomUUID(),
                 startDate: new Date().toISOString(),
                 amount: initialAmount,
                 productTargets: (d as any).productTargets || []
             };
             
             delete (d as any).productTargets;

             const deal: Deal = {
                 ...d as any,
                 id,
                 createdAt: new Date().toISOString(),
                 cycles: [cycle]
             };

             await this.deals.add(deal);

             if (initialAmount > 0) {
                 await this.addCashTransactionInternal({
                     type: CashTransactionType.EXPENSE,
                     category: 'DOCTOR_COMMISSION',
                     reference_id: id,
                     related_name: d.doctorName || 'Unknown Doctor',
                     amount: initialAmount,
                     date: new Date().toISOString(),
                     notes: `Initial commission for deal with ${d.doctorName}`
                 });
             }
        });
    }
    
    async updateDeal(id: string, updates: any) {
        return (this as any).transaction('rw', [this.deals, this.activityLogs], async () => {
            const deal = await this.deals.get(id);
            if (!deal) throw new Error("Deal not found");
            
            if (updates.productTargets) {
                const cycles = [...(deal.cycles || [])];
                if(cycles.length > 0) {
                    cycles[0].productTargets = updates.productTargets;
                    updates.cycles = cycles;
                }
                delete updates.productTargets;
            }
            await this.deals.update(id, updates);
        });
    }

    async renewDeal(id: string, amount: number, targets: DealTarget[]) {
        return (this as any).transaction('rw', [this.deals, this.cashTransactions, this.activityLogs], async () => {
            const deal = await this.deals.get(id);
            if (!deal) throw new Error("Deal not found");

            const newCycle: DealCycle = {
                id: crypto.randomUUID(), startDate: new Date().toISOString(),
                amount: amount, productTargets: targets
            };
            const cycles = [newCycle, ...(deal.cycles || [])];
            await this.deals.update(id, { cycles });

            if (amount > 0) {
                await this.addCashTransactionInternal({
                     type: CashTransactionType.EXPENSE,
                     category: 'DOCTOR_COMMISSION',
                     reference_id: id,
                     related_name: deal.doctorName,
                     amount: amount,
                     date: new Date().toISOString(),
                     notes: `Renewed deal (Cycle ${cycles.length}) for ${deal.doctorName}`
                 });
            }
        });
    }

    async addCustomer(c: Partial<Customer>) {
        const id = crypto.randomUUID();
        await this.customers.add({ ...c, id, current_balance: c.opening_balance || 0 } as Customer);
    }

    async updateCustomer(id: string, updates: Partial<Customer>) {
        await (this as any).transaction('rw', this.customers, async () => {
            const c = await this.customers.get(id);
            if(c && updates.opening_balance !== undefined && updates.opening_balance !== c.opening_balance) {
                const diff = updates.opening_balance - c.opening_balance;
                updates.current_balance = c.current_balance + diff;
            }
            await this.customers.update(id, updates);
        });
    }

    async deleteCustomer(id: string) { await this.customers.delete(id); }
    async addSupplier(s: any) { await this.suppliers.add({ ...s, id: crypto.randomUUID(), current_balance: s.opening_balance || 0 }); }
    
    async addProduct(p: any, b: any) {
        return (this as any).transaction('rw', [this.products, this.batches], async () => {
            const pid = crypto.randomUUID();
            await this.products.add({ ...p, id: pid });
            await this.batches.add({ ...b, id: crypto.randomUUID(), product_id: pid, warehouse_id: 'W1', status: BatchStatus.ACTIVE });
        });
    }

    async addCashTransaction(tx: Omit<CashTransaction, 'id'>) {
        await (this as any).transaction('rw', [this.cashTransactions, this.customers, this.suppliers], async () => {
            await this.addCashTransactionInternal(tx);
        });
    }

    private async addCashTransactionInternal(tx: Omit<CashTransaction, 'id'>) {
        const id = await this.generateSequence('V', 'cashTransactions', 'id');
        await this.cashTransactions.add({ ...tx, id });

        if (tx.reference_id) {
            if (tx.category === 'CUSTOMER_PAYMENT') {
                const c = await this.customers.get(tx.reference_id);
                if (c) {
                    const change = tx.type === 'RECEIPT' ? -tx.amount : tx.amount;
                    await this.customers.update(c.id, { current_balance: c.current_balance + change });
                }
            } else if (tx.category === 'SUPPLIER_PAYMENT') {
                const s = await this.suppliers.get(tx.reference_id);
                if (s) {
                    const change = tx.type === 'EXPENSE' ? -tx.amount : tx.amount;
                    await this.suppliers.update(s.id, { current_balance: s.current_balance + change });
                }
            }
        }
    }
    
    async updateInvoice(id: string, customerId: string, items: CartItem[], cashPaid: number) {
        return { success: false, message: "Edit not supported in this version to protect integrity." };
    }

    private async generateSequence(prefix: string, table: string, key: string): Promise<string> {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const pattern = `${prefix}${year}${month}-`;
        const items = await (this as any)[table].toArray(); 
        let maxSeq = 0;
        items.forEach((item: any) => {
            if (item[key] && item[key].startsWith(pattern)) {
                const parts = item[key].split('-');
                if (parts.length > 1) {
                    const seq = parseInt(parts[1]);
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            }
        });
        return `${pattern}${maxSeq + 1}`;
    }

    async resetDatabase() { await (this as any).delete(); window.location.reload(); }
    async deleteInvoice(id: string) { await this.invoices.delete(id); }
    async deletePurchaseInvoice(id: string) { await this.purchaseInvoices.delete(id); }
    async deleteProduct(id: string) { 
        await (this as any).transaction('rw', [this.products, this.batches], async () => {
            await this.products.delete(id);
            await this.batches.where('product_id').equals(id).delete();
        });
    }
    async addRepresentative(r: any) { await this.representatives.add({...r, id: crypto.randomUUID()}); }
    async updateRepresentative(id: string, r: any) { await this.representatives.update(id, r); }
    async addWarehouse(name: string) { await this.warehouses.add({ id: crypto.randomUUID(), name, is_default: false }); }
    async updateWarehouse(id: string, name: string) { await this.warehouses.update(id, { name }); }
    async updateProduct(id: string, p: any) { await this.products.update(id, p); }
    
    async exportDatabase() {
        const allData: any = {};
        for(const table of (this as any).tables) allData[table.name] = await table.toArray();
        return JSON.stringify(allData);
    }
    
    async importDatabase(json: string) {
        try {
            const data = JSON.parse(json);
            await (this as any).transaction('rw', (this as any).tables, async () => {
                for(const table of (this as any).tables) {
                    if(data[table.name]) {
                        await table.clear();
                        await table.bulkAdd(data[table.name]);
                    }
                }
            });
            return true;
        } catch(e) { return false; }
    }
}

export const db = new MizanDatabase();
