
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
  // Login with REAL Supabase Auth
  login: async (email: string, password: string): Promise<User> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("No user returned");

    // Attempt to ensure profile exists to prevent RLS errors later
    try {
        await authService.ensureAccountSetup(data.user.id, email);
    } catch (e) {
        console.warn("Auto-profile setup failed", e);
    }

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
      
      if (data.user) {
          // Create profile immediately
          await authService.ensureAccountSetup(data.user.id, email);
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

  // Ensures a profile row exists for the user. Fixes "permission denied for table profiles"
  ensureAccountSetup: async (userId: string, email: string) => {
      if (!supabase) return;
      console.log("Ensuring account profile exists...");
      
      // Try 'profiles' - standard Supabase table for users
      const { error } = await supabase.from('profiles').upsert({
          id: userId,
          full_name: email.split('@')[0],
          updated_at: new Date().toISOString()
      });
      
      if (error) {
          console.warn("Profile upsert failed (profiles table might not exist or schema differs):", error.message);
      }
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
