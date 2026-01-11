import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { PageLoader } from '@/components/ui/page-loader';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CountrySelect } from '@/components/ui/country-select';
import {
  Store, Database, Palette, Clock,
  CheckCircle2, Circle, Loader2, ExternalLink, ArrowRight, ArrowLeft, Sparkles, AlertCircle, X, Info, LogOut, Mail
} from 'lucide-react';
import { handleLogout } from '@/utils/auth';
import apiClient from '@/utils/api';
import { Store as StoreEntity } from '@/api/entities';
import { ThemePresetSelector } from '@/components/admin/ThemePresetSelector';

const STEPS = [
  { id: 1, title: 'Create Store', description: 'Store details & location', icon: Store, required: true },
  { id: 2, title: 'Customize', description: 'Theme & demo data', icon: Palette, required: true },
  { id: 3, title: 'Connect Database', description: 'Link your Supabase', icon: Database, required: true },
  { id: 4, title: 'Provision Store', description: 'Set up your store', icon: Sparkles, required: true },
];

export default function StoreOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // All useState hooks must be at the top, before any conditional returns
  const [authChecked, setAuthChecked] = useState(false);
  const [isReprovision, setIsReprovision] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [storeId, setStoreId] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [storeData, setStoreData] = useState({ name: '', slug: '' });
  const [selectedThemePreset, setSelectedThemePreset] = useState('default');
  const [dbData, setDbData] = useState({ connectionString: '', serviceRoleKey: '' });
  const [oauthCompleted, setOauthCompleted] = useState(false);
  const [needsServiceKey, setNeedsServiceKey] = useState(false);
  const [profileData, setProfileData] = useState({ phone: '', country: '', storeEmail: '' });
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, message: '' });
  const [checkingExistingStores, setCheckingExistingStores] = useState(true); // Block UI until check completes
  const [provisionDemoData, setProvisionDemoData] = useState(false); // Default unchecked - adds setup time
  const [provisioningStatus, setProvisioningStatus] = useState(null); // Current provisioning step
  const [provisioningMessage, setProvisioningMessage] = useState(''); // User-friendly message
  const [backgroundJobStarted, setBackgroundJobStarted] = useState(false); // Track if background job was started
  const slugCheckTimeoutRef = React.useRef(null);
  const provisioningPollRef = React.useRef(null);

  // Poll for provisioning status updates - defined early so it can be used in useEffects
  const pollProvisioningStatus = async (targetStoreId) => {
    try {
      const statusResponse = await apiClient.get(`/stores/${targetStoreId}/provisioning-status`);

      // Handle various response formats from apiClient
      let responseData;
      if (Array.isArray(statusResponse)) {
        responseData = statusResponse[0];
      } else if (Array.isArray(statusResponse.data)) {
        responseData = statusResponse.data[0];
      } else if (statusResponse.data?.data) {
        responseData = statusResponse.data.data;
      } else if (statusResponse.data) {
        responseData = statusResponse.data;
      } else {
        responseData = statusResponse;
      }

      if (responseData && responseData.provisioningStatus) {
        const status = responseData.provisioningStatus;
        const message = responseData.message;
        const isComplete = responseData.isComplete;
        const isFailed = responseData.isFailed;

        setProvisioningStatus(status);
        setProvisioningMessage(message);

        if (isComplete) {
          // Provisioning completed successfully
          clearInterval(provisioningPollRef.current);
          provisioningPollRef.current = null;
          setLoading(false);
          setProvisioningStatus('completed');
          setProvisioningMessage('Provisioning completed successfully');
          setCompletedSteps([1, 2, 3, 4]);
          setSuccess('🎉 Your store is ready! Redirecting to dashboard...');

          // Clear old store selection data
          localStorage.removeItem('selectedStoreId');
          localStorage.removeItem('selectedStoreName');
          localStorage.removeItem('selectedStoreSlug');

          // Redirect to dashboard after a short delay
          setTimeout(() => {
            window.location.href = '/admin/dashboard';
          }, 2000);
          return;
        }

        if (isFailed) {
          // Provisioning failed
          clearInterval(provisioningPollRef.current);
          provisioningPollRef.current = null;
          setLoading(false);
          setError(message || 'Provisioning failed. Click "Provision Database" to retry.');
          setProvisioningStatus(null);
          setProvisioningMessage('');
          return;
        }
      }
    } catch (err) {
      console.warn('Error polling provisioning status:', err.message);
    }
  };

  // Auth check - redirect to login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem('store_owner_auth_token');
    if (!token) {
      navigate('/admin/auth', { replace: true });
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  // Handle reprovision mode - start at step 3 with existing store
  useEffect(() => {
    const step = searchParams.get('step');
    const reprovision = searchParams.get('reprovision');
    const resumeStoreId = searchParams.get('storeId');
    const resume = searchParams.get('resume');

    // Resume mode: store exists but provisioning was interrupted
    if (resumeStoreId && resume === 'true') {
      setIsReprovision(true);
      setStoreId(resumeStoreId);
      setCompletedSteps([1, 2, 3]); // Mark steps 1, 2, 3 as completed
      setCurrentStep(4); // Go to provisioning step

      // Check provisioning status to determine correct step
      const checkProvisioningProgress = async () => {
        try {
          const response = await apiClient.get(`/stores/${resumeStoreId}/provisioning-status`);
          // Handle array response
          const data = Array.isArray(response) ? response[0] :
                       Array.isArray(response.data) ? response.data[0] :
                       response.data || response;

          if (!data || !data.storeId) {
            // Store doesn't exist - clear storeId and start fresh
            setStoreId(null);
            setError('The store no longer exists. Please create a new store.');
            setCurrentStep(1);
            setCheckingExistingStores(false);
            return;
          }

          const status = data.provisioningStatus;

          // Set store data from API response
          setStoreData({
            name: data.name || 'My Store',
            slug: data.slug || 'my-store'
          });
          setProfileData({
            country: data.country || '',
            phone: data.phone || '',
            storeEmail: data.storeEmail || ''
          });
          if (data.themePreset) {
            setSelectedThemePreset(data.themePreset);
          }
          if (data.provisioningProgress?.demo_requested) {
            setProvisionDemoData(true);
          }

          if (data.isComplete || status === 'completed') {
            // Provisioning already complete - redirect to dashboard
            window.location.href = '/admin/dashboard';
            return;
          }

          // If status is beyond 'pending', provisioning is in progress
          if (status && status !== 'pending' && status !== 'failed') {
            // Provisioning is actively running - show progress UI and start polling
            setOauthCompleted(true);
            setNeedsServiceKey(false);
            setProvisioningStatus(status);
            setSuccess('Your store is being set up. You can close this page and we\'ll email you when it\'s ready.');
            // Start polling for status updates
            if (!provisioningPollRef.current) {
              provisioningPollRef.current = setInterval(() => {
                pollProvisioningStatus(resumeStoreId);
              }, 2000);
            }
          } else if (status === 'failed') {
            // Failed - let user retry from service key step
            setOauthCompleted(true);
            setNeedsServiceKey(true);
            setError(data.message || 'Previous setup failed. Please try again.');
          } else {
            // OAuth not done yet - go back to step 3
            setCompletedSteps([1, 2]);
            setCurrentStep(3);
          }
        } catch (err) {
          console.warn('Could not check provisioning status:', err.message);
          // Store might not exist
          if (err.message?.includes('404') || err.message?.includes('not found')) {
            setStoreId(null);
            setError('The store no longer exists. Please create a new store.');
            setCurrentStep(1);
          } else {
            setError('Could not verify store status. Please try again.');
          }
        }
        setCheckingExistingStores(false);
      };
      checkProvisioningProgress();
      return;
    }

    if ((step === '2' || step === '3') && reprovision === 'true') {
      const existingStoreId = localStorage.getItem('selectedStoreId');
      const existingStoreName = localStorage.getItem('selectedStoreName');

      if (existingStoreId) {
        // Verify store exists and check provisioning status
        const verifyStoreAndStatus = async () => {
          try {
            const response = await apiClient.get(`/stores/${existingStoreId}/provisioning-status`);
            const data = Array.isArray(response) ? response[0] :
                         Array.isArray(response.data) ? response.data[0] :
                         response.data || response;

            if (!data || !data.storeId) {
              // Store doesn't exist
              localStorage.removeItem('selectedStoreId');
              localStorage.removeItem('selectedStoreName');
              setError('The store no longer exists. Please create a new store.');
              setCurrentStep(1);
              return;
            }

            const status = data.provisioningStatus;

            if (data.isComplete || status === 'completed') {
              // Already complete - redirect to dashboard
              window.location.href = '/admin/dashboard';
              return;
            }

            // Store exists - set up reprovision mode with data from API
            setIsReprovision(true);
            setStoreId(existingStoreId);
            setStoreData({
              name: data.name || existingStoreName || 'My Store',
              slug: data.slug || existingStoreName?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my-store'
            });
            setProfileData({
              country: data.country || '',
              phone: data.phone || '',
              storeEmail: data.storeEmail || ''
            });
            if (data.themePreset) {
              setSelectedThemePreset(data.themePreset);
            }
            // Restore demo data preference from provisioning progress
            if (data.provisioningProgress?.demo_requested) {
              setProvisionDemoData(true);
            }
            setCompletedSteps([1, 2, 3]);
            setCurrentStep(4);

            // Check provisioning status
            if (status && status !== 'pending' && status !== 'failed') {
              // Provisioning is actively running - show progress UI and start polling
              setOauthCompleted(true);
              setProvisioningStatus(status);
              setNeedsServiceKey(false);
              setSuccess('Your store is being set up. You can close this page and we\'ll email you when it\'s ready.');
              // Start polling for status updates
              if (!provisioningPollRef.current) {
                provisioningPollRef.current = setInterval(() => {
                  pollProvisioningStatus(existingStoreId);
                }, 2000);
              }
            } else if (status === 'failed') {
              setOauthCompleted(true);
              setNeedsServiceKey(true);
              setError(data.message || 'Previous setup failed. Please try again.');
            } else {
              // OAuth not done yet - go back to step 3
              setCompletedSteps([1, 2]);
              setCurrentStep(3);
            }
          } catch (err) {
            console.warn('Could not verify store:', err.message);
            // Store might not exist - clear localStorage and storeId
            if (err.message?.includes('404') || err.message?.includes('not found')) {
              localStorage.removeItem('selectedStoreId');
              localStorage.removeItem('selectedStoreName');
              setStoreId(null);
              setError('The store no longer exists. Please create a new store.');
              setCurrentStep(1);
            } else {
              setError('Could not verify store status. Please try again.');
            }
          }
        };
        verifyStoreAndStatus();
      } else {
        // No store in localStorage - redirect to step 1 to check for incomplete stores
        setCurrentStep(1);
      }
    }
  }, [searchParams]);

  // Check if user has existing stores and auto-resume incomplete ones
  useEffect(() => {
    // Skip only if resume mode with storeId (that useEffect handles it)
    const resume = searchParams.get('resume');
    const resumeStoreId = searchParams.get('storeId');

    // Only skip if we have a specific storeId to resume
    if (resume === 'true' && resumeStoreId) {
      setCheckingExistingStores(false);
      return;
    }

    const checkExistingStores = async () => {
      try {
        const stores = await StoreEntity.findAll();

        if (Array.isArray(stores) && stores.length > 0) {
          // Check for incomplete stores (pending_database, provisioning, or provisioned awaiting profile)
          const incompleteStore = stores.find(s =>
            s.status === 'pending_database' || s.status === 'provisioning' || s.status === 'provisioned'
          );

          if (incompleteStore) {
            // Check provisioning status to determine what step to resume
            try {
              const response = await apiClient.get(`/stores/${incompleteStore.id}/provisioning-status`);
              const data = Array.isArray(response) ? response[0] :
                           Array.isArray(response.data) ? response.data[0] :
                           response.data || response;

              const status = data?.provisioningStatus;

              // If provisioning_status is completed, redirect to dashboard
              if (status === 'completed') {
                window.location.href = '/admin/dashboard';
                return;
              }
              // If provisioning has started but not complete, go to step 4 (provisioning)
              else if (status && status !== 'pending' && status !== 'failed') {
                setStoreId(incompleteStore.id);
                setStoreData({
                  name: data.name || incompleteStore.name || 'My Store',
                  slug: data.slug || incompleteStore.slug || 'my-store'
                });
                // Use profile data from provisioning-status API response
                setProfileData({
                  country: data.country || '',
                  phone: data.phone || '',
                  storeEmail: data.storeEmail || ''
                });
                // Restore demo data preference from provisioning progress
                if (data.provisioningProgress?.demo_requested) {
                  setProvisionDemoData(true);
                }
                if (data.themePreset) {
                  setSelectedThemePreset(data.themePreset);
                }
                setCompletedSteps([1, 2, 3]);
                setCurrentStep(4);
                setIsReprovision(true);
                setOauthCompleted(true);
                setProvisioningStatus(status);
                // Provisioning is actively running - show progress UI and start polling
                setNeedsServiceKey(false);
                setSuccess('Your store is being set up. You can close this page and we\'ll email you when it\'s ready.');
                // Start polling for status updates
                if (!provisioningPollRef.current) {
                  provisioningPollRef.current = setInterval(() => {
                    pollProvisioningStatus(incompleteStore.id);
                  }, 2000);
                }
              } else {
                // Still pending or failed - stay on step 1 but use existing store ID for upsert
                setStoreId(incompleteStore.id);
                setStoreData({
                  name: data.name || incompleteStore.name || '',
                  slug: data.slug || incompleteStore.slug || ''
                });
                // Use profile data from provisioning-status API response
                setProfileData({
                  country: data.country || '',
                  phone: data.phone || '',
                  storeEmail: data.storeEmail || ''
                });
                if (data.themePreset) {
                  setSelectedThemePreset(data.themePreset);
                }
                // Show info message about resuming
                setSuccess(`Resuming setup for "${data.name || incompleteStore.name || incompleteStore.slug}". You can update the details below.`);
              }
            } catch (err) {
              // Can't check status - stay on step 1 with existing store ID
              setStoreId(incompleteStore.id);
              setStoreData({
                name: incompleteStore.name || '',
                slug: incompleteStore.slug || ''
              });
              setProfileData({
                country: incompleteStore.country || '',
                phone: incompleteStore.phone || '',
                storeEmail: incompleteStore.storeEmail || ''
              });
              setSuccess(`Resuming setup for "${incompleteStore.name || incompleteStore.slug}". You can update the details below.`);
            }
          }
        }
      } catch (err) {
        console.error('Error checking existing stores:', err);
      } finally {
        setCheckingExistingStores(false);
      }
    };
    checkExistingStores();
  }, [searchParams]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (provisioningPollRef.current) {
        clearInterval(provisioningPollRef.current);
      }
    };
  }, []);

  // Show loading while checking auth
  if (!authChecked) {
    return <PageLoader size="lg" text="Checking authentication..." />;
  }

  // Show loading while checking for existing incomplete stores
  if (checkingExistingStores) {
    return <PageLoader size="lg" text="Checking for existing stores..." />;
  }

  // Check slug availability with debounce
  const checkSlugAvailability = async (slug) => {
    if (!slug || slug.length < 2) {
      setSlugStatus({ checking: false, available: null, message: '' });
      return;
    }

    setSlugStatus({ checking: true, available: null, message: '' });

    try {
      const response = await apiClient.get(`/stores/check-slug?slug=${encodeURIComponent(slug)}`);
      if (response.success) {
        setSlugStatus({
          checking: false,
          available: response.available,
          message: response.message
        });
      }
    } catch (err) {
      setSlugStatus({ checking: false, available: null, message: '' });
    }
  };

  const handleNameChange = (name) => {
    const newSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    setStoreData({ name, slug: newSlug });

    // Debounce slug check
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }
    slugCheckTimeoutRef.current = setTimeout(() => {
      checkSlugAvailability(newSlug);
    }, 500);
  };

  const handleSlugChange = (slug) => {
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    setStoreData({ ...storeData, slug: normalizedSlug });

    // Debounce slug check
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }
    slugCheckTimeoutRef.current = setTimeout(() => {
      checkSlugAvailability(normalizedSlug);
    }, 500);
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate country is required
    if (!profileData.country) {
      setError('Country is required');
      setLoading(false);
      return;
    }

    try {
      let response;

      if (storeId) {
        // Update existing store (resuming incomplete store)
        response = await apiClient.put(`/stores/${storeId}`, {
          name: storeData.name,
          slug: storeData.slug,
          country: profileData.country,
          phone: profileData.phone || null,
          store_email: profileData.storeEmail || null
        });

        if (response && response.success) {
          setCompletedSteps([1]);
          setCurrentStep(2);
          setSuccess('Store details saved');
        } else {
          setError(response?.error || response?.message || 'Failed to update store');
        }
      } else {
        // Create new store with profile data
        response = await apiClient.post('/stores', {
          name: storeData.name,
          country: profileData.country,
          phone: profileData.phone || null,
          store_email: profileData.storeEmail || null
        });

        if (response && response.success && response.data) {
          const newStoreData = response.data.store || response.data;
          setStoreId(newStoreData.id);
          setCompletedSteps([1]);
          setCurrentStep(2);
          setSuccess(response.message || 'Store created successfully');
        } else {
          setError(response?.error || response?.message || 'Failed to create store');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to create/update store');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save customization options and move to step 3
  const handleSaveCustomization = (e) => {
    e.preventDefault();
    setCompletedSteps([1, 2]);
    setCurrentStep(3);
    const demoText = provisionDemoData ? ' with demo data' : '';
    setSuccess(<>You have selected the <strong>{selectedThemePreset.toUpperCase()}</strong> theme{demoText}</>);
  };

  const handleConnectDatabase = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Step 1: Initiate OAuth flow
      const oauthResponse = await apiClient.post(`/supabase/connect?storeId=${storeId}`);

      if (!oauthResponse.success || !oauthResponse.authUrl) {
        throw new Error('Failed to get OAuth URL');
      }

      // Step 2: Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        oauthResponse.authUrl,
        'Supabase OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        throw new Error('Please allow popups for this site');
      }

      // Step 3: Listen for OAuth error messages from popup
      let oauthError = null;
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'supabase-oauth-error') {
          oauthError = event.data.error;
        }
      };
      window.addEventListener('message', messageHandler);

      // Step 4: Wait for popup to close, then verify OAuth via API
      const checkClosed = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkClosed);

          // Wait longer for any pending messages to arrive
          await new Promise(resolve => setTimeout(resolve, 500));

          window.removeEventListener('message', messageHandler);

          // Check sessionStorage as fallback if postMessage didn't work
          if (!oauthError) {
            try {
              const storedError = sessionStorage.getItem('supabase_oauth_error');
              if (storedError) {
                oauthError = storedError;
                sessionStorage.removeItem('supabase_oauth_error'); // Clean up
              }
            } catch (e) {
            }
          }

          // If we received an error message, show it immediately
          if (oauthError) {
            setError(oauthError);
            setLoading(false);
            return;
          }

          // Verify OAuth succeeded by checking database/memory state
          try {
            const statusResponse = await apiClient.get(`/supabase/oauth-status?storeId=${storeId}`);

            // Check if there's an error in the response
            if (statusResponse.error) {
              setError(statusResponse.error);
              setLoading(false);
              return;
            }

            if (statusResponse.success && statusResponse.connected) {
              setOauthCompleted(true);
              setNeedsServiceKey(true);
              setCompletedSteps([1, 2, 3]);
              setCurrentStep(4);
              setSuccess('Supabase connected! Please provide your Service Role Key to complete setup.');
              setLoading(false);
            } else {
              // Instead of generic message, suggest checking for duplicates
              setError('OAuth connection failed. Please try to connect with SupaBase again');
            }
          } catch (apiError) {
            setError(apiError.message || 'Failed to verify OAuth connection. Please try again.');
          }

          setLoading(false);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        if (!popup.closed) {
          popup.close();
          setError('OAuth timeout - please try again');
          setLoading(false);
        }
      }, 300000);

    } catch (err) {
      setError(err.message || 'Failed to connect database');
      setLoading(false);
    }
  };

  const handleProvisionDatabase = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setProvisioningStatus('pending');
    setProvisioningMessage('Starting provisioning...');

    if (!dbData.serviceRoleKey) {
      setError('Please provide your Supabase Service Role Key');
      setLoading(false);
      setProvisioningStatus(null);
      return;
    }

    try {
      // Start polling immediately to catch status updates
      provisioningPollRef.current = setInterval(() => {
        pollProvisioningStatus(storeId);
      }, 2000); // Poll every 2 seconds

      // Fire off the provisioning request - always use background mode for email notification
      apiClient.post(`/stores/${storeId}/connect-database`, {
        storeName: storeData.name,
        storeSlug: storeData.slug,
        useOAuth: true,
        autoProvision: true,
        serviceRoleKey: dbData.serviceRoleKey,
        themePreset: selectedThemePreset,
        provisionDemoData: provisionDemoData,
        backgroundMode: true // Always run in background with email notification
      }).then(provisionResponse => {
        // Check for success - API call completed
        if (provisionResponse.success) {
          // Background mode - the job was queued, user can close page
          if (provisionResponse.backgroundMode) {
            setBackgroundJobStarted(true);
            // Keep polling to update UI if user stays on page
            return;
          }

          // Fallback: synchronous mode completed (shouldn't happen with backgroundMode: true)
          clearInterval(provisioningPollRef.current);
          provisioningPollRef.current = null;
          setLoading(false);
          setProvisioningStatus('completed');
          setProvisioningMessage('Provisioning completed successfully');
          setCompletedSteps([1, 2, 3, 4]);
          setSuccess('🎉 Your store is ready! Redirecting to dashboard...');

          // Clear old store selection data
          localStorage.removeItem('selectedStoreId');
          localStorage.removeItem('selectedStoreName');
          localStorage.removeItem('selectedStoreSlug');

          // Redirect to dashboard after a short delay
          setTimeout(() => {
            window.location.href = '/admin/dashboard';
          }, 2000);
          return;
        }

        // If there's an error in the response, handle it
        if (provisionResponse.error) {
          clearInterval(provisioningPollRef.current);
          provisioningPollRef.current = null;
          setLoading(false);
          setError(provisionResponse.error);
          setProvisioningStatus(null);
          setProvisioningMessage('');
          setBackgroundJobStarted(false);
        }
      }).catch(err => {
        clearInterval(provisioningPollRef.current);
        provisioningPollRef.current = null;
        setLoading(false);
        setError(err.message || 'Failed to provision database');
        setProvisioningStatus(null);
        setProvisioningMessage('');
        setBackgroundJobStarted(false);
      });

      // Set a maximum timeout of 10 minutes
      setTimeout(() => {
        if (provisioningPollRef.current) {
          clearInterval(provisioningPollRef.current);
          provisioningPollRef.current = null;
          setLoading(false);
          setError('Provisioning timeout. The process may still be running. Please check your store status or try again.');
          setProvisioningStatus(null);
          setProvisioningMessage('');
        }
      }, 600000); // 10 minutes

    } catch (err) {
      clearInterval(provisioningPollRef.current);
      provisioningPollRef.current = null;
      setError(err.message || 'Failed to provision database');
      setLoading(false);
      setProvisioningStatus(null);
      setProvisioningMessage('');
      setBackgroundJobStarted(false);
    }
  };

  const progressPercent = (completedSteps.length / STEPS.length) * 100;
  const currentStepData = STEPS[currentStep - 1];
  const StepIcon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <img src="/logo_red.svg" alt="DainoStore" className="h-8" />
          <span className="text-xl font-bold text-gray-900">DainoStore</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-gray-600 hover:text-gray-900"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl flex flex-col items-center">
      <Card className="w-full shadow-2xl relative">
        {/* Cancel Button - always show for users who can go back to stores */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
          onClick={() => navigate('/admin/stores')}
          title="Cancel and return to stores"
        >
          <X className="w-5 h-5" />
        </Button>
        {/* Progress Bar */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-2 pr-8">
            <span className="text-sm font-medium text-gray-600">Step {currentStep} of {STEPS.length}</span>
            <span className="text-sm font-medium text-gray-600">{Math.round(progressPercent)}% Complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />

          {/* Step Indicators */}
          <div className="flex items-center justify-between mt-6 mb-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className={`flex items-center ${index < STEPS.length - 1 ? 'w-full' : ''}`}>
                <div className={`flex flex-col items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    completedSteps.includes(step.id)
                      ? 'bg-green-500 text-white'
                      : currentStep === step.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                    {completedSteps.includes(step.id) ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-xs mt-1 text-center hidden sm:block whitespace-nowrap">{step.title}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`h-0.5 w-full mx-2 ${
                    completedSteps.includes(step.id) ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <StepIcon className={`w-16 h-16 text-blue-600 ${currentStep === 4 && loading ? 'animate-spin' : ''}`} />
          </div>
          <CardTitle className="text-2xl font-bold">
            {currentStep === 4 && loading
              ? 'Provisioning Store'
              : isReprovision && currentStep === 4
                ? 'Reprovision Store'
                : currentStepData.title}
          </CardTitle>
          <CardDescription className="text-base">
            {currentStep === 4 && loading && provisioningMessage
              ? provisioningMessage
              : currentStep === 4 && loading
                ? 'Starting provisioning...'
                : isReprovision && currentStep === 4
                  ? `Provision database for "${storeData.name}"`
                  : currentStepData.description}
          </CardDescription>
          {currentStep === 3 && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button type="button" className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 mt-2">
                    Don't have a Supabase account yet?
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm bg-gray-900 text-white p-4">
                  <p className="font-semibold mb-2">Create a free Supabase account:</p>
                  <ol className="text-xs space-y-1 list-decimal list-inside">
                    <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline">supabase.com</a> and click "Start your project"</li>
                    <li>Sign up with GitHub, Google, or email</li>
                    <li>Click "New Project" and choose a name and password</li>
                    <li>Select a region close to your customers</li>
                    <li>Wait ~2 minutes for your project to be created</li>
                  </ol>
                  <p className="text-xs text-gray-400 mt-2">Free tier includes 500MB storage!</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!currentStepData.required && (
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full mt-2">
              Optional - Can be skipped
            </span>
          )}
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Create Store + Profile */}
          {currentStep === 1 && (
            <form onSubmit={handleCreateStore} className="space-y-6">
              <div>
                <Label htmlFor="storeName">Store Name *</Label>
                <Input
                  id="storeName"
                  placeholder="My Awesome Store"
                  value={storeData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  autoFocus
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="storeSlug">Store URL *</Label>
                <div className="relative">
                  <Input
                    id="storeSlug"
                    value={storeData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                    className={`mt-2 font-mono pr-10 ${
                      slugStatus.available === false ? 'border-red-500 focus:ring-red-500' :
                      slugStatus.available === true ? 'border-green-500 focus:ring-green-500' : ''
                    }`}
                  />
                  {slugStatus.checking && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-1 w-4 h-4 animate-spin text-gray-400" />
                  )}
                  {!slugStatus.checking && slugStatus.available === true && (
                    <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-1 w-4 h-4 text-green-500" />
                  )}
                  {!slugStatus.checking && slugStatus.available === false && (
                    <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-1 w-4 h-4 text-red-500" />
                  )}
                </div>
                <p className={`text-sm mt-1 ${slugStatus.available === false ? 'text-red-500' : 'text-gray-500'}`}>
                  {slugStatus.available === false
                    ? slugStatus.message
                    : `https://www.dainostore.com/public/${storeData.slug || 'your-store'}`}
                </p>
              </div>

              <div>
                <Label htmlFor="country">Country <span className="text-red-500">*</span></Label>
                <CountrySelect
                  id="country"
                  value={profileData.country}
                  onChange={(country) => setProfileData({ ...profileData, country })}
                  className="mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Required for tax and shipping configuration.
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number <span className="text-gray-400 text-sm">(optional)</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="storeEmail">Store Email <span className="text-gray-400 text-sm">(optional)</span></Label>
                <Input
                  id="storeEmail"
                  type="email"
                  placeholder="store@example.com"
                  value={profileData.storeEmail}
                  onChange={(e) => setProfileData({ ...profileData, storeEmail: e.target.value })}
                  className="mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Public contact email for your store. If empty, your account email will be used.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !storeData.name || !profileData.country || slugStatus.available === false || slugStatus.checking}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </form>
          )}

          {/* Step 2: Customize Store */}
          {currentStep === 2 && (
            <form onSubmit={handleSaveCustomization} className="space-y-6">
              {/* Theme Preset Selection */}
              <div>
                <Label className="mb-3 block font-bold">Choose Your Store Theme</Label>
                <p className="text-sm text-gray-500 mb-3">
                  Select a color theme for your store. You can customize it later.
                </p>
                <div className="overflow-hidden">
                  <ThemePresetSelector
                    value={selectedThemePreset}
                    onChange={setSelectedThemePreset}
                    variant="cards"
                  />
                </div>
              </div>

              {/* Demo Data Provisioning */}
              <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Checkbox
                  id="provisionDemoData"
                  checked={provisionDemoData}
                  onCheckedChange={setProvisionDemoData}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="provisionDemoData" className="font-medium cursor-pointer">
                    Include demo data
                  </Label>
                  <p className="text-sm text-gray-600 mt-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1 text-amber-600" />
                    Adds 2-3 minutes to setup
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Sample products, categories, and orders to help you explore.{' '}
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex items-center text-amber-700 hover:text-amber-800 underline underline-offset-2">
                            What's included?
                            <Info className="w-3 h-3 ml-1" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs bg-gray-900 text-white p-3">
                          <p className="font-semibold mb-2">Demo data includes:</p>
                          <ul className="text-xs space-y-1 list-disc list-inside">
                            <li>4 categories with subcategories</li>
                            <li>25+ demo products with images</li>
                            <li>Attribute sets and attributes</li>
                            <li>20 demo customers</li>
                            <li>50 demo orders</li>
                            <li>CMS pages and blocks</li>
                            <li>Product tabs and product labels</li>
                            <li>Tax configuration and coupons</li>
                            <li>Custom options rule</li>
                            <li>SEO templates</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button type="submit" className="flex-1">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Connect Database */}
          {currentStep === 3 && !oauthCompleted && (
            <form onSubmit={handleConnectDatabase} className="space-y-6">
              {/* Why you need a database */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2 flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  Why do I need a database?
                </h4>
                <p className="text-sm text-amber-800">
                  Your Supabase database is where all your store data lives - products, categories, customers, orders, and settings.
                  You own and control your data completely. We just help you set it up!
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Database className="w-10 h-10 text-green-600" />
                </div>

                {/* What happens when you click */}
                <div className="bg-white/80 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 mr-2 text-yellow-500" />
                    What happens when you click "Connect"?
                  </h4>
                  <ol className="text-sm text-gray-700 space-y-2 text-left max-w-md mx-auto">
                    <li className="flex items-start">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold">1</span>
                      <span>A <strong>popup window</strong> opens for Supabase login</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold">2</span>
                      <span>You <strong>select a project</strong> from your Supabase account</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold">3</span>
                      <span>You <strong>authorize access</strong> so we can create tables</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold">4</span>
                      <span>Popup closes and you're <strong>brought back here</strong> automatically</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold">5</span>
                      <span>Enter your <strong>Service Role Key</strong> to authorize database setup</span>
                    </li>
                    <li className="flex items-start">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center mr-2 flex-shrink-0 text-xs font-bold">6</span>
                      <span>Your <strong>database is provisioned</strong> and store is ready!</span>
                    </li>
                  </ol>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connect with Supabase
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Provision Store */}
          {currentStep === 4 && (
            <form onSubmit={handleProvisionDatabase} className="space-y-6">
              {/* Show progress when provisioning is active (either started now or resumed) */}
              {(loading && provisioningStatus) || (provisioningStatus && !needsServiceKey) ? (
                provisioningStatus === 'completed' ? (
                  /* Completion celebration UI */
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-8 text-center">
                    <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                      <CheckCircle2 className="w-14 h-14 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-800 mb-2">
                      Your Store is Ready!
                    </h2>
                    <p className="text-green-700 text-lg mb-4">
                      Congratulations! <strong>{storeData.name}</strong> has been successfully set up.
                    </p>
                    <div className="bg-white/80 rounded-lg p-4 mb-6 max-w-md mx-auto">
                      <h4 className="font-semibold text-gray-900 mb-3">What's been set up:</h4>
                      <ul className="text-sm text-gray-700 space-y-2 text-left">
                        <li className="flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 flex-shrink-0" />
                          <span>129 database tables created</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 flex-shrink-0" />
                          <span>Store configuration applied</span>
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 flex-shrink-0" />
                          <span><strong>{selectedThemePreset.toUpperCase()}</strong> theme installed</span>
                        </li>
                        {provisionDemoData && (
                          <li className="flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 flex-shrink-0" />
                            <span>Demo products and orders added</span>
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-center text-blue-800">
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        <span className="font-medium">Redirecting to your dashboard...</span>
                      </div>
                      <p className="text-blue-600 text-sm mt-1">
                        You'll be there in a moment!
                      </p>
                    </div>
                  </div>
                ) : (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Setting Up Your Store
                    </h3>
                    <div className="space-y-2">
                      <p className="text-gray-600 text-sm">
                        We're building your store right now. This usually takes 2-5 minutes.
                      </p>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-green-800 text-sm font-medium flex items-center justify-center">
                          <Mail className="w-4 h-4 mr-2" />
                          You can safely close this page
                        </p>
                        <p className="text-green-700 text-xs mt-1">
                          We'll email you when your store is ready!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* What's happening right now */}
                  <div className="bg-white/60 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-600 text-center">
                      <strong>What's happening:</strong> We're creating {provisioningStatus === 'tables_creating' || provisioningStatus === 'pending' ? 'database tables' : provisioningStatus === 'seed_running' ? 'store settings' : provisioningStatus === 'demo_running' ? 'demo content' : 'your store'} for <strong>{storeData.name}</strong>
                    </p>
                  </div>

                  {/* Progress Steps */}
                  <div className="space-y-3">
                    {[
                      { status: 'tables_creating', label: 'Creating database tables', description: '129 tables for products, orders, customers, etc.' },
                      { status: 'tables_completed', label: 'Tables created', description: 'Database structure ready' },
                      { status: 'seed_running', label: 'Adding store settings', description: 'Currency, tax rules, shipping options' },
                      { status: 'seed_completed', label: 'Settings configured', description: 'Store configuration complete' },
                      { status: 'demo_running', label: 'Adding demo content', description: 'Sample products, categories, and orders' },
                      { status: 'completed', label: 'Setup complete', description: 'Your store is ready!' },
                    ].map((step, index) => {
                      const stepOrder = ['pending', 'tables_creating', 'tables_completed', 'seed_running', 'seed_completed', 'demo_running', 'completed'];
                      const currentIndex = stepOrder.indexOf(provisioningStatus);
                      const stepIndex = stepOrder.indexOf(step.status);
                      const isComplete = stepIndex < currentIndex || provisioningStatus === 'completed';
                      const isActive = step.status === provisioningStatus || (step.status === 'tables_creating' && provisioningStatus === 'pending');
                      const isPending = stepIndex > currentIndex;

                      // Skip demo step if not provisioning demo data
                      if (step.status === 'demo_running' && !provisionDemoData) return null;

                      return (
                        <div
                          key={step.status}
                          className={`flex items-center p-3 rounded-lg transition-all ${
                            isActive ? 'bg-blue-100 border border-blue-300' :
                            isComplete ? 'bg-green-50 border border-green-200' :
                            'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${
                            isComplete ? 'bg-green-500 text-white' :
                            isActive ? 'bg-blue-500 text-white' :
                            'bg-gray-300 text-gray-500'
                          }`}>
                            {isComplete ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : isActive ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${
                              isComplete ? 'text-green-800' :
                              isActive ? 'text-blue-800' :
                              'text-gray-500'
                            }`}>
                              {step.label}
                            </p>
                            <p className={`text-xs ${
                              isComplete ? 'text-green-600' :
                              isActive ? 'text-blue-600' :
                              'text-gray-400'
                            }`}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )
              ) : (
                <>
                  {/* What is provisioning? */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-900 mb-2 flex items-center">
                      <Sparkles className="w-4 h-4 mr-2" />
                      What is "Provisioning"?
                    </h4>
                    <p className="text-sm text-purple-800 mb-3">
                      Provisioning means we're setting up everything your store needs to work:
                    </p>
                    <ul className="text-sm text-purple-700 space-y-1 ml-2">
                      <li className="flex items-start">
                        <CheckCircle2 className="w-4 h-4 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Database tables</strong> - for products, orders, customers, categories</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="w-4 h-4 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Store settings</strong> - currency, tax rules, shipping options</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="w-4 h-4 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Your theme</strong> - the {selectedThemePreset.toUpperCase()} theme you selected</span>
                      </li>
                      {provisionDemoData && (
                        <li className="flex items-start">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-purple-500 mt-0.5 flex-shrink-0" />
                          <span><strong>Demo content</strong> - sample products and orders to explore</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                      <Info className="w-4 h-4 mr-2" />
                      One more step - Service Role Key
                    </h4>
                    <p className="text-sm text-blue-800 mb-2">
                      To create tables in your database, we need your Supabase Service Role Key:
                    </p>
                    <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
                      <li>Go to your Supabase Dashboard → Project Settings → API Keys</li>
                      <li>Find the "service_role" key under "Legacy anon, service_role API keys"</li>
                      <li>Copy the service_role key (starts with "eyJh...")</li>
                      <li>Paste it in the field below</li>
                    </ol>
                  </div>

                  <div>
                    <Label htmlFor="serviceRoleKey">Supabase Service Role Key *</Label>
                    <Input
                      id="serviceRoleKey"
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={dbData.serviceRoleKey}
                      onChange={(e) => setDbData({ ...dbData, serviceRoleKey: e.target.value })}
                      required
                      autoFocus
                      className="mt-2 font-mono text-xs"
                    />
                  </div>

                  {/* Info about email notification */}
                  <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <Mail className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-green-800 font-medium">
                        Setup takes a few minutes. You can close this page after starting.
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        We'll email you when your store is ready!
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => { setCurrentStep(3); setOauthCompleted(false); setNeedsServiceKey(false); setError(''); }} disabled={loading}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading || !dbData.serviceRoleKey}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Provision Store
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}
        </CardContent>
      </Card>

        {/* Support Links */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="mb-2">Need help? We're here for you!</p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://discord.gg/vvAhfdaX"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Join our Discord
            </a>
            <span className="text-gray-400">|</span>
            <a
              href="https://www.calendly.com/dainostore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Schedule a Call
            </a>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
