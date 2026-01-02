import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import apiClient from '@/api/client';
import FlashMessage from '@/components/storefront/FlashMessage';

const NeonCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Connecting to Neon...');
  const [flashMessage, setFlashMessage] = useState(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        throw new Error(searchParams.get('error_description') || 'OAuth authorization failed');
      }

      if (!code || !state) {
        throw new Error('Missing OAuth parameters');
      }

      setMessage('Exchanging authorization code...');

      // Send to backend to complete OAuth flow
      const response = await apiClient.post('/database-oauth/neon/callback', {
        code,
        state
      });

      if (response.success) {
        setStatus('success');
        setMessage('Neon database connected successfully!');
        setFlashMessage({ type: 'success', message: 'Neon database connected successfully' });

        // Redirect to database integrations page after 2 seconds
        setTimeout(() => {
          navigate('/admin/integrations/database');
        }, 2000);
      } else {
        throw new Error(response.message || 'Failed to connect database');
      }
    } catch (error) {
      console.error('Neon OAuth callback error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to connect to Neon');
      setFlashMessage({ type: 'error', message: error.message || 'Failed to connect to Neon' });

      // Redirect back after 3 seconds
      setTimeout(() => {
        navigate('/admin/integrations/database');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting to Neon
              </h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Success!
              </h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">Redirecting...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">Redirecting back...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NeonCallback;
