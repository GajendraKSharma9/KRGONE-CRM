import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Activity as ActivityIcon, 
  FileSpreadsheet, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X,
  Compass,
  UserCircle,
  CloudUpload,
  Target,
  Award,
  TrendingUp,
  Users,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Database
} from 'lucide-react';
import { UserProfile } from '../types';
import { authService } from '../services/authService';

interface LayoutProps {
  user: UserProfile | null;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isPerformanceProduct = location.pathname.startsWith('/sales-performance');

  const crmNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/businesses', label: 'Sales Pipeline', icon: Building2 },
    { path: '/contact-directory', label: 'Contact Directory', icon: Users },
    { path: '/contact-directory?style=master', label: 'Lead Data Master', icon: Database },
    { path: '/marketing-os', label: 'Marketing OS', icon: Sparkles },
    { path: '/activities', label: 'Activities', icon: ActivityIcon },
    { path: '/bulk-import', label: 'Bulk Import', icon: FileSpreadsheet },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const perfNavItems = [
    { path: '/sales-performance/dashboard', label: 'Sales Performance', icon: LayoutDashboard },
    { path: '/sales-performance/target-setting', label: 'Target Setting', icon: Target },
    { path: '/sales-performance/achievement-entry', label: 'Achievement Entry', icon: Award },
    { path: '/sales-performance/team-review', label: 'Team Review', icon: Users },
    { path: '/sales-performance/reports', label: 'Reports', icon: TrendingUp },
    { path: '/sales-performance/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const activeNavItems = isPerformanceProduct ? perfNavItems : crmNavItems;

  const getPageTitle = () => {
    if (isPerformanceProduct) {
      if (location.pathname.includes('/target-setting')) return 'KPI & Target Setting';
      if (location.pathname.includes('/achievement-entry')) return 'Achievement Entry';
      if (location.pathname.includes('/team-review')) return 'Team Review & Gap Analysis';
      if (location.pathname.includes('/reports')) return 'Performance Reports';
      if (location.pathname.includes('/settings')) return 'Performance Settings';
      return 'Sales Performance Dashboard';
    } else {
      if (location.pathname === '/contact-directory' && location.search.includes('style=master')) {
        return 'Lead Data Master';
      }
      const item = crmNavItems.find(i => i.path === location.pathname);
      return item ? item.label : 'KRGONE Sales Navigator™';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 antialiased">
      {/* Mobile Top Header */}
      <div className={`md:hidden text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md ${
        isPerformanceProduct ? 'bg-indigo-950 border-b border-indigo-900' : 'bg-slate-900 border-b border-slate-800'
      }`}>
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-xs ${
            isPerformanceProduct ? 'bg-indigo-600' : 'bg-blue-600'
          }`}>
            {isPerformanceProduct ? <Target className="w-5 h-5" /> : <Compass className="w-5 h-5" />}
          </div>
          <div>
            <span className="font-semibold text-xs tracking-tight block">KRGONE</span>
            <span className="text-[10px] text-slate-300 block -mt-1">
              {isPerformanceProduct ? 'Sales Performance™' : 'Sales Navigator™'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 text-slate-300 flex flex-col justify-between transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isPerformanceProduct ? 'bg-slate-950' : 'bg-slate-900'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div>
          {/* Logo Branding */}
          <div className={`p-5 border-b flex items-center space-x-3 ${
            isPerformanceProduct ? 'border-slate-900 bg-slate-950' : 'border-slate-800 bg-slate-900'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
              isPerformanceProduct ? 'bg-indigo-600' : 'bg-blue-600'
            }`}>
              {isPerformanceProduct ? <Target className="w-6 h-6" /> : <Compass className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-tight leading-none">KRGONE</h1>
              <p className={`text-[11px] font-black tracking-wide mt-1 uppercase ${
                isPerformanceProduct ? 'text-indigo-400' : 'text-blue-400'
              }`}>
                {isPerformanceProduct ? 'Sales Performance™' : 'Sales Navigator™'}
              </p>
            </div>
          </div>

          {/* Premium Product Switcher Button */}
          <div className="px-4 py-3 border-b border-slate-900/40 bg-slate-950/20">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate(isPerformanceProduct ? '/dashboard' : '/sales-performance/dashboard');
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-[11px] font-black tracking-wide text-slate-200 hover:text-white transition-all shadow-xs"
            >
              <div className="flex items-center space-x-2">
                <RefreshCw className={`w-3.5 h-3.5 ${isPerformanceProduct ? 'text-indigo-400' : 'text-blue-400'}`} />
                <span className="uppercase">
                  Switch to {isPerformanceProduct ? 'CRM' : 'Performance'}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 mb-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Menu Links
            </div>
            {activeNavItems.map((item) => {
              const Icon = item.icon;
              
              // Custom active check to support query parameter-based items (e.g. Lead Data Master)
              const itemPathBase = item.path.split('?')[0];
              const itemPathQuery = item.path.split('?')[1] || '';
              const isActive = itemPathQuery
                ? (location.pathname === itemPathBase && location.search.includes(itemPathQuery))
                : (location.pathname === itemPathBase && !location.search.includes('style=master')) ||
                  (item.path === '/sales-performance/dashboard' && location.pathname === '/sales-performance');
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? isPerformanceProduct 
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout at Bottom */}
        <div className="p-4 border-t border-slate-900/80 bg-slate-950/50">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center space-x-2 overflow-hidden">
              <UserCircle className="w-7 h-7 text-slate-400 flex-shrink-0" />
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate leading-tight">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-400 truncate leading-none mt-0.5">{user?.role || 'Member'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-[11px] font-black text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors border border-slate-800/60 uppercase tracking-wider"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Desktop Top Header */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-slate-200 px-8 py-4 shadow-3xs sticky top-0 z-20">
          <div className="flex flex-col">
            <div className="flex items-center space-x-3">
              <h2 className="text-base font-black text-slate-950 tracking-tight uppercase">{getPageTitle()}</h2>
              <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider shadow-3xs ${
                isPerformanceProduct 
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200' 
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isPerformanceProduct ? 'bg-indigo-500' : 'bg-blue-500'} animate-pulse`}></span>
                <span>{isPerformanceProduct ? 'Target & Performance' : 'Lead CRM Mode'}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
              {isPerformanceProduct 
                ? 'KRGONE Sales Performance™ — Sales Target & Performance Management' 
                : 'KRGONE Sales Navigator™ — Lead Management CRM'}
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 text-right">
              <div>
                <p className="text-xs font-black text-slate-900 leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">{user?.role} Account</p>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm ${
                isPerformanceProduct ? 'bg-indigo-600' : 'bg-blue-600'
              }`}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
