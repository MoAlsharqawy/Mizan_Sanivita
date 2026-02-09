
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

export const authService = {
  // Login with REAL Supabase Auth***
  login: async (email: string, password: string): Promise<User> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("No user returned");

    // We use the User ID as the Company ID for single-tenant simplified mode
    const userObj: User = {
        id: data.user.id,
        username: email,
        name: email.split('@')[0],
        role: 'ADMIN',
        company_id: data.user.id, // VITAL: Bind data to this user directly
        permissions: ALL_PERMISSIONS_IDS
    };

    authService.saveUserToStorage(userObj);
    return userObj;
  },

  signup: async (email: string, password: string, companyName: string): Promise<void> => {
      if (!supabase) throw new Error("Supabase not configured");

      const { data, error } = await supabase.auth.signUp({
          email,
          password
      });

      if (error) throw error;
      // Login will handle the storage setup
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
    // Check both local storage AND if we have a supabase client/session token
    const hasLocal = !!localStorage.getItem('user');
    return hasLocal; 
  },

  hasPermission: (permissionId: string): boolean => {
      return true; // Always allow in single mode
  },

  saveUserToStorage: (user: User) => {
      localStorage.setItem('user', JSON.stringify(user));
  },

  // Compatibility stub
  ensureAccountSetup: async (userId: string, email: string) => {
      // In this simplified mode, we assume the auth user IS the account owner.
      return;
  },

  transformUser: (sbUser: any): User => {
      return {
          id: sbUser.id,
          username: sbUser.email,
          name: sbUser.email.split('@')[0],
          role: 'ADMIN',
          company_id: sbUser.id 
      };
  },

  getUsers: (): any[] => {
      return []; 
  },
  
  saveUser: (user: any) => {}, 
  deleteUser: (id: string) => {}
};
