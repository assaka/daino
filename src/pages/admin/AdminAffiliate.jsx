/**
 * AdminAffiliate.jsx
 *
 * Affiliate dashboard for store owners who are also affiliates.
 * Shows their referrals, earnings, and payout requests.
 * Linked from the admin sidebar.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wallet,
  ArrowRight,
  MousePointerClick
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAffiliate() {
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [copied, setCopied] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  useEffect(() => {
    loadAffiliateData();
  }, []);

  const loadAffiliateData = async () => {
    try {
      setLoading(true);

      // Get current user's affiliate info
      const meResponse = await apiClient.get('/affiliates/auth/me');

      if (!meResponse.success) {
        setAffiliate(null);
        setLoading(false);
        return;
      }

      setAffiliate(meResponse.data);

      // Load stats, referrals, commissions, payouts in parallel
      const [statsRes, referralsRes, commissionsRes, payoutsRes] = await Promise.all([
        apiClient.get('/affiliates/auth/stats'),
        apiClient.get('/affiliates/auth/referrals'),
        apiClient.get('/affiliates/auth/commissions'),
        apiClient.get('/affiliates/auth/payouts')
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (referralsRes.success) setReferrals(referralsRes.data || []);
      if (commissionsRes.success) setCommissions(commissionsRes.data || []);
      if (payoutsRes.success) setPayouts(payoutsRes.data || []);

    } catch (error) {
      console.error('Error loading affiliate data:', error);
      // User is not an affiliate
      setAffiliate(null);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/signup?ref=${affiliate.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestPayout = async () => {
    if (!stats || stats.availableBalance < stats.minPayoutAmount) {
      toast.error(`Minimum payout is $${stats?.minPayoutAmount || 50}`);
      return;
    }

    try {
      setRequestingPayout(true);
      const response = await apiClient.post('/affiliates/auth/request-payout');

      if (response.success) {
        toast.success('Payout requested successfully!');
        loadAffiliateData(); // Refresh data
      } else {
        toast.error(response.error || 'Failed to request payout');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to request payout');
    } finally {
      setRequestingPayout(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
      approved: { variant: 'default', icon: CheckCircle, label: 'Approved' },
      paid: { variant: 'success', icon: Check, label: 'Paid' },
      cancelled: { variant: 'destructive', icon: XCircle, label: 'Cancelled' },
      refunded: { variant: 'outline', icon: AlertCircle, label: 'Refunded' },
      signed_up: { variant: 'secondary', icon: Users, label: 'Signed Up' },
      converted: { variant: 'default', icon: CheckCircle, label: 'Converted' },
      qualified: { variant: 'success', icon: TrendingUp, label: 'Qualified' },
      processing: { variant: 'secondary', icon: Clock, label: 'Processing' },
      completed: { variant: 'success', icon: Check, label: 'Completed' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' }
    };

    const config = variants[status] || { variant: 'outline', icon: AlertCircle, label: status };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Not an affiliate - show signup prompt
  if (!affiliate) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">Become an Affiliate</CardTitle>
            <CardDescription className="text-base">
              Earn commissions by referring new store owners to DainoStore
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">Up to 20%</p>
                <p className="text-sm text-gray-600">Commission Rate</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">30 Days</p>
                <p className="text-sm text-gray-600">Cookie Duration</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">Fast</p>
                <p className="text-sm text-gray-600">Stripe Payouts</p>
              </div>
            </div>

            <div className="text-center">
              <Button asChild size="lg">
                <Link to="/affiliate/apply">
                  Apply to Become an Affiliate
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Affiliate dashboard
  const baseUrl = window.location.origin;
  const referralLink = `${baseUrl}/signup?ref=${affiliate.referral_code}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
          <p className="text-gray-600">
            Tier: <span className="font-medium">{affiliate.affiliate_tiers?.name || 'Standard'}</span>
            {' • '}
            Commission: <span className="font-medium">
              {affiliate.custom_commission_value
                ? `${(affiliate.custom_commission_value * 100).toFixed(0)}%`
                : affiliate.affiliate_tiers?.commission_rate
                  ? `${(affiliate.affiliate_tiers.commission_rate * 100).toFixed(0)}%`
                  : '10%'}
            </span>
          </p>
        </div>
      </div>

      {/* Referral Link Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Your Referral Link</CardTitle>
          <CardDescription>Share this link to earn commissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-gray-100 rounded-lg text-sm truncate">
              {referralLink}
            </code>
            <Button onClick={copyReferralLink} variant="outline" size="icon">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button asChild variant="outline" size="icon">
              <a href={referralLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Referral Code: <span className="font-mono font-medium">{affiliate.referral_code}</span>
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Clicks</p>
                  <p className="text-2xl font-bold">{stats.clicks}</p>
                </div>
                <MousePointerClick className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Signups</p>
                  <p className="text-2xl font-bold">{stats.signups}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.conversions} converted ({stats.conversionRate}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ${stats.totalPaidOut.toFixed(2)} paid out
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Available Balance</p>
                  <p className="text-2xl font-bold text-green-700">${stats.availableBalance.toFixed(2)}</p>
                </div>
                <Wallet className="h-8 w-8 text-green-600" />
              </div>
              <Button
                onClick={handleRequestPayout}
                disabled={requestingPayout || stats.availableBalance < stats.minPayoutAmount}
                size="sm"
                className="mt-3 w-full"
              >
                {requestingPayout ? 'Requesting...' : 'Request Payout'}
              </Button>
              <p className="text-xs text-green-600 mt-1 text-center">
                Min: ${stats.minPayoutAmount}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for Referrals, Commissions, Payouts */}
      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="commissions">Commissions ({commissions.length})</TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({payouts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      No referrals yet. Share your link to get started!
                    </TableCell>
                  </TableRow>
                ) : (
                  referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-mono text-sm">{referral.referred_email}</TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell>${(referral.total_purchases || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(referral.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No commissions yet. Earnings appear when referrals make purchases.
                    </TableCell>
                  </TableRow>
                ) : (
                  commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="capitalize">
                        {commission.source_type.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>${commission.purchase_amount.toFixed(2)}</TableCell>
                      <TableCell className="font-medium text-green-600">
                        +${commission.commission_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(commission.status)}</TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(commission.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      No payouts yet. Request a payout when you have available balance.
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">${payout.amount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(payout.requested_at || payout.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {payout.completed_at
                          ? new Date(payout.completed_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
