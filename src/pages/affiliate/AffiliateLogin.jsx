import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import apiClient from "@/api/client";
import { Loader2, Link2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function AffiliateLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login'); // login, forgot, reset, setup
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('affiliateToken');
    if (token) {
      navigate('/affiliate/dashboard');
      return;
    }

    // Check for setup or reset token
    const setupToken = searchParams.get('setup');
    const resetToken = searchParams.get('token');
    if (setupToken) {
      setMode('setup');
      setFormData(prev => ({ ...prev, token: setupToken }));
    } else if (resetToken) {
      setMode('reset');
      setFormData(prev => ({ ...prev, token: resetToken }));
    }
  }, [searchParams, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post('/affiliates/auth/login', {
        email: formData.email,
        password: formData.password
      });

      if (response?.success) {
        localStorage.setItem('affiliateToken', response.data.token);
        toast({ title: "Welcome back!" });
        navigate('/affiliate/dashboard');
      } else {
        throw new Error(response?.error || 'Login failed');
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post('/affiliates/auth/forgot-password', {
        email: formData.email
      });

      if (response?.success) {
        toast({ title: "Reset link sent", description: "Check your email for the reset link." });
        setMode('login');
      } else {
        throw new Error(response?.error || 'Failed to send reset link');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'setup' ? '/affiliates/auth/setup-password' : '/affiliates/auth/reset-password';
      const response = await apiClient.post(endpoint, {
        token: formData.token,
        password: formData.password
      });

      if (response?.success) {
        toast({ title: "Password set successfully!", description: "You can now log in." });
        setMode('login');
        setFormData({ email: "", password: "", confirmPassword: "" });
      } else {
        throw new Error(response?.error || 'Failed to set password');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4">
            <Link2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Affiliate Portal</h1>
          <p className="text-gray-600">
            {mode === 'login' && "Sign in to manage your referrals"}
            {mode === 'forgot' && "Reset your password"}
            {mode === 'setup' && "Set up your password"}
            {mode === 'reset' && "Create a new password"}
          </p>
        </div>

        <Card className="p-6">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => setMode('forgot')}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <button
                type="button"
                className="w-full text-sm text-gray-600 hover:text-gray-900"
                onClick={() => setMode('login')}
              >
                Back to login
              </button>
            </form>
          )}

          {(mode === 'setup' || mode === 'reset') && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm your password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Set Password"
                )}
              </Button>
            </form>
          )}
        </Card>

        {/* Apply link */}
        <div className="text-center mt-6">
          <p className="text-gray-600">
            Not an affiliate yet?{" "}
            <Link to="/affiliate/apply" className="text-primary font-medium hover:underline">
              Apply now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
