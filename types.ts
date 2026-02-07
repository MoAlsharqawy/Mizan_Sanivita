
// Domain Model (STRICT)

export enum BatchStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DEPLETED = 'DEPLETED',
}

export type Role = 'ADMIN' | 'USER';

// --- SYNC & ARCHITECTURE TYPES ---
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface BaseEntity {
    company_id?: string; // Multi-tenancy root
    branch_id?: string;
    sync_status?: SyncStatus;
    created_at?: string;
    updated_at?: string;
    updated_by?: string; // Audit: Who made the last change
    is_deleted?: boolean; // Soft Delete
    deleted_at?: string;
}

export interface User extends BaseEntity {
  id: string;
  username: string;
  name: string;
  role: Role;
  avatar?: string;
  permissions?: string[]; // List of enabled permission IDs
}

export interface Warehouse extends BaseEntity {
  id: string;
  name: string;
  is_default: boolean;
}

export interface Product extends BaseEntity {
  id: string;
  code: string;
  name: string;
}

export interface Batch extends BaseEntity {
  id: string;
  product_id: string;
  warehouse_id: string; // Link to Warehouse
  batch_number: string;
  selling_price: number;
  purchase_price: number;
  quantity: number;
  expiry_date: string; // ISO Date string
  status: BatchStatus;
}

export interface Representative extends BaseEntity {
  id: string;
  code: string; // Primary Link
  name: string;
  phone: string;
  supervisor_id?: string; // Link to User (Supervisor)
}

export interface Customer extends BaseEntity {
  id: string;
  code: string;
  name: string;
  phone: string;
  area: string;
  address: string;
  opening_balance: number;
  current_balance: number;
  representative_code?: string; // Link to Representative Code
}

export interface Supplier extends BaseEntity {
  id: string;
  code: string;
  name: string;
  phone: string;
  contact_person: string;
  address: string;
  opening_balance: number;
  current_balance: number;
}

export enum PaymentStatus {
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  UNPAID = 'UNPAID',
}

export interface Invoice extends BaseEntity {
  id: string;
  invoice_number: string;
  customer_id: string;
  date: string;
  total_before_discount: number;
  total_discount: number;
  net_total: number;
  previous_balance: number;
  final_balance: number;
  payment_status: PaymentStatus;
  items: CartItem[]; // Added to persist items
  type: 'SALE' | 'RETURN'; // Added Invoice Type
}

export interface PurchaseInvoice extends BaseEntity {
  id: string;
  invoice_number: string;
  supplier_id: string;
  date: string;
  total_amount: number;
  paid_amount: number;
  type: 'PURCHASE' | 'RETURN';
  items: PurchaseItem[];
}

export interface PurchaseItem {
  product_id: string;
  warehouse_id: string; // Target Warehouse
  batch_number: string; // For new batches or identifying returned batches
  quantity: number;
  cost_price: number;
  selling_price: number;
  expiry_date: string;
}

export interface InvoiceItem extends BaseEntity {
  id: string;
  invoice_id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  bonus_quantity: number;
  unit_price: number;
  discount_percentage: number;
  line_total: number;
}

export enum CashTransactionType {
  RECEIPT = 'RECEIPT',
  EXPENSE = 'EXPENSE',
}

export type CashCategory = 
  | 'CUSTOMER_PAYMENT' 
  | 'PARTNER_CONTRIBUTION' 
  | 'SUPPLIER_PAYMENT' 
  | 'SALARY' 
  | 'ELECTRICITY' 
  | 'MARKETING' 
  | 'DOCTOR_COMMISSION'
  | 'OTHER';

export interface CashTransaction extends BaseEntity {
  id: string;
  type: CashTransactionType;
  category: CashCategory;
  reference_id?: string; // ID of the Invoice, Customer, or Supplier
  related_name?: string; // Name of the person/entity for display
  amount: number;
  date: string;
  notes: string;
}

export interface DealTarget {
    productId: string;
    targetQuantity: number; // The goal (e.g. 100 boxes)
}

export interface DealCycle extends BaseEntity {
    id: string;
    startDate: string;
    amount: number; // The commission/payment for this specific cycle
    notes?: string;
    productTargets: DealTarget[]; // Targets specific to this cycle
}

export interface Deal extends BaseEntity {
  id: string;
  doctorName: string;
  representativeCode: string; // Link to Rep
  customerIds: string[]; // List of linked pharmacies/customers
  createdAt: string; // Original creation date
  cycles: DealCycle[]; // History of renewals
}

// Audit & Control Types
export interface ActivityLog extends BaseEntity {
    id: string;
    userId: string;
    userName: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'ADJUSTMENT';
    entity: 'INVOICE' | 'CUSTOMER' | 'PRODUCT' | 'STOCK' | 'SUPPLIER' | 'CASH';
    details: string;
    timestamp: string;
}

// Helper types for UI
export interface ProductWithBatches extends Product {
  batches: Batch[];
}

export interface CartItem {
  product: Product;
  batch: Batch;
  quantity: number;
  bonus_quantity: number;
  discount_percentage: number;
  unit_price?: number; // Added: The actual selling price used
}

export interface QueueItem {
    id?: number; // Auto-incremented local ID
    client_transaction_id: string; // UUID for idempotency
    action_type: string; // e.g., 'CREATE_INVOICE', 'UPDATE_CUSTOMER'
    payload: any;
    status: SyncStatus;
    created_at: string;
    retries: number;
    error_log?: string;
}
