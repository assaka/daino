import React, { useState } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { AlertTriangle, Database, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/**
 * StoreHealthGuard - Middleware component that blocks rendering if store database is unhealthy
 * Must wrap admin pages to prevent them from trying to load data from an empty database
 */
export default function StoreHealthGuard({ children, pageName }) {
  const {
    selectedStore,
    loading,
    deleteStorePermanently,
  } = useStoreSelection();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  // Skip health check ONLY for pages that don't require a healthy database
  const skipPages = [
    'Auth',
    'StoreOnboarding',
    // Admin pages that should work without a healthy database
    'Stores',              // Allow switching to another store
    'DatabaseIntegrations', // Allow configuring database
    'Dashboard',           // Show dashboard even with pending database
    // Public/Storefront pages - don't block customers
    'Storefront',
    'Category',
    'ProductDetail',
    'Cart',
    'Checkout',
    'OrderSuccess',
    'OrderCancel',
    'CustomerAuth',
    'CustomerDashboard',
    'ResetPassword',
    'EmailVerification',
    'CmsPageViewer',
    'SitemapPublic',
    'RobotsPublic',
    'Landing',
    'NotFound'
  ];
  if (skipPages.includes(pageName)) {
    return children;
  }

  // No store selected - let the normal flow handle redirect
  if (!selectedStore) {
    return children;
  }

  // Check if database is unhealthy (no config)
  const isDatabaseUnhealthy = selectedStore.database_healthy === false;

  // If database is healthy, render children normally
  if (!isDatabaseUnhealthy) {
    return children;
  }

  // Redirect to onboarding step 2 (database connection)
  const handleReprovision = () => {
    window.location.href = '/admin/onboarding?step=2&reprovision=true';
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteStorePermanently();

      if (!result.success) {
        setError(result.error || 'Failed to delete store');
      } else {
        window.location.href = '/admin/stores';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Database Issue</h2>
              <p className="text-sm text-gray-500">{selectedStore?.name || 'Your store'}</p>
            </div>
          </div>

          <p className="text-gray-600 mb-6">
            The database for this store is empty or not properly configured.
            Click below to reconnect your Supabase account and restore the database.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700"
              onClick={handleReprovision}
              disabled={isDeleting}
            >
              <Database className="w-4 h-4 mr-2" />
              Reprovision Database
            </Button>

            <Button
              variant="outline"
              className="w-full border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Store from Platform
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => window.location.href = '/admin/stores'}
              disabled={isDeleting}
            >
              Switch to Another Store
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{selectedStore?.name}" from the platform.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
