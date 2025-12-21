import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const apiUrl = import.meta.env.DEV
        ? '/api/auth/store-owner/forgot-password'
        : `${baseUrl}/api/auth/store-owner/forgot-password`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md mx-auto w-full">
          <Card className="material-elevation-2 border-0">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Check Your Email
              </h2>
              <p className="text-gray-600 mb-6">
                If an account exists with <span className="font-medium">{email}</span>,
                you will receive a password reset link shortly.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                The link will expire in 1 hour.
              </p>
              <Link
                to="/admin/auth"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md mx-auto w-full">
        <Card className="material-elevation-2 border-0">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-blue-100 mb-4">
              <Mail className="h-7 w-7 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Forgot Password?
            </CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            <div className="text-center">
              <Link
                to="/admin/auth"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
