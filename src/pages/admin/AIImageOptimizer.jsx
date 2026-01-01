import React, { useState, useEffect } from 'react';
import { Wand2, Sparkles, Image, Zap, CreditCard, Info } from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { ImageOptimizer } from '@/components/image-optimizer';
import apiClient from '@/api/client';

const AIImageOptimizer = () => {
  const { selectedStore } = useStoreSelection();
  const [pricing, setPricing] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  // Fetch pricing on mount
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await apiClient.get('/image-optimization/pricing');
        if (response.success) {
          setPricing(response);
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
      } finally {
        setPricingLoading(false);
      }
    };
    fetchPricing();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Image Optimizer</h1>
            <p className="text-gray-600">
              Enhance, upscale, remove backgrounds, and stage products using AI
            </p>
          </div>
        </div>
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Compress & Optimize</h3>
          <p className="text-sm text-gray-500">AI-powered compression maintaining visual quality</p>
        </div>

        <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
            <Image className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Upscale & Enhance</h3>
          <p className="text-sm text-gray-500">Increase resolution up to 4x with AI enhancement</p>
        </div>

        <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Remove Background</h3>
          <p className="text-sm text-gray-500">Automatically remove or replace image backgrounds</p>
        </div>

        <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center mb-3">
            <Wand2 className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Product Staging</h3>
          <p className="text-sm text-gray-500">Place products in realistic environments</p>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Optimizer */}
        <div className="lg:col-span-2">
          <ImageOptimizer
            storeId={selectedStore?.id}
            onImageOptimized={(result) => {
              console.log('Optimized:', result);
            }}
            className="h-[600px]"
          />
        </div>

        {/* Pricing Sidebar */}
        <div className="space-y-6">
          {/* Credit Costs Card */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-sm">Credit Costs</h3>
              <span className="text-xs text-gray-500 ml-auto">1 credit = $0.10</span>
            </div>
            <div className="p-4">
              {pricingLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-8 bg-gray-100 rounded" />
                  ))}
                </div>
              ) : pricing?.matrix ? (
                <div className="space-y-4">
                  {pricing.providers?.map(provider => (
                    <div key={provider} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {provider === 'openai' && '🤖'}
                          {provider === 'gemini' && '✨'}
                          {provider === 'flux' && '⚡'}
                          {provider === 'qwen' && '🎨'}
                        </span>
                        <span className="font-medium text-sm capitalize">{provider}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {pricing.operations?.map(op => {
                          const cost = pricing.matrix[provider]?.[op]?.credits;
                          return cost !== undefined ? (
                            <div key={op} className="flex justify-between py-1 px-2 bg-gray-50 rounded">
                              <span className="text-gray-600 capitalize">{op.replace('_', ' ')}</span>
                              <span className="font-medium text-purple-600">{cost} cr</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Pricing unavailable</p>
              )}
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm text-purple-900">Tips</h3>
            </div>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <span>Use <strong>Product Staging</strong> to show furniture in rooms or clothing on models</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <span><strong>Qwen</strong> is the most cost-effective for simple tasks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <span><strong>OpenAI</strong> produces the highest quality results</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <span>Bulk optimize from <strong>File Library</strong> or <strong>Product Edit</strong></span>
              </li>
            </ul>
          </div>

          {/* Staging Contexts */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-sm mb-3">Popular Staging Contexts</h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Modern Living Room',
                'Cozy Bedroom',
                'Kitchen Counter',
                'Home Office',
                'Fashion Model',
                'Outdoor Patio',
                'Flat Lay',
                'White Studio'
              ].map(ctx => (
                <span
                  key={ctx}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                >
                  {ctx}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIImageOptimizer;
