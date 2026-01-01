import React, { useState, useEffect } from 'react';
import { Wand2, Sparkles, Image, Zap, CreditCard, Info, ArrowRight, FolderOpen, Package } from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Link } from 'react-router-dom';
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
        {/* Where to Use Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Access Cards */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500">
              <h2 className="text-lg font-semibold text-white">Get Started</h2>
              <p className="text-purple-100 text-sm">
                Select images to optimize from one of these locations
              </p>
            </div>
            <div className="p-6 grid gap-4 md:grid-cols-2">
              {/* File Library */}
              <Link
                to="/admin/file-library"
                className="group flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                  <FolderOpen className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 flex items-center gap-2">
                    File Library
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Bulk optimize images from your media library. Select multiple files and apply AI operations.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Bulk select</span>
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">All file types</span>
                  </div>
                </div>
              </Link>

              {/* Products */}
              <Link
                to="/admin/products"
                className="group flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-200 transition-colors">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 flex items-center gap-2">
                    Product Images
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Edit a product and optimize its images directly. Perfect for individual product updates.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">Product photos</span>
                    <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">Gallery images</span>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">How It Works</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 font-semibold text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Select Images</h4>
                  <p className="text-sm text-gray-500">
                    Go to File Library or Product Edit and select the images you want to optimize. Use checkboxes for bulk selection.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 font-semibold text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Choose AI Provider & Operation</h4>
                  <p className="text-sm text-gray-500">
                    Select an AI provider (OpenAI, Gemini, Flux, or Qwen) and choose the operation: compress, upscale, remove background, or stage.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 font-semibold text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Review Costs & Optimize</h4>
                  <p className="text-sm text-gray-500">
                    See the total credit cost before processing. Click optimize to apply AI enhancements to your images.
                  </p>
                </div>
              </div>
            </div>
          </div>
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
                <span>Bulk optimize from <strong>File Library</strong> for best efficiency</span>
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
