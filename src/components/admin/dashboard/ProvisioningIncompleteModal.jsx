import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import apiClient from '@/api/client';

export function ProvisioningIncompleteModal({ isOpen, onClose, storeId, onComplete }) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.post(`/api/stores/${storeId}/complete-provisioning`);

      if (response.data.success) {
        setResult('success');
        // Wait a moment to show success, then close
        setTimeout(() => {
          onComplete?.();
          onClose();
        }, 1500);
      } else {
        setError(response.data.error || 'Provisioning failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to complete provisioning');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismiss = () => {
    // User chooses to continue with incomplete data
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {result === 'success' ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            )}
            <DialogTitle>
              {result === 'success' ? 'Setup Complete' : 'Store Setup Incomplete'}
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {result === 'success' ? (
              'Your store has been fully set up and is ready to use.'
            ) : (
              'It looks like your store setup was interrupted. Some features or default data may be missing.'
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result !== 'success' && (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">What would you like to do?</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>Complete Setup</strong> - Re-run provisioning to add any missing data</li>
              <li><strong>Continue Anyway</strong> - Use the store as-is (you can fix later)</li>
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {result !== 'success' && (
            <>
              <Button
                variant="outline"
                onClick={handleDismiss}
                disabled={isRetrying}
              >
                Continue Anyway
              </Button>
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Completing Setup...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Complete Setup
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
