import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertCircle, CreditCard, Settings, Mail, Globe, RefreshCw } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { checkStripeConnectStatus } from '@/api/functions';
import brevoAPI from '@/api/brevo';

export const SetupGuide = ({ store }) => {
    const navigate = useNavigate();
    const [emailConfigured, setEmailConfigured] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(true);
    const [stripeStatus, setStripeStatus] = useState(null);
    const [loadingStripe, setLoadingStripe] = useState(true);

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
    const needsPrimaryDomain = store.has_domains_without_primary && store.active_domain_count > 0;
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

    // Only hide the setup guide if domain, Stripe, and email are connected
    // Keep showing if any is incomplete, or if domains exist but no primary is set
    if (isDomainConnected && !needsPrimaryDomain && isStripeConnected && emailConfigured) {
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
        <Card className="mb-8 bg-blue-50 border-blue-200 material-elevation-1">
            <CardHeader>
                <CardTitle className="text-blue-900">Finish Setting Up Your Store</CardTitle>
                <CardDescription className="text-blue-700">Complete these steps to start selling.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-4">
                    <li className="flex items-center justify-between">
                        <div className="flex items-center">
                            {isDomainConnected ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                            ) : needsPrimaryDomain ? (
                                <AlertCircle className="w-5 h-5 text-orange-500 mr-3" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600 mr-3" />
                            )}
                            <div>
                                <p className="font-semibold text-gray-800">
                                    {isDomainConnected ? 'Domain Connected' : needsPrimaryDomain ? 'Set Primary Domain' : 'Connect Your Domain'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {isDomainConnected
                                        ? `Connected: ${store.custom_domain}`
                                        : needsPrimaryDomain
                                            ? `You have ${store.active_domain_count} active domain${store.active_domain_count > 1 ? 's' : ''} but no primary is set.`
                                            : 'Make your store accessible at your own URL.'
                                    }
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={isDomainConnected ? "secondary" : needsPrimaryDomain ? "default" : "default"}
                            size="sm"
                            onClick={() => navigate(createPageUrl('custom-domains'))}
                            className={needsPrimaryDomain ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                        >
                            <Globe className="w-4 h-4 mr-1" />
                            {isDomainConnected ? 'Manage' : needsPrimaryDomain ? 'Set Primary' : 'Connect'}
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
                                >
                                    <Settings className="w-4 h-4 mr-1" />
                                    Manage
                                </Button>
                            ) : (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => navigate('/admin/payment-methods')}
                                    className="bg-orange-600 hover:bg-orange-700 text-white"
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
                </ul>
            </CardContent>
        </Card>
    );
};