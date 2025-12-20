import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import FlashMessage from '@/components/storefront/FlashMessage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Database,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Code,
  Brain,
  BookOpen
} from 'lucide-react';

const EmbeddingBackfill = () => {
  const [flashMessage, setFlashMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [jobResult, setJobResult] = useState(null);
  const [runningJob, setRunningJob] = useState(null);

  // Options for what to backfill
  const [options, setOptions] = useState({
    documents: true,
    examples: true,
    entities: true,
    training: true,
    async: false
  });

  useEffect(() => {
    loadStatus();
  }, []);

  const getAuthToken = () => {
    return localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
  };

  const loadStatus = async () => {
    try {
      setStatusLoading(true);
      const token = getAuthToken();

      if (!token) {
        setFlashMessage({ type: 'error', message: 'Not authenticated. Please log in.' });
        return;
      }

      const res = await fetch('/api/admin/embedding-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setStatus({
            ...result.pending,
            totals: result.totals
          });
        }
      } else {
        const error = await res.json();
        setFlashMessage({ type: 'error', message: error.error || 'Failed to load status' });
      }
    } catch (error) {
      console.error('Failed to load status:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load embedding status' });
    } finally {
      setStatusLoading(false);
    }
  };

  const runBackfill = async () => {
    try {
      setLoading(true);
      setJobResult(null);
      const token = getAuthToken();

      if (!token) {
        setFlashMessage({ type: 'error', message: 'Not authenticated. Please log in.' });
        return;
      }

      const res = await fetch('/api/admin/run-backfill-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(options)
      });

      const result = await res.json();

      if (result.success) {
        if (options.async) {
          setRunningJob(result.jobId);
          setFlashMessage({ type: 'success', message: 'Backfill job started in background!' });
          // Poll for job status
          pollJobStatus(result.jobId);
        } else {
          setJobResult(result);
          setFlashMessage({ type: 'success', message: result.message });
          // Reload status after completion
          loadStatus();
        }
      } else {
        setFlashMessage({ type: 'error', message: result.error || 'Failed to run backfill' });
      }
    } catch (error) {
      console.error('Backfill error:', error);
      setFlashMessage({ type: 'error', message: 'Failed to run backfill' });
    } finally {
      if (!options.async) {
        setLoading(false);
      }
    }
  };

  const pollJobStatus = async (jobId) => {
    const token = getAuthToken();
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/embedding-job/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const result = await res.json();
          if (result.status === 'completed' || result.status === 'failed') {
            setRunningJob(null);
            setLoading(false);
            setJobResult(result);
            loadStatus();
            if (result.status === 'completed') {
              setFlashMessage({ type: 'success', message: result.message || 'Backfill completed!' });
            } else {
              setFlashMessage({ type: 'error', message: result.error || 'Backfill failed' });
            }
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setRunningJob(null);
          setLoading(false);
          setFlashMessage({ type: 'warning', message: 'Job is still running. Check back later.' });
        }
      } catch (error) {
        console.error('Poll error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      }
    };

    poll();
  };

  const StatusCard = ({ title, icon: Icon, count, color }) => (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${color}`}>
      <Icon className="w-8 h-8" />
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold">{count}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Embedding Backfill</h1>
          <p className="text-gray-600 mt-1">Generate vector embeddings for AI context data</p>
        </div>
        <Button variant="outline" onClick={loadStatus} disabled={statusLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${statusLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Database className="w-4 h-4" />
        <AlertDescription>
          This tool generates vector embeddings for AI training data, enabling semantic search and RAG (Retrieval Augmented Generation) capabilities.
          Embeddings are created using OpenAI's text-embedding-3-small model.
        </AlertDescription>
      </Alert>

      {/* Pending Status */}
      <Card>
        <CardHeader>
          <CardTitle>Embedding Status</CardTitle>
          <CardDescription>Records that need vector embeddings generated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : status ? (
            <>
              {/* Pending Embeddings */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Pending (need embeddings)</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <StatusCard
                    title="Documents"
                    icon={FileText}
                    count={status.documents}
                    color="bg-blue-50 border-blue-200 text-blue-700"
                  />
                  <StatusCard
                    title="Examples"
                    icon={Code}
                    count={status.examples}
                    color="bg-purple-50 border-purple-200 text-purple-700"
                  />
                  <StatusCard
                    title="Entities"
                    icon={Brain}
                    count={status.entities}
                    color="bg-green-50 border-green-200 text-green-700"
                  />
                  <StatusCard
                    title="Training"
                    icon={BookOpen}
                    count={status.training}
                    color="bg-orange-50 border-orange-200 text-orange-700"
                  />
                  <StatusCard
                    title="Total Pending"
                    icon={Database}
                    count={status.total}
                    color="bg-gray-50 border-gray-300 text-gray-700"
                  />
                </div>
              </div>

              {/* Total Records */}
              {status.totals && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Total Records in Database</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{status.totals.documents}</p>
                      <p className="text-sm text-gray-500">Documents</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{status.totals.examples}</p>
                      <p className="text-sm text-gray-500">Examples</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{status.totals.entities}</p>
                      <p className="text-sm text-gray-500">Entities</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{status.totals.training}</p>
                      <p className="text-sm text-gray-500">Training</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500">Unable to load status</p>
          )}
        </CardContent>
      </Card>

      {/* Run Backfill */}
      <Card>
        <CardHeader>
          <CardTitle>Run Backfill</CardTitle>
          <CardDescription>Select which data types to generate embeddings for</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Options */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="documents"
                checked={options.documents}
                onCheckedChange={(checked) => setOptions({ ...options, documents: checked })}
                disabled={loading}
              />
              <Label htmlFor="documents">Documents</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="examples"
                checked={options.examples}
                onCheckedChange={(checked) => setOptions({ ...options, examples: checked })}
                disabled={loading}
              />
              <Label htmlFor="examples">Examples</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="entities"
                checked={options.entities}
                onCheckedChange={(checked) => setOptions({ ...options, entities: checked })}
                disabled={loading}
              />
              <Label htmlFor="entities">Entities</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="training"
                checked={options.training}
                onCheckedChange={(checked) => setOptions({ ...options, training: checked })}
                disabled={loading}
              />
              <Label htmlFor="training">Training</Label>
            </div>
          </div>

          {/* Async Option */}
          <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
            <Switch
              id="async"
              checked={options.async}
              onCheckedChange={(checked) => setOptions({ ...options, async: checked })}
              disabled={loading}
            />
            <Label htmlFor="async" className="flex-1">
              <span className="font-medium">Run in Background</span>
              <p className="text-sm text-gray-500">
                Start the job and return immediately. Use this for large backfills to avoid timeout.
              </p>
            </Label>
          </div>

          {/* Run Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={runBackfill}
              disabled={loading || (!options.documents && !options.examples && !options.entities && !options.training)}
              className="min-w-[200px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {runningJob ? 'Running in Background...' : 'Processing...'}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Backfill
                </>
              )}
            </Button>

            {runningJob && (
              <Badge variant="secondary" className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Job ID: {runningJob}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {jobResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {jobResult.status === 'failed' ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              Backfill Results
            </CardTitle>
            {jobResult.duration && (
              <CardDescription>Completed in {jobResult.duration}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {jobResult.stats && (
              <div className="space-y-4">
                {/* Stats Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Type</th>
                      <th className="text-right py-2">Total</th>
                      <th className="text-right py-2">Success</th>
                      <th className="text-right py-2">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(jobResult.stats).map(([key, stat]) => (
                      <tr key={key} className="border-b">
                        <td className="py-2 capitalize">{key}</td>
                        <td className="text-right py-2">{stat.total}</td>
                        <td className="text-right py-2 text-green-600">{stat.success}</td>
                        <td className="text-right py-2 text-red-600">{stat.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Errors */}
                {Object.entries(jobResult.stats).some(([, stat]) => stat.errors?.length > 0) && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 text-red-600">Errors (first 5 per type):</h4>
                    {Object.entries(jobResult.stats).map(([key, stat]) => (
                      stat.errors?.length > 0 && (
                        <div key={key} className="mb-2">
                          <p className="font-medium capitalize">{key}:</p>
                          <ul className="list-disc list-inside text-sm text-gray-600">
                            {stat.errors.map((err, i) => (
                              <li key={i}>{err.title || err.name || err.id}: {err.error}</li>
                            ))}
                          </ul>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmbeddingBackfill;
