
import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { User } from '@/api/entities';
import { Store } from '@/api/entities';
import { CreditTransaction } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Store as StoreIcon, Users, Settings, Trash2, Eye, Crown, UserPlus, Pause, Play, AlertCircle, Calendar, Filter, Mail, CreditCard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getExternalStoreUrl, getStoreBaseUrl } from '@/utils/urlUtils';
import apiClient from '@/api/client';
import brevoAPI from '@/api/brevo';

export default function Stores() {
  const navigate = useNavigate();
  const { selectStore, refreshStores } = useStoreSelection();
  const [stores, setStores] = useState([]);
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]); // Keep state for clients, though its usage in loadData is removed by outline
  const [loading, setLoading] = useState(true);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [storeToPublish, setStoreToPublish] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [storeUptimes, setStoreUptimes] = useState({});
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'pending_database', 'provisioning', 'suspended', 'inactive'
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationErrors, setValidationErrors] = useState({ email: false, payment: false });
  const [validatingStore, setValidatingStore] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);

      // Backend API automatically filters stores by user's email from JWT token
      // No need to pass filter parameters - the backend handles this
      const userStores = await Store.findAll();

      // Fetch uptime data for each store
      try {
        const uptimeMap = {};

        // Fetch uptime for each store individually (tenant DB per store)
        await Promise.all(
          userStores.map(async (store) => {
            try {
              const uptimeResponse = await apiClient.get(
                `credits/uptime-report?days=365&store_id=${store.id}`
              );

              if (uptimeResponse && uptimeResponse.store_breakdown && uptimeResponse.store_breakdown[0]) {
                const breakdown = uptimeResponse.store_breakdown[0];
                uptimeMap[store.id] = {
                  days_running: breakdown.days_running,
                  total_credits: breakdown.total_credits
                };
              }
            } catch (storeUptimeError) {
              console.error(`Error loading uptime for store ${store.id}:`, storeUptimeError);
              // Continue with other stores
            }
          })
        );

        setStoreUptimes(uptimeMap);
      } catch (uptimeError) {
        console.error('Error loading uptime data:', uptimeError);
        // Continue without uptime data
      }

      // Store.findAll() already returns complete store data with all fields
      setStores(userStores || []);
    } catch (error) {
      console.error('Error loading stores:', error);
      // Set empty array on error to prevent "no stores" message from showing incorrectly
      setStores([]);
    } finally {
      setLoading(false);
    }
  };


  const handleTogglePublished = async (storeId, currentStatus) => {
    const newStatus = !currentStatus;

    // If publishing (paused -> running), validate email and payment configuration first
    if (!currentStatus) {
      const store = stores.find(s => s.id === storeId);
      setValidatingStore({ id: storeId, name: store?.name });

      try {
        // Check email configuration
        const emailStatus = await brevoAPI.getConnectionStatus(storeId);
        const isEmailConfigured = emailStatus?.data?.isConfigured || emailStatus?.isConfigured || false;

        // Check payment methods - need at least one active
        const pmResponse = await apiClient.get(`payment-methods?store_id=${storeId}&limit=100`);
        const paymentMethods = pmResponse?.data?.payment_methods || pmResponse?.payment_methods || [];
        const hasActivePaymentMethod = paymentMethods.some(pm => pm.is_active === true);

        // If either is missing, show validation error modal
        if (!isEmailConfigured || !hasActivePaymentMethod) {
          setValidationErrors({
            email: !isEmailConfigured,
            payment: !hasActivePaymentMethod
          });
          setShowValidationError(true);
          setValidatingStore(null);
          return;
        }

        // Validation passed - show publish confirmation
        setStoreToPublish({ id: storeId, name: store?.name });
        setShowPublishConfirm(true);
        setValidatingStore(null);
      } catch (error) {
        console.error('Error validating store configuration:', error);
        // If validation fails due to error, show generic error
        setValidationErrors({ email: true, payment: true });
        setShowValidationError(true);
        setValidatingStore(null);
        return;
      }
      return;
    }

    // If pausing (running -> paused), proceed immediately
    await confirmTogglePublished(storeId, currentStatus);
  };

  const confirmTogglePublished = async (storeId, currentStatus) => {
    const newStatus = !currentStatus;

    try {
      // Optimistic update: Update UI immediately
      setStores(prevStores =>
        prevStores.map(store =>
          store.id === storeId
            ? { ...store, published: newStatus }
            : store
        )
      );

      // Update backend
      const response = await Store.update(storeId, { published: newStatus });

      // Wait a moment for database to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload data to confirm and get any other changes
      await loadData();

      // Close confirmation modal if open
      setShowPublishConfirm(false);
      setStoreToPublish(null);
    } catch (error) {
      console.error('❌ Error toggling store published status:', error);
      alert('Failed to update store status. Please try again.');

      // Revert optimistic update on error
      await loadData();

      // Close confirmation modal
      setShowPublishConfirm(false);
      setStoreToPublish(null);
    }
  };

  const handleDeleteStore = async (storeId) => {
    const store = stores.find(s => s.id === storeId);
    setStoreToDelete({ id: storeId, name: store?.name });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteStore = async () => {
    if (!storeToDelete) return;

    try {
      await Store.delete(storeToDelete.id);
      setShowDeleteConfirm(false);
      setStoreToDelete(null);
      loadData();
    } catch (error) {
      console.error('Error deleting store:', error);
      alert('Failed to delete store. Please try again.');
      setShowDeleteConfirm(false);
      setStoreToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter stores based on status
  const filteredStores = statusFilter === 'all'
    ? stores
    : stores.filter(store => store.status === statusFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.account_type === 'agency' ? 'Client Stores' : user?.role === 'admin' ? 'All Stores' : 'My Stores'}
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.account_type === 'agency'
              ? `Manage stores for your clients. ${user?.credits || 0} credits remaining.`
              : user?.role === 'admin'
                ? 'Manage all stores in the system'
                : 'Manage your online stores'
            }
          </p>
        </div>

        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => navigate('/admin/onboarding')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Store
        </Button>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <Label className="text-sm font-medium text-gray-700">Filter by Status:</Label>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_database">Pending Database</SelectItem>
            <SelectItem value="provisioning">Provisioning</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {statusFilter !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter('all')}
            className="text-gray-600"
          >
            Clear Filter
          </Button>
        )}
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <StoreIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No stores yet</h3>
            <p className="text-gray-600 mb-6">
              {user?.account_type === 'agency'
                ? 'Create your first client store to get started.'
                : user?.role === 'admin'
                  ? 'Create the first store to get started.'
                  : 'Create your first store to start selling online.'
              }
            </p>
            <Button onClick={() => navigate('/admin/onboarding')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Store
            </Button>
          </CardContent>
        </Card>
      ) : filteredStores.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No stores found</h3>
            <p className="text-gray-600 mb-6">
              No stores match the selected status filter.
            </p>
            <Button variant="outline" onClick={() => setStatusFilter('all')}>
              Clear Filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <Card key={store.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{store.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Created: {store.created_at ?
                        new Date(store.created_at).toLocaleDateString() :
                        'Unknown'
                      }
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {/* Check multiple ways to determine ownership */}
                    {(store.user_id === user?.id || store.is_direct_owner || store.access_role === 'owner') ? (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200" variant="outline">
                        <Crown className="w-3 h-3 mr-1" />
                        Owner
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="outline">
                        <UserPlus className="w-3 h-3 mr-1" />
                        Invited
                      </Badge>
                    )}
                    <Badge className={store.published ? 'bg-green-100 text-green-800 border-green-200' : 'bg-orange-100 text-orange-800 border-orange-200'}  variant="outline">
                      {store.published ? 'Running' : 'Paused'}
                    </Badge>
                    {/* Status Badge */}
                    {store.status && (
                      <Badge className={
                        store.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        store.status === 'pending_database' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        store.status === 'provisioning' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        store.status === 'suspended' ? 'bg-red-100 text-red-800 border-red-200' :
                        store.status === 'inactive' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                      } variant="outline">
                        {store.status === 'pending_database' ? 'Pending DB' :
                         store.status === 'provisioning' ? 'Provisioning' :
                         store.status === 'active' ? 'Ready' :
                         store.status === 'suspended' ? 'Suspended' :
                         store.status === 'inactive' ? 'Inactive' :
                         store.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const storeCode = store.slug || store.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        if (store.published) {
                          const baseUrl = getStoreBaseUrl(store);
                          window.open(getExternalStoreUrl(storeCode, '', baseUrl), '_blank');
                        } else {
                          // Use preview URL when store is not running
                          window.open(`/public/${storeCode}`, '_blank');
                        }
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Set this store as selected and navigate to settings
                        // This ensures the settings page loads with the correct store context
                        window.location.href = `/admin/settings?store=${store.id}`;
                      }}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Manage
                    </Button>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTogglePublished(store.id, store.published)}
                      className={store.published ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                      title={store.published ? "Pause store (stop daily charges)" : "Run store (start daily charges)"}
                    >
                      {store.published ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteStore(store.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Uptime Information */}
                {storeUptimes[store.id] && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>Total Uptime:</span>
                      </div>
                      <div className="font-semibold text-gray-900">
                        {storeUptimes[store.id].days_running} {storeUptimes[store.id].days_running === 1 ? 'day' : 'days'}
                        <span className="text-gray-500 ml-2">
                          ({storeUptimes[store.id].total_credits} credits)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Publish Confirmation Modal */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Running Store?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">
                Store: {storeToPublish?.name}
              </p>
              <p className="text-sm text-blue-800">
                Running this store will cost <strong>1 credit per day</strong>.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 font-medium mb-2">
                Daily Billing Information:
              </p>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                <li>1 credit will be deducted every day at midnight UTC</li>
                <li>Your current balance: <strong>{user?.credits || 0} credits</strong></li>
                <li>You can pause the store anytime to stop charges</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPublishConfirm(false);
                  setStoreToPublish(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (storeToPublish) {
                    confirmTogglePublished(storeToPublish.id, false);
                  }
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                Start Running
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Delete Store?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900 font-medium mb-2">
                Store: {storeToDelete?.name}
              </p>
              <p className="text-sm text-red-800">
                This action cannot be undone. The store will be permanently suspended.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 font-medium mb-2">
                Warning:
              </p>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                <li>All store data will be inaccessible</li>
                <li>This store will be marked as suspended</li>
                <li>You will not be charged for this store anymore</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setStoreToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={confirmDeleteStore}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Store
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Error Modal */}
      <Dialog open={showValidationError} onOpenChange={setShowValidationError}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              Cannot Start Store
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 font-medium mb-3">
                Please complete the following setup before starting your store:
              </p>
              <ul className="space-y-3">
                {validationErrors.email && (
                  <li className="flex items-start gap-3 text-sm text-amber-800">
                    <Mail className="w-5 h-5 mt-0.5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Email Service Not Configured</p>
                      <p className="text-amber-700">Configure your email service (Brevo) to send order confirmations and customer notifications.</p>
                    </div>
                  </li>
                )}
                {validationErrors.payment && (
                  <li className="flex items-start gap-3 text-sm text-amber-800">
                    <CreditCard className="w-5 h-5 mt-0.5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium">No Payment Method Enabled</p>
                      <p className="text-amber-700">Enable at least one payment method so customers can complete purchases.</p>
                    </div>
                  </li>
                )}
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowValidationError(false);
                  setValidationErrors({ email: false, payment: false });
                }}
              >
                Close
              </Button>
              {validationErrors.email && (
                <Button
                  onClick={() => {
                    setShowValidationError(false);
                    navigate('/admin/email-settings');
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Configure Email
                </Button>
              )}
              {!validationErrors.email && validationErrors.payment && (
                <Button
                  onClick={() => {
                    setShowValidationError(false);
                    navigate('/admin/payment-methods');
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Configure Payments
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
