import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowRight, Eye, EyeOff, Loader2,
  Shield, Sparkles, LineChart, Palette, Globe,
  CheckCircle2
} from 'lucide-react';
import apiClient from '@/utils/api';
import { Auth as AuthService, User } from '@/api/entities';
import { setRoleBasedAuthData } from '@/utils/auth';
import { createAdminUrl } from '@/utils/urlUtils';
import { WHATS_NEW } from '@/constants/MarketingContent';

// Google logo SVG component
const GoogleLogo = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function MarketingLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Handle OAuth callback and check if already logged in
  useEffect(() => {
    // CRITICAL: Clear logout flag when on auth page to allow fresh login
    // This prevents the "Session has been terminated" error loop
    localStorage.removeItem('user_logged_out');
    apiClient.isLoggedOut = false;

    // Check for OAuth callback params
    const oauthToken = searchParams.get('token');
    const oauth = searchParams.get('oauth');
    const redirectParam = searchParams.get('redirect');

    if (oauthToken && oauth === 'success') {
      // Handle Google OAuth callback
      handleOAuthCallback(oauthToken, redirectParam);
      return;
    }

    // Check if already logged in
    const existingToken = localStorage.getItem('store_owner_auth_token');
    if (existingToken) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    // Check for error params
    const errorParam = searchParams.get('error');
    if (errorParam === 'no_active_store') {
      setError('No active store found. Please contact support or create a new store.');
    } else if (errorParam) {
      setError('Authentication failed. Please try again.');
    }
  }, [navigate, searchParams]);

  // Handle OAuth callback (Google login)
  const handleOAuthCallback = async (token, redirectUrl) => {
    setLoading(true);
    setError('');

    try {
      // Set the token
      localStorage.setItem('store_owner_auth_token', token);
      apiClient.setToken(token);

      // Fetch user data
      const user = await User.me();

      if (!user || !user.id) {
        throw new Error('Failed to get user data');
      }

      // Save user data to localStorage
      setRoleBasedAuthData(user, token);

      // Fetch stores and redirect
      try {
        const dropdownResponse = await apiClient.get('/stores/dropdown');
        const stores = dropdownResponse.data || dropdownResponse;

        if (stores && stores.length > 0) {
          const selectedStore = stores.find(s => s.is_active && s.status !== 'pending_database') || stores[0];

          if (selectedStore) {
            localStorage.setItem('selectedStoreId', selectedStore.id);
            localStorage.setItem('selectedStoreSlug', selectedStore.slug || selectedStore.code || '');
            localStorage.setItem('selectedStoreName', selectedStore.name);
          }

          // Redirect to requested URL or dashboard
          if (redirectUrl) {
            window.location.href = decodeURIComponent(redirectUrl);
          } else {
            window.location.href = createAdminUrl("DASHBOARD");
          }
        } else {
          // No stores - redirect to onboarding
          if (redirectUrl) {
            window.location.href = decodeURIComponent(redirectUrl);
          } else {
            navigate('/admin/onboarding', { replace: true });
          }
        }
      } catch (storeError) {
        console.error('Error fetching stores:', storeError);
        // Still logged in, just go to onboarding
        navigate('/admin/onboarding', { replace: true });
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
      // Clear invalid token
      localStorage.removeItem('store_owner_auth_token');
      apiClient.setToken(null);
      setError('Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setError('');

    const googleAuthUrl = `${apiClient.baseURL}/api/auth/google`;

    const redirectTimeout = setTimeout(() => {
      setError('Failed to connect to Google. Please try again.');
      setGoogleLoading(false);
    }, 5000);

    window.addEventListener('beforeunload', () => {
      clearTimeout(redirectTimeout);
    });

    try {
      window.location.href = googleAuthUrl;
    } catch (err) {
      setError('Failed to redirect to Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await AuthService.login(
        formData.email,
        formData.password,
        formData.rememberMe,
        'store_owner'
      );

      let actualResponse = response;
      if (Array.isArray(response)) {
        actualResponse = response[0];
      }

      const isSuccess = actualResponse?.success ||
                       actualResponse?.status === 'success' ||
                       actualResponse?.token;

      if (isSuccess) {
        const token = actualResponse.data?.token || actualResponse.token;

        if (token) {
          localStorage.removeItem('user_logged_out');
          apiClient.isLoggedOut = false;
          localStorage.setItem('store_owner_auth_token', token);
          apiClient.setToken(token);

          const userData = actualResponse.data?.user || actualResponse.user || actualResponse;
          if (userData && userData.id) {
            setRoleBasedAuthData(userData, token);
          }

          // Check for verification or onboarding needs
          const requiresVerification = actualResponse.data?.requiresVerification;
          const userEmail = actualResponse.data?.user?.email || formData.email;

          if (requiresVerification) {
            navigate(`/admin/verify-email?email=${encodeURIComponent(userEmail)}`);
            return;
          }

          const requiresOnboarding = actualResponse.data?.requiresOnboarding;
          if (requiresOnboarding) {
            window.location.href = '/admin/onboarding';
            return;
          }

          // Navigate to dashboard - always fetch stores, don't rely solely on JWT store_id
          setTimeout(async () => {
            try {
              const storeId = actualResponse.data?.user?.store_id;
              const dropdownResponse = await apiClient.get('/stores/dropdown');
              const stores = dropdownResponse.data || dropdownResponse;

              if (stores && stores.length > 0) {
                // Try to find the store from JWT first (if storeId exists)
                let selectedStore = storeId ? stores.find(s => s.id === storeId) : null;

                if (selectedStore && (!selectedStore.is_active || selectedStore.status === 'pending_database')) {
                  selectedStore = null;
                }

                if (!selectedStore) {
                  selectedStore = stores.find(s => s.is_active && s.status !== 'pending_database') || stores.find(s => s.is_active) || stores[0];
                }

                if (selectedStore) {
                  localStorage.setItem('selectedStoreId', selectedStore.id);
                  localStorage.setItem('selectedStoreSlug', selectedStore.slug || selectedStore.code || '');
                  localStorage.setItem('selectedStoreName', selectedStore.name);

                  await new Promise(resolve => setTimeout(resolve, 50));

                  const redirectUrl = searchParams.get('redirect');
                  if (redirectUrl) {
                    window.location.href = decodeURIComponent(redirectUrl);
                  } else {
                    window.location.href = createAdminUrl("DASHBOARD");
                  }
                } else {
                  // All stores are inactive/pending
                  navigate('/admin/onboarding');
                }
              } else {
                // No stores at all - go to onboarding
                const redirectUrl = searchParams.get('redirect');
                if (redirectUrl) {
                  window.location.href = decodeURIComponent(redirectUrl);
                } else {
                  navigate('/admin/onboarding');
                }
              }
            } catch (error) {
              console.error('Error fetching stores:', error);
              navigate('/admin/onboarding');
            }
          }, 100);
        }
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Sparkles, text: 'AI-Powered Store Builder' },
    { icon: Palette, text: 'Visual Theme Editor' },
    { icon: LineChart, text: 'Real-Time Analytics' },
    { icon: Globe, text: 'Multi-Store Management' }
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex">
      {/* Left side - Marketing content */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2" />

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <Link to="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-8 transition-colors">
            <img src="/logo_red.svg" alt="DainoStore" className="h-12" />
            <span className="font-bold text-xl">DainoStore</span>
          </Link>

          <h1 className="text-4xl xl:text-5xl font-black text-white mb-6 leading-tight">
            Welcome Back
          </h1>

          <p className="text-xl text-white/70 mb-10 max-w-md">
            Continue building your online store with powerful tools and best practices.
          </p>

          <div className="space-y-4 mb-10">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                className="flex items-center gap-3 text-white/80"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="font-medium">{feature.text}</span>
              </motion.div>
            ))}
          </div>

          {/* What's New Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-white/90">What's New</span>
            </div>
            <ul className="space-y-2">
              {WHATS_NEW.map((update, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-white/70">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{update}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Trust badges */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-6 text-white/60 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>256-bit SSL encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>99.9% uptime</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <img src="/logo_red.svg" alt="DainoStore" className="h-12" />
              <span className="font-bold text-xl text-slate-900">DainoStore</span>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Sign In to Your Account
              </h2>
              <p className="text-slate-600">
                Access your store dashboard
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div>
                <Label htmlFor="email" className="text-slate-700 font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  className="mt-1.5"
                  placeholder="john@example.com"
                />
              </div>

              {/* Password field */}
              <div>
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  Password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    className="pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={formData.rememberMe}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, rememberMe: checked }))
                    }
                    disabled={loading}
                  />
                  <Label htmlFor="rememberMe" className="text-sm font-normal text-slate-600 cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <Link
                  to="/admin/forgot-password"
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg font-semibold rounded-xl transition-all group"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-slate-500">Or continue with</span>
              </div>
            </div>

            {/* Google login button */}
            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              variant="outline"
              className="w-full py-5 text-base font-medium border-slate-300 hover:bg-slate-50"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <GoogleLogo />
                  Sign in with Google
                </>
              )}
            </Button>

            {/* Sign up link */}
            <p className="mt-6 text-center text-slate-600">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Create one free
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
