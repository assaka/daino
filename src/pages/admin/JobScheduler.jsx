import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import FlashMessage from '@/components/storefront/FlashMessage';
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Calendar,
  RefreshCw,
  Code,
  Zap,
  AlertCircle,
  Eye
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const JobScheduler = () => {
  const [flashMessage, setFlashMessage] = useState(null);
  const [cronJobs, setCronJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cron_expression: '0 0 * * *', // Daily at midnight
    job_type: 'webhook',
    configuration: {},
    is_active: true,
    plugin_id: null
  });

  useEffect(() => {
    loadCronJobs();
  }, []);

  const loadCronJobs = async () => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');

      if (!token) {
        setFlashMessage({ type: 'error', message: 'Not authenticated. Please log in.' });
        return;
      }

      const res = await fetch(`/api/cron-jobs?store_id=${storeId}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          // API returns data.cron_jobs nested structure
          setCronJobs(result.data?.cron_jobs || []);
        }
      } else {
        const error = await res.json();
        setFlashMessage({ type: 'error', message: error.message || 'Failed to load cron jobs' });
      }
    } catch (error) {
      console.error('Failed to load cron jobs:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load cron jobs' });
    }
  };

  const saveCronJob = async () => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');

      const url = editingJob
        ? `/api/cron-jobs/${editingJob.id}`
        : '/api/cron-jobs';

      const method = editingJob ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          store_id: storeId
        })
      });

      const data = await res.json();
      if (data.success) {
        setFlashMessage({ type: 'success', message: 'Cron job saved successfully!' });
        setShowCreateForm(false);
        setEditingJob(null);
        resetForm();
        loadCronJobs();
      } else {
        setFlashMessage({ type: 'error', message: data.message });
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save cron job' });
    }
  };

  const toggleJobActive = async (jobId, currentStatus) => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const res = await fetch(`/api/cron-jobs/${jobId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (res.ok) {
        setFlashMessage({ type: 'success', message: 'Job status updated' });
        loadCronJobs();
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to toggle job' });
    }
  };

  const deleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this cron job?')) return;

    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const res = await fetch(`/api/cron-jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setFlashMessage({ type: 'success', message: 'Cron job deleted' });
        loadCronJobs();
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to delete job' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      cron_expression: '0 0 * * *',
      job_type: 'webhook',
      configuration: {},
      is_active: true,
      plugin_id: null
    });
  };

  const cronPresets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Weekly (Sunday midnight)', value: '0 0 * * 0' },
    { label: 'Monthly (1st at midnight)', value: '0 0 1 * *' }
  ];

  return (
    <div className="p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Scheduler</h1>
          <p className="text-gray-600 mt-1">Schedule recurring tasks and cron jobs</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="w-4 h-4 mr-2" />
            New Cron Job
          </Button>
          <Button variant="outline" onClick={loadCronJobs}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Code className="w-4 h-4" />
        <AlertDescription>
          <strong>For Plugin Developers:</strong> Plugins can register cron jobs via the API.
          Use <code className="bg-gray-100 px-1 rounded">POST /api/cron-jobs</code> with your plugin_id to create scheduled tasks.
        </AlertDescription>
      </Alert>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingJob ? 'Edit' : 'Create'} Cron Job
              {editingJob?.is_system && <Badge variant="secondary" className="ml-2">System Job</Badge>}
            </CardTitle>
            <CardDescription>
              {editingJob?.is_system
                ? 'System jobs are read-only and cannot be modified'
                : 'Schedule a recurring task'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show alert for system jobs */}
            {editingJob?.is_system && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  This is a system job and cannot be edited. You can only view its configuration.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Daily Inventory Sync"
                disabled={editingJob?.is_system}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="What does this job do?"
                rows={2}
                disabled={editingJob?.is_system}
              />
            </div>

            <div>
              <Label htmlFor="cron_expression">Schedule (Cron Expression)</Label>
              <div className="flex gap-2">
                <Input
                  id="cron_expression"
                  value={formData.cron_expression}
                  onChange={(e) => setFormData({...formData, cron_expression: e.target.value})}
                  placeholder="* * * * *"
                  className="font-mono"
                />
                <select
                  onChange={(e) => setFormData({...formData, cron_expression: e.target.value})}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Presets...</option>
                  {cronPresets.map(preset => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Format: minute hour day month weekday. Example: <code>0 0 * * *</code> = daily at midnight
              </p>
            </div>

            <div>
              <Label htmlFor="job_type">Job Type</Label>
              <select
                id="job_type"
                value={formData.job_type}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    job_type: e.target.value,
                    configuration: {} // Reset config when type changes
                  });
                }}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="webhook">Webhook (External HTTP Request)</option>
                <option value="api_call">API Call (Internal Route)</option>
                <option value="database_query">Database Query</option>
                <option value="email">Send Email</option>
                <option value="cleanup">Cleanup Task</option>
              </select>
            </div>

            {/* API Call Configuration - Only show if not a system job */}
            {formData.job_type === 'api_call' && !editingJob?.is_system && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900">API Call Configuration</h4>

                <div>
                  <Label htmlFor="api_url">API Route (Internal)</Label>
                  <Input
                    id="api_url"
                    value={formData.configuration.url || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, url: e.target.value }
                    })}
                    placeholder="/api/your-endpoint"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Example: /api/shopify/import/products or /api/my-plugin/sync
                  </p>
                </div>

                <div>
                  <Label htmlFor="api_method">HTTP Method</Label>
                  <select
                    id="api_method"
                    value={formData.configuration.method || 'POST'}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, method: e.target.value }
                    })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="api_headers">Headers (JSON)</Label>
                  <Textarea
                    id="api_headers"
                    value={JSON.stringify(formData.configuration.headers || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const headers = JSON.parse(e.target.value);
                        setFormData({
                          ...formData,
                          configuration: { ...formData.configuration, headers }
                        });
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{\n  "Content-Type": "application/json"\n}'
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="api_body">Request Body (JSON)</Label>
                  <Textarea
                    id="api_body"
                    value={JSON.stringify(formData.configuration.body || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const body = JSON.parse(e.target.value);
                        setFormData({
                          ...formData,
                          configuration: { ...formData.configuration, body }
                        });
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{\n  "store_id": "uuid",\n  "action": "sync"\n}'
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Only needed for POST, PUT, PATCH requests
                  </p>
                </div>
              </div>
            )}

            {/* Webhook Configuration */}
            {formData.job_type === 'webhook' && (
              <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-semibold text-purple-900">Webhook Configuration</h4>

                <div>
                  <Label htmlFor="webhook_url">Webhook URL (External)</Label>
                  <Input
                    id="webhook_url"
                    value={formData.configuration.url || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, url: e.target.value }
                    })}
                    placeholder="https://example.com/webhook"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Full URL to external webhook endpoint
                  </p>
                </div>

                <div>
                  <Label htmlFor="webhook_method">HTTP Method</Label>
                  <select
                    id="webhook_method"
                    value={formData.configuration.method || 'POST'}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, method: e.target.value }
                    })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="webhook_headers">Headers (JSON)</Label>
                  <Textarea
                    id="webhook_headers"
                    value={JSON.stringify(formData.configuration.headers || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const headers = JSON.parse(e.target.value);
                        setFormData({
                          ...formData,
                          configuration: { ...formData.configuration, headers }
                        });
                      } catch (err) {
                        // Invalid JSON
                      }
                    }}
                    placeholder='{\n  "Authorization": "Bearer token"\n}'
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="webhook_body">Request Body (JSON)</Label>
                  <Textarea
                    id="webhook_body"
                    value={JSON.stringify(formData.configuration.body || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const body = JSON.parse(e.target.value);
                        setFormData({
                          ...formData,
                          configuration: { ...formData.configuration, body }
                        });
                      } catch (err) {
                        // Invalid JSON
                      }
                    }}
                    placeholder='{\n  "event": "scheduled_task"\n}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {/* Email Configuration */}
            {formData.job_type === 'email' && (
              <div className="space-y-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900">Email Configuration</h4>

                <div>
                  <Label htmlFor="email_to">To Email Address</Label>
                  <Input
                    id="email_to"
                    type="email"
                    value={formData.configuration.to || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, to: e.target.value }
                    })}
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="email_subject">Email Subject</Label>
                  <Input
                    id="email_subject"
                    value={formData.configuration.subject || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, subject: e.target.value }
                    })}
                    placeholder="Daily Report"
                  />
                </div>

                <div>
                  <Label htmlFor="email_template">Email Template</Label>
                  <Input
                    id="email_template"
                    value={formData.configuration.template || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, template: e.target.value }
                    })}
                    placeholder="store-status-daily"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Email template ID from your email templates
                  </p>
                </div>

                <div>
                  <Label htmlFor="email_data">Template Data (JSON)</Label>
                  <Textarea
                    id="email_data"
                    value={JSON.stringify(formData.configuration.data || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const data = JSON.parse(e.target.value);
                        setFormData({
                          ...formData,
                          configuration: { ...formData.configuration, data }
                        });
                      } catch (err) {
                        // Invalid JSON
                      }
                    }}
                    placeholder='{\n  "include_metrics": true\n}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {/* Database Query Configuration */}
            {formData.job_type === 'database_query' && (
              <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-900">Database Query Configuration</h4>
                <Alert className="bg-yellow-100 border-yellow-300">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Database queries run with full permissions. Use with caution!
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="db_query">SQL Query</Label>
                  <Textarea
                    id="db_query"
                    value={formData.configuration.query || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      configuration: { ...formData.configuration, query: e.target.value }
                    })}
                    placeholder="DELETE FROM temp_data WHERE created_at < NOW() - INTERVAL '30 days'"
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Use for cleanup, data maintenance, or automated queries
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label>Active (job will run on schedule)</Label>
            </div>

            {/* Only show save button for non-system jobs */}
            {!editingJob?.is_system && (
              <div className="flex gap-2">
                <SaveButton onClick={saveCronJob} label={editingJob ? 'Update Job' : 'Create Job'} />
                <Button variant="outline" onClick={() => {
                  setShowCreateForm(false);
                  setEditingJob(null);
                  resetForm();
                }}>
                  Cancel
                </Button>
              </div>
            )}

            {/* For system jobs, only show close button */}
            {editingJob?.is_system && (
              <Button variant="outline" onClick={() => {
                setShowCreateForm(false);
                setEditingJob(null);
                resetForm();
              }}>
                Close
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cron Jobs List */}
      <div className="space-y-3">
        {cronJobs.map(job => (
          <Card key={job.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${job.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {job.name}
                      {job.is_system && <Badge variant="secondary">System</Badge>}
                      {job.plugin_id && <Badge variant="outline">Plugin</Badge>}
                    </h3>
                    <p className="text-sm text-gray-600">{job.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {job.cron_expression}
                      </span>
                      <span>Type: {job.job_type}</span>
                      <span>Runs: {job.run_count}</span>
                      <span>Success: {job.success_count}</span>
                      {job.next_run_at && (
                        <span>Next: {new Date(job.next_run_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Allow toggling all jobs (both system and user) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleJobActive(job.id, job.is_active)}
                    title={job.is_active ? 'Pause job' : 'Activate job'}
                  >
                    {job.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>

                  {/* Only allow editing non-system jobs */}
                  {!job.is_system && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingJob(job);
                        setFormData(job);
                        setShowCreateForm(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {/* System jobs: View-only (Eye icon) */}
                  {job.is_system && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingJob(job);
                        setFormData(job);
                        setShowCreateForm(true);
                      }}
                      title="View system job (read-only)"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Only allow deleting non-system jobs */}
                  {!job.is_system && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteJob(job.id)}
                      title="Delete job"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {cronJobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled jobs yet</p>
              <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Job
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Plugin API Documentation */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Plugin Developer API
          </CardTitle>
          <CardDescription>Allow plugins to register scheduled jobs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Create Cron Job from Plugin:</h4>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-md text-xs overflow-x-auto">
{`POST /api/cron-jobs

{
  "name": "My Plugin Daily Task",
  "description": "Runs daily cleanup",
  "cron_expression": "0 2 * * *",
  "job_type": "api_call",
  "configuration": {
    "url": "/api/my-plugin/daily-task",
    "method": "POST"
  },
  "plugin_id": "your-plugin-uuid",
  "store_id": "store-uuid"
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Supported Job Types:</h4>
            <ul className="text-sm space-y-1 text-gray-700">
              <li><code className="bg-white px-2 py-1 rounded">webhook</code> - Call external HTTP endpoint</li>
              <li><code className="bg-white px-2 py-1 rounded">api_call</code> - Call internal API route</li>
              <li><code className="bg-white px-2 py-1 rounded">database_query</code> - Execute SQL query</li>
              <li><code className="bg-white px-2 py-1 rounded">email</code> - Send scheduled email</li>
              <li><code className="bg-white px-2 py-1 rounded">cleanup</code> - Cleanup/maintenance task</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Common Cron Expressions:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {cronPresets.map(preset => (
                <div key={preset.value} className="bg-white p-2 rounded">
                  <code className="text-purple-600">{preset.value}</code>
                  <span className="text-gray-600 ml-2">= {preset.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JobScheduler;
