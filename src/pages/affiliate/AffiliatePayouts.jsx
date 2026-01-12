import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import apiClient from "@/api/client";
import {
  Loader2,
  DollarSign,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function AffiliatePayouts() {
  const { affiliate, refreshAffiliate } = useOutletContext();
  const { toast } = useToast();
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('affiliateToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [payoutsRes, statsRes] = await Promise.all([
        apiClient.get('/affiliates/auth/payouts', { headers }),
        apiClient.get('/affiliates/auth/stats', { headers })
      ]);

      if (payoutsRes?.success) {
        setPayouts(payoutsRes.data || []);
      }
      if (statsRes?.success) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    setRequesting(true);
    try {
      const token = localStorage.getItem('affiliateToken');
      const response = await apiClient.post('/affiliates/auth/request-payout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response?.success) {
        toast({ title: "Payout requested!", description: "We'll process your payout soon." });
        setConfirmDialogOpen(false);
        loadData();
        refreshAffiliate?.();
      } else {
        throw new Error(response?.error || 'Failed to request payout');
      }
    } catch (error) {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
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

  const canRequestPayout = stats && stats.availableBalance >= (stats.minPayoutAmount || 50);
  const hasPendingPayout = payouts.some(p => ['pending', 'processing'].includes(p.status));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-sm text-gray-500">Request and track your payouts</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Balance Card */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Available Balance</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(stats?.availableBalance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Minimum payout: {formatCurrency(stats?.minPayoutAmount || 50)}
            </p>
          </div>
          <Button
            onClick={() => setConfirmDialogOpen(true)}
            disabled={!canRequestPayout || hasPendingPayout || loading}
            size="lg"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Request Payout
          </Button>
        </div>

        {hasPendingPayout && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              You have a pending payout request. Please wait for it to be processed before requesting another.
            </p>
          </div>
        )}

        {!canRequestPayout && !hasPendingPayout && stats && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              You need at least {formatCurrency(stats.minPayoutAmount)} to request a payout.
              You're {formatCurrency((stats.minPayoutAmount || 50) - stats.availableBalance)} away.
            </p>
          </div>
        )}
      </Card>

      {/* Payout History */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Payout History</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Requested</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No payouts yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Request your first payout when you reach the minimum
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-sm">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(payout.amount)}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                      {payout.completed_at
                        ? new Date(payout.completed_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              You're about to request a payout of {formatCurrency(stats?.availableBalance)}.
              This will be processed within 1-3 business days.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold">{formatCurrency(stats?.availableBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Payment method</span>
                <span>Stripe Connect</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestPayout} disabled={requesting}>
              {requesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
