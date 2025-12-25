import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Check, X, Send, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import sendgridAPI from '@/api/sendgrid';

export default function SendGridProvider({
  storeEmail,
  storeName,
  onBack,
  onFlashMessage,
  getSelectedStoreId,
  showConfirm
}) {

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [testingSend, setTestingSend] = useState(false);
  const [showTestSection, setShowTestSection] = useState(false);
  const [stats, setStats] = useState(null);

  // Configuration form state
  const [apiKey, setApiKey] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    loadConnectionStatus();
    loadEmailStats();
  }, []);

  const loadConnectionStatus = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    setLoading(true);
    try {
      const response = await sendgridAPI.getConnectionStatus(storeId);
      if (response.success) {
        setConnectionStatus(response.data);
        if (response.data.config) {
          setSenderName(response.data.config.sender_name || '');
          setSenderEmail(response.data.config.sender_email || '');
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadEmailStats = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    try {
      const response = await sendgridAPI.getEmailStatistics(storeId, 30);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
    }
  };

  const handleSaveConfiguration = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      onFlashMessage({ type: 'error', message: 'No store selected' });
      return;
    }

    if (!apiKey || !senderName || !senderEmail) {
      onFlashMessage({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    setSaving(true);
    try {
      const response = await sendgridAPI.saveConfiguration(storeId, apiKey, senderName, senderEmail);
      if (response.success) {
        onFlashMessage({ type: 'success', message: 'SendGrid configured successfully!' });
        setShowConfig(false);
        setApiKey('');
        loadConnectionStatus();
      }
    } catch (error) {
      const errorMsg = error.message || 'Failed to save configuration';
      onFlashMessage({ type: 'error', message: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    const confirmed = await showConfirm(
      "Are you sure you want to disconnect SendGrid? Email sending will be disabled.",
      "Disconnect SendGrid"
    );

    if (confirmed) {
      try {
        await sendgridAPI.disconnect(storeId);
        onFlashMessage({ type: 'success', message: 'SendGrid disconnected successfully' });
        onBack();
        loadConnectionStatus();
      } catch (error) {
        onFlashMessage({ type: 'error', message: 'Failed to disconnect SendGrid' });
      }
    }
  };

  const handleTestConnection = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId || !testEmail) {
      onFlashMessage({ type: 'error', message: 'Please enter a test email address' });
      return;
    }

    setTestingSend(true);
    try {
      const response = await sendgridAPI.testConnection(storeId, testEmail);
      if (response.success) {
        if (response.testEmailSent) {
          onFlashMessage({ type: 'success', message: 'Test email sent successfully! Check your inbox.' });
        } else if (response.testEmailError) {
          onFlashMessage({ type: 'warning', message: `Connection verified but test email failed: ${response.testEmailError}` });
        } else {
          onFlashMessage({ type: 'success', message: 'SendGrid connection verified!' });
        }
        setTestEmail('');
        setShowTestSection(false);
      } else {
        onFlashMessage({ type: 'error', message: `Test failed: ${response.message || response.error}` });
      }
    } catch (error) {
      onFlashMessage({ type: 'error', message: 'Failed to send test email. Please verify your sender identity in SendGrid.' });
    } finally {
      setTestingSend(false);
    }
  };

  const handleOpenTestSection = () => {
    setTestEmail(storeEmail || '');
    setShowTestSection(true);
    setTimeout(() => {
      document.getElementById('test-email-sendgrid')?.focus();
    }, 100);
  };

  const handleConfigureSendGrid = () => {
    setShowConfig(true);
    setSenderName(storeName || '');
    setSenderEmail(storeEmail || '');
  };

  const handleUpdateConfiguration = () => {
    setShowConfig(!showConfig);
    if (!showConfig) {
      setSenderName(connectionStatus?.config?.sender_name || storeName || '');
      setSenderEmail(connectionStatus?.config?.sender_email || storeEmail || '');
    }
  };

  const isSendGridConnected = connectionStatus?.isConfigured && connectionStatus?.config?.is_active;

  return (
    <>
      {/* Back Button */}
      <Button variant="outline" size="sm" onClick={onBack}>
        &larr; Back to Providers
      </Button>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center text-xl">
                📤
              </div>
              <CardTitle>SendGrid Email Service</CardTitle>
            </div>
            {loading ? (
              <Badge variant="outline">Loading...</Badge>
            ) : isSendGridConnected ? (
              <Badge className="bg-green-500">
                <Check className="w-3 h-3 mr-1" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <X className="w-3 h-3 mr-1" /> Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSendGridConnected ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-green-600" />
                  <p className="font-medium text-green-900">Email service is active</p>
                </div>
                <div className="space-y-1 text-sm text-green-800">
                  <p><strong>Sender Name:</strong> {connectionStatus.config.sender_name}</p>
                  <p><strong>Sender Email:</strong> {connectionStatus.config.sender_email}</p>
                  {connectionStatus.config.is_primary && (
                    <Badge className="bg-blue-500 text-xs mt-1">Primary Provider</Badge>
                  )}
                  {(connectionStatus.config.updated_at || connectionStatus.config.created_at) && (
                    <p className="text-xs text-green-600 mt-2">
                      <strong>Configured:</strong> {new Date(connectionStatus.config.updated_at || connectionStatus.config.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={handleUpdateConfiguration}
                  >
                    {showConfig ? 'Hide Configuration' : 'Update Configuration'}
                  </Button>
                  {!showTestSection && (
                    <Button
                      variant="outline"
                      onClick={handleOpenTestSection}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Test Email
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={loadConnectionStatus}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    className="text-red-600 hover:text-red-700"
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600">
                Configure your SendGrid API key to send transactional emails (signup, orders, password reset).
              </p>
              <Button
                onClick={handleConfigureSendGrid}
                className="bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600"
              >
                <Mail className="w-4 h-4 mr-2" />
                Configure SendGrid
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      {showConfig && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>SendGrid API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-sendgrid">SendGrid API Key</Label>
              <Input
                id="api-key-sendgrid"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="SG.xxx..."
                required
              />
              <p className="text-xs text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://app.sendgrid.com/settings/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  SendGrid Settings &gt; API Keys
                  <ExternalLink className="w-3 h-3 inline ml-1" />
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender-name-sendgrid">Sender Name</Label>
              <Input
                id="sender-name-sendgrid"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder={storeName || "Your Store Name"}
                required
              />
              <p className="text-xs text-gray-500">
                Uses Store Name from Settings &gt; General. Override to use a different name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender-email-sendgrid">Sender Email</Label>
              <Input
                id="sender-email-sendgrid"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder={storeEmail || "noreply@yourdomain.com"}
                required
              />
              <p className="text-xs text-gray-500">
                Uses Store Email from Settings &gt; General. Override to use a different email.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                <p className="text-xs text-blue-800">
                  <strong>Important:</strong> The sender email must be verified in SendGrid.
                  Go to Settings &gt; Sender Authentication to verify your domain or single sender.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveConfiguration}
                disabled={saving || !apiKey || !senderName || !senderEmail}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfig(false);
                  setApiKey('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Email */}
      {isSendGridConnected && !showConfig && showTestSection && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Email Connection</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTestSection(false)}
              >
                Hide
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email-sendgrid">Send Test Email To:</Label>
              <div className="flex gap-2">
                <Input
                  id="test-email-sendgrid"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleTestConnection}
                  disabled={!testEmail || testingSend}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {testingSend ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Email is pre-filled with your store email. You can change it to test with a different address.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Statistics */}
      {isSendGridConnected && stats && !showConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Email Statistics (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{stats.total || 0}</p>
                <p className="text-sm text-gray-600">Total Sent</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{stats.sent || 0}</p>
                <p className="text-sm text-gray-600">Delivered</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{stats.opened || 0}</p>
                <p className="text-sm text-gray-600">Opened</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{stats.failed || 0}</p>
                <p className="text-sm text-gray-600">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions */}
      {!isSendGridConnected && !showConfig && (
        <Card className="border-cyan-200 bg-cyan-50">
          <CardHeader>
            <CardTitle className="text-cyan-900">How to Get Your SendGrid API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-cyan-800">
            <ol className="list-decimal list-inside space-y-2">
              <li>Sign in to your SendGrid account at{' '}
                <a href="https://app.sendgrid.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  app.sendgrid.com
                </a>
              </li>
              <li>Go to Settings &rarr; API Keys (or click{' '}
                <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  here
                </a>)
              </li>
              <li>Click "Create API Key"</li>
              <li>Give it a name and select "Full Access" or "Restricted Access" with Mail Send permissions</li>
              <li>Copy the API key (starts with "SG.")</li>
              <li>Click "Configure SendGrid" above and paste your API key</li>
            </ol>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 text-sm mb-1">Sender Authentication Required</p>
                  <p className="text-xs text-yellow-800">
                    Before sending emails, you must verify your sender identity in SendGrid.
                    Go to Settings &rarr; Sender Authentication to set up domain authentication or
                    create a single sender identity.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white border border-cyan-300 rounded">
              <p className="font-medium text-cyan-900 mb-2">Don't have a SendGrid account?</p>
              <p className="mb-2">Create a free account at{' '}
                <a
                  href="https://signup.sendgrid.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  sendgrid.com
                </a>
              </p>
              <p className="text-xs text-cyan-700">Free tier includes 100 emails/day</p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
