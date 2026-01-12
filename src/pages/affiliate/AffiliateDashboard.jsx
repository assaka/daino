import React, { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import apiClient from "@/api/client";
import {
  Loader2,
  Copy,
  Check,
  TrendingUp,
  Users,
  DollarSign,
  MousePointerClick,
  ExternalLink,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export default function AffiliateDashboard() {
  const { affiliate } = useOutletContext();
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('affiliateToken');
      const response = await apiClient.get('/affiliates/auth/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReferralLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?ref=${affiliate?.referral_code}`;
  };

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(getReferralLink());
      setCopied(true);
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Welcome back, {affiliate?.first_name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here's how your referrals are performing
        </p>
      </div>

      {/* Referral Link Card */}
      <Card className="p-6 mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg mb-1">Your Referral Link</h2>
            <p className="text-white/80 text-sm">Share this link to earn commissions</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/20 rounded-lg px-4 py-2 flex-1 sm:flex-none">
              <code className="text-sm font-mono break-all">{getReferralLink()}</code>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyReferralLink}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MousePointerClick className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Clicks</span>
          </div>
          <p className="text-2xl font-bold">{stats?.clicks || 0}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Signups</span>
          </div>
          <p className="text-2xl font-bold">{stats?.signups || 0}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Conversions</span>
          </div>
          <p className="text-2xl font-bold">{stats?.conversions || 0}</p>
          <p className="text-xs text-gray-400">{stats?.conversionRate}% rate</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm text-gray-500">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.totalEarnings)}</p>
        </Card>
      </div>

      {/* Earnings Breakdown */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Earnings</h3>
          <p className="text-xl font-bold text-yellow-600">{formatCurrency(stats?.pendingEarnings)}</p>
          <p className="text-xs text-gray-400 mt-1">Being processed (14-day hold)</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Available Balance</h3>
          <p className="text-xl font-bold text-green-600">{formatCurrency(stats?.availableBalance)}</p>
          <p className="text-xs text-gray-400 mt-1">Ready for payout</p>
          {stats?.availableBalance >= (stats?.minPayoutAmount || 50) && (
            <Link to="/affiliate/payouts">
              <Button size="sm" className="mt-3">
                Request Payout
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Paid Out</h3>
          <p className="text-xl font-bold">{formatCurrency(stats?.totalPaidOut)}</p>
          <p className="text-xs text-gray-400 mt-1">Lifetime payouts</p>
        </Card>
      </div>

      {/* Tier Info */}
      {affiliate?.affiliate_tiers && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Your Tier: {affiliate.affiliate_tiers.name}</h3>
                <Badge variant="secondary">{affiliate.affiliate_tiers.code}</Badge>
              </div>
              <p className="text-sm text-gray-500">
                {affiliate.affiliate_tiers.commission_type === 'percentage'
                  ? `${(affiliate.affiliate_tiers.commission_rate * 100).toFixed(0)}% commission on all referral purchases`
                  : `$${affiliate.affiliate_tiers.commission_rate} per successful referral`
                }
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Min. Payout</p>
              <p className="font-semibold">{formatCurrency(stats?.minPayoutAmount)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Links */}
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <Link to="/affiliate/referrals">
          <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-400" />
                <span className="font-medium">View Referrals</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>
          </Card>
        </Link>
        <Link to="/affiliate/earnings">
          <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-gray-400" />
                <span className="font-medium">View Earnings</span>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
