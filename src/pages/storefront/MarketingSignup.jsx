import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowRight, Sparkles, CheckCircle2, Eye, EyeOff,
  Zap, Shield, Globe, Loader2
} from 'lucide-react';
import apiClient from '@/utils/api';
import { User } from '@/api/entities';

// Google logo SVG component
const GoogleLogo = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function MarketingSignup() {
  const navigate = useNavigate();

  // Form state - same fields as regular registration
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('store_owner_auth_token');
    if (token) {
      navigate('/admin/onboarding', { replace: true });
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setError('');

    // Build the Google OAuth URL with redirect to onboarding
    const googleAuthUrl = `${apiClient.baseURL}/api/auth/google?redirect=/admin/onboarding`;

    // Add a timeout to check if redirect fails
    const redirectTimeout = setTimeout(() => {
      setError('Failed to connect to Google. Please try again.');
      setGoogleLoading(false);
    }, 5000);

    // Clear timeout if page unloads (successful redirect)
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

    // Validate password
    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const registerData = {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: 'store_owner'
      };

      const response = await User.register(registerData);

      if (response.success) {
        // Store the token
        if (response.data?.token) {
          localStorage.setItem('store_owner_auth_token', response.data.token);
        }
        // Navigate to onboarding to create their store
        navigate('/admin/onboarding');
      } else {
        setError(response.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      if (err.response?.data?.errors) {
        const validationErrors = err.response.data.errors;
        const errorMessages = validationErrors.map(e => e.msg || e.message).join('. ');
        setError(errorMessages);
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Zap, text: 'Launch in minutes, not months' },
    { icon: Shield, text: 'Enterprise-grade security' },
    { icon: Globe, text: 'Sell globally, manage locally' },
    { icon: Sparkles, text: 'AI-powered customization' }
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
            Start Building Your
            <br />
            <span className="text-indigo-400">Dream Store</span> Today
          </h1>

          <p className="text-xl text-white/70 mb-10 max-w-md">
            Join thousands of entrepreneurs who've transformed their ideas into thriving online businesses.
          </p>

          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                className="flex items-center gap-3 text-white/80"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <benefit.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="font-medium">{benefit.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-6 text-white/60 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Free tier available</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right side - Registration form */}
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
                Create Your Account
              </h2>
              <p className="text-slate-600">
                Start your free trial today
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-slate-700 font-medium">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    className="mt-1.5"
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-slate-700 font-medium">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    className="mt-1.5"
                    placeholder="Doe"
                  />
                </div>
              </div>

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
                    placeholder="Create a strong password"
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
                <p className="mt-1.5 text-xs text-slate-500">
                  Min 8 chars with uppercase, lowercase, number & special character
                </p>
              </div>

              {/* Confirm Password field */}
              <div>
                <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">
                  Confirm Password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    className="pr-10"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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
                    Start Free Trial
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
                  Sign up with Google
                </>
              )}
            </Button>

            {/* Login link */}
            <p className="mt-6 text-center text-slate-600">
              Already have an account?{' '}
              <Link
                to="/admin/auth"
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Sign in
              </Link>
            </p>

            {/* Terms */}
            <p className="mt-6 text-center text-xs text-slate-500">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-indigo-600 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
