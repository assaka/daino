import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, AlertCircle, CreditCard, Settings, Mail, Globe, RefreshCw, Palette, Database, Beaker, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { checkStripeConnectStatus } from '@/api/functions';
import brevoAPI from '@/api/brevo';
import apiClient from '@/api/client';
import { ThemePresetSelector } from '@/components/admin/ThemePresetSelector';

export const SetupGuide = ({ store }) => {
    const navigate = useNavigate();
    const [emailConfigured, setEmailConfigured] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(true);
    const [stripeStatus, setStripeStatus] = useState(null);
    const [loadingStripe, setLoadingStripe] = useState(true);

    // Theme preset modal state
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [applyingTheme, setApplyingTheme] = useState(false);
    const [themeDisplayName, setThemeDisplayName] = useState(null);

    // Demo data modal state
    const [showDemoModal, setShowDemoModal] = useState(false);
    const [provisioningDemo, setProvisioningDemo] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoringDemo, setRestoringDemo] = useState(false);

    // Load Stripe Connect status
    useEffect(() => {
        const loadStripeStatus = async () => {
            if (!store?.id) return;

            setLoadingStripe(true);
            try {
                const response = await checkStripeConnectStatus(store.id);
                // response structure: { data: { connected: true, onboardingComplete: true, ... } }
                const status = response.data?.data || response.data || null;
                setStripeStatus(status);
            } catch (error) {
                console.error('Error loading Stripe status:', error);
                setStripeStatus(null);
            } finally {
                setLoadingStripe(false);
            }
        };

        loadStripeStatus();
    }, [store?.id]);

    if (!store) {
        return null;
    }

    const isDomainConnected = store.custom_domain && store.domain_status === 'active';
    const hasCustomDomains = store.active_domain_count > 0;
    // Check if Stripe is connected from IntegrationConfig via API
    const isStripeConnected = stripeStatus?.connected && stripeStatus?.onboardingComplete;
    const stripeAccountId = stripeStatus?.account_id; // API returns account_id not accountId

    // Load email configuration status
    useEffect(() => {
        const loadEmailStatus = async () => {
            if (!store?.id) return;

            setLoadingEmail(true);
            try {
                const response = await brevoAPI.getConnectionStatus(store.id);
                if (response.success) {
                    setEmailConfigured(response.data.isConfigured || false);
                }
            } catch (error) {
                console.error('Error loading email status:', error);
                setEmailConfigured(false);
            } finally {
                setLoadingEmail(false);
            }
        };

        loadEmailStatus();
    }, [store?.id]);

    // Fetch theme preset display name
    useEffect(() => {
        const fetchThemeDisplayName = async () => {
            if (!store?.theme_preset) {
                setThemeDisplayName(null);
                return;
            }
            try {
                const response = await fetch(`/api/public/theme-defaults/preset/${store.theme_preset}`);
                const data = await response.json();
                if (data.success && data.data?.display_name) {
                    setThemeDisplayName(data.data.display_name);
                }
            } catch (error) {
                console.error('Error fetching theme display name:', error);
            }
        };
        fetchThemeDisplayName();
    }, [store?.theme_preset]);

    // Theme preset handler
    const handleApplyThemePreset = async () => {
        if (!store || !selectedPreset) return;

        setApplyingTheme(true);
        try {
            const response = await apiClient.post(`/stores/${store.id}/apply-theme-preset`, {
                presetName: selectedPreset
            });

            if (response.success) {
                setShowThemeModal(false);
                setSelectedPreset(null);
                // Optionally reload the page to reflect changes
                window.location.reload();
            } else {
                alert(response.error || 'Failed to apply theme preset');
            }
        } catch (error) {
            console.error('Error applying theme preset:', error);
            alert('Failed to apply theme preset. Please try again.');
        } finally {
            setApplyingTheme(false);
        }
    };

    // Demo provisioning handler
    const handleProvisionDemo = async () => {
        if (!store) return;

        setProvisioningDemo(true);
        try {
            const response = await apiClient.post(`stores/${store.id}/provision-demo`);
            if (response.success) {
                setShowDemoModal(false);
                // Reload to reflect new demo status
                window.location.reload();
            } else {
                alert(response.error || 'Failed to provision demo data');
            }
        } catch (error) {
            console.error('Demo provisioning error:', error);
            alert('Failed to provision demo data. Please try again.');
        } finally {
            setProvisioningDemo(false);
        }
    };

    // Demo restore handler
    const handleRestoreDemo = async () => {
        if (!store) return;

        setRestoringDemo(true);
        try {
            const response = await apiClient.post(`stores/${store.id}/restore-demo`);
            if (response.success) {
                setShowRestoreModal(false);
                // Reload to reflect restored status
                window.location.reload();
            } else {
                alert(response.error || 'Failed to restore store');
            }
        } catch (error) {
            console.error('Demo restoration error:', error);
            alert('Failed to restore store. Please try again.');
        } finally {
            setRestoringDemo(false);
        }
    };

    // Determine demo/theme status
    const hasThemePreset = !!store?.theme_preset;
    const isDemoStore = store?.status === 'demo';
    const canProvisionDemo = store?.status === 'active' && !store?.published;

    // Only hide the setup guide if domain, Stripe, and email are connected
    if (isDomainConnected && isStripeConnected && emailConfigured) {
        // Show a condensed version when everything is set up
        return (
            <Card className="mb-8 bg-green-50 border-green-200 material-elevation-1">
                <CardHeader>
                    <CardTitle className="text-green-900 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Store Setup Complete
                    </CardTitle>
                    <CardDescription className="text-green-700">Your store is ready to start selling!</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-700">Domain Connected</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-700">
                                    Stripe Connected {stripeAccountId && `(${stripeAccountId.substring(0, 15)}...)`}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-700">Email Configured</span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/admin/payment-methods')}
                        >
                            <Settings className="w-4 h-4 mr-1" />
                            Manage Payments
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
        <Card className="mb-8 bg-blue-50 border-blue-200 material-elevation-1">
            <CardHeader>
                <CardTitle className="text-blue-900">Set Up Your Store</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-4">
                    <li className="flex items-center justify-between">
                        <div className="flex items-center">
                            {isDomainConnected ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600 mr-3" />
                            )}
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {isDomainConnected ? 'Domain Connected' : hasCustomDomains ? 'Configure Custom Domain' : 'Add Custom Domain'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {isDomainConnected
                                        ? `Connected: ${store.custom_domain}`
                                        : hasCustomDomains
                                            ? `You have ${store.active_domain_count} active domain${store.active_domain_count !== 1 ? 's' : ''}${store.pending_domain_count > 0 ? ` and ${store.pending_domain_count} pending` : ''}.`
                                            : 'Make your store accessible at your own URL.'
                                    }
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={isDomainConnected ? "secondary" : "default"}
                            size="sm"
                            onClick={() => navigate(createPageUrl('custom-domains'))}
                            className="w-28"
                        >
                            <Globe className="w-4 h-4 mr-1" />
                            {isDomainConnected ? 'Manage' : hasCustomDomains ? 'Configure' : 'Add'}
                        </Button>
                    </li>
                    <li className="flex items-center justify-between">
                        <div className="flex items-center">
                            {isStripeConnected ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600 mr-3" />
                            )}
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {isStripeConnected ? 'Stripe Account Connected' : 'Connect Stripe Account'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {isStripeConnected
                                        ? (stripeAccountId
                                            ? `Account ID: ${stripeAccountId.substring(0, 20)}...`
                                            : 'Ready to accept payments')
                                        : 'Securely connect Stripe to receive payments.'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {isStripeConnected ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate('/admin/payment-methods')}
                                    title="Manage payment settings"
                                    className="w-28"
                                >
                                    <Settings className="w-4 h-4 mr-1" />
                                    Manage
                                </Button>
                            ) : (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => navigate('/admin/payment-methods')}
                                    className="w-28 bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Connect
                                </Button>
                            )}
                        </div>
                    </li>
                    <li className="flex items-center justify-between">
                        <div className="flex items-center">
                            {emailConfigured ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600 mr-3" />
                            )}
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {emailConfigured ? 'Email Configured' : 'Configure Email'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {emailConfigured
                                        ? 'Email provider connected and ready to send transactional emails.'
                                        : 'Set up email service for order confirmations and customer communications.'
                                    }
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={emailConfigured ? "secondary" : "default"}
                            size="sm"
                            onClick={() => navigate(createPageUrl('email'))}
                            disabled={loadingEmail}
                            className="w-28"
                        >
                            {loadingEmail ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Mail className="w-4 h-4 mr-1" />
                                    {emailConfigured ? 'Manage' : 'Configure'}
                                </>
                            )}
                        </Button>
                    </li>
                    {/* Theme Preset Item */}
                    <li className="flex items-center justify-between">
                        <div className="flex items-center">
                            {hasThemePreset ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                            ) : (
                                <Palette className="w-5 h-5 text-violet-600 mr-3" />
                            )}
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {hasThemePreset ? 'Theme Selected' : 'Choose Theme Preset'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {hasThemePreset
                                        ? `Using "${themeDisplayName || store.theme_preset}" theme preset.`
                                        : 'Select a theme preset to customize your store appearance.'
                                    }
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={hasThemePreset ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                                setSelectedPreset(store?.theme_preset || 'default');
                                setShowThemeModal(true);
                            }}
                            className={`w-28 ${!hasThemePreset ? "border-violet-200 text-violet-600 hover:bg-violet-50" : ""}`}
                        >
                            <Palette className="w-4 h-4 mr-1" />
                            {hasThemePreset ? 'Change' : 'Select'}
                        </Button>
                    </li>
                    {/* Demo Data Provisioning Item */}
                    {(canProvisionDemo || isDemoStore) && (
                        <li className="flex items-center justify-between">
                            <div className="flex items-center">
                                {isDemoStore ? (
                                    <Beaker className="w-5 h-5 text-purple-600 mr-3" />
                                ) : (
                                    <Database className="w-5 h-5 text-purple-600 mr-3" />
                                )}
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        {isDemoStore ? 'Demo Mode Active' : 'Add Demo Data'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {isDemoStore
                                            ? 'Store is loaded with demo content. Clear to go live.'
                                            : 'Populate your store with sample products, orders, and customers.'
                                        }
                                    </p>
                                </div>
                            </div>
                            {isDemoStore ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowRestoreModal(true)}
                                    className="w-28 border-amber-200 text-amber-600 hover:bg-amber-50"
                                >
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                    Clear Demo
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDemoModal(true)}
                                    className="w-28 border-purple-200 text-purple-600 hover:bg-purple-50"
                                >
                                    <Database className="w-4 h-4 mr-1" />
                                    Provision
                                </Button>
                            )}
                        </li>
                    )}
                </ul>
            </CardContent>
        </Card>

        {/* Theme Preset Modal */}
        <Dialog open={showThemeModal} onOpenChange={(open) => {
            if (!open) {
                setShowThemeModal(false);
                setSelectedPreset(null);
            }
        }}>
            <DialogContent className="max-w-2xl overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-violet-600" />
                        Select Theme Preset
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 overflow-hidden">
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                        <p className="text-sm text-violet-900 font-medium mb-1">
                            Store: {store?.name}
                        </p>
                        <p className="text-sm text-violet-700">
                            Select a theme preset to apply colors and styles to your store.
                        </p>
                    </div>

                    <ThemePresetSelector
                        value={selectedPreset}
                        onChange={setSelectedPreset}
                        variant="cards"
                        storeId={store?.id}
                    />

                    <div className="flex justify-between items-center pt-4 border-t">
                        <Button
                            variant="link"
                            className="text-sm text-gray-500 p-0"
                            onClick={() => {
                                setShowThemeModal(false);
                                navigate(`/admin/theme-layout?store=${store?.id}`);
                            }}
                        >
                            Advanced Theme Settings →
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowThemeModal(false);
                                    setSelectedPreset(null);
                                }}
                                disabled={applyingTheme}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-violet-600 hover:bg-violet-700"
                                onClick={handleApplyThemePreset}
                                disabled={applyingTheme || !selectedPreset}
                            >
                                {applyingTheme ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Applying...
                                    </>
                                ) : (
                                    <>
                                        <Palette className="w-4 h-4 mr-2" />
                                        Apply Theme
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Demo Data Provision Modal */}
        <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-purple-600">
                        <Beaker className="w-5 h-5" />
                        Provision Demo Data?
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-900 font-medium mb-2">Your data is safe</p>
                        <p className="text-sm text-blue-800">
                            Demo content will be added to your store. You can revert this action later
                            without losing any data you've manually added.
                        </p>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm text-purple-900 font-medium mb-2">Demo data includes:</p>
                        <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
                            <li>4 categories with subcategories</li>
                            <li>25+ demo products with images</li>
                            <li>Attribute sets and attributes</li>
                            <li>20 demo customers</li>
                            <li>50 demo orders</li>
                            <li>CMS pages and blocks</li>
                            <li>Product tabs and product labels</li>
                            <li>Tax configuration and coupons</li>
                        </ul>
                    </div>

                    <p className="text-sm text-gray-600">
                        Store: <strong>{store?.name}</strong>
                    </p>

                    <div className="flex justify-end space-x-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowDemoModal(false)}
                            disabled={provisioningDemo}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={handleProvisionDemo}
                            disabled={provisioningDemo}
                        >
                            {provisioningDemo ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Provisioning...
                                </>
                            ) : (
                                <>
                                    <Database className="w-4 h-4 mr-2" />
                                    Provision Demo Data
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Demo Data Restore Modal */}
        <Dialog open={showRestoreModal} onOpenChange={setShowRestoreModal}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <RefreshCw className="w-5 h-5" />
                        Restore Store?
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-900 font-medium mb-2">What this does:</p>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                            <li>Removes all demo data (products, orders, customers)</li>
                            <li>Keeps any data you added manually</li>
                            <li>Sets store to Active + Paused state</li>
                            <li>You can then run the store or add your own data</li>
                        </ul>
                    </div>

                    <p className="text-sm text-gray-600">
                        Store: <strong>{store?.name}</strong>
                    </p>

                    <div className="flex justify-end space-x-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowRestoreModal(false)}
                            disabled={restoringDemo}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={handleRestoreDemo}
                            disabled={restoringDemo}
                        >
                            {restoringDemo ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Restoring...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Restore Store
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </>
    );
};