import React, { useState, useEffect } from 'react';
import { StorePauseAccess } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  KeyRound,
  Check,
  X,
  Ban,
  Clock,
  Mail,
  Loader2,
  AlertCircle
} from 'lucide-react';
import FlashMessage from '@/components/storefront/FlashMessage';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: Check
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: X
  },
  revoked: {
    label: 'Revoked',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Ban
  }
};

export default function AccessRequestsManagement({ storeId, storeName }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [flashMessage, setFlashMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, request: null });
  const [actionLoading, setActionLoading] = useState(null);

  // Fetch requests
  const fetchRequests = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const result = await StorePauseAccess.getRequests(storeId, { status: 'all', limit: 100 });
      setRequests(result?.requests || []);
    } catch (error) {
      console.error('Error fetching access requests:', error);
      showFlash('Failed to load access requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [storeId]);

  const showFlash = (message, type = 'success') => {
    setFlashMessage({ message, type });
    setTimeout(() => setFlashMessage(null), 4000);
  };

  const handleApprove = async (request) => {
    setActionLoading(request.id);
    try {
      await StorePauseAccess.approve(storeId, request.id);
      showFlash(`Access approved for ${request.email}`);
      fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      showFlash('Failed to approve request', 'error');
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, action: null, request: null });
    }
  };

  const handleReject = async (request) => {
    setActionLoading(request.id);
    try {
      await StorePauseAccess.reject(storeId, request.id);
      showFlash(`Request from ${request.email} rejected`);
      fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      showFlash('Failed to reject request', 'error');
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, action: null, request: null });
    }
  };

  const handleRevoke = async (request) => {
    setActionLoading(request.id);
    try {
      await StorePauseAccess.revoke(storeId, request.id);
      showFlash(`Access revoked for ${request.email}`);
      fetchRequests();
    } catch (error) {
      console.error('Error revoking access:', error);
      showFlash('Failed to revoke access', 'error');
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, action: null, request: null });
    }
  };

  const openConfirmDialog = (action, request) => {
    setConfirmDialog({ open: true, action, request });
  };

  const executeAction = () => {
    const { action, request } = confirmDialog;
    if (action === 'approve') handleApprove(request);
    else if (action === 'reject') handleReject(request);
    else if (action === 'revoke') handleRevoke(request);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter requests by status
  const filteredRequests = requests.filter(r => {
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'approved') return r.status === 'approved';
    if (activeTab === 'other') return r.status === 'rejected' || r.status === 'revoked';
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const otherCount = requests.filter(r => r.status === 'rejected' || r.status === 'revoked').length;

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Please select a store to manage access requests.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <FlashMessage message={flashMessage?.message} type={flashMessage?.type} />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Access Requests</CardTitle>
          </div>
          <CardDescription>
            Manage access requests from users who want to view your paused store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <Check className="h-4 w-4" />
                Approved
                {approvedCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{approvedCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="other" className="gap-2">
                <X className="h-4 w-4" />
                Rejected/Revoked
                {otherCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{otherCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {activeTab === 'other' ? 'rejected or revoked' : activeTab} requests
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => {
                      const StatusIcon = STATUS_CONFIG[request.status]?.icon || Clock;
                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{request.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
                              {request.message || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(request.requested_at)}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${STATUS_CONFIG[request.status]?.color} gap-1`}>
                              <StatusIcon className="h-3 w-3" />
                              {STATUS_CONFIG[request.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {request.status === 'pending' && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => openConfirmDialog('approve', request)}
                                  disabled={actionLoading === request.id}
                                >
                                  {actionLoading === request.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  <span className="ml-1">Approve</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => openConfirmDialog('reject', request)}
                                  disabled={actionLoading === request.id}
                                >
                                  <X className="h-4 w-4" />
                                  <span className="ml-1">Reject</span>
                                </Button>
                              </div>
                            )}
                            {request.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => openConfirmDialog('revoke', request)}
                                disabled={actionLoading === request.id}
                              >
                                {actionLoading === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Ban className="h-4 w-4" />
                                )}
                                <span className="ml-1">Revoke</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, request: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' && 'Approve Access Request?'}
              {confirmDialog.action === 'reject' && 'Reject Access Request?'}
              {confirmDialog.action === 'revoke' && 'Revoke Access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve' && (
                <>
                  This will allow <strong>{confirmDialog.request?.email}</strong> to view your paused store.
                  They will receive an email with a link to access the store.
                </>
              )}
              {confirmDialog.action === 'reject' && (
                <>
                  This will deny <strong>{confirmDialog.request?.email}</strong>'s request to view your store.
                  They will be notified via email.
                </>
              )}
              {confirmDialog.action === 'revoke' && (
                <>
                  This will remove <strong>{confirmDialog.request?.email}</strong>'s access to your paused store.
                  They will no longer be able to view the store.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className={
                confirmDialog.action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {confirmDialog.action === 'approve' && 'Approve'}
              {confirmDialog.action === 'reject' && 'Reject'}
              {confirmDialog.action === 'revoke' && 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
