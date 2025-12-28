import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Globe,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Info,
  ArrowRight
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { getStoreBaseUrl, getExternalStoreUrl } from '@/utils/urlUtils';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';

const CustomDomains = () => {
  const { selectedStore } = useStoreSelection();
  const storeId = selectedStore?.id || localStorage.getItem('selectedStoreId');

  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dnsDialogOpen, setDnsDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checkingSSL, setCheckingSSL] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dnsDebugData, setDnsDebugData] = useState(null);
  const [isDnsDebugOpen, setIsDnsDebugOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(null);

  // Companion domain state
  const [companionDomain, setCompanionDomain] = useState('');
  const [includeCompanion, setIncludeCompanion] = useState(true);
  const [showCompanionOption, setShowCompanionOption] = useState(false);

  // Custom domain daily cost from service_credit_costs table
  const [customDomainCost, setCustomDomainCost] = useState(0.5); // default fallback

  // Helper to detect domain type and get companion
  const getDomainInfo = (domain) => {
    const normalized = domain.trim().toLowerCase();
    const isWww = normalized.startsWith('www.');
    const isRootDomain = !normalized.startsWith('www.') && normalized.split('.').length === 2;

    if (isWww) {
      return {
        type: 'www',
        companion: normalized.replace(/^www\./, ''),
        hasCompanion: true
      };
    } else if (isRootDomain) {
      return {
        type: 'root',
        companion: `www.${normalized}`,
        hasCompanion: true
      };
    } else {
      return {
        type: 'subdomain',
        companion: null,
        hasCompanion: false
      };
    }
  };

  // Update companion when domain changes
  const handleDomainChange = (value) => {
    setNewDomain(value);
    const domainInfo = getDomainInfo(value);
    setShowCompanionOption(domainInfo.hasCompanion);
    setCompanionDomain(domainInfo.companion || '');
    setIncludeCompanion(domainInfo.hasCompanion);
  };

  // Helper to get DNS record name for a domain
  const getDnsRecordName = (domain) => {
    if (!domain) return 'www';
    const normalized = domain.toLowerCase();
    const isWww = normalized.startsWith('www.');
    const parts = normalized.split('.');

    if (isWww) {
      return 'www';
    } else if (parts.length === 2) {
      // Root domain like hamid.com
      return '@';
    } else {
      // Subdomain like shop.hamid.com
      return parts[0];
    }
  };

  // Helper to get TXT verification record name
  const getTxtRecordName = (domain) => {
    const dnsName = getDnsRecordName(domain);
    if (dnsName === '@') {
      return '_daino-verification';
    }
    return `_daino-verification.${dnsName}`;
  };

  // Check if domain is root (can't use CNAME)
  const isRootDomain = (domain) => {
    if (!domain) return false;
    const parts = domain.toLowerCase().split('.');
    return parts.length === 2;
  };

  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      loadDomains();
    }
  }, [storeId]);

  // Fetch custom domain cost from service_credit_costs table
  useEffect(() => {
    const fetchCustomDomainCost = async () => {
      try {
        const response = await apiClient.get('/service-credit-costs/key/custom_domain');
        if (response.success && response.service) {
          setCustomDomainCost(response.service.cost_per_unit);
        }
      } catch (error) {
        console.error('Error fetching custom domain cost:', error);
        // Keep default fallback value of 0.5
      }
    };
    fetchCustomDomainCost();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/custom-domains');
      if (response.success) {
        setDomains(response.domains || []);
      }
    } catch (error) {
      console.error('Error loading domains:', error);
      toast.error('Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error('Please enter a domain name');
      return;
    }

    // Basic domain validation
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(newDomain.trim())) {
      toast.error('Please enter a valid domain name (e.g., shop.example.com)');
      return;
    }

    try {
      setAdding(true);
      const response = await apiClient.post('/custom-domains/add', {
        domain: newDomain.trim().toLowerCase(),
        redirect_from: includeCompanion && companionDomain ? companionDomain : null,
        verificationMethod: 'txt',
        sslProvider: 'letsencrypt'
      });

      if (response.success) {
        const message = includeCompanion && companionDomain
          ? `Domains added: ${newDomain} (primary) and ${companionDomain} (redirects)`
          : 'Domain added successfully! Please configure DNS records.';
        toast.success(message);
        setAddDialogOpen(false);
        setNewDomain('');
        setCompanionDomain('');
        setIncludeCompanion(true);
        setShowCompanionOption(false);
        loadDomains();

        // Show DNS instructions
        setSelectedDomain(response.domain);
        setDnsDialogOpen(true);
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error(error.response?.data?.message || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerifyDomain = async (domainId) => {
    try {
      setVerifying(true);
      const response = await apiClient.post(`/custom-domains/${domainId}/verify`);

      if (response.success) {
        toast.success('Domain verified successfully!');
        loadDomains();
      } else {
        toast.error(response.message || 'Domain verification failed. Please check DNS records.');
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error(error.response?.data?.message || 'Failed to verify domain');
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckDNS = async (domainId) => {
    try {
      const response = await apiClient.post(`/custom-domains/${domainId}/check-dns`);

      if (response.configured) {
        toast.success('All DNS records configured correctly!');
      } else {
        const missing = response.records.filter(r => !r.configured);
        toast.warning(`Missing ${missing.length} DNS record(s). Check details below.`);
      }

      // Show results
    } catch (error) {
      toast.error('Failed to check DNS configuration');
    }
  };

  const handleDebugDNS = async (domainId) => {
    try {
      const response = await apiClient.get(`/custom-domains/${domainId}/debug-dns`);

      if (response.success) {
        console.log('=== DNS DEBUG REPORT ===');
        console.log('Domain:', response.debug.domain);
        console.log('\nExpected Records:');
        console.log(response.debug.expected_records);
        console.log('\nActual Records:');
        console.log(response.debug.actual_records);
        console.log('\nRecommendations:');
        console.log(response.recommendations);
        console.log('=====================');

        // Show recommendations as toast
        response.recommendations.forEach(rec => {
          if (rec.type === 'error') {
            toast.error(rec.message, { duration: 8000 });
          } else if (rec.type === 'warning') {
            toast.warning(rec.message, { duration: 6000 });
          } else {
            toast.success(rec.message, { duration: 4000 });
          }
        });

        // Open debug modal
        setDnsDebugData(response);
        setIsDnsDebugOpen(true);
      }
    } catch (error) {
      console.error('Error debugging DNS:', error);
      toast.error('Failed to debug DNS configuration');
    }
  };

  const handleCheckSSL = async (domainId) => {
    try {
      setCheckingSSL(true);
      const response = await apiClient.post(`/custom-domains/${domainId}/check-ssl`);

      if (response.success) {
        if (response.ssl_status === 'active') {
          toast.success('SSL certificate is active!');
        } else {
          toast.info(`SSL status: ${response.ssl_status}. Vercel is provisioning the certificate...`);
        }
        loadDomains();
      } else {
        toast.warning(response.message || 'SSL status check failed');
      }
    } catch (error) {
      console.error('Error checking SSL:', error);
      toast.error(error.response?.data?.message || 'Failed to check SSL status');
    } finally {
      setCheckingSSL(false);
    }
  };

  const handleRemoveDomain = (domainId, domainName) => {
    setDomainToDelete({ id: domainId, name: domainName });
    setDeleteDialogOpen(true);
  };

  const confirmRemoveDomain = async () => {
    if (!domainToDelete) return;

    try {
      setDeleting(true);
      const response = await apiClient.delete(`/custom-domains/${domainToDelete.id}`);

      if (response.success) {
        toast.success('Domain removed successfully');
        setDeleteDialogOpen(false);
        setDomainToDelete(null);
        loadDomains();
      }
    } catch (error) {
      console.error('Error removing domain:', error);
      toast.error(error.response?.data?.message || 'Failed to remove domain');
    } finally {
      setDeleting(false);
    }
  };

  const showDNSInstructions = (domain) => {
    setSelectedDomain(domain);
    setDnsDialogOpen(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getStoreUrl = (domain) => {
    // If domain is verified and SSL is active, show custom domain URL
    if (domain.verification_status === 'verified' && domain.ssl_status === 'active') {
      return `https://${domain.domain}`;
    }
    // Otherwise show the default platform URL with /public/storecode
    const storeCode = selectedStore?.code || selectedStore?.slug;
    if (!storeCode) {
      return 'Store code not available';
    }
    return getExternalStoreUrl(storeCode);
  };

  const getStatusBadge = (domain) => {
    if (domain.verification_status === 'verified' && domain.ssl_status === 'active') {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    } else if (domain.verification_status === 'verified') {
      return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />SSL Pending</Badge>;
    } else if (domain.verification_status === 'pending') {
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    } else if (domain.verification_status === 'failed') {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  const getSSLBadge = (sslStatus) => {
    switch (sslStatus) {
      case 'active':
        return <Badge className="bg-green-500"><Shield className="w-3 h-3 mr-1" />Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">Not Issued</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="w-8 h-8" />
            Custom Domains
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your own domain to your store
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Domain
        </Button>
      </div>

      {/* Current Store URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Store URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {(() => {
                const activeDomain = domains.find(d => d.verification_status === 'verified' && d.ssl_status === 'active' && !d.is_redirect);
                const storeCode = selectedStore?.code || selectedStore?.slug;
                const currentUrl = activeDomain
                  ? `https://${activeDomain.domain}`
                  : storeCode ? getExternalStoreUrl(storeCode) : 'Store code not available';

                const internalUrl = storeCode ? getExternalStoreUrl(storeCode) : null;

                return (
                  <div className="space-y-3">
                    {/* Active Custom Domain URL */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {activeDomain ? 'Custom Domain' : 'Default Platform URL'}
                      </p>
                      <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono text-base flex items-center gap-2"
                      >
                        {currentUrl}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {activeDomain && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          SSL Active, Verified
                        </p>
                      )}
                    </div>

                    {/* Internal Vercel URL (always show) */}
                    {internalUrl && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Internal URL</p>
                        <a
                          href={internalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:underline font-mono text-sm flex items-center gap-2"
                        >
                          {internalUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <p className="text-xs text-muted-foreground mt-1">
                          Always accessible (even without custom domain)
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Custom domains allow you to use your own domain name (e.g., www.myshop.com) instead of /public/storecode URLs.<br/>
          <strong> Costs {customDomainCost} credits per day</strong>
        </AlertDescription>
      </Alert>

      {/* Domains List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Domains</CardTitle>
          <CardDescription>
            Manage custom domains for your store. DNS changes may take 5-60 minutes to propagate.
          </CardDescription>
          <Alert className="mt-3 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              <strong>Steps:</strong> 1. Configure DNS records → 2. Click <strong>"Verify"</strong> → 3. When status shows "SSL Pending", click <strong>"Check SSL"</strong>
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading domains...
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No custom domains configured yet.</p>
              <p className="text-sm mt-1">Click "Add Domain" to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Domain</TableHead>
                  <TableHead className="hidden md:table-cell">Store URL</TableHead>
                  <TableHead className="sm:px-2 md:px-4">Status</TableHead>
                  <TableHead className="hidden md:table-cell">SSL</TableHead>
                  <TableHead className="text-right sm:px-2 md:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium px-2 md:px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate text-sm">{domain.domain}</span>
                        </div>
                        {domain.is_redirect && (
                          <Badge variant="secondary" className="text-orange-600 bg-orange-50 text-xs w-fit">
                            <ArrowRight className="w-3 h-3 mr-1" />
                            <span className="hidden md:inline">Redirects to {domain.redirect_to}</span>
                            <span className="md:hidden">Redirect</span>
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <a
                          href={getStoreUrl(domain)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm font-mono flex items-center gap-1"
                        >
                          {getStoreUrl(domain)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(getStoreUrl(domain))}
                          className="h-6 w-6 p-0"
                        >
                          {copiedText === getStoreUrl(domain) ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 md:px-4">
                      {getStatusBadge(domain)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {getSSLBadge(domain.ssl_status)}
                    </TableCell>
                    <TableCell className="text-right px-2 md:px-4">
                      <div className="flex items-center justify-end gap-1 md:gap-2">
                        {/* Settings button - always show */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => showDNSInstructions(domain)}
                          className="px-2 md:px-3"
                        >
                          <Info className="w-3 h-3 md:mr-1" />
                          <span className="hidden md:inline">Settings</span>
                        </Button>

                        {domain.verification_status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDebugDNS(domain.id)}
                              className="bg-blue-50 hidden md:flex"
                            >
                              <RefreshCw className="w-3 h-3 mr-1 text-blue-600" />
                              Check DNS
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleVerifyDomain(domain.id)}
                              disabled={verifying}
                              className="px-2 md:px-3"
                            >
                              {verifying ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3 md:mr-1" />
                                  <span className="hidden md:inline">Verify</span>
                                </>
                              )}
                            </Button>
                          </>
                        )}

                        {domain.verification_status === 'verified' && domain.ssl_status !== 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCheckSSL(domain.id)}
                            disabled={checkingSSL}
                            className="px-2 md:px-3"
                          >
                            {checkingSSL ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Shield className="w-3 h-3 md:mr-1" />
                                <span className="hidden md:inline">Check SSL</span>
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDomain(domain.id, domain.domain)}
                          className="px-2"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Domain Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Domain</DialogTitle>
            <DialogDescription>
              Enter your domain name. You'll configure DNS records in the next step.
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Daily Cost:</strong> {customDomainCost} credits per day will be automatically deducted for active custom domains.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                placeholder="www.myshop.com or myshop.com"
                value={newDomain}
                onChange={(e) => handleDomainChange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Enter your full domain (e.g., www.myshop.com or myshop.com)
              </p>
            </div>

            {/* Companion domain option */}
            {showCompanionOption && companionDomain && (
              <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="include-companion"
                    checked={includeCompanion}
                    onCheckedChange={setIncludeCompanion}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="include-companion" className="font-medium cursor-pointer">
                      Also add <code className="px-1 py-0.5 bg-background rounded text-sm">{companionDomain}</code>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Visitors to <strong>{companionDomain}</strong> will be automatically redirected to <strong>{newDomain.trim().toLowerCase()}</strong>
                    </p>
                  </div>
                </div>

                {includeCompanion && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800">
                      You'll need to add DNS records for <strong>both</strong> domains in your DNS provider.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDomain} disabled={adding}>
              {adding ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Domain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DNS Instructions Dialog */}
      <Dialog open={dnsDialogOpen} onOpenChange={setDnsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>DNS Configuration for {selectedDomain?.domain}</DialogTitle>
            <DialogDescription>
              Add these DNS records to your domain provider to verify ownership and enable your custom domain.
              {selectedDomain?.redirect_to && (
                <span className="block mt-1 text-orange-600">
                  Note: This domain will redirect to {selectedDomain.redirect_to}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-2 flex-1">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                DNS changes can take 5-60 minutes to propagate worldwide. After adding these records,
                click "Check DNS" to verify configuration, then "Verify" to complete setup.
              </AlertDescription>
            </Alert>

            {(() => {
              const redirectDomain = domains.find(d => d.redirect_to === selectedDomain?.domain);
              const hasCompanion = !!redirectDomain;

              // Helper to render DNS records for a domain
              const renderDnsRecords = (domain, token, isRedirect = false) => (
                <div className="space-y-4">
                  {isRootDomain(domain) && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        <strong>Root domain ({domain}):</strong> Must use A records. CNAME is not supported for root/apex domains.
                      </AlertDescription>
                    </Alert>
                  )}

                  {isRedirect && (
                    <Alert className="bg-orange-50 border-orange-200">
                      <ArrowRight className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        This domain will redirect visitors to <strong>{selectedDomain?.domain}</strong>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* A Records Section */}
                  <div>
                    <h4 className="font-semibold mb-2">
                      A Records {isRootDomain(domain) ? '(Required)' : '(Recommended)'}
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>TTL</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className={isRedirect ? "bg-orange-50" : "bg-green-50"}>
                          <TableCell className="font-mono font-bold">A</TableCell>
                          <TableCell className="font-mono">{getDnsRecordName(domain)}</TableCell>
                          <TableCell className="font-mono">76.76.21.21</TableCell>
                          <TableCell className="font-mono">3600</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard('76.76.21.21')}>
                              {copiedText === '76.76.21.21' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow className={isRedirect ? "bg-orange-50" : "bg-green-50"}>
                          <TableCell className="font-mono font-bold">A</TableCell>
                          <TableCell className="font-mono">{getDnsRecordName(domain)}</TableCell>
                          <TableCell className="font-mono">76.76.21.22</TableCell>
                          <TableCell className="font-mono">3600</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard('76.76.21.22')}>
                              {copiedText === '76.76.21.22' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* CNAME Alternative - only show for non-root domains */}
                  {!isRootDomain(domain) && (
                    <div>
                      <h4 className="font-semibold mb-2">OR CNAME Record (Alternative to A records)</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>TTL</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">CNAME</TableCell>
                            <TableCell className="font-mono">{getDnsRecordName(domain)}</TableCell>
                            <TableCell className="font-mono">cname.vercel-dns.com</TableCell>
                            <TableCell className="font-mono">3600</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => copyToClipboard('cname.vercel-dns.com')}>
                                {copiedText === 'cname.vercel-dns.com' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* TXT Record */}
                  <div>
                    <h4 className="font-semibold mb-2">TXT Record for Verification (Required)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>TTL</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="bg-yellow-50">
                          <TableCell className="font-mono font-bold">TXT</TableCell>
                          <TableCell className="font-mono">{getTxtRecordName(domain)}</TableCell>
                          <TableCell className="font-mono text-xs break-all">{token}</TableCell>
                          <TableCell className="font-mono">300</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(token)}>
                              {copiedText === token ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );

              if (hasCompanion) {
                // Show tabs with actual domain names
                return (
                  <Tabs defaultValue="primary">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="primary" className="text-xs sm:text-sm">
                        {selectedDomain?.domain}
                      </TabsTrigger>
                      <TabsTrigger value="redirect" className="text-xs sm:text-sm">
                        {redirectDomain.domain}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="primary" className="space-y-4 mt-4">
                      {renderDnsRecords(selectedDomain?.domain, selectedDomain?.verification_token, false)}
                    </TabsContent>

                    <TabsContent value="redirect" className="space-y-4 mt-4">
                      {renderDnsRecords(redirectDomain.domain, redirectDomain.verification_token, true)}
                    </TabsContent>
                  </Tabs>
                );
              } else {
                // Single domain - no tabs needed
                return renderDnsRecords(selectedDomain?.domain, selectedDomain?.verification_token, false);
              }
            })()}

            <Alert>
              <ExternalLink className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Common DNS Providers:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <a href="https://www.transip.nl/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      TransIP →
                    </a>
                    <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Cloudflare →
                    </a>
                    <a href="https://www.namecheap.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Namecheap →
                    </a>
                    <a href="https://dcc.godaddy.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      GoDaddy →
                    </a>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDnsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmRemoveDomain}
        title="Delete Custom Domain?"
        description={`Are you sure you want to remove ${domainToDelete?.name}? This action cannot be undone and will immediately stop serving your store on this domain.`}
        confirmText="Delete Domain"
        cancelText="Cancel"
        loading={deleting}
      />

      {/* DNS Debug Modal */}
      <Dialog open={isDnsDebugOpen} onOpenChange={setIsDnsDebugOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              DNS Debug Report
            </DialogTitle>
            <DialogDescription>
              Detailed DNS configuration analysis for {dnsDebugData?.debug?.domain}
            </DialogDescription>
          </DialogHeader>

          {dnsDebugData && (
            <div className="space-y-4">
              {/* Verification Status */}
              <div className="rounded-lg border p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm text-gray-700">Verification Status</h3>
                  {dnsDebugData.debug.can_verify ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Ready to Verify
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3 mr-1" />
                      Cannot Verify Yet
                    </Badge>
                  )}
                </div>
              </div>

              {/* DNS Records */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-gray-700">DNS Records Found</h3>

                {/* A Record */}
                <div className="rounded-lg border p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">A</span>
                        <span className="text-sm font-medium">A Record</span>
                      </div>
                      {dnsDebugData.debug.actual_records.a?.found ? (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">
                            Values: {dnsDebugData.debug.actual_records.a.values.join(', ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {dnsDebugData.debug.actual_records.a.note}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Not configured</p>
                      )}
                    </div>
                    {dnsDebugData.debug.actual_records.a?.matches_expected ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* CNAME Record */}
                <div className="rounded-lg border p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">CNAME</span>
                        <span className="text-sm font-medium">CNAME Record</span>
                      </div>
                      {dnsDebugData.debug.actual_records.cname?.found ? (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">
                            Values: {dnsDebugData.debug.actual_records.cname.values.join(', ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {dnsDebugData.debug.actual_records.cname.note}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">{dnsDebugData.debug.actual_records.cname?.message || 'Not configured'}</p>
                      )}
                    </div>
                    {dnsDebugData.debug.actual_records.cname?.matches_expected ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </div>

                {/* TXT Record */}
                <div className="rounded-lg border p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">TXT</span>
                        <span className="text-sm font-medium">Verification Record</span>
                      </div>
                      {dnsDebugData.debug.actual_records.txt?.found ? (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">
                            Record: {dnsDebugData.debug.actual_records.txt.record_name}
                          </p>
                          <p className="text-xs font-mono text-gray-500 break-all">
                            {dnsDebugData.debug.actual_records.txt.values[0]}
                          </p>
                          {dnsDebugData.debug.actual_records.txt.matches_expected ? (
                            <p className="text-xs text-green-600 font-medium">✓ Token matches</p>
                          ) : (
                            <p className="text-xs text-red-600 font-medium">✗ Token doesn't match</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">{dnsDebugData.debug.actual_records.txt?.message || 'Not configured'}</p>
                      )}
                    </div>
                    {dnsDebugData.debug.actual_records.txt?.matches_expected ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expected Token */}
              <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                <h3 className="font-medium text-sm text-blue-900 mb-2">Expected Verification Token</h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-white p-2 rounded border break-all">
                    {dnsDebugData.debug.verification_token}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(dnsDebugData.debug.verification_token)}
                  >
                    {copiedText === dnsDebugData.debug.verification_token ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Recommendations */}
              {dnsDebugData.recommendations && dnsDebugData.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-700">Recommendations</h3>
                  {dnsDebugData.recommendations.map((rec, idx) => (
                    <Alert key={idx} className={rec.type === 'error' ? 'border-red-200 bg-red-50' : rec.type === 'success' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
                      <AlertDescription className="text-sm">
                        {rec.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDnsDebugOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CustomDomains;
