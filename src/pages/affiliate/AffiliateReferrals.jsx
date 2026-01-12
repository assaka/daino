import React, { useState, useEffect } from "react";
import apiClient from "@/api/client";
import { Loader2, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AffiliateReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('affiliateToken');
      const response = await apiClient.get('/affiliates/auth/referrals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response?.success) {
        setReferrals(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'signed_up':
        return <Badge variant="secondary">Signed Up</Badge>;
      case 'converted':
        return <Badge className="bg-green-500">Converted</Badge>;
      case 'qualified':
        return <Badge className="bg-blue-500">Qualified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Your Referrals</h1>
          <p className="text-sm text-gray-500">People who signed up using your link</p>
        </div>
        <Button variant="outline" onClick={loadReferrals} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">First Purchase</TableHead>
                <TableHead className="hidden md:table-cell">Total Purchases</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : referrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No referrals yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Share your referral link to start earning
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <span className="font-medium">{referral.referred_email}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(referral.status)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {referral.first_purchase_amount
                        ? formatCurrency(referral.first_purchase_amount)
                        : '-'}
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
    </div>
  );
}
