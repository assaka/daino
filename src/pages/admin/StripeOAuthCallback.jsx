import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeStripeOAuthCallback } from "@/api/functions";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

export default function StripeOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Connecting your Stripe account...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth errors (user denied access, etc.)
      if (error) {
        setStatus('error');
        setMessage(errorDescription || 'Failed to connect Stripe account. Please try again.');
        setTimeout(() => {
          navigate('/admin/payment-methods?stripe_error=' + encodeURIComponent(errorDescription || error));
        }, 3000);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Invalid OAuth callback. Missing required parameters.');
        setTimeout(() => {
          navigate('/admin/payment-methods?stripe_error=invalid_callback');
        }, 3000);
        return;
      }

      try {
        const response = await completeStripeOAuthCallback(code, state);
        const data = response.data?.data || response.data;

        if (data?.account_id) {
          setStatus('success');
          if (data.onboardingComplete) {
            setMessage('Stripe account connected successfully!');
          } else {
            setMessage('Account connected! Some additional setup may be required in Stripe.');
          }
          setTimeout(() => {
            navigate('/admin/payment-methods?stripe_oauth_success=true');
          }, 2000);
        } else {
          throw new Error('No account ID returned');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        const errorMsg = error.response?.data?.message || error.message || 'Failed to connect Stripe account';
        setMessage(errorMsg);
        setTimeout(() => {
          navigate('/admin/payment-methods?stripe_error=' + encodeURIComponent(errorMsg));
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {status === 'processing' && (
            <>
              <RefreshCw className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
              <h2 className="text-xl font-semibold mb-2">Connecting Stripe</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <h2 className="text-xl font-semibold mb-2 text-green-700">Success!</h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Redirecting to payment methods...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
              <h2 className="text-xl font-semibold mb-2 text-red-700">Connection Failed</h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Redirecting back...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
