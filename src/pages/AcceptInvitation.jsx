import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, UserPlus, Shield, AlertCircle, Eye, EyeOff, Users, Sparkles } from 'lucide-react';
import apiClient from '@/api/client';
import FlashMessage from '@/components/storefront/FlashMessage';

const ROLE_COLORS = {
  admin: 'bg-blue-100 text-blue-800',
  editor: 'bg-green-100 text-green-800',
  viewer: 'bg-slate-100 text-slate-800'
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [flashMessage, setFlashMessage] = useState(null);
  const [loggedInUserEmail, setLoggedInUserEmail] = useState(null);

  useEffect(() => {
    const authToken = localStorage.getItem('store_owner_auth_token');
    const isLoggedOut = localStorage.getItem('user_logged_out') === 'true';
    const loggedIn = !!authToken && !isLoggedOut;
    setIsLoggedIn(loggedIn);

    if (loggedIn) {
      try {
        const userData = JSON.parse(localStorage.getItem('store_owner_user_data') || '{}');
        setLoggedInUserEmail(userData.email || null);
      } catch (e) {
        setLoggedInUserEmail(null);
      }
    }

    if (token) fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      setError(null);
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
      setError(err.message?.includes('expired')
        ? 'This invitation has expired. Please ask for a new invitation.'
        : err.message?.includes('not found')
        ? 'This invitation was not found or has already been used.'
        : err.message || 'Failed to load invitation details');
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

  const hasEmailMismatch = isLoggedIn && loggedInUserEmail && invitation?.email &&
    loggedInUserEmail.toLowerCase() !== invitation.email.toLowerCase();

  const handleLogout = () => {
    localStorage.removeItem('store_owner_auth_token');
    localStorage.removeItem('store_owner_user_data');
    localStorage.setItem('user_logged_out', 'true');
    setIsLoggedIn(false);
    setLoggedInUserEmail(null);
    setFlashMessage({ type: 'info', message: 'Logged out. Please sign in with the correct account.' });
  };

  const handleAccept = async (e) => {
    e?.preventDefault();
    setFormError('');

    if (isLoggedIn) {
      try {
        setAccepting(true);
        const response = await apiClient.post(`store-teams/accept-invitation/${token}`);

        if (response.success) {
          setSuccess(true);
          setFlashMessage({ type: 'success', message: 'Invitation accepted! You are now part of the team.' });
          setTimeout(() => navigate('/admin/dashboard'), 2000);
        } else {
          throw new Error(response.message || 'Failed to accept invitation');
        }
      } catch (err) {
        console.error('Error accepting invitation:', err);
        if (err.message?.includes('Session has been terminated') ||
            err.message?.includes('token') ||
            err.message?.includes('Unauthorized') ||
            err.message?.includes('Authentication')) {
          setFlashMessage({ type: 'error', message: 'Session expired. Please enter your password to continue.' });
          localStorage.removeItem('store_owner_auth_token');
          setIsLoggedIn(false);
          return;
        }
        setFlashMessage({ type: 'error', message: err.message || 'Failed to accept invitation' });
        setFormError(err.message);
      } finally {
        setAccepting(false);
      }
      return;
    }

    if (!password) {
      setFormError('Please enter a password');
      return;
    }

    if (!invitation?.userExists) {
      const pwdError = validatePassword(password);
      if (pwdError) { setFormError(pwdError); return; }
      if (password !== confirmPassword) { setFormError('Passwords do not match'); return; }
      if (!firstName.trim()) { setFormError('Please enter your first name'); return; }
    }

    try {
      setAccepting(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'https://backend.dainostore.com';
      const response = await fetch(`${apiUrl}/api/invitations/${token}/accept-with-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, firstName: firstName.trim(), lastName: lastName.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.data?.token) {
          localStorage.removeItem('user_logged_out');
          localStorage.setItem('store_owner_auth_token', data.data.token);
          apiClient.setToken(data.data.token);
          if (data.data.user) localStorage.setItem('store_owner_user_data', JSON.stringify(data.data.user));
        }
        setSuccess(true);
        setFlashMessage({ type: 'success', message: 'Welcome to the team!' });
        setTimeout(() => navigate('/admin/dashboard'), 2000);
      } else {
        throw new Error(data.message || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setFormError(err.message || 'Failed to accept invitation');
      setFlashMessage({ type: 'error', message: err.message || 'Failed to accept invitation' });
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading invitation details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Invitation</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/')} variant="outline">Go to Homepage</Button>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Welcome to the Team!</h2>
          <p className="text-slate-600 mb-2">
            You've joined <strong className="text-indigo-600">{invitation?.store?.name}</strong>
          </p>
          <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            You're Invited by {invitation?.inviter?.first_name || 'the store owner'}!
          </h1>
          <p className="text-slate-600">Join the team and start collaborating</p>
        </div>

        {/* Store info */}
        <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl mb-5">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-xl font-bold text-indigo-600">
              {invitation?.store?.name?.charAt(0)?.toUpperCase() || 'S'}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Joining store</p>
            <h3 className="font-bold text-slate-900">{invitation?.store?.name}</h3>
            {invitation?.store?.domain && <p className="text-sm text-slate-500">{invitation.store.domain}</p>}
          </div>
        </div>

        {/* Role & Inviter */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 uppercase mb-1">Your Role</p>
            <Badge className={`${ROLE_COLORS[invitation?.role]} text-sm`}>
              <Shield className="w-3 h-3 mr-1" />
              {invitation?.role?.charAt(0).toUpperCase() + invitation?.role?.slice(1)}
            </Badge>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 uppercase mb-1">Invited By</p>
            <p className="text-slate-900 font-medium text-sm truncate">
              {invitation?.inviter?.first_name
                ? `${invitation.inviter.first_name} ${invitation.inviter.last_name || ''}`
                : invitation?.inviter?.email || 'Store Owner'}
            </p>
          </div>
        </div>

        {/* Message */}
        {invitation?.message && (
          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700 italic">"{invitation.message}"</p>
          </div>
        )}

        {/* Expiration */}
        {invitation?.expires_at && (
          <div className="mb-5 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Expires {new Date(invitation.expires_at).toLocaleDateString()}</span>
          </div>
        )}

        {/* Email mismatch warning */}
        {hasEmailMismatch && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-800 mb-1">Wrong Account</p>
            <p className="text-sm text-red-700 mb-3">
              Invitation is for <strong>{invitation.email}</strong>, but you're logged in as <strong>{loggedInUserEmail}</strong>.
            </p>
            <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100" onClick={handleLogout}>
              Log out and use correct account
            </Button>
          </div>
        )}

        {/* Form for non-logged-in users */}
        {!isLoggedIn && (
          <form onSubmit={handleAccept} className="mb-5 space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {invitation?.userExists ? 'Sign In to Accept' : 'Create Your Account'}
                  </p>
                  <p className="text-xs text-slate-500">{invitation?.email}</p>
                </div>
              </div>

              {!invitation?.userExists && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <Label htmlFor="firstName" className="text-slate-700 font-medium">First Name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-slate-700 font-medium">Last Name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="mt-1" />
                  </div>
                </div>
              )}

              <div className="mb-4">
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={invitation?.userExists ? 'Enter your password' : 'Create a strong password'}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!invitation?.userExists && (
                <div>
                  <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" className="mt-1" />
                  <p className="text-xs text-slate-500 mt-1">Min 8 chars with uppercase, lowercase, number & special character</p>
                </div>
              )}

              {formError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {formError}
                  </p>
                </div>
              )}
            </div>
          </form>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 py-5" onClick={() => navigate('/')}>
            Decline
          </Button>
          <Button
            className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-700 font-semibold"
            onClick={handleAccept}
            disabled={accepting || hasEmailMismatch}
          >
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isLoggedIn ? 'Accepting...' : (invitation?.userExists ? 'Signing in...' : 'Creating...')}
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
        <p className="mt-6 text-center text-xs text-slate-500">
          By accepting, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
