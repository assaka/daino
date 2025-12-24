import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import {
  BookOpen, ArrowRight, Mail, Zap, ShoppingCart,
  BarChart3, TestTube2, MousePointer2, Package, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

const BLOG_ARTICLES = [
  {
    category: 'Email Marketing',
    icon: Mail,
    color: 'bg-blue-100 text-blue-600',
    articles: [
      {
        title: 'Complete Guide to Email Marketing for E-commerce',
        description: 'Learn how to create campaigns, automate customer journeys, and boost conversions with email marketing.',
        slug: 'email-marketing-guide',
        readTime: '12 min read',
        featured: true
      },
      {
        title: 'How to Recover Abandoned Carts with Email Automation',
        description: 'Set up a proven 3-email sequence to recover 5-15% of lost sales from abandoned carts.',
        slug: 'abandoned-cart-recovery',
        readTime: '8 min read',
        featured: true
      }
    ]
  },
  {
    category: 'Analytics & Testing',
    icon: BarChart3,
    color: 'bg-purple-100 text-purple-600',
    articles: [
      {
        title: 'A/B Testing Guide for E-commerce',
        description: 'Run experiments to optimize your store and increase conversions with data-driven decisions.',
        slug: 'ab-testing-guide',
        readTime: '10 min read'
      },
      {
        title: 'Using Heatmaps to Understand Customer Behavior',
        description: 'Visualize where customers click, scroll, and focus to improve your store layout.',
        slug: 'heatmaps-guide',
        readTime: '7 min read'
      }
    ]
  },
  {
    category: 'Marketplace Integrations',
    icon: ShoppingCart,
    color: 'bg-green-100 text-green-600',
    articles: [
      {
        title: 'How to Configure Amazon Marketplace',
        description: 'Connect your store to Amazon and sync products, inventory, and orders automatically.',
        slug: 'how-to-configure-amazon-marketplace',
        readTime: '6 min read'
      },
      {
        title: 'How to Configure eBay Marketplace',
        description: 'List products on eBay and manage orders from your DainoStore dashboard.',
        slug: 'how-to-configure-ebay-marketplace',
        readTime: '6 min read'
      }
    ]
  },
  {
    category: 'Developer Guides',
    icon: Clock,
    color: 'bg-orange-100 text-orange-600',
    articles: [
      {
        title: 'Understanding Background Jobs & Queue System',
        description: 'How background jobs work and how to monitor task processing in your store.',
        slug: 'understanding-background-jobs-queue',
        readTime: '5 min read'
      },
      {
        title: 'Plugin Developer: Job Scheduler Guide',
        description: 'Create scheduled tasks and background jobs for your custom plugins.',
        slug: 'plugin-developer-job-scheduler-guide',
        readTime: '8 min read'
      }
    ]
  }
];

function ArticleCard({ article, featured = false }) {
  return (
    <Link
      to={`/blog/${article.slug}`}
      className={`
        group block p-6 rounded-xl border transition-all duration-300 hover:shadow-lg
        ${featured
          ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100 hover:border-indigo-300'
          : 'bg-white border-neutral-200 hover:border-neutral-300'
        }
      `}
    >
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-lg text-neutral-900 group-hover:text-indigo-600 transition-colors pr-4">
          {article.title}
        </h4>
        <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
      </div>
      <p className="text-neutral-600 text-sm mb-4 line-clamp-2">
        {article.description}
      </p>
      <span className="text-xs text-neutral-500 font-medium">
        {article.readTime}
      </span>
    </Link>
  );
}

function CategorySection({ category }) {
  const Icon = category.icon;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-xl font-bold text-neutral-900">{category.category}</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {category.articles.map((article, idx) => (
          <ArticleCard key={idx} article={article} featured={article.featured} />
        ))}
      </div>
    </div>
  );
}

export default function Resources() {
  // Get featured articles for the hero section
  const featuredArticles = BLOG_ARTICLES
    .flatMap(cat => cat.articles.filter(a => a.featured))
    .slice(0, 2);

  return (
    <section id="resources" className="py-32 bg-neutral-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="inline-block bg-indigo-100 text-indigo-700 px-4 py-2 font-bold text-sm mb-6 rounded-full">
            RESOURCES
          </div>
          <h2 className="text-5xl md:text-6xl font-black mb-6 text-neutral-900">
            Learn & Grow
          </h2>
          <p className="text-xl text-neutral-600 max-w-2xl">
            Guides, tutorials, and best practices to help you get the most out of your online store.
          </p>
        </motion.div>

        {/* Featured Articles */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-6">
            Featured Guides
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {featuredArticles.map((article, idx) => (
              <Link
                key={idx}
                to={`/blog/${article.slug}`}
                className="group relative bg-white rounded-2xl p-8 border border-neutral-200 hover:border-indigo-300 transition-all duration-300 hover:shadow-xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-bl-full opacity-50" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <Mail className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-600">Email Marketing</span>
                  </div>
                  <h4 className="text-2xl font-bold text-neutral-900 mb-3 group-hover:text-indigo-600 transition-colors">
                    {article.title}
                  </h4>
                  <p className="text-neutral-600 mb-6">
                    {article.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-500">{article.readTime}</span>
                    <span className="flex items-center gap-2 text-indigo-600 font-semibold group-hover:gap-3 transition-all">
                      Read Guide <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* All Categories */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-8">
            Browse by Topic
          </h3>
          <div className="grid lg:grid-cols-2 gap-x-12 gap-y-8">
            {BLOG_ARTICLES.map((category, idx) => (
              <CategorySection key={idx} category={category} />
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-4 bg-white rounded-full px-6 py-3 border border-neutral-200 shadow-sm">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span className="text-neutral-600">
              More guides coming soon. Join our Discord for updates!
            </span>
            <a
              href="https://discord.gg/J3BCegpX"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
            >
              Join Discord →
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
