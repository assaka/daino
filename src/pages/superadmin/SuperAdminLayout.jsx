import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet, Link } from "react-router-dom";
import { getCurrentUser } from "@/utils/auth";
import {
  Shield,
  Store,
  Users,
  Database,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const SUPERADMIN_EMAILS = ['hello@dainostore.com', 'hamid@dainostore.com'];

const sidebarItems = [
  { path: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/superadmin/stores', label: 'Stores', icon: Store },
  { path: '/superadmin/users', label: 'Users', icon: Users },
  { path: '/superadmin/migrations', label: 'Migrations', icon: Database },
];

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate('/admin/auth');
      return;
    }
    if (!SUPERADMIN_EMAILS.includes(currentUser.email?.toLowerCase())) {
      navigate('/admin/dashboard');
      return;
    }
    setUser(currentUser);
    setAuthorized(true);
    setLoading(false);
  }, [navigate]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 ease-in-out lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Super Admin</h1>
                <p className="text-xs text-slate-400">Platform Management</p>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              className="lg:hidden p-1 hover:bg-slate-800 rounded"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
                {active && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-medium">
              {user?.email?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || 'Super Admin'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => navigate('/admin/dashboard')}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center gap-3">
          <button
            className="p-2 hover:bg-gray-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Super Admin</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
