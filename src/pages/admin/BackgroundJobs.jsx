import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FlashMessage from '@/components/storefront/FlashMessage';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  Activity,
  AlertCircle,
  Play,
  Pause,
  Trash2,
  Eye
} from 'lucide-react';

const BackgroundJobs = () => {
  const [flashMessage, setFlashMessage] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadData();
    const interval = autoRefresh ? setInterval(loadData, 5000) : null;
    return () => interval && clearInterval(interval);
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');

      // Load queue status
      const statusRes = await fetch('/api/background-jobs/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statusData = await statusRes.json();
      if (statusData.success) {
        setQueueStatus(statusData.status);
        setStatistics(statusData.statistics);
      }

      // Load jobs for store
      const jobsRes = await fetch(`/api/background-jobs/store/${storeId}?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const jobsData = await jobsRes.json();
      if (jobsData.success) {
        setJobs(jobsData.jobs);
      }
    } catch (error) {
      console.error('Failed to load background jobs:', error);
    }
  };

  const cancelJob = async (jobId) => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const res = await fetch(`/api/background-jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        setFlashMessage({ type: 'success', message: 'Job cancelled successfully' });
        loadData();
      } else {
        setFlashMessage({ type: 'error', message: data.message });
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to cancel job' });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'cancelling':
        return <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      running: 'default',
      cancelling: 'outline',
      pending: 'secondary',
      cancelled: 'outline'
    };
    const labels = {
      cancelling: 'Cancelling...',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const formatJobType = (type) => {
    return type.split(':').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' → ');
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (job.progress_message || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesType = typeFilter === 'all' || job.type.startsWith(typeFilter);
    return matchesSearch && matchesStatus && matchesType;
  });

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending' || j.status === 'cancelling');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed');
  const cancelledJobs = jobs.filter(j => j.status === 'cancelled');

  return (
    <div className="p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Background Jobs</h1>
          <p className="text-gray-600 mt-1">Monitor and manage all background job processing</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Queue Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueStatus?.is_running ? (
                <span className="text-green-600 flex items-center gap-2">
                  <Activity className="w-6 h-6" />
                  Running
                </span>
              ) : (
                <span className="text-gray-400">Stopped</span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {queueStatus?.currently_processing || 0}/{queueStatus?.max_concurrent_jobs || 5} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics?.success_rate || '0%'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activeJobs.length}
            </div>
            <p className="text-xs text-gray-600 mt-1">Running or pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Failed Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {failedJobs.length}
            </div>
            <p className="text-xs text-gray-600 mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
                <option value="cancelling">Cancelling</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Types</option>
                <option value="translation">Translations</option>
                <option value="shopify">Shopify</option>
                <option value="amazon">Amazon</option>
                <option value="ebay">eBay</option>
                <option value="akeneo">Akeneo</option>
                <option value="plugin">Plugins</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active ({activeJobs.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedJobs.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failedJobs.length})</TabsTrigger>
          <TabsTrigger value="all">All ({filteredJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {activeJobs.map(job => (
            <Card key={job.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <h3 className="font-semibold">{formatJobType(job.type)}</h3>
                        <p className="text-sm text-gray-600">Job #{job.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                      {(job.status === 'pending' || job.status === 'running') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelJob(job.id)}
                          title="Cancel job"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {job.progress !== null && job.progress !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{job.progress_message || 'Processing...'}</span>
                        <span className="font-medium">{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Started:</span>
                      <span className="ml-2">{job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Priority:</span>
                      <span className="ml-2 capitalize">{job.priority}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {activeJobs.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active jobs</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3">
          {completedJobs.slice(0, 20).map(job => (
            <Card key={job.id} className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <h3 className="font-medium">{formatJobType(job.type)}</h3>
                      <p className="text-sm text-gray-600">
                        Completed {new Date(job.completed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">#{job.id}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="failed" className="space-y-3">
          {failedJobs.map(job => (
            <Card key={job.id} className="border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <div>
                        <h3 className="font-medium">{formatJobType(job.type)}</h3>
                        <p className="text-sm text-gray-600">
                          Failed {new Date(job.failed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Failed</Badge>
                      <span className="text-sm text-gray-600">
                        Retry {job.retry_count}/{job.max_retries}
                      </span>
                    </div>
                  </div>
                  {job.last_error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-sm text-red-800">{job.last_error}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {failedJobs.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No failed jobs - everything is running smoothly!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {filteredJobs.map(job => (
            <Card key={job.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="font-medium">{formatJobType(job.type)}</h3>
                      <p className="text-sm text-gray-600">
                        {job.status === 'completed' && `Completed ${new Date(job.completed_at).toLocaleString()}`}
                        {job.status === 'failed' && `Failed ${new Date(job.failed_at).toLocaleString()}`}
                        {job.status === 'running' && `Started ${new Date(job.started_at).toLocaleString()}`}
                        {job.status === 'pending' && `Scheduled ${new Date(job.scheduled_at).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(job.status)}
                    {(job.status === 'pending' || job.status === 'running') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelJob(job.id)}
                        title="Cancel job"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {job.progress !== null && job.status === 'running' && (
                  <div className="mt-3">
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Statistics Card */}
      {statistics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Queue Statistics (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold">{statistics.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{statistics.completed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{statistics.failed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{statistics.pending}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Running</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.running}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BackgroundJobs;
