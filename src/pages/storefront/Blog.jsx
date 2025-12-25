import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Clock, Calendar, BookOpen, Mail, BarChart3,
  ShoppingCart, Zap, ChevronRight, Tag, Package, CreditCard,
  Truck, Users, Search, Settings, Globe, Code, Database,
  PieChart, Target, Layers
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Custom components for markdown rendering
const MarkdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-neutral-900 mt-8 mb-4 pb-2 border-b border-neutral-200">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-bold text-neutral-900 mt-8 mb-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-neutral-800 mt-6 mb-3">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-lg font-semibold text-neutral-800 mt-4 mb-2">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-neutral-700 leading-7 mb-4">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-6 mb-4 space-y-2 text-neutral-700">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-6 mb-4 space-y-2 text-neutral-700">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-7 pl-1">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-indigo-50 rounded-r-lg italic text-neutral-700">
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children }) => {
    if (inline) {
      return (
        <code className="bg-neutral-100 text-indigo-700 px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className={className}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-neutral-900 text-neutral-100 rounded-lg p-4 overflow-x-auto mb-4 text-sm font-mono leading-6">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-6">
      <table className="min-w-full border border-neutral-200 rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-neutral-100">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-neutral-200">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-neutral-50">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-900 border-b border-neutral-200">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-sm text-neutral-700 border-b border-neutral-100">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
      {children}
    </a>
  ),
  hr: () => (
    <hr className="my-8 border-t border-neutral-200" />
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="rounded-lg shadow-md my-6 max-w-full" />
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-neutral-900">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic">
      {children}
    </em>
  ),
};

// Tag definitions with colors
const TAGS = {
  'getting-started': { label: 'Getting Started', color: 'bg-green-100 text-green-700 border-green-200' },
  'marketing': { label: 'Marketing', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'email': { label: 'Email', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'automation': { label: 'Automation', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'analytics': { label: 'Analytics', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  'seo': { label: 'SEO', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  'integrations': { label: 'Integrations', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  'marketplace': { label: 'Marketplace', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'payments': { label: 'Payments', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  'shipping': { label: 'Shipping', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  'orders': { label: 'Orders', color: 'bg-red-100 text-red-700 border-red-200' },
  'products': { label: 'Products', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  'customers': { label: 'Customers', color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  'developer': { label: 'Developer', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  'advanced': { label: 'Advanced', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  'ai': { label: 'AI', color: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200' },
  'crm': { label: 'CRM', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  'migration': { label: 'Migration', color: 'bg-amber-100 text-amber-700 border-amber-200' }
};

// Blog article metadata
const BLOG_ARTICLES = {
  // Email Marketing
  'email-marketing-guide': {
    title: 'Complete Guide to Email Marketing for E-commerce',
    description: 'Learn how to create campaigns, automate customer journeys, and boost conversions with email marketing.',
    category: 'Email Marketing',
    categoryIcon: Mail,
    categoryColor: 'bg-blue-100 text-blue-600',
    tags: ['marketing', 'email', 'getting-started'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'abandoned-cart-recovery': {
    title: 'How to Recover Abandoned Carts with Email Automation',
    description: 'Set up a proven 3-email sequence to recover 5-15% of lost sales from abandoned carts.',
    category: 'Email Marketing',
    categoryIcon: Mail,
    categoryColor: 'bg-blue-100 text-blue-600',
    tags: ['marketing', 'email', 'automation', 'orders'],
    readTime: '8 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'email-automation-workflows': {
    title: 'Building Email Automation Workflows',
    description: 'Create automated email sequences that nurture leads, convert customers, and drive repeat purchases.',
    category: 'Email Marketing',
    categoryIcon: Mail,
    categoryColor: 'bg-blue-100 text-blue-600',
    tags: ['marketing', 'email', 'automation'],
    readTime: '15 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // Analytics & Testing
  'ab-testing-guide': {
    title: 'A/B Testing Guide for E-commerce',
    description: 'Run experiments to optimize your store and increase conversions with data-driven decisions.',
    category: 'Analytics & Testing',
    categoryIcon: BarChart3,
    categoryColor: 'bg-purple-100 text-purple-600',
    tags: ['analytics', 'advanced'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'heatmaps-guide': {
    title: 'Using Heatmaps to Understand Customer Behavior',
    description: 'Visualize where customers click, scroll, and focus to improve your store layout.',
    category: 'Analytics & Testing',
    categoryIcon: BarChart3,
    categoryColor: 'bg-purple-100 text-purple-600',
    tags: ['analytics', 'customers'],
    readTime: '7 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'analytics-dashboard': {
    title: 'Understanding Your Analytics Dashboard',
    description: 'Make data-driven decisions with sales tracking, customer insights, and performance metrics.',
    category: 'Analytics & Testing',
    categoryIcon: PieChart,
    categoryColor: 'bg-purple-100 text-purple-600',
    tags: ['analytics', 'getting-started'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'customer-activity-tracking': {
    title: 'Using Customer Activity Tracking',
    description: 'Understand customer behavior through page views, cart actions, and session data.',
    category: 'Analytics & Testing',
    categoryIcon: Target,
    categoryColor: 'bg-purple-100 text-purple-600',
    tags: ['analytics', 'customers'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'custom-datalayer-events': {
    title: 'Custom DataLayer Events for Advanced Tracking',
    description: 'Learn how to create and manage custom datalayer events to track user interactions and send data to Google Tag Manager, analytics platforms, and marketing tools.',
    category: 'Analytics & Testing',
    categoryIcon: Layers,
    categoryColor: 'bg-purple-100 text-purple-600',
    tags: ['analytics', 'developer', 'integrations', 'marketing'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // Marketplace Integrations
  'how-to-configure-amazon-marketplace': {
    title: 'How to Sell Your Products on Amazon',
    description: 'Connect your store to Amazon and sync products, inventory, and orders automatically.',
    category: 'Marketplace Integrations',
    categoryIcon: ShoppingCart,
    categoryColor: 'bg-green-100 text-green-600',
    tags: ['marketplace', 'integrations', 'products'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'how-to-configure-ebay-marketplace': {
    title: 'How to Sell Your Products on eBay',
    description: 'List products on eBay and manage orders from your DainoStore dashboard.',
    category: 'Marketplace Integrations',
    categoryIcon: ShoppingCart,
    categoryColor: 'bg-green-100 text-green-600',
    tags: ['marketplace', 'integrations', 'products'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'google-shopping-feeds': {
    title: 'Product Feeds for Google Shopping',
    description: 'Get your products appearing in Google Shopping results with optimized product feeds.',
    category: 'Marketplace Integrations',
    categoryIcon: ShoppingCart,
    categoryColor: 'bg-green-100 text-green-600',
    tags: ['marketplace', 'seo', 'products'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // Store Essentials
  'getting-started-products': {
    title: 'Getting Started: Setting Up Your First Products',
    description: 'Learn how to add products, organize categories, and configure attributes for your store.',
    category: 'Store Essentials',
    categoryIcon: Package,
    categoryColor: 'bg-emerald-100 text-emerald-600',
    tags: ['getting-started', 'products'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'managing-orders': {
    title: 'Managing Orders Like a Pro',
    description: 'Master your order workflow from processing to fulfillment, refunds, and customer communication.',
    category: 'Store Essentials',
    categoryIcon: Package,
    categoryColor: 'bg-emerald-100 text-emerald-600',
    tags: ['orders', 'getting-started'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'stripe-payment-setup': {
    title: 'Configuring Payments with Stripe',
    description: 'Accept credit cards, Apple Pay, Google Pay, and more with complete Stripe setup guide.',
    category: 'Store Essentials',
    categoryIcon: CreditCard,
    categoryColor: 'bg-emerald-100 text-emerald-600',
    tags: ['payments', 'getting-started'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'shipping-delivery-setup': {
    title: 'Setting Up Shipping and Delivery',
    description: 'Configure shipping methods, rates, zones, and delivery options for your customers.',
    category: 'Store Essentials',
    categoryIcon: Truck,
    categoryColor: 'bg-emerald-100 text-emerald-600',
    tags: ['shipping', 'getting-started'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'discount-coupons': {
    title: 'Creating Discount Coupons',
    description: 'Set up promotional codes to drive sales, reward loyalty, and attract new customers.',
    category: 'Store Essentials',
    categoryIcon: Package,
    categoryColor: 'bg-emerald-100 text-emerald-600',
    tags: ['marketing', 'getting-started'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'customer-management': {
    title: 'Customer Management and Blacklisting',
    description: 'Build customer relationships, manage data, and protect your store from fraud.',
    category: 'Store Essentials',
    categoryIcon: Users,
    categoryColor: 'bg-emerald-100 text-emerald-600',
    tags: ['customers', 'getting-started'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // Marketing & Growth
  'rfm-customer-segmentation': {
    title: 'Customer Segmentation with RFM Analysis',
    description: 'Use Recency, Frequency, and Monetary value to identify your best customers.',
    category: 'Marketing & Growth',
    categoryIcon: Target,
    categoryColor: 'bg-pink-100 text-pink-600',
    tags: ['marketing', 'customers', 'analytics'],
    readTime: '15 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'marketing-integrations': {
    title: 'Connecting to Klaviyo, Mailchimp, and HubSpot',
    description: 'Integrate with popular marketing platforms for advanced email and CRM capabilities.',
    category: 'Marketing & Growth',
    categoryIcon: Mail,
    categoryColor: 'bg-pink-100 text-pink-600',
    tags: ['marketing', 'integrations', 'email'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'ai-product-optimization': {
    title: 'Using AI to Optimize Product Listings',
    description: 'Leverage AI for compelling descriptions, optimized titles, and accurate translations.',
    category: 'Marketing & Growth',
    categoryIcon: Zap,
    categoryColor: 'bg-pink-100 text-pink-600',
    tags: ['ai', 'products', 'seo'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'multi-language-setup': {
    title: 'Multi-Language Store Setup',
    description: 'Expand globally by offering your store in multiple languages with AI-powered translation.',
    category: 'Marketing & Growth',
    categoryIcon: Globe,
    categoryColor: 'bg-pink-100 text-pink-600',
    tags: ['getting-started', 'ai'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'first-marketing-campaign': {
    title: 'How to Create Your First Marketing Campaign',
    description: 'A step-by-step guide to launching your first email marketing campaign, from building your audience to tracking results.',
    category: 'Marketing & Growth',
    categoryIcon: Mail,
    categoryColor: 'bg-pink-100 text-pink-600',
    tags: ['marketing', 'email', 'getting-started'],
    readTime: '15 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // SEO & Optimization
  'seo-optimization-guide': {
    title: 'SEO Optimization Complete Guide',
    description: 'Master search engine optimization to drive organic traffic and increase visibility.',
    category: 'SEO & Optimization',
    categoryIcon: Search,
    categoryColor: 'bg-teal-100 text-teal-600',
    tags: ['seo', 'marketing'],
    readTime: '18 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // Advanced Features
  'crm-pipelines-deals': {
    title: 'CRM: Managing Sales Pipelines and Deals',
    description: 'Track leads, manage deals, and grow relationships with the built-in CRM system.',
    category: 'Advanced Features',
    categoryIcon: Target,
    categoryColor: 'bg-rose-100 text-rose-600',
    tags: ['crm', 'advanced'],
    readTime: '15 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'team-management': {
    title: 'Team Management and Permissions',
    description: 'Add team members, create custom roles, and control access with granular permissions.',
    category: 'Advanced Features',
    categoryIcon: Users,
    categoryColor: 'bg-rose-100 text-rose-600',
    tags: ['advanced', 'getting-started'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'custom-domain-setup': {
    title: 'Custom Domain Setup',
    description: 'Connect your own domain to your store for a professional, branded experience.',
    category: 'Advanced Features',
    categoryIcon: Globe,
    categoryColor: 'bg-rose-100 text-rose-600',
    tags: ['getting-started', 'advanced'],
    readTime: '8 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'cms-pages-blocks': {
    title: 'Content Management with CMS',
    description: 'Create custom pages, content blocks, and navigation using the built-in CMS.',
    category: 'Advanced Features',
    categoryIcon: Layers,
    categoryColor: 'bg-rose-100 text-rose-600',
    tags: ['advanced'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'inventory-management': {
    title: 'Inventory and Stock Management',
    description: 'Track inventory, prevent overselling, and optimize stock levels for efficiency.',
    category: 'Advanced Features',
    categoryIcon: Package,
    categoryColor: 'bg-rose-100 text-rose-600',
    tags: ['products', 'advanced'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // Developer Guides
  'understanding-background-jobs-queue': {
    title: 'Understanding Background Jobs & Queue System',
    description: 'How background jobs work and how to monitor task processing in your store.',
    category: 'Developer Guides',
    categoryIcon: Clock,
    categoryColor: 'bg-slate-100 text-slate-600',
    tags: ['developer', 'advanced'],
    readTime: '8 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'plugin-developer-job-scheduler-guide': {
    title: 'Plugin Developer: Job Scheduler Guide',
    description: 'Create scheduled tasks and background jobs for your custom plugins.',
    category: 'Developer Guides',
    categoryIcon: Zap,
    categoryColor: 'bg-slate-100 text-slate-600',
    tags: ['developer', 'advanced', 'automation'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'building-plugins': {
    title: 'Building Custom Plugins',
    description: 'Extend DainoStore with custom plugins using hooks, routes, and the plugin API.',
    category: 'Developer Guides',
    categoryIcon: Code,
    categoryColor: 'bg-slate-100 text-slate-600',
    tags: ['developer', 'advanced'],
    readTime: '18 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'database-integrations': {
    title: 'Database Integrations Guide',
    description: 'Connect and manage databases with Supabase, Neon, PlanetScale, or your own.',
    category: 'Developer Guides',
    categoryIcon: Database,
    categoryColor: 'bg-slate-100 text-slate-600',
    tags: ['developer', 'advanced', 'integrations'],
    readTime: '12 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'media-cdn-setup': {
    title: 'Media and CDN Configuration',
    description: 'Optimize images and files with CDN delivery for faster loading worldwide.',
    category: 'Developer Guides',
    categoryIcon: Globe,
    categoryColor: 'bg-slate-100 text-slate-600',
    tags: ['developer', 'advanced'],
    readTime: '10 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'api-integration-patterns': {
    title: 'API Integration Patterns',
    description: 'Learn how to integrate external services, handle webhooks, and build robust connections.',
    category: 'Developer Guides',
    categoryIcon: Code,
    categoryColor: 'bg-slate-100 text-slate-600',
    tags: ['developer', 'integrations', 'advanced'],
    readTime: '15 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'multi-tenant-architecture': {
    title: 'Multi-Tenant Architecture Explained',
    description: 'Understand how DainoStore isolates stores, scales efficiently, and maintains security.',
    category: 'Developer Guides',
    categoryIcon: Layers,
    categoryColor: 'bg-slate-100 text-slate-600',
    tags: ['developer', 'advanced'],
    readTime: '15 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  // Migration
  'shopify-migration': {
    title: 'Migrating Your Shopify Store to DainoStore',
    description: 'Complete guide to moving products, customers, and orders from Shopify.',
    category: 'Migration Guides',
    categoryIcon: Package,
    categoryColor: 'bg-amber-100 text-amber-600',
    tags: ['migration', 'getting-started'],
    readTime: '15 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  }
};

// Map slugs to content file paths (served from public/blog)
const CONTENT_PATHS = {
  // Email Marketing
  'email-marketing-guide': '/blog/email-marketing-guide.md',
  'abandoned-cart-recovery': '/blog/abandoned-cart-recovery.md',
  'email-automation-workflows': '/blog/email-automation-workflows.md',
  // Analytics & Testing
  'ab-testing-guide': '/blog/ab-testing-guide.md',
  'heatmaps-guide': '/blog/heatmaps-guide.md',
  'analytics-dashboard': '/blog/analytics-dashboard.md',
  'customer-activity-tracking': '/blog/customer-activity-tracking.md',
  'custom-datalayer-events': '/blog/custom-datalayer-events.md',
  // Marketplace Integrations
  'how-to-configure-amazon-marketplace': '/blog/how-to-configure-amazon-marketplace.md',
  'how-to-configure-ebay-marketplace': '/blog/how-to-configure-ebay-marketplace.md',
  'google-shopping-feeds': '/blog/google-shopping-feeds.md',
  // Store Essentials
  'getting-started-products': '/blog/getting-started-products.md',
  'managing-orders': '/blog/managing-orders.md',
  'stripe-payment-setup': '/blog/stripe-payment-setup.md',
  'shipping-delivery-setup': '/blog/shipping-delivery-setup.md',
  'discount-coupons': '/blog/discount-coupons.md',
  'customer-management': '/blog/customer-management.md',
  // Marketing & Growth
  'rfm-customer-segmentation': '/blog/rfm-customer-segmentation.md',
  'marketing-integrations': '/blog/marketing-integrations.md',
  'ai-product-optimization': '/blog/ai-product-optimization.md',
  'multi-language-setup': '/blog/multi-language-setup.md',
  'first-marketing-campaign': '/blog/first-marketing-campaign.md',
  // SEO & Optimization
  'seo-optimization-guide': '/blog/seo-optimization-guide.md',
  // Advanced Features
  'crm-pipelines-deals': '/blog/crm-pipelines-deals.md',
  'team-management': '/blog/team-management.md',
  'custom-domain-setup': '/blog/custom-domain-setup.md',
  'cms-pages-blocks': '/blog/cms-pages-blocks.md',
  'inventory-management': '/blog/inventory-management.md',
  // Developer Guides
  'understanding-background-jobs-queue': '/blog/understanding-background-jobs-queue.md',
  'plugin-developer-job-scheduler-guide': '/blog/plugin-developer-job-scheduler-guide.md',
  'building-plugins': '/blog/building-plugins.md',
  'database-integrations': '/blog/database-integrations.md',
  'media-cdn-setup': '/blog/media-cdn-setup.md',
  'api-integration-patterns': '/blog/api-integration-patterns.md',
  'multi-tenant-architecture': '/blog/multi-tenant-architecture.md',
  // Migration
  'shopify-migration': '/blog/shopify-migration.md'
};

function BlogHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto p-2 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/landing" className="flex items-center gap-2">
            <img src="/logo_red.svg" alt="DainoStore" className="h-12" />
            <span className="text-xl font-bold">DainoStore</span>
          </Link>

          {/* Navigation - Centered (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 font-semibold text-lg">
            <a href="https://discord.gg/J3BCegpX" className="text-slate-600 hover:text-indigo-600 transition-colors">
              Discord
            </a>
            <a href="/landing#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors">
              Pricing
            </a>
            <Link to="/blog" className="text-indigo-600 font-semibold">
              Resources
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/admin/onboarding">
              <Button className="bg-green-500 text-white">Try Now</Button>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex md:hidden items-center justify-center gap-6 font-semibold text-base mt-2">
          <a href="https://discord.gg/J3BCegpX" className="text-slate-600 hover:text-indigo-600 transition-colors">
            Discord
          </a>
          <a href="/landing#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors">
            Pricing
          </a>
          <Link to="/blog" className="text-indigo-600 font-semibold">
            Resources
          </Link>
        </nav>
      </div>
    </header>
  );
}

function BlogIndex() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse selected tags from URL (comma-separated)
  const tagsParam = searchParams.get('tags') || '';
  const selectedTags = tagsParam ? tagsParam.split(',').filter(Boolean) : [];

  // Get search query from URL
  const searchQuery = searchParams.get('q') || '';

  const articles = Object.entries(BLOG_ARTICLES).map(([slug, meta]) => ({
    slug,
    ...meta
  }));

  // Get all unique tags used in articles
  const usedTags = [...new Set(articles.flatMap(a => a.tags || []))].sort();

  // Filter articles by search query and selected tags
  let filteredArticles = articles;

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredArticles = filteredArticles.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.description.toLowerCase().includes(query) ||
      a.category.toLowerCase().includes(query)
    );
  }

  // Apply tag filter (show articles that have ANY of the selected tags)
  if (selectedTags.length > 0) {
    filteredArticles = filteredArticles.filter(a => a.tags?.some(tag => selectedTags.includes(tag)));
  }

  // Group by category
  const categories = filteredArticles.reduce((acc, article) => {
    if (!acc[article.category]) {
      acc[article.category] = {
        name: article.category,
        icon: article.categoryIcon,
        color: article.categoryColor,
        articles: []
      };
    }
    acc[article.category].articles.push(article);
    return acc;
  }, {});

  const handleTagClick = (tag) => {
    let newTags;
    if (selectedTags.includes(tag)) {
      // Remove tag
      newTags = selectedTags.filter(t => t !== tag);
    } else {
      // Add tag
      newTags = [...selectedTags, tag];
    }

    const params = {};
    if (searchQuery) params.q = searchQuery;
    if (newTags.length > 0) params.tags = newTags.join(',');
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    const params = {};
    if (query) params.q = query;
    if (selectedTags.length > 0) params.tags = selectedTags.join(',');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <BlogHeader />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="inline-block bg-indigo-100 text-indigo-700 px-4 py-2 font-bold text-sm mb-6 rounded-full">
              BLOG & RESOURCES
            </div>
            <h1 className="text-5xl font-black text-neutral-900 mb-4">
              Learn & Grow
            </h1>
            <p className="text-xl text-neutral-600 max-w-2xl">
              Guides, tutorials, and best practices to help you get the most out of your online store.
            </p>
          </motion.div>

          {/* Search Input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mb-6"
          >
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-neutral-900 placeholder-neutral-400"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch({ target: { value: '' } })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  ✕
                </button>
              )}
            </div>
          </motion.div>

          {/* Tag Filter Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-500">Filter by topic (select multiple):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                onClick={clearFilters}
                className={`cursor-pointer px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  selectedTags.length === 0 && !searchQuery
                    ? 'bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                All Articles
              </Badge>
              {usedTags.map(tag => {
                const tagInfo = TAGS[tag];
                if (!tagInfo) return null;
                const isSelected = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`cursor-pointer px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500'
                        : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    {tagInfo.label}
                  </Badge>
                );
              })}
            </div>
          </motion.div>

          {/* Results count when filtered */}
          {(selectedTags.length > 0 || searchQuery) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <p className="text-neutral-600 flex items-center gap-2 flex-wrap">
                Showing {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1">
                    matching "<span className="font-medium text-neutral-900">{searchQuery}</span>"
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-indigo-600 hover:underline ml-2"
                >
                  Clear filters
                </button>
              </p>
            </motion.div>
          )}

          {Object.keys(categories).length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Search className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 text-lg">
                {searchQuery
                  ? `No articles found matching "${searchQuery}"`
                  : 'No articles found with the selected filters.'}
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 text-indigo-600 hover:underline"
              >
                View all articles
              </button>
            </motion.div>
          ) : (
            Object.values(categories).map((category, idx) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="mb-12"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-neutral-900">{category.name}</h2>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.articles.map((article) => (
                      <Link
                        key={article.slug}
                        to={`/blog/${article.slug}`}
                        className="group bg-white rounded-xl p-6 border border-neutral-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-300"
                      >
                        <h3 className="font-bold text-lg text-neutral-900 mb-2 group-hover:text-indigo-600 transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-neutral-600 text-sm mb-4 line-clamp-2">
                          {article.description}
                        </p>
                        {/* Tags on article card */}
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {article.tags.slice(0, 3).map(tag => {
                              const tagInfo = TAGS[tag];
                              if (!tagInfo) return null;
                              return (
                                <Badge
                                  key={tag}
                                  className="bg-yellow-400 text-black border-yellow-500 text-xs px-2 py-0.5"
                                >
                                  {tagInfo.label}
                                </Badge>
                              );
                            })}
                            {article.tags.length > 3 && (
                              <Badge className="bg-neutral-100 text-neutral-500 border-neutral-200 text-xs px-2 py-0.5">
                                +{article.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-500">{article.readTime}</span>
                          <span className="text-indigo-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                            Read <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

function BlogArticle({ slug }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const article = BLOG_ARTICLES[slug];
  const Icon = article?.categoryIcon || BookOpen;

  useEffect(() => {
    if (!article) {
      setError('Article not found');
      setLoading(false);
      return;
    }

    const loadContent = async () => {
      try {
        const path = CONTENT_PATHS[slug];
        const response = await fetch(path);
        if (!response.ok) throw new Error('Failed to load article');
        const text = await response.text();
        setContent(text);
      } catch (err) {
        // Try alternative path
        try {
          const altPath = `/blog/${slug}.md`;
          const response = await fetch(altPath);
          if (response.ok) {
            const text = await response.text();
            setContent(text);
            return;
          }
        } catch {}
        setError('Failed to load article content');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [slug, article]);

  if (!article) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <BlogHeader />
        <main className="pt-24 pb-16">
          <div className="max-w-3xl mx-auto px-6 text-center py-20">
            <h1 className="text-3xl font-bold text-neutral-900 mb-4">Article Not Found</h1>
            <p className="text-neutral-600 mb-8">The article you're looking for doesn't exist.</p>
            <Link to="/blog">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Blog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <BlogHeader />

      <main className="pt-24 pb-16">
        <article className="max-w-3xl mx-auto px-6">
          {/* Breadcrumb */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8"
          >
            <Link
              to="/blog"
              className="inline-flex items-center text-neutral-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to all articles
            </Link>
          </motion.div>

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-lg ${article.categoryColor} flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-neutral-600">{article.category}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-neutral-900 mb-6">
              {article.title}
            </h1>

            <p className="text-xl text-neutral-600 mb-6">
              {article.description}
            </p>

            <div className="flex items-center gap-6 text-sm text-neutral-500 mb-4">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {article.date}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {article.readTime}
              </span>
              <span>{article.author}</span>
            </div>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {article.tags.map(tag => {
                  const tagInfo = TAGS[tag];
                  if (!tagInfo) return null;
                  return (
                    <Link key={tag} to={`/blog?tags=${tag}`}>
                      <Badge className="bg-yellow-400 text-black border-yellow-500 hover:bg-yellow-500 transition-colors cursor-pointer px-3 py-1">
                        {tagInfo.label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.header>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-none"
          >
            {loading ? (
              <div className="py-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-neutral-500">Loading article...</p>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <p className="text-neutral-600">
                  Please try refreshing the page or{' '}
                  <Link to="/blog" className="text-indigo-600 hover:underline">
                    browse other articles
                  </Link>.
                </p>
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MarkdownComponents}
              >
                {content}
              </ReactMarkdown>
            )}
          </motion.div>

          {/* Footer CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 pt-8 border-t"
          >
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold text-neutral-900 mb-3">
                Ready to grow your store?
              </h3>
              <p className="text-neutral-600 mb-6">
                Start using these strategies today with DainoStore's built-in marketing tools.
              </p>
              <div className="flex justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                    Get Started Free
                  </Button>
                </Link>
                <Link to="/blog">
                  <Button size="lg" variant="outline">
                    Read More Guides
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </article>
      </main>
    </div>
  );
}

export default function Blog() {
  const { slug } = useParams();

  if (slug) {
    return <BlogArticle slug={slug} />;
  }

  return <BlogIndex />;
}
