import React, { useState, useEffect } from "react";
import apiClient from "@/api/client";
import {
  RefreshCw,
  Loader2,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function SuperAdminAffiliatePayouts() {
  const { toast } = useToast();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    loadPayouts();
  }, [statusFilter]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await apiClient.get(`/superadmin/affiliate-payouts?${params.toString()}`);
      if (response?.success) {
        setPayouts(response.data?.payouts || []);
      } else {
        throw new Error(response?.error || 'Failed to load payouts');
      }
    } catch (error) {
      toast({
        title: "Error loading payouts",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (payoutId) => {
    setProcessing(true);
    try {
      const response = await apiClient.put(`/superadmin/affiliate-payouts/${payoutId}/process`);
      if (response?.success) {
        toast({ title: "Payout processed successfully" });
        loadPayouts();
      } else {
        throw new Error(response?.error || 'Failed to process payout');
      }
    } catch (error) {
      toast({
        title: "Error processing payout",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const openCancelDialog = (payout) => {
    setSelectedPayout(payout);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const response = await apiClient.put(`/superadmin/affiliate-payouts/${selectedPayout.id}/cancel`, {
        reason: cancelReason
      });
      if (response?.success) {
        toast({ title: "Payout cancelled" });
        setCancelDialogOpen(false);
        loadPayouts();
      } else {
        throw new Error(response?.error || 'Failed to cancel payout');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500">Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    pending: payouts.filter(p => p.status === 'pending').length,
    pendingAmount: payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    processing: payouts.filter(p => p.status === 'processing').length,
    completed: payouts.filter(p => p.status === 'completed').length,
    completedAmount: payouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Affiliate Payouts</h1>
          <p className="text-sm sm:text-base text-gray-500">Process and manage affiliate payouts</p>
        </div>
        <Button variant="outline" onClick={loadPayouts} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <p className="text-xs sm:text-sm text-gray-500">Pending</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-400">{formatCurrency(stats.pendingAmount)}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <PlayCircle className="h-4 w-4 text-blue-500" />
            <p className="text-xs sm:text-sm text-gray-500">Processing</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.processing}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <p className="text-xs sm:text-sm text-gray-500">Completed</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-gray-400">{formatCurrency(stats.completedAmount)}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-purple-500" />
            <p className="text-xs sm:text-sm text-gray-500">Total Paid</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">{formatCurrency(stats.completedAmount)}</p>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Requested</TableHead>
                <TableHead className="hidden md:table-cell">Completed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {statusFilter !== 'all' ? 'No payouts with this status' : 'No payouts found'}
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{payout.affiliates?.email}</div>
                      <div className="text-xs text-gray-400">
                        {payout.affiliates?.first_name} {payout.affiliates?.last_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">{formatCurrency(payout.amount)}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500 text-sm">
                      {payout.completed_at
                        ? new Date(payout.completed_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {payout.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleProcess(payout.id)}
                              disabled={processing}
                            >
                              {processing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Process
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCancelDialog(payout)}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {payout.status === 'failed' && payout.failure_reason && (
                          <span className="text-xs text-red-500" title={payout.failure_reason}>
                            Error
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Payout</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this payout of {formatCurrency(selectedPayout?.amount)}?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label>Reason (optional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter reason for cancellation..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Payout
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
