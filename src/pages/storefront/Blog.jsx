import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Clock, Calendar, BookOpen, Mail, BarChart3,
  ShoppingCart, Zap, ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Blog article metadata
const BLOG_ARTICLES = {
  'email-marketing-guide': {
    title: 'Complete Guide to Email Marketing for E-commerce',
    description: 'Learn how to create campaigns, automate customer journeys, and boost conversions with email marketing.',
    category: 'Email Marketing',
    categoryIcon: Mail,
    categoryColor: 'bg-blue-100 text-blue-600',
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
    readTime: '8 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'ab-testing-guide': {
    title: 'A/B Testing Guide for E-commerce',
    description: 'Run experiments to optimize your store and increase conversions with data-driven decisions.',
    category: 'Analytics & Testing',
    categoryIcon: BarChart3,
    categoryColor: 'bg-purple-100 text-purple-600',
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
    readTime: '7 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'how-to-configure-amazon-marketplace': {
    title: 'How to Configure Amazon Marketplace',
    description: 'Connect your store to Amazon and sync products, inventory, and orders automatically.',
    category: 'Marketplace Integrations',
    categoryIcon: ShoppingCart,
    categoryColor: 'bg-green-100 text-green-600',
    readTime: '6 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'how-to-configure-ebay-marketplace': {
    title: 'How to Configure eBay Marketplace',
    description: 'List products on eBay and manage orders from your DainoStore dashboard.',
    category: 'Marketplace Integrations',
    categoryIcon: ShoppingCart,
    categoryColor: 'bg-green-100 text-green-600',
    readTime: '6 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'understanding-background-jobs-queue': {
    title: 'Understanding Background Jobs & Queue System',
    description: 'How background jobs work and how to monitor task processing in your store.',
    category: 'Developer Guides',
    categoryIcon: Clock,
    categoryColor: 'bg-orange-100 text-orange-600',
    readTime: '5 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  },
  'plugin-developer-job-scheduler-guide': {
    title: 'Plugin Developer: Job Scheduler Guide',
    description: 'Create scheduled tasks and background jobs for your custom plugins.',
    category: 'Developer Guides',
    categoryIcon: Zap,
    categoryColor: 'bg-orange-100 text-orange-600',
    readTime: '8 min read',
    date: 'December 2024',
    author: 'DainoStore Team'
  }
};

// Map slugs to content file paths (served from public/blog)
const CONTENT_PATHS = {
  'email-marketing-guide': '/blog/email-marketing-guide.md',
  'abandoned-cart-recovery': '/blog/abandoned-cart-recovery.md',
  'ab-testing-guide': '/blog/ab-testing-guide.md',
  'heatmaps-guide': '/blog/heatmaps-guide.md',
  'how-to-configure-amazon-marketplace': '/blog/how-to-configure-amazon-marketplace.md',
  'how-to-configure-ebay-marketplace': '/blog/how-to-configure-ebay-marketplace.md',
  'understanding-background-jobs-queue': '/blog/understanding-background-jobs-queue.md',
  'plugin-developer-job-scheduler-guide': '/blog/plugin-developer-job-scheduler-guide.md'
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
  const articles = Object.entries(BLOG_ARTICLES).map(([slug, meta]) => ({
    slug,
    ...meta
  }));

  // Group by category
  const categories = articles.reduce((acc, article) => {
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

  return (
    <div className="min-h-screen bg-neutral-50">
      <BlogHeader />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
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

          {Object.values(categories).map((category, idx) => {
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
          })}
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

            <div className="flex items-center gap-6 text-sm text-neutral-500">
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
          </motion.header>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="prose prose-lg prose-neutral max-w-none
              prose-headings:font-bold prose-headings:text-neutral-900
              prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
              prose-p:text-neutral-700 prose-p:leading-relaxed
              prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
              prose-code:bg-neutral-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-neutral-900 prose-pre:text-neutral-100
              prose-table:border prose-th:bg-neutral-100 prose-th:p-3 prose-td:p-3 prose-td:border
              prose-img:rounded-lg prose-img:shadow-lg
            "
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
