import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle } from 'lucide-react';
import brevoAPI from '@/api/brevo';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import FlashMessage from '@/components/storefront/FlashMessage';
import { useAlertTypes } from '@/hooks/useAlert';
import BrevoProvider from './providers/BrevoProvider';

// Email provider configurations
const EMAIL_PROVIDERS = {
  brevo: {
    id: 'brevo',
    name: 'Brevo',
    description: 'Powerful email marketing and transactional email service',
    logo: '📧',
    color: 'from-blue-500 to-blue-600',
    available: true,
    features: ['Transactional Emails', 'Email Templates', 'Analytics', 'Free tier: 300 emails/day'],
    setupUrl: 'https://app.brevo.com/settings/keys/api'
  },
  sendgrid: {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Cloud-based email delivery and management platform by Twilio',
    logo: '📤',
    color: 'from-blue-400 to-cyan-500',
    available: false,
    features: ['High Deliverability', 'Email API', 'Analytics & Tracking', 'Free tier: 100 emails/day'],
    comingSoon: true
  },
  postmark: {
    id: 'postmark',
    name: 'Postmark',
    description: 'Fast and reliable transactional email service',
    logo: '📬',
    color: 'from-yellow-400 to-yellow-500',
    available: false,
    features: ['Fast Delivery', 'Detailed Analytics', 'Dedicated IPs', 'Developer Friendly'],
    comingSoon: true
  },
  resend: {
    id: 'resend',
    name: 'Resend',
    description: 'Modern email API for developers',
    logo: '✉️',
    color: 'from-gray-700 to-gray-900',
    available: false,
    features: ['React Email Support', 'Simple API', 'Real-time Webhooks', 'Free tier: 3,000 emails/month'],
    comingSoon: true
  }
};

export default function EmailProviderSettings({ storeEmail, storeName }) {
  const { getSelectedStoreId } = useStoreSelection();
  const { showConfirm, AlertComponent } = useAlertTypes();
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBrevoConnected, setIsBrevoConnected] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  useEffect(() => {
    checkProviderStatus();
  }, []);

  const checkProviderStatus = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    setLoading(true);
    try {
      // Check Brevo connection status
      const response = await brevoAPI.getConnectionStatus(storeId);
      if (response.success && response.data.isConfigured) {
        setIsBrevoConnected(true);
      }
    } catch (error) {
      console.error('Error checking provider status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (providerId) => {
    const provider = EMAIL_PROVIDERS[providerId];
    if (!provider.available) {
      setFlashMessage({ type: 'info', message: `${provider.name} integration coming soon!` });
      return;
    }
    setSelectedProvider(providerId);
  };

  const handleBackToProviders = () => {
    setSelectedProvider(null);
    // Refresh provider status when returning
    checkProviderStatus();
  };

  return (
    <div className="space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <AlertComponent />

      {/* Missing Store Email Warning */}
      {!storeEmail && !loading && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-900 mb-1">Store Email Not Configured</p>
                <p className="text-sm text-yellow-800 mb-3">
                  To pre-fill configuration forms and use the quick test feature, please add your store's contact email first.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = '/admin/settings'}
                  className="border-yellow-400 text-yellow-900 hover:bg-yellow-100"
                >
                  Go to Settings &gt; General
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Provider Selection */}
      {!selectedProvider && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Select Email Provider</h3>
            <p className="text-sm text-gray-600">Choose your email service provider to send transactional emails</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(EMAIL_PROVIDERS).map((provider) => (
              <Card
                key={provider.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  provider.available ? 'hover:border-blue-400' : 'opacity-75'
                } ${selectedProvider === provider.id ? 'border-blue-500 border-2' : ''}`}
                onClick={() => handleProviderSelect(provider.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 bg-gradient-to-r ${provider.color} rounded-lg flex items-center justify-center text-2xl`}>
                        {provider.logo}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                      </div>
                    </div>
                    {provider.comingSoon && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                        Soon
                      </Badge>
                    )}
                    {provider.id === 'brevo' && isBrevoConnected && (
                      <Badge className="bg-green-500 text-xs">
                        <Check className="w-3 h-3 mr-1" /> Active
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">{provider.description}</p>
                  <ul className="space-y-1">
                    {provider.features.map((feature, idx) => (
                      <li key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {provider.available && (
                    <Button
                      className="w-full mt-4"
                      variant={provider.id === 'brevo' && isBrevoConnected ? 'outline' : 'default'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProviderSelect(provider.id);
                      }}
                    >
                      {provider.id === 'brevo' && isBrevoConnected ? 'Manage' : 'Configure'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Brevo Provider */}
      {selectedProvider === 'brevo' && (
        <BrevoProvider
          storeEmail={storeEmail}
          storeName={storeName}
          onBack={handleBackToProviders}
          onFlashMessage={setFlashMessage}
          getSelectedStoreId={getSelectedStoreId}
          showConfirm={showConfirm}
        />
      )}

      {/*
       Add new provider:
       1. Create src/components/admin/settings/providers/[ProviderName]Provider.jsx
       2. In EmailProviderSettings.jsx, add:

      {selectedProvider === 'providerId' && (
          <ProviderComponent
              storeEmail={storeEmail}
              storeName={storeName}
              onBack={handleBackToProviders}
              onFlashMessage={setFlashMessage}
              getSelectedStoreId={getSelectedStoreId}
              showConfirm={showConfirm}
          />
      )}
        */}


    </div>
  );
}
