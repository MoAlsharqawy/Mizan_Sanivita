
import { supabase } from './supabase';
import { User } from '../types';

export const PERMISSIONS = [
  { id: 'VIEW_DASHBOARD', label: 'View Dashboard' },
  { id: 'VIEW_REPORTS', label: 'View Reports' },
  { id: 'MANAGE_SALES', label: 'Manage Sales (Invoices)' },
  { id: 'MANAGE_INVENTORY', label: 'Manage Inventory' },
  { id: 'MANAGE_CUSTOMERS', label: 'Manage Customers' },
  { id: 'MANAGE_SUPPLIERS', label: 'Manage Suppliers' },
  { id: 'MANAGE_REPS', label: 'Manage Representatives' },
  { id: 'MANAGE_WAREHOUSES', label: 'Manage Warehouses' },
  { id: 'MANAGE_CASH', label: 'Cash Register Access' },
  { id: 'MANAGE_SETTINGS', label: 'System Settings' },
  { id: 'MANAGE_USERS', label: 'Manage Users' },
];

const ALL_PERMISSIONS_IDS = PERMISSIONS.map(p => p.id);

// SINGLE TENANT MODE: Everyone belongs to this "Company" ID in the database.
const SHARED_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("No user returned");

    // We force everyone to have the SAME company_id locally.
    // This allows the app to treat all data as "mine" (since the app logic filters by company_id).
    const userObj: User = {
        id: data.user.id,
        username: email,
        name: email.split('@')[0],
        role: 'ADMIN',
        company_id: SHARED_COMPANY_ID, 
        permissions: ALL_PERMISSIONS_IDS
    };

    authService.saveUserToStorage(userObj);
    return userObj;
  },

  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('user');
    localStorage.removeItem('sb-access-token'); 
    localStorage.removeItem('sb-refresh-token');
    window.location.href = '/#/login';
  },

  getCurrentUser: (): User | null => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('user'); 
  },

  hasPermission: (permissionId: string): boolean => {
      return true; // Full access for single tenant mode
  },

  saveUserToStorage: (user: User) => {
      localStorage.setItem('user', JSON.stringify(user));
  },

  ensureAccountSetup: async (userId: string, email: string) => {
      // Setup logic if needed
  },

  getUsers: (): any[] => {
      return []; // Admin manages users via Supabase Dashboard
  },
  
  saveUser: (user: any) => {},
  deleteUser: (id: string) => {},
  signup: async () => {} // Disabled
};
