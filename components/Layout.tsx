import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, FileText, Settings, CreditCard, Truck, Briefcase, Warehouse, Menu, X, BarChart3, LogOut, ChevronDown, ChevronRight, TrendingUp, Phone, Plus, Award, ShieldAlert } from 'lucide-react';
import { t, isRTL } from '../utils/t';
import { authService } from '../services/auth';

interface LayoutProps {
    children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['/reports']); 
  const rtl = isRTL();
  const dir = rtl ? 'rtl' : 'ltr';
  const user = authService.getCurrentUser();

  const allNavs = [
    { label: t('nav.dashboard'), path: '/', icon: LayoutDashboard, perm: 'VIEW_DASHBOARD' },
    
    // SALES GROUP
    { 
        label: t('nav.sales_group'), 
        path: '/sales', 
        icon: ShoppingCart, 
        perm: 'MANAGE_SALES',
        children: [
             { label: t('nav.new_invoice'), path: '/invoice/new', icon: Plus },
             { label: t('nav.invoices'), path: '/invoices', icon: FileText },
             { label: t('nav.deals'), path: '/deals', icon: Award },
        ]
    },

    // PURCHASES GROUP
    { 
        label: t('nav.purchases_group'), 
        path: '/purchases', 
        icon: Truck, 
        perm: 'MANAGE_SUPPLIERS',
        children: [
             { label: t('nav.new_purchase'), path: '/purchases/new', icon: Plus },
             { label: t('nav.purchase_log'), path: '/purchases/log', icon: FileText },
             { label: t('nav.suppliers'), path: '/suppliers', icon: Users },
        ]
    },

    { label: t('nav.inventory'), path: '/inventory', icon: Package, perm: 'MANAGE_INVENTORY' },
    { label: t('nav.customers'), path: '/customers', icon: Users, perm: 'MANAGE_CUSTOMERS' },
    { label: t('nav.representatives'), path: '/representatives', icon: Briefcase, perm: 'MANAGE_REPS' },
    
    // Reports
    { 
        label: t('nav.reports'), 
        path: '/reports', 
        icon: BarChart3, 
        perm: 'VIEW_REPORTS',
        children: [
            { label: t('nav.reports_sales'), path: '/reports/sales', icon: TrendingUp },
            { label: t('nav.reports_purchases'), path: '/reports/purchases', icon: Truck },
            { label: t('nav.reports_reps'), path: '/reports/representatives', icon: Briefcase },
        ]
    },

    { label: t('nav.warehouses'), path: '/warehouses', icon: Warehouse, perm: 'MANAGE_WAREHOUSES' },
    { label: t('nav.cash'), path: '/cash', icon: CreditCard, perm: 'MANAGE_CASH' },
    { label: 'Activity Log', path: '/activity-log', icon: ShieldAlert, perm: 'MANAGE_SETTINGS' },
    { label: t('nav.settings'), path: '/settings', icon: Settings, perm: 'MANAGE_SETTINGS' },
  ];

  const navs = allNavs.filter(item => authService.hasPermission(item.perm));

  const toggleMenu = (path: string) => {
      setExpandedMenus(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900" dir={dir}>
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 z-30 w-72 bg-slate-850 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-out lg:static lg:translate-x-0 
          ${rtl 
            ? (sidebarOpen ? 'translate-x-0' : 'translate-x-full') 
            : (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
          }
        `}
      >
        <div className="p-6 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <span className="font-bold text-xl text-white">M</span>
             </div>
             <div>
                <h1 className="text-xl font-bold tracking-tight text-white">{t('app.name')}</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Enterprise v2.0</p>
             </div>
          </div>
          {/* Close button for mobile */}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-1 px-4">
            {navs.map((item) => {
                if (item.children) {
                    const isExpanded = expandedMenus.includes(item.path);
                    // Check if any child is active
                    const isActiveParent = item.children.some(child => isActive(child.path)) || location.pathname.startsWith(item.path);
                    
                    return (
                        <li key={item.path}>
                            <div 
                                onClick={() => toggleMenu(item.path)}
                                className={`group flex items-center justify-between px-4 py-3 text-base font-medium rounded-xl transition-all duration-200 cursor-pointer
                                    ${isActiveParent ? 'text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}
                                `}
                            >
                                <div className="flex items-center">
                                    <item.icon className={`w-5 h-5 transition-colors ${rtl ? 'ml-3' : 'mr-3'} ${isActiveParent ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                    {item.label}
                                </div>
                                {isExpanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : rtl ? <ChevronDown className="w-4 h-4 opacity-50 rotate-90" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                            </div>
                            
                            {/* Submenu */}
                            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                <ul className={`space-y-1 ${rtl ? 'pr-8' : 'pl-8'}`}>
                                    {item.children.map(child => (
                                        <li key={child.path}>
                                            <Link
                                                to={child.path}
                                                onClick={() => setSidebarOpen(false)}
                                                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                                    isActive(child.path) 
                                                    ? 'bg-blue-600 text-white' 
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                    }`
                                                }
                                            >
                                                <child.icon className={`w-3.5 h-3.5 ${rtl ? 'ml-2' : 'mr-2'}`} />
                                                {child.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </li>
                    );
                }

                return (
                    <li key={item.path}>
                        <Link
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`group flex items-center justify-between px-4 py-3 text-base font-medium rounded-xl transition-all duration-200 ${
                            isActive(item.path) 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 translate-x-1' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100 hover:translate-x-1'
                            }`
                        }
                        >
                        <div className="flex items-center">
                            <item.icon className={`w-5 h-5 transition-colors ${rtl ? 'ml-3' : 'mr-3'} ${isActive(item.path) ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                            {item.label}
                        </div>
                        {isActive(item.path) && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                        )}
                        </Link>
                    </li>
                );
            })}
          </ul>
        </nav>
        
        <div className="p-4 m-4 rounded-xl bg-slate-800 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white border-2 border-slate-600 shadow-md">
                    {user?.avatar || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{user?.role === 'ADMIN' ? 'Manager' : 'Employee'}</p>
                </div>
            </div>
            <button 
                onClick={authService.logout}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
            >
                <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative w-full bg-slate-50">
        <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 h-16 flex items-center justify-center sm:justify-between px-4 sm:px-8 z-10 sticky top-0 shrink-0">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg focus:outline-none transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 truncate">
                {location.pathname.includes('reports') ? t('nav.reports') : (allNavs.find(n => n.path === location.pathname)?.label || (location.pathname.includes('deals') ? t('deal.title') : t('app.overview')))}
            </h2>
          </div>

          <div className="flex items-center space-x-4 rtl:space-x-reverse hidden sm:flex">
             <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                 {new Date().toLocaleDateString()}
             </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             {children}
          </div>
        </div>
        
        {/* Company Footer Bar */}
        <footer className="bg-white border-t border-slate-200 p-2 text-center text-[11px] text-slate-500 shrink-0 z-10 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-4 font-medium">
                <span className="font-bold text-slate-700">Mizan Sales</span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span>&copy; 2026</span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                    <Phone className="w-3 h-3 text-blue-500" />
                    <span dir="ltr" className="font-mono text-slate-700 tracking-wide">01559550481</span>
                </div>
            </div>
        </footer>
      </main>
    </div>
  );
};

export default Layout;