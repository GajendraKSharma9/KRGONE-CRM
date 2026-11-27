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
  Database,
  Info
} from 'lucide-react';
import { UserProfile } from '../types';
import { authService } from '../services/authService';

interface LayoutProps {
  user: UserProfile | null;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
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
      return item ? item.label : 'KRG ONE PMS';
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
            <span className="font-semibold text-xs tracking-tight block">KRG ONE PMS</span>
            <span className="text-[10px] text-slate-300 block -mt-1">
              {isPerformanceProduct ? 'Sales Performance Management' : 'Lead Management CRM'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsAboutModalOpen(true)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="About KRG ONE PMS"
            aria-label="About KRG ONE PMS"
          >
            <Info className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
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
              <h1 className="font-extrabold text-white text-base tracking-tight leading-none">KRG ONE PMS</h1>
              <p className={`text-[11px] font-black tracking-wide mt-1 uppercase ${
                isPerformanceProduct ? 'text-indigo-400' : 'text-blue-400'
              }`}>
                {isPerformanceProduct ? 'Sales Performance Management' : 'Lead Management CRM'}
              </p>
            </div>
          </div>

          {/* Premium Product Switcher Button */}
          <div className="px-3.5 py-3 border-b border-slate-900/60 bg-slate-950/40">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate(isPerformanceProduct ? '/dashboard' : '/sales-performance/dashboard');
              }}
              className={`group relative w-full overflow-hidden rounded-xl p-2.5 flex items-center justify-between border transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-md ${
                isPerformanceProduct
                  ? 'bg-gradient-to-r from-blue-950/90 via-slate-900 to-blue-900/40 border-blue-500/40 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20'
                  : 'bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-900/40 border-indigo-500/40 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/20'
              }`}
            >
              {/* Subtle ambient light sweep across button on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />

              <div className="flex items-center space-x-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-xs transition-transform duration-300 group-hover:scale-105 ${
                  isPerformanceProduct
                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                    : 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300'
                }`}>
                  <RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" />
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      isPerformanceProduct ? 'bg-blue-400' : 'bg-indigo-400'
                    }`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      isPerformanceProduct ? 'text-blue-300' : 'text-indigo-300'
                    }`}>
                      Switch Workspace
                    </span>
                  </div>
                  <p className="text-[11px] font-extrabold text-white tracking-tight truncate leading-tight mt-0.5">
                    {isPerformanceProduct ? 'Lead Management CRM' : 'Sales Performance'}
                  </p>
                </div>
              </div>

              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-200 group-hover:translate-x-0.5 ${
                isPerformanceProduct
                  ? 'bg-blue-500/10 border-blue-400/30 text-blue-300 group-hover:bg-blue-500/20 group-hover:text-white'
                  : 'bg-indigo-500/10 border-indigo-400/30 text-indigo-300 group-hover:bg-indigo-500/20 group-hover:text-white'
              }`}>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
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
                <span>{isPerformanceProduct ? 'Sales Performance Management' : 'Lead Management CRM'}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
              KRG ONE PMS — Your Intelligent Sales Assistant • Sales Management System
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsAboutModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200/80 text-xs font-semibold"
              title="About KRG ONE PMS"
            >
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>About PMS</span>
            </button>

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

      {/* About KRG ONE PMS Modal */}
      {isAboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-950 p-6 text-white flex items-start justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-lg text-white">KRG ONE PMS</h3>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-md">
                      Sales Management System
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-blue-400 mt-0.5">Your Intelligent Sales Assistant</p>
                  <p className="text-[10px] text-slate-400">Built for Business Founders & Sales Teams</p>
                </div>
              </div>
              <button
                onClick={() => setIsAboutModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-slate-600 text-xs leading-relaxed">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-slate-700">
                <p>
                  <strong>KRG ONE PMS</strong> is a Sales Management System designed to support business founders, leadership teams, and sales managers in managing and monitoring their sales operations.
                </p>
                <p>
                  It brings lead management, customer information, sales pipeline tracking, lead allocation, follow-up activities, sales targets, team performance, and manager-wise reviews into one organized platform.
                </p>
                <p>
                  Think of it as your intelligent sales assistant, helping your business stay organized, accountable, and informed while reducing the need for manual sales tracking and scattered reporting.
                </p>
                <p>
                  KRG ONE PMS helps you understand what is happening across your sales organization, identify pending activities, monitor performance, and maintain better visibility over your sales process.
                </p>
              </div>

              {/* Mode Descriptions */}
              <div className="space-y-3 pt-1">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Connected System Modes</h4>
                
                <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <h5 className="font-bold text-slate-900 text-xs">1. Lead Management CRM</h5>
                  </div>
                  <p className="text-[11px] text-slate-600 pl-4">
                    Manage your leads, customer database, sales pipeline, lead allocation, follow-ups, and sales activities in one organized workspace.
                  </p>
                </div>

                <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <h5 className="font-bold text-slate-900 text-xs">2. Sales Performance Management</h5>
                  </div>
                  <p className="text-[11px] text-slate-600 pl-4">
                    Set sales targets, monitor team activities, review salesperson and manager-wise performance, and maintain clear visibility of sales progress.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">KRGONE Business Consulting & Technologies</span>
              <button
                onClick={() => setIsAboutModalOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
