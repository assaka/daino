import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { SaveButton } from "@/components/ui/save-button";
import { useTranslation } from "@/contexts/TranslationContext";

// Helper function to replace placeholders with React components
const replacePlaceholders = (text, replacements) => {
  const placeholderRegex = /\{(\w+)\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = placeholderRegex.exec(text)) !== null) {
    // Add text before placeholder
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add replacement component
    const placeholderName = match[1];
    if (replacements[placeholderName]) {
      parts.push(replacements[placeholderName]);
    } else {
      parts.push(match[0]); // Keep original if no replacement
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.map((part, index) =>
    typeof part === 'string' ? <span key={index}>{part}</span> : React.cloneElement(part, { key: index })
  );
};

export default function CustomerAuthLayout({ loading, error, success, onAuth, onGoogleAuth }) {
  const { t } = useTranslation();

  console.log('🚀 CustomerAuthLayout mounted, t function:', typeof t);

  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    rememberMe: false
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onAuth(formData, isLogin);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            {isLogin ? 'Welcome Back!' : 'Join Our Store'}
          </h2>
          <p className="mt-2 text-gray-600">
            {isLogin 
              ? 'Sign in to your account to continue shopping'
              : 'Create your account to start shopping with us'
            }
          </p>
        </div>
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-semibold text-gray-800">
              {isLogin ? 'Sign In' : 'Create Account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="Enter your first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Enter your last name"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                  />
                </div>
              )}

              {isLogin && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="rememberMe"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, rememberMe: checked }))
                      }
                    />
                    <Label htmlFor="rememberMe" className="text-sm">
                      Remember me
                    </Label>
                  </div>
                </div>
              )}

              <SaveButton
                type="submit"
                className="w-full font-medium py-2.5"
                loading={loading}
                defaultText={isLogin ? 'Sign In' : 'Create My Account'}
                loadingText='Processing...'
              />

              <p className="text-xs text-center text-gray-500 mt-3">
                {(() => {
                  console.log('📝 Agreement text rendering started');

                  const key = isLogin ? 'auth.agree_signin_with_links' : 'auth.agree_signup_with_links';
                  const fallback = isLogin
                    ? 'By signing in, you agree to our {termsLink} and {privacyLink}.'
                    : 'By creating an account, you agree to our {termsLink} and {privacyLink}.';

                  console.log('🔑 Translation key:', key);

                  const translatedText = t(key, fallback);
                  console.log('🔍 Translation Debug:', {
                    key,
                    fallback,
                    translatedText,
                    hasPlaceholders: translatedText.includes('{termsLink}') || translatedText.includes('{privacyLink}'),
                    termsOfService: t('common.terms_of_service', 'Terms of Service'),
                    privacyPolicy: t('common.privacy_policy', 'Privacy Policy')
                  });

                  console.log('🔧 Calling replacePlaceholders...');

                  try {
                    const result = replacePlaceholders(
                      translatedText,
                      {
                        termsLink: (
                          <a
                            href="/cms/terms-of-service"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {t('common.terms_of_service', 'Terms of Service')}
                          </a>
                        ),
                        privacyLink: (
                          <a
                            href="/cms/privacy-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {t('common.privacy_policy', 'Privacy Policy')}
                          </a>
                        )
                      }
                    );
                    console.log('✅ replacePlaceholders succeeded');
                    return result;
                  } catch (error) {
                    console.error('❌ replacePlaceholders error:', error);
                    return translatedText;
                  }
                })()}
              </p>
            </form>

            <div className="mt-6">
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-500"
                  onClick={() => {
                    setIsLogin(!isLogin);
                  }}
                >
                  {isLogin 
                    ? "New customer? Create your account" 
                    : "Already have an account? Sign in"
                  }
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}