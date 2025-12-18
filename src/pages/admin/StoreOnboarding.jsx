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
import {
  Store, Database, CreditCard, DollarSign, User as UserIcon,
  CheckCircle2, Circle, Loader2, ExternalLink, ArrowRight, ArrowLeft, Sparkles, AlertCircle, X
} from 'lucide-react';
import apiClient from '@/utils/api';
import { User, Store as StoreEntity } from '@/api/entities';
import { ThemePresetSelector } from '@/components/admin/ThemePresetSelector';

const STEPS = [
  { id: 1, title: 'Create Store', description: 'Name your store', icon: Store, required: true },
  { id: 2, title: 'Connect Database', description: 'Connect Supabase', icon: Database, required: true },
  { id: 3, title: 'Complete Profile', description: 'Your information', icon: UserIcon, required: true },
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
  const [stripeData, setStripeData] = useState({ publishableKey: '', secretKey: '' });
  const [creditData, setCreditData] = useState({ amount: 100 });
  const [profileData, setProfileData] = useState({ phone: '', companyName: '' });
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, message: '' });
  const [hasExistingStores, setHasExistingStores] = useState(false);
  const slugCheckTimeoutRef = React.useRef(null);

  // Auth check - redirect to login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem('store_owner_auth_token');
    if (!token) {
      navigate('/admin/auth', { replace: true });
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  // Handle reprovision mode - start at step 2 with existing store
  useEffect(() => {
    const step = searchParams.get('step');
    const reprovision = searchParams.get('reprovision');

    if (step === '2' && reprovision === 'true') {
      const existingStoreId = localStorage.getItem('selectedStoreId');
      const existingStoreName = localStorage.getItem('selectedStoreName');

      if (existingStoreId) {
        setIsReprovision(true);
        setStoreId(existingStoreId);
        setStoreData({
          name: existingStoreName || 'My Store',
          slug: existingStoreName?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my-store'
        });
        setCompletedSteps([1]); // Mark step 1 as completed
        setCurrentStep(2);
      }
    }
  }, [searchParams]);

  // Check if user has existing stores (to show cancel button)
  useEffect(() => {
    const checkExistingStores = async () => {
      try {
        const stores = await StoreEntity.findAll();
        if (Array.isArray(stores) && stores.length > 0) {
          setHasExistingStores(true);
        }
      } catch (err) {
        // Ignore errors - just means we can't check for existing stores
      }
    };
    checkExistingStores();
  }, []);

  // Show loading while checking auth
  if (!authChecked) {
    return <PageLoader size="lg" text="Checking authentication..." />;
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

    try {
      // Theme preset is passed to connect-database later, not stored in master DB
      const response = await apiClient.post('/stores', {
        name: storeData.name
      });

      // Handle response from POST /api/stores
      if (response && response.success && response.data) {
        // Response format: { success: true, data: { store: {...} } }
        const storeData = response.data.store || response.data;
        setStoreId(storeData.id);
        setCompletedSteps([1]);
        setCurrentStep(2);
        setSuccess(response.message || 'Store created successfully');
      } else {
        setError(response?.error || response?.message || 'Failed to create store');
      }
    } catch (err) {
      setError(err.message || 'Failed to create store');
    } finally {
      setLoading(false);
    }
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
          console.log('🔍 After 500ms wait, oauthError is:', oauthError);

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
              setSuccess('Supabase connected! Please provide your Service Role Key to complete setup.');
              setLoading(false);
            } else {
              // Instead of generic message, suggest checking for duplicates
              setError('OAuth connection failed. This database may already be in use by another store.');
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

    if (!dbData.serviceRoleKey) {
      setError('Please provide your Supabase Service Role Key');
      setLoading(false);
      return;
    }

    try {
      const provisionResponse = await apiClient.post(`/stores/${storeId}/connect-database`, {
        storeName: storeData.name,
        storeSlug: storeData.slug,
        useOAuth: true,
        autoProvision: true,
        serviceRoleKey: dbData.serviceRoleKey,
        themePreset: selectedThemePreset  // Pass selected theme to tenant provisioning
      });

      if (provisionResponse.success) {
        setCompletedSteps([...completedSteps, 2]);

        // If reprovision mode, redirect to dashboard instead of step 3
        if (isReprovision) {
          setSuccess('Database reprovisioned successfully! Redirecting...');
          setTimeout(() => window.location.href = '/admin/dashboard', 1500);
        } else {
          setSuccess('Database connected and provisioned successfully!');
          setTimeout(() => setCurrentStep(3), 1500);
        }
      } else {
        setError(provisionResponse.error || 'Failed to provision database');
      }
    } catch (err) {
      setError(err.message || 'Failed to provision database');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Try to update profile (optional - user might not exist in tenant DB yet)
      try {
        await User.updateProfile({
          phone: profileData.phone,
          company_name: profileData.companyName
        });
      } catch (updateError) {
        // Continue anyway - user can update profile later from settings
      }

      // Clear old store selection data before redirecting
      localStorage.removeItem('selectedStoreId');
      localStorage.removeItem('selectedStoreName');
      localStorage.removeItem('selectedStoreSlug');

      setSuccess('🎉 Store created successfully! Redirecting to dashboard...');
      setTimeout(() => window.location.href = '/admin/dashboard', 2000);
    } catch (err) {
      // Fallback - always redirect to dashboard
      localStorage.removeItem('selectedStoreId');
      localStorage.removeItem('selectedStoreName');
      localStorage.removeItem('selectedStoreSlug');

      setSuccess('Store setup complete! Redirecting...');
      setTimeout(() => window.location.href = '/admin/dashboard', 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setError('');
    setCurrentStep(currentStep + 1);
  };

  const progressPercent = (completedSteps.length / STEPS.length) * 100;
  const currentStepData = STEPS[currentStep - 1];
  const StepIcon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl shadow-2xl relative">
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
            <StepIcon className="w-16 h-16 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isReprovision && currentStep === 2 ? 'Reprovision Database' : currentStepData.title}
          </CardTitle>
          <CardDescription className="text-base">
            {isReprovision && currentStep === 2
              ? `Reconnect Supabase for "${storeData.name}"`
              : currentStepData.description}
          </CardDescription>
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

          {/* Step 1: Create Store */}
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

              {/* Theme Preset Selection */}
              <div>
                <Label className="mb-3 block">Choose Your Store Theme</Label>
                <p className="text-sm text-gray-500 mb-3">
                  Select a color theme for your store. You can customize it later.
                </p>
                <ThemePresetSelector
                  value={selectedThemePreset}
                  onChange={setSelectedThemePreset}
                  variant="cards"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !storeData.name || slugStatus.available === false || slugStatus.checking}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </form>
          )}

          {/* Step 2: Connect Database */}
          {currentStep === 2 && !oauthCompleted && (
            <form onSubmit={handleConnectDatabase} className="space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Database className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Connect Your Supabase Database
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  We'll securely connect to your Supabase account using OAuth, create all necessary tables, and seed initial data automatically.
                </p>
                <div className="bg-white/80 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 mr-2 text-yellow-500" />
                    Your store is just 3 clicks away!
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-2 text-left max-w-md mx-auto">
                    <li className="flex items-start">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Connect instantly</strong> with secure OAuth authorization</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Choose your project</strong> from your Supabase account</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Sit back & relax</strong> while we build your entire database</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} disabled={loading}>
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

          {/* Step 2b: Enter Connection String (after OAuth) */}
          {currentStep === 2 && oauthCompleted && needsServiceKey && (
            <form onSubmit={handleProvisionDatabase} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  One more step!
                </h4>
                <p className="text-sm text-blue-800 mb-2">
                  To complete the setup, we need your Supabase Service Role Key.
                </p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
                  <li>Go to your Supabase Dashboard → Settings → API</li>
                  <li>Find the "service_role" key under "Project API keys"</li>
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

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => { setOauthCompleted(false); setNeedsServiceKey(false); setError(''); }} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading || !dbData.serviceRoleKey}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Provisioning Database...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Provision Database
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}


          {/* Step 3: Complete Profile */}
          {currentStep === 3 && (
            <form onSubmit={handleCompleteProfile} className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">
                  Complete your profile information to personalize your experience. All fields are optional.
                </p>
              </div>

              <div>
                <Label htmlFor="companyName">Company / Business Name <span className="text-gray-400 text-sm">(optional)</span></Label>
                <Input
                  id="companyName"
                  placeholder="Acme Inc."
                  value={profileData.companyName}
                  onChange={(e) => setProfileData({ ...profileData, companyName: e.target.value })}
                  className="mt-2"
                />
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

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <>Complete Setup <Sparkles className="w-4 h-4 ml-2" /></>}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
