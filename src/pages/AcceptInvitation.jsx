import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, UserPlus, Building2, Shield, AlertCircle, Eye, EyeOff, Users, Sparkles } from 'lucide-react';
import apiClient from '@/api/client';
import { toast } from 'sonner';

// Daino Logo Component
const DainoLogo = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="url(#gradient)" />
    <path d="M12 12h6c5.5 0 10 4.5 10 10s-4.5 10-10 10h-6V12z" fill="white" fillOpacity="0.9"/>
    <path d="M14 14h4c4.4 0 8 3.6 8 8s-3.6 8-8 8h-4V14z" fill="url(#gradient)"/>
    <defs>
      <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6"/>
        <stop offset="1" stopColor="#8B5CF6"/>
      </linearGradient>
    </defs>
  </svg>
);

const ROLE_COLORS = {
  admin: 'bg-blue-100 text-blue-800',
  editor: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800'
};

export default function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Form state for account creation/login
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    // Check if user is logged in (check token exists and user not marked as logged out)
    const authToken = localStorage.getItem('store_owner_auth_token');
    const isLoggedOut = localStorage.getItem('user_logged_out') === 'true';
    setIsLoggedIn(!!authToken && !isLoggedOut);

    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use direct fetch for public endpoint (no auth required)
      const apiUrl = import.meta.env.VITE_API_URL || 'https://backend.dainostore.com';
      const response = await fetch(`${apiUrl}/api/invitations/${token}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setInvitation(data.data);
      } else {
        setError(data.message || 'Invalid or expired invitation');
      }
    } catch (err) {
      console.error('Error fetching invitation:', err);
      if (err.message?.includes('expired')) {
        setError('This invitation has expired. Please ask for a new invitation.');
      } else if (err.message?.includes('not found')) {
        setError('This invitation was not found or has already been used.');
      } else {
        setError(err.message || 'Failed to load invitation details');
      }
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain a lowercase letter';
    if (!/\d/.test(pwd)) return 'Password must contain a number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return 'Password must contain a special character';
    return null;
  };

  const handleAccept = async (e) => {
    e?.preventDefault();
    setFormError('');

    // If logged in, just accept the invitation
    if (isLoggedIn) {
      try {
        setAccepting(true);
        const response = await apiClient.post(`store-teams/accept-invitation/${token}`);

        if (response.success) {
          setSuccess(true);
          toast.success('Invitation accepted! You are now part of the team.');

          // Redirect to the store dashboard after a short delay
          setTimeout(() => {
            navigate('/admin/dashboard');
          }, 2000);
        } else {
          throw new Error(response.message || 'Failed to accept invitation');
        }
      } catch (err) {
        console.error('Error accepting invitation:', err);

        // If session expired or invalid token, mark as logged out
        if (err.message?.includes('Session has been terminated') ||
            err.message?.includes('token') ||
            err.message?.includes('Unauthorized') ||
            err.message?.includes('Authentication')) {
          toast.error('Session expired. Please enter your password to continue.');
          localStorage.removeItem('store_owner_auth_token');
          setIsLoggedIn(false);
          return;
        }

        toast.error(err.message || 'Failed to accept invitation');
        setFormError(err.message);
      } finally {
        setAccepting(false);
      }
      return;
    }

    // Not logged in - need to create account or login
    if (!password) {
      setFormError('Please enter a password');
      return;
    }

    // For new users, validate password and check confirm
    if (!invitation?.userExists) {
      const pwdError = validatePassword(password);
      if (pwdError) {
        setFormError(pwdError);
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match');
        return;
      }
      if (!firstName.trim()) {
        setFormError('Please enter your first name');
        return;
      }
    }

    try {
      setAccepting(true);

      // Call the combined endpoint that handles signup/login + accept invitation
      const apiUrl = import.meta.env.VITE_API_URL || 'https://backend.dainostore.com';
      const response = await fetch(`${apiUrl}/api/invitations/${token}/accept-with-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store the auth token
        if (data.data?.token) {
          localStorage.removeItem('user_logged_out');
          localStorage.setItem('store_owner_auth_token', data.data.token);
          apiClient.setToken(data.data.token);

          // Store user data
          if (data.data.user) {
            localStorage.setItem('store_owner_user_data', JSON.stringify(data.data.user));
          }
        }

        setSuccess(true);
        toast.success('Welcome to the team!');

        // Redirect to the store dashboard after a short delay
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setFormError(err.message || 'Failed to accept invitation');
      toast.error(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>

        <Card className="w-full max-w-md relative bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DainoLogo className="w-12 h-12 mb-4" />
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-3" />
            <p className="text-gray-600">Loading invitation details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>

        <Card className="w-full max-w-md relative bg-white/95 backdrop-blur-sm shadow-2xl border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DainoLogo className="w-12 h-12 mb-6" />
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invitation</h2>
            <p className="text-gray-600 text-center mb-6">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Go to Homepage
            </Button>
            <p className="text-xs text-gray-400 mt-6">Powered by DainoStore</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>

        <Card className="w-full max-w-md relative bg-white/95 backdrop-blur-sm shadow-2xl border-0 overflow-hidden">
          {/* Success confetti effect */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500"></div>

          <CardContent className="flex flex-col items-center justify-center py-12">
            <DainoLogo className="w-12 h-12 mb-4" />
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the Team!</h2>
            <p className="text-gray-600 text-center mb-2">
              You've successfully joined <strong className="text-blue-600">{invitation?.store?.name}</strong>
            </p>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>

      {/* Floating elements for visual interest */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl"></div>

      <Card className="w-full max-w-lg relative bg-white/95 backdrop-blur-sm shadow-2xl border-0 overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
          {/* Daino Branding */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <DainoLogo className="w-10 h-10" />
            <div className="text-left">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Daino</h2>
              <p className="text-xs text-gray-500 -mt-0.5">E-commerce Platform</p>
            </div>
          </div>

          {/* Invitation Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Users className="w-10 h-10 text-blue-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Invited!</h1>
          <p className="text-gray-500">Join the team and start collaborating</p>
        </div>

        <CardContent className="p-8">
          {/* Store Info Card */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl mb-6 border border-blue-100">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
              <span className="text-2xl font-bold text-blue-600">
                {invitation?.store?.name?.charAt(0)?.toUpperCase() || 'S'}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">You're joining store</p>
              <h3 className="font-bold text-gray-900 text-lg">{invitation?.store?.name}</h3>
              {invitation?.store?.domain && (
                <p className="text-sm text-gray-500">{invitation.store.domain}</p>
              )}
            </div>
          </div>

          {/* Role & Inviter Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Role */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your Role</p>
              <Badge className={`${ROLE_COLORS[invitation?.role]} text-sm px-3 py-1.5`}>
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                {invitation?.role?.charAt(0).toUpperCase() + invitation?.role?.slice(1)}
              </Badge>
            </div>

            {/* Inviter */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Invited By</p>
              <p className="text-gray-900 font-medium text-sm">
                {invitation?.inviter?.first_name
                  ? `${invitation.inviter.first_name} ${invitation.inviter.last_name || ''}`
                  : invitation?.inviter?.email || 'Store Owner'}
              </p>
            </div>
          </div>

          {/* Message */}
          {invitation?.message && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 italic">"{invitation.message}"</p>
              </div>
            </div>
          )}

          {/* Expiration Warning */}
          {invitation?.expires_at && (
            <div className="mb-6 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                This invitation expires on {new Date(invitation.expires_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}

          {/* Account Creation/Login Form for non-logged-in users */}
          {!isLoggedIn && (
            <form onSubmit={handleAccept} className="mb-6 space-y-4">
              <div className="p-5 bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {invitation?.userExists ? 'Sign In to Accept' : 'Create Your Account'}
                    </p>
                    <p className="text-xs text-gray-500">{invitation?.email}</p>
                  </div>
                </div>

                {/* Name fields for new users */}
                {!invitation?.userExists && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <Label htmlFor="firstName" className="text-xs font-medium text-gray-600">First Name</Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-xs font-medium text-gray-600">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="mt-1 bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Password field */}
                <div className="mb-4">
                  <Label htmlFor="password" className="text-xs font-medium text-gray-600">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={invitation?.userExists ? 'Enter your password' : 'Create a secure password'}
                      className="pr-10 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password for new users */}
                {!invitation?.userExists && (
                  <div className="mb-4">
                    <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-600">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="mt-1 bg-white"
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      Min 8 characters with uppercase, lowercase, number, and special character
                    </p>
                  </div>
                )}

                {/* Form error */}
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {formError}
                    </p>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={handleDecline}
            >
              Decline
            </Button>
            <Button
              className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg shadow-blue-500/25"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isLoggedIn ? 'Accepting...' : (invitation?.userExists ? 'Signing in...' : 'Creating account...')}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              By accepting, you agree to Daino's Terms of Service and Privacy Policy
            </p>
            <p className="text-xs text-gray-300 mt-2">
              Powered by <span className="font-medium text-gray-400">Daino</span> — E-commerce made simple
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
