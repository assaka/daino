import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Package,
  X,
  Trash2
} from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';

const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  CANCELLING: 'cancelling',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const STATUS_CONFIG = {
  [JOB_STATUS.PENDING]: {
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
    label: 'Queued'
  },
  [JOB_STATUS.RUNNING]: {
    color: 'bg-blue-100 text-blue-800',
    icon: Loader2,
    label: 'Running',
    iconClass: 'animate-spin'
  },
  [JOB_STATUS.CANCELLING]: {
    color: 'bg-orange-100 text-orange-800',
    icon: Loader2,
    label: 'Cancelling...',
    iconClass: 'animate-spin'
  },
  [JOB_STATUS.COMPLETED]: {
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    label: 'Completed'
  },
  [JOB_STATUS.FAILED]: {
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    label: 'Failed'
  },
  [JOB_STATUS.CANCELLED]: {
    color: 'bg-gray-100 text-gray-800',
    icon: X,
    label: 'Cancelled'
  }
};

const ImportJobProgress = ({
  source = 'shopify', // 'shopify' or 'akeneo'
  onJobComplete,
  onJobFailed,
  showHistory = true,
  maxHistoryItems = 5,
  className = '',
  refreshTrigger = 0  // Increment this to trigger a refresh after scheduling a job
}) => {
  const { selectedStore } = useStoreSelection();
  const storeId = selectedStore?.id;

  const [activeJobs, setActiveJobs] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [showRecentJobs, setShowRecentJobs] = useState(false);
  const pollingRef = useRef(null);
  const mountedRef = useRef(true);
  const previousActiveJobIdsRef = useRef(new Set()); // Track previously active job IDs

  // Fetch active jobs for this integration source
  const fetchJobs = useCallback(async () => {
    if (!storeId) return;

    try {
      const response = await fetch(`/api/background-jobs/store/${storeId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (!response.ok) return;

      const data = await response.json();

      if (!mountedRef.current) return;

      // Filter jobs by source (shopify or akeneo)
      const sourcePrefix = source === 'shopify' ? 'shopify:import' : 'akeneo:import';

      const allJobs = data.jobs || [];
      const active = allJobs.filter(job =>
        job.type?.startsWith(sourcePrefix) &&
        (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.RUNNING || job.status === JOB_STATUS.CANCELLING)
      );

      const recent = allJobs.filter(job =>
        job.type?.startsWith(sourcePrefix) &&
        (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED || job.status === JOB_STATUS.CANCELLED)
      ).slice(0, maxHistoryItems);

      // Detect jobs that transitioned from active to completed/failed
      const previousActiveIds = previousActiveJobIdsRef.current;
      const currentActiveIds = new Set(active.map(j => j.id));

      // Check if any previously active jobs are now completed/failed
      recent.forEach(job => {
        if (previousActiveIds.has(job.id)) {
          // This job was active before and now it's completed/failed
          if (job.status === JOB_STATUS.COMPLETED && onJobComplete) {
            onJobComplete(job);
          } else if (job.status === JOB_STATUS.FAILED && onJobFailed) {
            onJobFailed(job);
          }
        }
      });

      // Update the ref with current active job IDs
      previousActiveJobIdsRef.current = currentActiveIds;

      setActiveJobs(active);
      setRecentJobs(recent);

    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  }, [storeId, source, maxHistoryItems, onJobComplete, onJobFailed]);

  // Initial fetch and fetch when refreshTrigger changes (after scheduling a job)
  useEffect(() => {
    mountedRef.current = true;
    fetchJobs();

    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchJobs, refreshTrigger]);

  // Start/stop polling based on active jobs
  useEffect(() => {
    const startPolling = () => {
      if (pollingRef.current) return;
      pollingRef.current = setInterval(() => {
        if (mountedRef.current) {
          fetchJobs();
        }
      }, 5000); // Poll every 5 seconds (only when active jobs exist)
    };

    const stopPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    // Only poll when there are active jobs
    if (activeJobs.length > 0) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [activeJobs.length, fetchJobs]);

  // Cancel a job
  const cancelJob = async (jobId) => {
    try {
      const response = await fetch(`/api/background-jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (response.ok) {
        fetchJobs(); // Refresh job list
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  // Format job type for display
  const formatJobType = (type) => {
    if (!type) return 'Unknown';
    // Convert 'shopify:import:products' to 'Products Import'
    const parts = type.split(':');
    const action = parts[parts.length - 1];
    return action.charAt(0).toUpperCase() + action.slice(1) + ' Import';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get elapsed time
  const getElapsedTime = (startedAt) => {
    if (!startedAt) return '';
    const start = new Date(startedAt);
    const now = new Date();
    const seconds = Math.floor((now - start) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Render a single job item
  const renderJobItem = (job, isActive = false) => {
    const status = STATUS_CONFIG[job.status] || STATUS_CONFIG[JOB_STATUS.PENDING];
    const StatusIcon = status.icon;
    const progress = job.progress || 0;

    return (
      <div key={job.id} className="border rounded-lg p-4 space-y-3">
        {/* Header: Job type on left, status badge on right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{formatJobType(job.type)}</span>
          </div>
          <Badge variant="outline" className={status.color}>
            <StatusIcon className={`h-3 w-3 mr-1 ${status.iconClass || ''}`} />
            {status.label}
          </Badge>
        </div>

        {/* Progress bar for running/cancelling jobs */}
        {isActive && (job.status === JOB_STATUS.RUNNING || job.status === JOB_STATUS.CANCELLING) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {job.status === JOB_STATUS.CANCELLING
                  ? 'Cancelling... Please wait'
                  : (job.progress_message || 'Processing...')}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Footer: Elapsed time on left, cancel button on right */}
        {isActive && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {job.started_at ? `Elapsed: ${getElapsedTime(job.started_at)}` : 'Waiting to start...'}
            </div>
            {(job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.RUNNING) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelJob(job.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                title="Cancel import"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Date info for completed jobs */}
        {!isActive && (
          <div className="text-sm text-gray-500">
            {job.completed_at ? (
              <span>Completed: {formatDate(job.completed_at)}</span>
            ) : job.created_at ? (
              <span>Started: {formatDate(job.created_at)}</span>
            ) : null}
          </div>
        )}

        {/* Error message for failed jobs */}
        {job.status === JOB_STATUS.FAILED && job.error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              {job.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats for completed jobs */}
        {job.status === JOB_STATUS.COMPLETED && job.result && (
          <div className="text-sm bg-green-50 p-2 rounded">
            {job.result.stats && (
              <div className="flex gap-4">
                <span>Imported: <strong className="text-green-600">{job.result.stats.imported || 0}</strong></span>
                <span>Skipped: <strong className="text-yellow-600">{job.result.stats.skipped || 0}</strong></span>
                <span>Failed: <strong className="text-red-600">{job.result.stats.failed || 0}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Stats for cancelled jobs with partial results */}
        {job.status === JOB_STATUS.CANCELLED && job.result?.stats && (
          <div className="text-sm bg-gray-50 p-2 rounded">
            <div className="flex gap-4">
              <span>Imported before cancel: <strong className="text-blue-600">{job.result.stats.imported || 0}</strong></span>
              {job.result.stats.total > 0 && (
                <span>of <strong>{job.result.stats.total}</strong> total</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Don't render if no jobs and not showing history
  if (activeJobs.length === 0 && recentJobs.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {activeJobs.length > 0 && (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              )}
              Import Jobs
            </CardTitle>
            <CardDescription>
              {activeJobs.length > 0
                ? `${activeJobs.length} active import${activeJobs.length > 1 ? 's' : ''} in progress`
                : 'No active imports'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchJobs}
              disabled={false}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Page leave warning */}
          {activeJobs.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Imports run in the background. You can safely leave this page - the import will continue.
              </AlertDescription>
            </Alert>
          )}

          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700">Active Imports</h4>
              {activeJobs.map(job => renderJobItem(job, true))}
            </div>
          )}

          {/* Recent Jobs */}
          {showHistory && recentJobs.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowRecentJobs(!showRecentJobs)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                {showRecentJobs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Recent Imports ({recentJobs.length})
              </button>

              {showRecentJobs && (
                <div className="space-y-3">
                  {recentJobs.map(job => renderJobItem(job, false))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ImportJobProgress;
