import React, { useState, useEffect } from "react";
import apiClient from "@/api/client";
import { Loader2, TrendingUp, RefreshCw } from "lucide-react";
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

export default function AffiliateEarnings() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommissions();
  }, []);

  const loadCommissions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('affiliateToken');
      const response = await apiClient.get('/affiliates/auth/commissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response?.success) {
        setCommissions(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500">Approved</Badge>;
      case 'paid':
        return <Badge className="bg-green-500">Paid</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceLabel = (source) => {
    switch (source) {
      case 'credit_purchase':
        return 'Credit Purchase';
      case 'subscription_initial':
        return 'New Subscription';
      case 'subscription_recurring':
        return 'Recurring';
      default:
        return source;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Calculate totals
  const totals = {
    pending: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0),
    approved: commissions.filter(c => c.status === 'approved').reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0),
    paid: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0),
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Your Earnings</h1>
          <p className="text-sm text-gray-500">Commission history from your referrals</p>
        </div>
        <Button variant="outline" onClick={loadCommissions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-gray-500">Pending</p>
          <p className="text-lg sm:text-xl font-bold text-yellow-600">{formatCurrency(totals.pending)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-gray-500">Approved</p>
          <p className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrency(totals.approved)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-gray-500">Paid</p>
          <p className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(totals.paid)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Purchase</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : commissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No earnings yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Commissions appear when your referrals make purchases
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(commission.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getSourceLabel(commission.source_type)}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatCurrency(commission.purchase_amount)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">
                        {formatCurrency(commission.commission_amount)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(commission.status)}</TableCell>
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
