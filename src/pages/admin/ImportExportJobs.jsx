import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FlashMessage from '@/components/storefront/FlashMessage';
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Upload,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  BarChart3,
  DollarSign,
  Activity,
  Trash2,
  AlertCircle
} from 'lucide-react';

const ImportExportJobs = () => {
  const [flashMessage, setFlashMessage] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');

      // Load import/export jobs only
      const jobsRes = await fetch(`/api/background-jobs/store/${storeId}?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const jobsData = await jobsRes.json();

      if (jobsData.success) {
        // Filter only import/export related jobs
        const importExportJobs = jobsData.jobs.filter(job =>
          job.type.includes('import') ||
          job.type.includes('export') ||
          job.type.includes('sync')
        );
        setJobs(importExportJobs);

        // Calculate analytics
        calculateAnalytics(importExportJobs);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const calculateAnalytics = (jobs) => {
    const last30Days = jobs.filter(j => {
      const jobDate = new Date(j.created_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return jobDate > thirtyDaysAgo;
    });

    const exports = last30Days.filter(j => j.type.includes('export'));
    const imports = last30Days.filter(j => j.type.includes('import'));

    const analytics = {
      totalJobs: last30Days.length,
      totalExports: exports.length,
      totalImports: imports.length,
      successfulExports: exports.filter(j => j.status === 'completed').length,
      successfulImports: imports.filter(j => j.status === 'completed').length,
      failedExports: exports.filter(j => j.status === 'failed').length,
      failedImports: imports.filter(j => j.status === 'failed').length,

      // Marketplace breakdown
      amazonExports: exports.filter(j => j.type.includes('amazon')).length,
      ebayExports: exports.filter(j => j.type.includes('ebay')).length,
      shopifyImports: imports.filter(j => j.type.includes('shopify')).length,
      akeneoImports: imports.filter(j => j.type.includes('akeneo')).length,

      // Calculate estimated product count (from metadata)
      productsExported: exports.reduce((sum, j) => {
        return sum + (j.result?.successful || 0);
      }, 0),
      productsImported: imports.reduce((sum, j) => {
        return sum + (j.result?.stats?.products?.imported || 0);
      }, 0)
    };

    setAnalytics(analytics);
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

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending' || j.status === 'cancelling');
  const exportJobs = jobs.filter(j => j.type.includes('export'));
  const importJobs = jobs.filter(j => j.type.includes('import'));

  return (
    <div className="p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Import & Export Jobs</h1>
          <p className="text-gray-600 mt-1">Monitor marketplace integrations and track performance</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Total Jobs (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.totalJobs}</div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  {analytics.totalExports} exports
                </span>
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {analytics.totalImports} imports
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Products Exported
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{analytics.productsExported}</div>
              <div className="text-xs text-gray-600 mt-2">
                To Amazon, eBay, and more
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Products Imported
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{analytics.productsImported}</div>
              <div className="text-xs text-gray-600 mt-2">
                From Shopify, Akeneo PIM
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {analytics.totalJobs > 0
                  ? Math.round(((analytics.successfulExports + analytics.successfulImports) / analytics.totalJobs) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-gray-600 mt-2">
                {analytics.failedExports + analytics.failedImports} failed
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Marketplace Performance */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Marketplace Performance (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-5 h-5 text-orange-500" />
                  <span className="font-semibold">Amazon</span>
                </div>
                <div className="text-2xl font-bold">{analytics.amazonExports}</div>
                <div className="text-xs text-gray-600">Exports</div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold">eBay</span>
                </div>
                <div className="text-2xl font-bold">{analytics.ebayExports}</div>
                <div className="text-xs text-gray-600">Listings Created</div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-5 h-5 text-green-500" />
                  <span className="font-semibold">Shopify</span>
                </div>
                <div className="text-2xl font-bold">{analytics.shopifyImports}</div>
                <div className="text-xs text-gray-600">Imports</div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-5 h-5 text-purple-500" />
                  <span className="font-semibold">Akeneo</span>
                </div>
                <div className="text-2xl font-bold">{analytics.akeneoImports}</div>
                <div className="text-xs text-gray-600">PIM Syncs</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              Active Jobs ({activeJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeJobs.map(job => (
              <div key={job.id} className="border rounded-lg p-4 space-y-3">
                {/* Header: Job type on left, status badge on right */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="font-semibold">{job.type}</h3>
                      <p className="text-sm text-gray-600">Job #{job.id}</p>
                    </div>
                  </div>
                  {getStatusBadge(job.status)}
                </div>

                {/* Progress bar */}
                {job.progress !== null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {job.status === 'cancelling'
                          ? 'Cancelling... Please wait'
                          : (job.progress_message || 'Processing...')}
                      </span>
                      <span className="font-medium">{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}

                {/* Footer: Elapsed time on left, cancel button on right */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {job.started_at ? `Started: ${new Date(job.started_at).toLocaleString()}` : 'Waiting to start...'}
                  </div>
                  {(job.status === 'pending' || job.status === 'running') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelJob(job.id)}
                      title="Cancel job"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Jobs Tabs */}
      <Tabs defaultValue="exports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="exports">Exports ({exportJobs.length})</TabsTrigger>
          <TabsTrigger value="imports">Imports ({importJobs.length})</TabsTrigger>
          <TabsTrigger value="all">All Jobs ({jobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="exports" className="space-y-3">
          {exportJobs.slice(0, 20).map(job => (
            <Card key={job.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="font-medium">{job.type}</h3>
                      <p className="text-sm text-gray-600">
                        {job.status === 'completed' && `Exported ${job.result?.successful || 0} products`}
                        {job.status === 'failed' && job.last_error}
                        {job.status === 'running' && job.progress_message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'outline'}>
                      {job.status}
                    </Badge>
                    {job.result?.successful && (
                      <span className="text-xs text-green-600">
                        ✓ {job.result.successful} products
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="imports" className="space-y-3">
          {importJobs.slice(0, 20).map(job => (
            <Card key={job.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="font-medium">{job.type}</h3>
                      <p className="text-sm text-gray-600">
                        {job.status === 'completed' && (
                          <>
                            Imported {job.result?.stats?.imported || job.result?.stats?.products?.imported || 0} items
                          </>
                        )}
                        {job.status === 'cancelled' && (
                          <>
                            Cancelled - {job.result?.stats?.imported || 0} imported before cancel
                            {job.result?.stats?.total > 0 && ` of ${job.result.stats.total}`}
                          </>
                        )}
                        {job.status === 'failed' && job.last_error}
                        {job.status === 'running' && job.progress_message}
                        {job.status === 'cancelling' && 'Cancelling...'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    job.status === 'completed' ? 'default' :
                    job.status === 'failed' ? 'destructive' :
                    job.status === 'cancelled' ? 'outline' :
                    'outline'
                  }>
                    {job.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-3">
          {jobs.slice(0, 30).map(job => (
            <Card key={job.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <h3 className="font-medium">{job.type}</h3>
                      <p className="text-xs text-gray-500">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge>{job.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ImportExportJobs;
