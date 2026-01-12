import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, Users, ArrowRight, DollarSign, TrendingUp, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/api/client';

export default function AffiliateSection() {
  const [stats, setStats] = useState({ activeStores: 0, activeAffiliates: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/affiliates/public-stats');
      if (response?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Join Our Community
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Two Ways to Grow With Us
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Whether you want to launch your own store or earn by referring others, we have a path for you
          </p>
        </div>

        {/* Two Column Cards */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Store Owners Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl transform group-hover:scale-[1.02] transition-transform duration-300" />
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 lg:p-10 text-white overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                  <Store className="h-7 w-7 text-white" />
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold mb-3">
                  For Store Owners
                </h3>
                <p className="text-white/80 text-lg mb-6">
                  Launch your e-commerce store in minutes with AI-powered tools,
                  beautiful themes, and everything you need to sell online.
                </p>

                {/* Stats */}
                <div className="flex items-center gap-6 mb-8">
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold">
                      {stats.activeStores > 0 ? stats.activeStores.toLocaleString() : '50'}+
                    </p>
                    <p className="text-white/60 text-sm">Active Stores</p>
                  </div>
                  <div className="w-px h-12 bg-white/20" />
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold">30</p>
                    <p className="text-white/60 text-sm">Free Credits</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                    AI-powered product descriptions
                  </li>
                  <li className="flex items-center gap-3 text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                    Multiple payment gateways
                  </li>
                  <li className="flex items-center gap-3 text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Gift className="h-3 w-3" />
                    </div>
                    Earn 30 credits for every referral
                  </li>
                </ul>

                <p className="text-white/50 text-xs mb-4">
                  * Referral rewards require at least 1 active store
                </p>

                <Link to="/signup">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-white text-indigo-700 hover:bg-gray-100"
                  >
                    Start Your Store
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Affiliates Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl transform group-hover:scale-[1.02] transition-transform duration-300" />
            <div className="relative bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 sm:p-8 lg:p-10 text-white overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-white" />
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold mb-3">
                  For Bloggers & Influencers
                </h3>
                <p className="text-white/80 text-lg mb-6">
                  Earn generous commissions by referring new store owners.
                  Perfect for content creators, marketers, and agencies.
                </p>

                {/* Stats */}
                <div className="flex items-center gap-6 mb-8">
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold">20%</p>
                    <p className="text-white/60 text-sm">Commission Rate</p>
                  </div>
                  <div className="w-px h-12 bg-white/20" />
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold">30</p>
                    <p className="text-white/60 text-sm">Day Cookie</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <DollarSign className="h-3 w-3" />
                    </div>
                    Up to 20% on every referral
                  </li>
                  <li className="flex items-center gap-3 text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                    Real-time tracking dashboard
                  </li>
                  <li className="flex items-center gap-3 text-white/90">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                    Fast Stripe Connect payouts
                  </li>
                </ul>

                <Link to="/affiliate/apply">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-white text-purple-700 hover:bg-gray-100"
                  >
                    Become an Affiliate
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Note */}
        <div className="text-center mt-10 sm:mt-12">
          <p className="text-gray-500">
            Already an affiliate?{' '}
            <Link to="/affiliate/login" className="text-primary font-medium hover:underline">
              Sign in to your dashboard
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
