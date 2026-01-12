import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Link2,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import apiClient from "@/api/client";

const sidebarItems = [
  { path: '/affiliate/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/affiliate/referrals', label: 'Referrals', icon: Users },
  { path: '/affiliate/earnings', label: 'Earnings', icon: TrendingUp },
  { path: '/affiliate/payouts', label: 'Payouts', icon: DollarSign },
];

export default function AffiliateLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [affiliate, setAffiliate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('affiliateToken');
    if (!token) {
      navigate('/affiliate/login');
      return;
    }

    try {
      const response = await apiClient.get('/affiliates/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response?.success) {
        setAffiliate(response.data);
      } else {
        throw new Error('Not authenticated');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('affiliateToken');
      navigate('/affiliate/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('affiliateToken');
    navigate('/affiliate/login');
  };

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
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-indigo-900 to-purple-900 text-white flex flex-col transform transition-transform duration-200 ease-in-out lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Link2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Affiliate Portal</h1>
                <p className="text-xs text-white/60">Earn with referrals</p>
              </div>
            </div>
            <button
              className="lg:hidden p-1 hover:bg-white/10 rounded"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Referral Link */}
        {affiliate?.referral_code && (
          <div className="p-4 border-b border-white/10">
            <p className="text-xs text-white/60 mb-2">Your Referral Code</p>
            <div className="bg-white/10 rounded-lg px-3 py-2">
              <code className="text-sm font-mono text-white">{affiliate.referral_code}</code>
            </div>
          </div>
        )}

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
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
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
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-medium">
              {affiliate?.first_name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {affiliate?.first_name} {affiliate?.last_name}
              </p>
              <p className="text-xs text-white/60 truncate">{affiliate?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
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
            <Link2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">Affiliate Portal</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet context={{ affiliate, refreshAffiliate: checkAuth }} />
        </main>
      </div>
    </div>
  );
}
