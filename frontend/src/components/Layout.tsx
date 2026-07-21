import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAvatarDetails } from '../utils/format';
import Logo from './Logo';
import { 
  useNotifications, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead,
  useHouseholds 
} from '../utils/queryHooks';
import { 
  LayoutDashboard, 
  Receipt, 
  Scale, 
  Calendar, 
  Settings, 
  Menu, 
  Bell, 
  Sun, 
  Moon, 
  LogOut, 
  Home, 
  BellOff,
  User,
  RefreshCw
} from 'lucide-react';

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, householdId, selectHousehold } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Queries
  const { data: notifications = [] } = useNotifications();
  const { data: households = [] } = useHouseholds();
  
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navigationItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Expenses', path: '/expenses', icon: Receipt, requiresHousehold: true },
    { name: 'Balances', path: '/balances', icon: Scale, requiresHousehold: true },
    { name: 'Recurring Expenses', path: '/recurring', icon: RefreshCw, requiresHousehold: true },
    { name: 'Calendar', path: '/calendar', icon: Calendar, requiresHousehold: true },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleHouseholdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'manage') {
      navigate('/households');
    } else if (value) {
      selectHousehold(parseInt(value, 10));
      // Reload active queries
      navigate('/dashboard');
    } else {
      selectHousehold(null);
      navigate('/households');
    }
  };

  const handleNotificationClick = (id: number) => {
    markReadMutation.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#0b0c10] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      
      {/* SIDEBAR */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111317] transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <Logo size="sm" />
          {isSidebarOpen && (
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              FlatMath
            </span>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isDisabled = item.requiresHousehold && !householdId;

            if (isDisabled) return null;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {isSidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 shrink-0">
          {(() => {
            const avatar = getAvatarDetails(user?.name || '');
            return isSidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${avatar.colorClass} flex items-center justify-center font-semibold uppercase`}>
                  {avatar.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>
              </div>
            ) : (
              <div className={`w-10 h-10 mx-auto rounded-full ${avatar.colorClass} flex items-center justify-center font-semibold uppercase`}>
                {avatar.initials}
              </div>
            );
          })()}
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          isSidebarOpen ? 'pl-64' : 'pl-20'
        }`}
      >
        
        {/* TOPBAR */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#111317]/80 backdrop-blur-md">
          
          {/* Left section: toggle + household switcher */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Active Household Selector */}
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-gray-400" />
              <select
                value={householdId || ''}
                onChange={handleHouseholdChange}
                className="bg-transparent text-sm font-semibold border-none focus:ring-0 cursor-pointer pr-8 text-gray-900 dark:text-white"
              >
                <option value="" disabled className="text-gray-950">Select Household</option>
                {households.map((hh) => (
                  <option key={hh.id} value={hh.id} className="text-gray-950">
                    {hh.name}
                  </option>
                ))}
                <option value="manage" className="text-gray-950 font-semibold border-t">
                  + Manage Households
                </option>
              </select>
            </div>
          </div>

          {/* Right section: theme, notifications, user actions */}
          <div className="flex items-center gap-3">
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {/* Notifications Panel Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  unreadCount > 0 ? 'animate-pulse' : ''
                }`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full" />
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {isNotificationOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsNotificationOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl py-2 z-20 animate-fade-in">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="font-semibold text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllRead}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-gray-400 dark:text-gray-500 gap-1.5">
                          <BellOff className="w-8 h-8" />
                          <span className="text-xs">No notifications yet</span>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif.id)}
                            className={`px-4 py-3 border-b border-gray-50 dark:border-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer flex gap-2.5 items-start ${
                              !notif.isRead ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.isRead ? 'bg-blue-600' : 'bg-transparent'}`} />
                            <div className="flex-1">
                              <p className="text-xs leading-normal">{notif.message}</p>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                {new Date(notif.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {(() => {
                  const avatar = getAvatarDetails(user?.name || '');
                  return (
                    <div className={`w-8 h-8 rounded-full ${avatar.colorClass} flex items-center justify-center font-bold uppercase text-xs`}>
                      {avatar.initials}
                    </div>
                  );
                })()}
              </button>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl py-1.5 z-20 animate-fade-in">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-semibold truncate text-gray-900 dark:text-white">{user?.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{user?.email}</p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        {/* VIEW PORT CONTENT */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

    </div>
  );
};

export default Layout;
