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
    <div className="p-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Migrations</h1>
          <p className="text-gray-500">Manage tenant database migrations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadMigrations} disabled={loading || runningMigrations}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleRunAllMigrations} disabled={runningMigrations || pendingStores.length === 0}>
            <Play className={`h-4 w-4 mr-2 ${runningMigrations ? 'animate-spin' : ''}`} />
            Run All Migrations
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
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Latest Version</p>
          <p className="text-2xl font-bold">v{latestVersion}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total Migrations</p>
          <p className="text-2xl font-bold">{migrations.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Stores Up to Date</p>
          <p className="text-2xl font-bold text-green-600">
            {migrationStatus.length - pendingStores.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-orange-600">{pendingStores.length}</p>
        </Card>
      </div>

      {/* Available Migrations */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Available Migrations</CardTitle>
          <CardDescription>Migration definitions stored in the database</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : migrations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No migrations found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Version</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {migrations.map((migration) => (
                  <TableRow key={migration.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">v{migration.version}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{migration.name}</TableCell>
                    <TableCell className="text-gray-500">{migration.description}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(migration.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Store Migration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Store Migration Status</CardTitle>
          <CardDescription>
            {pendingStores.length > 0
              ? `${pendingStores.length} store(s) need migrations`
              : "All stores are up to date"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : migrationStatus.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No stores found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Current Version</TableHead>
                  <TableHead>Latest Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Migration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {migrationStatus.map((store) => (
                  <TableRow key={store.storeId}>
                    <TableCell>
                      <div className="font-medium">{store.storeName || 'Unknown'}</div>
                      <code className="text-xs text-gray-400">
                        {store.storeId?.slice(0, 8)}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">v{store.schemaVersion}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">v{store.latestVersion}</Badge>
                    </TableCell>
                    <TableCell>
                      {store.migrationInProgress ? (
                        <Badge className="gap-1 bg-blue-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          In Progress
                        </Badge>
                      ) : store.hasPendingMigrations ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Pending
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-green-500">
                          <CheckCircle className="h-3 w-3" />
                          Up to date
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {store.lastMigrationAt
                        ? new Date(store.lastMigrationAt).toLocaleString()
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
