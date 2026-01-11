import React, { useState, useEffect, useRef } from "react";
import apiClient from "@/api/client";
import {
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FlashMessage from "@/components/storefront/FlashMessage";

export default function SuperAdminMigrations() {
  const [migrations, setMigrations] = useState([]);
  const [migrationStatus, setMigrationStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningMigrations, setRunningMigrations] = useState(false);
  const [jobProgress, setJobProgress] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    loadMigrations();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const loadMigrations = async () => {
    setLoading(true);
    try {
      try {
        const migrationsRes = await apiClient.get('/superadmin/migrations');
        if (migrationsRes?.success) {
          setMigrations(migrationsRes.data?.migrations || []);
        }
      } catch (e) {
        console.error('Error loading migrations:', e);
      }

      try {
        const statusRes = await apiClient.get('/superadmin/migrations/status');
        if (statusRes?.success) {
          setMigrationStatus(statusRes.data?.stores || []);
        }
      } catch (e) {
        console.error('Error loading migration status:', e);
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: error.message || 'Error loading migrations' });
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId) => {
    try {
      const response = await apiClient.get(`/superadmin/migrations/job/${jobId}`);
      if (response?.success) {
        const { status, progress, progressMessage, result, error } = response.data;

        setJobProgress({
          status,
          progress: progress || 0,
          message: progressMessage || 'Processing...'
        });

        if (status === 'completed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setRunningMigrations(false);
          setJobProgress(null);
          setFlashMessage({ type: 'success', message: result?.message || 'All migrations finished successfully' });
          loadMigrations();
        } else if (status === 'failed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setRunningMigrations(false);
          setJobProgress(null);
          setFlashMessage({ type: 'error', message: error || 'An error occurred during migration' });
          loadMigrations();
        }
      }
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  };

  const handleRunAllMigrations = async () => {
    setRunningMigrations(true);
    setJobProgress({ status: 'starting', progress: 0, message: 'Starting migration job...' });

    try {
      const response = await apiClient.post('/superadmin/migrations/run-all');

      if (response?.success) {
        const jobId = response.data?.jobId;

        if (!jobId) {
          // No pending migrations
          setRunningMigrations(false);
          setJobProgress(null);
          setFlashMessage({ type: 'success', message: response.data?.message || 'All stores are up to date' });
          return;
        }

        // Start polling for job status
        setJobProgress({ status: 'pending', progress: 0, message: 'Job scheduled, waiting to start...' });
        pollingRef.current = setInterval(() => pollJobStatus(jobId), 2000);
      } else {
        throw new Error(response?.error || 'Failed to start migration job');
      }
    } catch (error) {
      setRunningMigrations(false);
      setJobProgress(null);
      setFlashMessage({ type: 'error', message: error.message || 'Error running migrations' });
    }
  };

  const pendingStores = migrationStatus.filter(s => s.hasPendingMigrations);
  const latestVersion = migrations.length > 0 ? Math.max(...migrations.map(m => m.version)) : 0;

  return (
    <div className="p-4 sm:p-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Migrations</h1>
          <p className="text-sm sm:text-base text-gray-500">Manage tenant database migrations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadMigrations} disabled={loading || runningMigrations} size="sm" className="sm:size-default">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button onClick={handleRunAllMigrations} disabled={runningMigrations || pendingStores.length === 0} size="sm" className="sm:size-default">
            <Play className={`h-4 w-4 mr-2 ${runningMigrations ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Run All Migrations</span>
            <span className="sm:hidden">Run All</span>
          </Button>
        </div>
      </div>

      {/* Job Progress */}
      {jobProgress && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="font-medium text-blue-900">Migration in progress</span>
            </div>
            <Progress value={jobProgress.progress} className="h-2 mb-2" />
            <p className="text-sm text-blue-700">{jobProgress.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Latest Version</p>
          <p className="text-xl sm:text-2xl font-bold">v{latestVersion}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Migrations</p>
          <p className="text-xl sm:text-2xl font-bold">{migrations.length}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Stores Up to Date</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {migrationStatus.length - pendingStores.length}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Pending</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">{pendingStores.length}</p>
        </Card>
      </div>

      {/* Available Migrations */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Available Migrations</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Migration definitions stored in the database</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : migrations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No migrations found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 sm:w-24">Version</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead className="hidden sm:table-cell w-32">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {migrations.map((migration) => (
                    <TableRow key={migration.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">v{migration.version}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{migration.name}</div>
                        <div className="text-xs text-gray-400 sm:hidden">{migration.description}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-gray-500">{migration.description}</TableCell>
                      <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                        {new Date(migration.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Migration Status */}
      <Card className="overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Store Migration Status</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {pendingStores.length > 0
              ? `${pendingStores.length} store(s) need migrations`
              : "All stores are up to date"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : migrationStatus.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No stores found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead className="hidden sm:table-cell">Latest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Last Migration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {migrationStatus.map((store) => (
                    <TableRow key={store.storeId}>
                      <TableCell>
                        <div className="font-medium text-sm">{store.storeName || 'Unknown'}</div>
                        <code className="text-xs text-gray-400">
                          {store.storeId?.slice(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">v{store.schemaVersion}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="font-mono text-xs">v{store.latestVersion}</Badge>
                      </TableCell>
                      <TableCell>
                        {store.migrationInProgress ? (
                          <Badge className="gap-1 bg-blue-500 text-xs">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="hidden sm:inline">In Progress</span>
                          </Badge>
                        ) : store.hasPendingMigrations ? (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertCircle className="h-3 w-3" />
                            <span className="hidden sm:inline">Pending</span>
                          </Badge>
                        ) : (
                          <Badge className="gap-1 bg-green-500 text-xs">
                            <CheckCircle className="h-3 w-3" />
                            <span className="hidden sm:inline">Up to date</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-500 text-sm">
                        {store.lastMigrationAt
                          ? new Date(store.lastMigrationAt).toLocaleString()
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
