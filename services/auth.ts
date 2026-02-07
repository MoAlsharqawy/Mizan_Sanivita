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

const DEFAULT_USERS = [
  { 
      id: '1', 
      username: 'admin', 
      password: '123', 
      name: 'General Manager', 
      role: 'ADMIN', 
      avatar: 'M',
      permissions: ALL_PERMISSIONS_IDS
  },
  { 
      id: '2', 
      username: 'sup1', 
      password: '123', 
      name: 'Supervisor East', 
      role: 'USER', 
      avatar: 'S1',
      permissions: ALL_PERMISSIONS_IDS 
  },
  { 
      id: '3', 
      username: 'sup2', 
      password: '123', 
      name: 'Supervisor West', 
      role: 'USER', 
      avatar: 'S2',
      permissions: ALL_PERMISSIONS_IDS 
  },
  { 
      id: '4', 
      username: 'sup3', 
      password: '123', 
      name: 'Supervisor North', 
      role: 'USER', 
      avatar: 'S3',
      permissions: ALL_PERMISSIONS_IDS 
  }
];

const loadUsers = (): any[] => {
  const stored = localStorage.getItem('app_users');
  if (stored) return JSON.parse(stored);
  // Seed default users if empty
  localStorage.setItem('app_users', JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
};

export const authService = {
  login: (username: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = loadUsers();
        const user = users.find((u: any) => u.username === username && u.password === password);
        if (user) {
          const { password, ...safeUser } = user;
          localStorage.setItem('user', JSON.stringify(safeUser));
          resolve(safeUser as User);
        } else {
          reject(new Error('Invalid credentials'));
        }
      }, 800); // Fake delay
    });
  },

  logout: () => {
    localStorage.removeItem('user');
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
      const userString = localStorage.getItem('user');
      if (!userString) return false;
      const user = JSON.parse(userString) as User;
      
      // ADMIN role generally has all permissions
      if (user.role === 'ADMIN') return true;
      
      return user.permissions?.includes(permissionId) || false;
  },

  // --- User Management Methods ---
  getUsers: (): any[] => {
    return loadUsers().map(({ password, ...u }) => ({
        ...u,
        permissions: u.permissions || [] // Ensure permissions array exists
    }));
  },

  saveUser: (user: any) => {
      const users = loadUsers();
      // Ensure permissions exist
      if (!user.permissions) user.permissions = [];
      
      if (user.id) {
          // Edit
          const idx = users.findIndex((u: any) => u.id === user.id);
          if (idx !== -1) {
             const updatedUser = { ...users[idx], ...user };
             // If password field is empty during edit, preserve old password
             if (!user.password) {
                 updatedUser.password = users[idx].password;
             }
             updatedUser.avatar = updatedUser.name.charAt(0).toUpperCase();
             users[idx] = updatedUser;
          }
      } else {
          // Add
          user.id = Date.now().toString();
          user.avatar = user.name.charAt(0).toUpperCase();
          users.push(user);
      }
      localStorage.setItem('app_users', JSON.stringify(users));
  },

  deleteUser: (id: string) => {
      const users = loadUsers().filter((u: any) => u.id !== id);
      localStorage.setItem('app_users', JSON.stringify(users));
  }
};