import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  ShoppingCart,
  CreditCard,
  Globe,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
  Store,
  Users,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

export default function UCPSettings() {
  const features = [
    {
      icon: Bot,
      title: 'AI Agent Commerce',
      description: 'Let AI assistants like Google Gemini and ChatGPT browse and purchase products on behalf of customers.'
    },
    {
      icon: ShoppingCart,
      title: 'Seamless Checkout',
      description: 'Standardized checkout sessions that work across any AI surface - voice assistants, chatbots, and more.'
    },
    {
      icon: CreditCard,
      title: 'Secure Payments',
      description: 'Built-in support for Google Pay, Apple Pay, and major payment providers with cryptographic verification.'
    },
    {
      icon: Globe,
      title: 'Universal Discovery',
      description: 'Your products become discoverable by AI agents through the standardized /.well-known/ucp endpoint.'
    }
  ];

  const benefits = [
    'Reach customers through AI assistants and chatbots',
    'No custom integrations needed per AI platform',
    'Automatic product discovery by AI agents',
    'Secure, standardized checkout flow',
    'Real-time order updates and tracking',
    'Works with your existing payment setup'
  ];

  const partners = [
    'Google', 'Shopify', 'Stripe', 'Visa', 'Mastercard',
    'PayPal', 'Adyen', 'Zalando', 'Target', 'Walmart'
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Universal Commerce Protocol</h1>
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Coming Soon</Badge>
        </div>
        <p className="text-gray-600">
          Enable AI agents to discover, browse, and purchase from your store
        </p>
      </div>

      {/* Hero Card */}
      <Card className="mb-8 overflow-hidden border-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">The Future of E-Commerce is Agentic</h2>
              <p className="text-blue-100 text-lg mb-4">
                Universal Commerce Protocol (UCP) is a new open standard developed by Google and Shopify
                that enables AI agents to conduct commerce on behalf of users. When enabled, your store
                becomes discoverable and shoppable through AI assistants like Google Gemini, ChatGPT, and more.
              </p>
              <div className="flex flex-wrap gap-2">
                {partners.slice(0, 6).map((partner) => (
                  <Badge key={partner} variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
                    {partner}
                  </Badge>
                ))}
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  +20 more
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {features.map((feature) => (
          <Card key={feature.title} className="border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How It Works */}
      <Card className="mb-8 border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">How UCP Works</CardTitle>
          <CardDescription>A simplified view of the agentic commerce flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Customer</span>
              <span className="text-xs text-gray-500">"Find me running shoes"</span>
            </div>

            <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 md:rotate-0" />

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <Bot className="w-8 h-8 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">AI Agent</span>
              <span className="text-xs text-gray-500">Discovers your store</span>
            </div>

            <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 md:rotate-0" />

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <Store className="w-8 h-8 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Your Store</span>
              <span className="text-xs text-gray-500">UCP checkout session</span>
            </div>

            <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 md:rotate-0" />

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Order Complete</span>
              <span className="text-xs text-gray-500">Seamless purchase</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="mb-8 border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Benefits for Your Store</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card className="border-2 border-dashed border-amber-300 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Currently Rolling Out</h3>
              <p className="text-sm text-gray-600 mb-3">
                UCP is currently available for US retailers through Google's waitlist program.
                Global expansion (including Europe) is planned for the coming months.
                We'll notify you when UCP becomes available for your region.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href="https://ucp.dev" target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4" />
                    Learn More at ucp.dev
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href="https://developers.google.com/merchant/ucp" target="_blank" rel="noopener noreferrer">
                    <Shield className="w-4 h-4" />
                    Google Developer Docs
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Preview */}
      <Card className="mt-8 border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Technical Preview</CardTitle>
          <CardDescription>What gets enabled when UCP is activated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <div className="text-gray-400 mb-2"># Your store's UCP discovery endpoint</div>
            <div className="text-green-400 mb-4">GET https://yourstore.com/.well-known/ucp</div>

            <div className="text-gray-400 mb-2"># Response (Business Profile)</div>
            <pre className="text-blue-300">{`{
  "ucp": {
    "version": "2026-01-11",
    "capabilities": ["dev.ucp.shopping.checkout"],
    "services": [...]
  },
  "payment": {
    "handlers": ["stripe", "google_pay", "apple_pay"]
  },
  "business": {
    "name": "Your Store Name",
    "website": "https://yourstore.com"
  }
}`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
