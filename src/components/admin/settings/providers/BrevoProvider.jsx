import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Check, X, Send, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import brevoAPI from '@/api/brevo';

export default function BrevoProvider({
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
  const [ipWhitelistError, setIpWhitelistError] = useState(null);

  useEffect(() => {
    loadConnectionStatus();
    loadEmailStats();
  }, []);

  const loadConnectionStatus = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    setLoading(true);
    try {
      const response = await brevoAPI.getConnectionStatus(storeId);
      if (response.success) {
        setConnectionStatus(response.data);
        if (response.data.config) {
          setSenderName(response.data.config.sender_name || '');
          setSenderEmail(response.data.config.sender_email || '');
        }
      }
    } catch (error) {
      console.error('Error loading Brevo status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmailStats = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    try {
      const response = await brevoAPI.getEmailStatistics(storeId, 30);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading email stats:', error);
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
    setIpWhitelistError(null); // Clear any previous errors
    try {
      const response = await brevoAPI.saveConfiguration(storeId, apiKey, senderName, senderEmail);
      if (response.success) {
        onFlashMessage({ type: 'success', message: 'Brevo configured successfully!' });
        setShowConfig(false);
        setApiKey('');
        setIpWhitelistError(null);
        loadConnectionStatus();
      }
    } catch (error) {
      console.error('Save config error:', error);

      // Check if this is an IP whitelist error
      const errorMsg = error.message || 'Failed to save configuration';
      if (errorMsg.includes('IP address not whitelisted')) {
        // Extract IP address from error message
        const ipMatch = errorMsg.match(/IP address not whitelisted: (\d+\.\d+\.\d+\.\d+)/);
        const serverIp = ipMatch ? ipMatch[1] : null;
        setIpWhitelistError({ message: errorMsg, serverIp });
      } else {
        setIpWhitelistError(null);
      }

      onFlashMessage({ type: 'error', message: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    const confirmed = await showConfirm(
      "Are you sure you want to disconnect Brevo? Email sending will be disabled.",
      "Disconnect Brevo"
    );

    if (confirmed) {
      try {
        await brevoAPI.disconnect(storeId);
        onFlashMessage({ type: 'success', message: 'Brevo disconnected successfully' });
        onBack();
        loadConnectionStatus();
      } catch (error) {
        console.error('Disconnect error:', error);
        onFlashMessage({ type: 'error', message: 'Failed to disconnect Brevo' });
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
      const response = await brevoAPI.testConnection(storeId, testEmail);
      if (response.success) {
        onFlashMessage({ type: 'success', message: 'Test email sent successfully! Check your inbox.' });
        setTestEmail('');
        setShowTestSection(false);
      } else {
        // Show verification info if connection failed
        const errorMsg = response.message?.includes('connection failed') || response.message?.includes('failed')
          ? 'Test failed: Brevo connection failed. Important: If your sender email is not yet verified in Brevo, check your inbox for a verification email and click the verification link before sending emails.'
          : `Test failed: ${response.message}`;
        onFlashMessage({ type: 'error', message: errorMsg });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      const errorMsg = 'Failed to send test email. Important: If your sender email is not yet verified in Brevo, check your inbox for a verification email and click the verification link.';
      onFlashMessage({ type: 'error', message: errorMsg });
    } finally {
      setTestingSend(false);
    }
  };

  const handleOpenTestSection = () => {
    // Pre-fill with store email if available, otherwise leave empty for user to enter
    setTestEmail(storeEmail || '');
    setShowTestSection(true);
    // Focus on the email input after a short delay
    setTimeout(() => {
      document.getElementById('test-email')?.focus();
    }, 100);
  };

  const handleConfigureBrevo = () => {
    console.log('📧 handleConfigureBrevo - Setting form values:', {
      storeName,
      storeEmail,
      willSetSenderName: storeName || '',
      willSetSenderEmail: storeEmail || ''
    });
    setShowConfig(true);
    // Pre-fill with store data from Settings > General
    setSenderName(storeName || '');
    setSenderEmail(storeEmail || '');
  };

  const handleUpdateConfiguration = () => {
    setShowConfig(!showConfig);
    // Pre-fill when opening with current config or store defaults
    if (!showConfig) {
      setSenderName(connectionStatus?.config?.sender_name || storeName || '');
      setSenderEmail(connectionStatus?.config?.sender_email || storeEmail || '');
    }
  };

  const isBrevoConnected = connectionStatus?.isConfigured && connectionStatus?.config?.is_active;

  return (
    <>
      {/* Back Button */}
      <Button variant="outline" size="sm" onClick={onBack}>
        ← Back to Providers
      </Button>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-xl">
                📧
              </div>
              <CardTitle>Brevo Email Service</CardTitle>
            </div>
            {loading ? (
              <Badge variant="outline">Loading...</Badge>
            ) : isBrevoConnected ? (
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
          {isBrevoConnected ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-green-600" />
                  <p className="font-medium text-green-900">Email service is active</p>
                </div>
                <div className="space-y-1 text-sm text-green-800">
                  <p><strong>Sender Name:</strong> {connectionStatus.config.sender_name}</p>
                  <p><strong>Sender Email:</strong> {connectionStatus.config.sender_email}</p>
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
                Configure your Brevo API key to send transactional emails (signup, orders, credits).
              </p>
              <Button
                onClick={handleConfigureBrevo}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                Configure Brevo
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      {showConfig && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Brevo API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">Brevo API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="xkeysib-..."
                required
              />
              <p className="text-xs text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://app.brevo.com/settings/keys/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Brevo Settings &gt; API Keys
                  <ExternalLink className="w-3 h-3 inline ml-1" />
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender-name">Sender Name</Label>
              <Input
                id="sender-name"
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
              <Label htmlFor="sender-email">Sender Email</Label>
              <Input
                id="sender-email"
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
                  <strong>Important:</strong> If this email is not yet verified in your Brevo account,
                  Brevo will send a verification email to this address. You must click the verification
                  link in that email before you can send emails from this address.
                </p>
              </div>
            </div>

            {/* IP Whitelist Error Warning */}
            {ipWhitelistError && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-medium text-yellow-900">IP Address Not Whitelisted</p>
                    <p className="text-sm text-yellow-800">
                      Your server's IP address needs to be added to Brevo's authorized IP list:
                    </p>
                    {ipWhitelistError.serverIp && (
                      <div className="bg-white border border-yellow-200 rounded p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Server IP Address:</p>
                            <p className="text-base font-mono font-semibold text-gray-900">
                              {ipWhitelistError.serverIp}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(ipWhitelistError.serverIp);
                              onFlashMessage({ type: 'success', message: 'IP address copied to clipboard!' });
                            }}
                            className="text-xs"
                          >
                            Copy IP
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-yellow-900">To fix this:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>
                          Visit{' '}
                          <a
                            href="https://app.brevo.com/security/authorised_ips"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                          >
                            Brevo Security Settings
                            <ExternalLink className="w-3 h-3 inline ml-1" />
                          </a>
                        </li>
                        <li>Add the IP address above to the authorized list</li>
                        <li>Click "Save Configuration" again</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveConfiguration}
                disabled={saving || !apiKey || !senderName || !senderEmail}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfig(false);
                  setApiKey('');
                  setIpWhitelistError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Email - Hidden by default, shown when green button clicked */}
      {isBrevoConnected && !showConfig && showTestSection && (
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
              <Label htmlFor="test-email">Send Test Email To:</Label>
              <div className="flex gap-2">
                <Input
                  id="test-email"
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
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                <p className="text-xs text-blue-800">
                  <strong>Important:</strong> If this email is not yet verified in your Brevo account,
                  Brevo will send a verification email to this address. You must click the verification
                  link in that email before you can send emails from this address.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Statistics */}
      {isBrevoConnected && stats && !showConfig && (
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
      {!isBrevoConnected && !showConfig && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">How to Get Your Brevo API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-blue-800">
            <ol className="list-decimal list-inside space-y-2">
              <li>Sign in to your Brevo account at{' '}
                <a href="https://app.brevo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  app.brevo.com
                </a>
              </li>
              <li>Go to Settings → API Keys (or click{' '}
                <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  here
                </a>)
              </li>
              <li>Click "Generate a new API key"</li>
              <li>Copy the API key (starts with "xkeysib-")</li>
              <li>Click "Configure Brevo" above and paste your API key</li>
              <li>Enter sender email - <strong>Brevo will send a verification email</strong> if not already verified</li>
              <li>Check your inbox and verify the sender email before sending test emails</li>
            </ol>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 text-sm mb-1">Sender Email Verification Required</p>
                  <p className="text-xs text-yellow-800">
                    When you enter a sender email, Brevo will send a verification email to that address.
                    You must click the verification link in that email before you can send emails.
                    Check your spam folder if you don't receive it within a few minutes.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white border border-blue-300 rounded">
              <p className="font-medium text-blue-900 mb-2">Don't have a Brevo account?</p>
              <p className="mb-2">Create a free account at{' '}
                <a
                  href="https://www.brevo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  brevo.com
                </a>
              </p>
              <p className="text-xs text-blue-700">Free tier includes 300 emails/day</p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
