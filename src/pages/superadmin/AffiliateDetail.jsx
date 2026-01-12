import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "@/api/client";
import {
  ArrowLeft,
  Loader2,
  Check,
  X,
  Ban,
  ExternalLink,
  Copy,
  DollarSign,
  Users,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SuperAdminAffiliateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [affiliate, setAffiliate] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAffiliate();
    loadReferrals();
    loadCommissions();
    loadTiers();
  }, [id]);

  const loadAffiliate = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/superadmin/affiliates/${id}`);
      if (response?.success) {
        setAffiliate(response.data);
      } else {
        throw new Error(response?.error || 'Failed to load affiliate');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReferrals = async () => {
    try {
      const response = await apiClient.get(`/superadmin/affiliates/${id}/referrals`);
      if (response?.success) {
        setReferrals(response.data?.referrals || []);
      }
    } catch (error) {
      console.error('Error loading referrals:', error);
    }
  };

  const loadCommissions = async () => {
    try {
      const response = await apiClient.get(`/superadmin/affiliates/${id}/commissions`);
      if (response?.success) {
        setCommissions(response.data?.commissions || []);
      }
    } catch (error) {
      console.error('Error loading commissions:', error);
    }
  };

  const loadTiers = async () => {
    try {
      const response = await apiClient.get('/superadmin/affiliate-tiers');
      if (response?.success) {
        setTiers(response.data?.tiers || []);
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await apiClient.put(`/superadmin/affiliates/${id}/approve`);
      if (response?.success) {
        toast({ title: "Affiliate approved" });
        loadAffiliate();
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    try {
      const response = await apiClient.put(`/superadmin/affiliates/${id}/reject`);
      if (response?.success) {
        toast({ title: "Affiliate rejected" });
        loadAffiliate();
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSuspend = async () => {
    try {
      const response = await apiClient.put(`/superadmin/affiliates/${id}/suspend`);
      if (response?.success) {
        toast({ title: "Affiliate suspended" });
        loadAffiliate();
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateTier = async (tierId) => {
    setSaving(true);
    try {
      const response = await apiClient.put(`/superadmin/affiliates/${id}`, {
        tier_id: tierId
      });
      if (response?.success) {
        toast({ title: "Tier updated" });
        loadAffiliate();
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'approved': return <Badge className="bg-green-500">Approved</Badge>;
      case 'suspended': return <Badge className="bg-red-500">Suspended</Badge>;
      case 'rejected': return <Badge variant="secondary">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReferralStatusBadge = (status) => {
    switch (status) {
      case 'clicked': return <Badge variant="outline">Clicked</Badge>;
      case 'signed_up': return <Badge className="bg-blue-500">Signed Up</Badge>;
      case 'converted': return <Badge className="bg-green-500">Converted</Badge>;
      case 'qualified': return <Badge className="bg-purple-500">Qualified</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCommissionStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'approved': return <Badge className="bg-blue-500">Approved</Badge>;
      case 'paid': return <Badge className="bg-green-500">Paid</Badge>;
      case 'cancelled': return <Badge variant="secondary">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Affiliate not found</p>
      </div>
    );
  }

  const referralUrl = `${window.location.origin}/signup?ref=${affiliate.referral_code}`;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/superadmin/affiliates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {affiliate.first_name} {affiliate.last_name}
          </h1>
          <p className="text-sm text-gray-500">{affiliate.email}</p>
        </div>
        {getStatusBadge(affiliate.status)}
      </div>

      {/* Action Buttons */}
      {affiliate.status === 'pending' && (
        <div className="flex gap-2 mb-6">
          <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button variant="destructive" onClick={handleReject}>
            <X className="h-4 w-4 mr-2" />
            Reject
          </Button>
        </div>
      )}
      {affiliate.status === 'approved' && (
        <div className="flex gap-2 mb-6">
          <Button variant="destructive" onClick={handleSuspend}>
            <Ban className="h-4 w-4 mr-2" />
            Suspend
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-gray-400" />
            <p className="text-xs sm:text-sm text-gray-500">Total Referrals</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{affiliate.total_referrals || 0}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <p className="text-xs sm:text-sm text-gray-500">Conversions</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{affiliate.total_conversions || 0}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <p className="text-xs sm:text-sm text-gray-500">Total Earnings</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{formatCurrency(affiliate.total_earnings)}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-purple-500" />
            <p className="text-xs sm:text-sm text-gray-500">Pending Balance</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">{formatCurrency(affiliate.pending_balance)}</p>
        </Card>
      </div>

      {/* Profile & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{affiliate.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Company</span>
              <span className="font-medium">{affiliate.company_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium">{affiliate.phone || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Website</span>
              {affiliate.website_url ? (
                <a href={affiliate.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 flex items-center gap-1">
                  Visit <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>-</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <Badge variant="outline">{affiliate.affiliate_type}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Joined</span>
              <span className="font-medium">{new Date(affiliate.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 block mb-1">Referral Code</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono">
                  {affiliate.referral_code}
                </code>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(affiliate.referral_code)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">Referral Link</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-xs overflow-hidden text-ellipsis">
                  {referralUrl}
                </code>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(referralUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">Commission Tier</label>
              <Select
                value={affiliate.tier_id || ''}
                onValueChange={handleUpdateTier}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map(tier => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.name} ({tier.commission_type === 'percentage'
                        ? `${(tier.commission_rate * 100).toFixed(0)}%`
                        : formatCurrency(tier.commission_rate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">Stripe Connect</label>
              <div className="flex items-center gap-2">
                {affiliate.stripe_connect_account_id ? (
                  <>
                    <Badge className="bg-green-500">Connected</Badge>
                    {affiliate.stripe_payouts_enabled && (
                      <Badge variant="outline">Payouts Enabled</Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="secondary">Not Connected</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Application Notes */}
      {affiliate.application_notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Application Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 whitespace-pre-wrap">{affiliate.application_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Referrals and Commissions */}
      <Tabs defaultValue="referrals" className="w-full">
        <TabsList>
          <TabsTrigger value="referrals">Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="commissions">Commissions ({commissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                    <TableHead className="hidden md:table-cell">Purchases</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No referrals yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">{referral.referred_email}</TableCell>
                        <TableCell>{getReferralStatusBadge(referral.status)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-gray-500">
                          {referral.tracking_source || '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatCurrency(referral.total_purchases)}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Purchase</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No commissions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="font-medium capitalize">
                          {commission.source_type.replace('_', ' ')}
                        </TableCell>
                        <TableCell>{formatCurrency(commission.purchase_amount)}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(commission.commission_amount)}
                        </TableCell>
                        <TableCell>{getCommissionStatusBadge(commission.status)}</TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {new Date(commission.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
