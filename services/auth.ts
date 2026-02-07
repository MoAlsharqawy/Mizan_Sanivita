
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
  // Login with Supabase
  login: async (email: string, password: string): Promise<User> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("No user returned");

    // Check if profile exists, if not, initialize the account
    await authService.ensureAccountSetup(data.user.id, email);

    return authService.transformUser(data.user);
  },

  // Register new user (Creates Company + Profile)
  signup: async (email: string, password: string, companyName: string): Promise<void> => {
      if (!supabase) throw new Error("Supabase not configured");

      const { data, error } = await supabase.auth.signUp({
          email,
          password
      });

      if (error) throw error;
      if (data.user) {
          // Note: If email confirmation is enabled in Supabase, this might run before the user confirms.
          // For this demo, we assume auto-confirm or we handle it on login.
          await authService.ensureAccountSetup(data.user.id, email, companyName);
      }
  },

  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('user');
    localStorage.removeItem('sb-access-token'); // Clear Supabase tokens if stored manually
    localStorage.removeItem('sb-refresh-token');
    window.location.href = '/#/login';
  },

  getCurrentUser: (): User | null => {
    // We still use localStorage for fast UI rendering, but the source of truth is Supabase
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('user');
  },

  hasPermission: (permissionId: string): boolean => {
      const userString = localStorage.getItem('user');
      if (!userString) return false;
      const user = JSON.parse(userString) as User;
      if (user.role === 'ADMIN') return true;
      return user.permissions?.includes(permissionId) || false;
  },

  // Helper: Ensures the user has a Company and Profile in SQL
  ensureAccountSetup: async (userId: string, email: string, newCompanyName: string = 'My Company') => {
      if (!supabase) return;

      // 1. Check Profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (profile) {
          // User exists, update local storage
          const userObj = {
              id: userId,
              username: email,
              name: profile.full_name || email.split('@')[0],
              role: profile.role || 'USER',
              company_id: profile.company_id,
              permissions: ALL_PERMISSIONS_IDS // For now, give all permissions
          };
          localStorage.setItem('user', JSON.stringify(userObj));
          return;
      }

      // 2. No Profile? Create Company + Profile (Bootstrap)
      console.log("Bootstrapping new account...");
      
      // A. Create Company
      const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({ name: newCompanyName })
          .select()
          .single();

      if (companyError || !company) throw new Error("Failed to create company: " + companyError?.message);

      // B. Create Profile linked to Company
      const { error: profileError } = await supabase
          .from('profiles')
          .insert({
              id: userId,
              company_id: company.id,
              role: 'ADMIN',
              full_name: email.split('@')[0]
          });

      if (profileError) throw new Error("Failed to create profile: " + profileError.message);

      // C. Save to Local Storage
      const userObj = {
          id: userId,
          username: email,
          name: email.split('@')[0],
          role: 'ADMIN',
          company_id: company.id,
          permissions: ALL_PERMISSIONS_IDS
      };
      localStorage.setItem('user', JSON.stringify(userObj));
  },

  transformUser: (sbUser: any): User => {
      // Helper to match types
      return {
          id: sbUser.id,
          username: sbUser.email,
          name: sbUser.email.split('@')[0],
          role: 'USER' // Default, will be overwritten by local storage load
      };
  },

  getUsers: (): any[] => {
      // For now, return mock users if offline, or implement fetching from Supabase 'profiles' table if needed
      return []; 
  },
  
  saveUser: (user: any) => {}, // Disabled for now in real auth mode
  deleteUser: (id: string) => {}
};
