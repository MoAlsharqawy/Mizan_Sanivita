
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

// FIXED ID for Single Company Mode
const DEFAULT_COMPANY_ID = 'default-company-id';

export const authService = {
  // Login with Supabase
  login: async (email: string, password: string): Promise<User> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("No user returned");

    // Force setup local session immediately
    authService.saveUserToStorage(data.user.id, email);

    return authService.transformUser(data.user);
  },

  // Register simply creates a user in Auth, no DB logic needed on frontend
  signup: async (email: string, password: string, companyName: string): Promise<void> => {
      if (!supabase) throw new Error("Supabase not configured");

      const { data, error } = await supabase.auth.signUp({
          email,
          password
      });

      if (error) throw error;
      if (data.user) {
          authService.saveUserToStorage(data.user.id, email);
      }
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
      return true; // Always allow in single mode
  },

  // Simplified: Just save the user to local storage and let them work
  saveUserToStorage: (userId: string, email: string) => {
      const userObj = { 
          id: userId, 
          username: email, 
          name: email.split('@')[0], 
          role: 'ADMIN', 
          company_id: DEFAULT_COMPANY_ID, 
          permissions: ALL_PERMISSIONS_IDS 
      };
      localStorage.setItem('user', JSON.stringify(userObj));
  },

  // Kept for compatibility but effectively bypassed
  ensureAccountSetup: async (userId: string, email: string) => {
      authService.saveUserToStorage(userId, email);
  },

  transformUser: (sbUser: any): User => {
      return {
          id: sbUser.id,
          username: sbUser.email,
          name: sbUser.email.split('@')[0],
          role: 'ADMIN' 
      };
  },

  getUsers: (): any[] => {
      return []; 
  },
  
  saveUser: (user: any) => {}, 
  deleteUser: (id: string) => {}
};
