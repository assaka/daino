/**
 * Plugin How-To Dialog
 * Wiki-style guide with sidebar navigation - displays one section at a time
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Rocket,
  Box,
  Code,
  Database,
  Clock,
  Zap,
  FileJson,
  Settings,
  AlertCircle,
  Puzzle,
  Wrench,
  FolderCode,
  Activity
} from 'lucide-react';

const CodeBlock = ({ code, title }) => (
  <div className="bg-gray-900 rounded-lg overflow-hidden my-3">
    {title && (
      <div className="bg-gray-800 px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700">
        {title}
      </div>
    )}
    <pre className="p-3 text-xs text-gray-100 overflow-x-auto">
      <code>{code}</code>
    </pre>
  </div>
);

const sections = [
  { id: 'start', label: 'Getting Started', icon: Rocket },
  { id: 'widgets', label: 'Widgets', icon: Box },
  { id: 'admin', label: 'Admin Pages', icon: Settings },
  { id: 'controllers', label: 'Controllers', icon: Code },
  { id: 'migrations', label: 'Migrations', icon: Database },
  { id: 'components', label: 'Components', icon: Puzzle },
  { id: 'services', label: 'Services', icon: Wrench },
  { id: 'utils', label: 'Utilities', icon: FolderCode },
  { id: 'hooks', label: 'Hooks', icon: Zap },
  { id: 'events', label: 'Events', icon: Activity },
  { id: 'cron', label: 'Cron Jobs', icon: Clock },
  { id: 'manifest', label: 'Manifest', icon: FileJson },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
];

const PluginHowToDialog = ({ open, onOpenChange }) => {
  const [activeSection, setActiveSection] = useState('start');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex h-[85vh]">
          {/* Sidebar Navigation */}
          <div className="w-56 border-r bg-gray-50 shrink-0 overflow-y-auto">
            <div className="p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Plugin Guide
              </h2>
            </div>
            <nav className="p-2">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                    activeSection === id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content - Single Section Display */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">

              {/* GETTING STARTED */}
              {activeSection === 'start' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Rocket className="w-6 h-6 text-blue-600" />
                    Getting Started
                  </h2>

                  <h3 className="text-lg font-semibold mt-6 mb-3">How to Create a Plugin</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">1</div>
                      <div>
                        <p className="font-medium">Open AI Workspace</p>
                        <p className="text-sm text-gray-600">Navigate to <code className="bg-gray-100 px-1 rounded">/ai-workspace</code> in your browser</p>
                        <p className="text-sm text-gray-600">Click <strong>&quot;Plugins&quot;</strong> in the top navigation bar</p>
                        <p className="text-sm text-gray-600">Click <strong>&quot;Create New Plugin&quot;</strong> button to start a new plugin project</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">2</div>
                      <div>
                        <p className="font-medium">Describe your plugin to the AI</p>
                        <p className="text-sm text-gray-600">In the chat panel on the left, type what you want to build:</p>
                        <div className="bg-gray-100 rounded p-2 mt-1 text-sm text-gray-700 italic">
                          &quot;Create a live chat plugin with a floating chat button on the storefront and an admin dashboard to view and respond to customer messages&quot;
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Be specific about features, UI placement, and functionality you need.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">3</div>
                      <div>
                        <p className="font-medium">AI generates the files</p>
                        <p className="text-sm text-gray-600">The AI will create multiple file types in the file tree on the right:</p>
                        <ul className="text-sm text-gray-600 list-disc list-inside mt-1 space-y-0.5">
                          <li><strong>Widgets</strong> - UI components for the storefront (chat button, popups)</li>
                          <li><strong>Admin Pages</strong> - Dashboard pages for store owners</li>
                          <li><strong>Controllers</strong> - API endpoints for data operations</li>
                          <li><strong>Migrations</strong> - Database table definitions</li>
                        </ul>
                        <p className="text-sm text-gray-500 mt-1">Click on any file in the tree to view and edit its code.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">4</div>
                      <div>
                        <p className="font-medium">Run database migrations</p>
                        <p className="text-sm text-gray-600">If your plugin has migrations (database tables):</p>
                        <ol className="text-sm text-gray-600 list-decimal list-inside mt-1 space-y-0.5">
                          <li>Look in the file tree for migration files (usually under <code className="bg-gray-100 px-1 rounded">migrations/</code>)</li>
                          <li>Click the <strong>database icon</strong> <Database className="w-3.5 h-3.5 inline text-orange-600" /> next to the migration file</li>
                          <li>Click <strong>&quot;Run Migration&quot;</strong> in the dropdown menu</li>
                          <li>Wait for the green checkmark indicating success</li>
                        </ol>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">5</div>
                      <div>
                        <p className="font-medium">Save and publish your plugin</p>
                        <p className="text-sm text-gray-600">Click the <strong>&quot;Save Plugin&quot;</strong> button in the top right corner</p>
                        <p className="text-sm text-gray-600">Your plugin is now installed and active on your store!</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                    <h4 className="font-medium text-green-900 mb-2">Tips for Better Results</h4>
                    <ul className="text-green-800 text-sm space-y-1">
                      <li>Be specific: &quot;floating chat button in bottom-right corner&quot; vs &quot;add chat&quot;</li>
                      <li>Mention all features: &quot;with admin dashboard to view messages and reply&quot;</li>
                      <li>Ask for iterations: &quot;make the button blue&quot; or &quot;add sound notifications&quot;</li>
                    </ul>
                  </div>

                  <h3 className="text-lg font-semibold mt-8 mb-3">Plugin File Types</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Box className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">Widgets</span>
                      </div>
                      <p className="text-xs text-gray-600">UI on storefront. Use React.createElement().</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Settings className="w-4 h-4 text-purple-600" />
                        <span className="font-medium">Admin Pages</span>
                      </div>
                      <p className="text-xs text-gray-600">Dashboard UI. Can use JSX.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Code className="w-4 h-4 text-green-600" />
                        <span className="font-medium">Controllers</span>
                      </div>
                      <p className="text-xs text-gray-600">API endpoints. Receive Supabase.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Database className="w-4 h-4 text-orange-600" />
                        <span className="font-medium">Migrations</span>
                      </div>
                      <p className="text-xs text-gray-600">Database tables. Run on install.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-cyan-600" />
                        <span className="font-medium">Hooks</span>
                      </div>
                      <p className="text-xs text-gray-600">Intercept data. Must return value.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-pink-600" />
                        <span className="font-medium">Cron Jobs</span>
                      </div>
                      <p className="text-xs text-gray-600">Scheduled tasks.</p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                    <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Important: Store ID Header
                    </h4>
                    <p className="text-yellow-800 text-sm mb-2">
                      Every API call must include the store ID for tenant isolation:
                    </p>
                    <CodeBlock code={`const getHeaders = () => {
  const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
  return storeId ? { 'x-store-id': storeId } : {};
};

fetch('/api/plugins/my-plugin/exec/data', { headers: getHeaders() });`} />
                  </div>
                </section>
              )}

              {/* WIDGETS */}
              {activeSection === 'widgets' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Box className="w-6 h-6 text-blue-600" />
                    Widgets
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Widgets are React components that display on the storefront. They must use <code className="bg-gray-100 px-1 rounded">React.createElement()</code> syntax (not JSX).
                  </p>

                  <h3 className="text-lg font-semibold mb-3">Widget Categories</h3>
                  <table className="w-full text-sm border-collapse mb-6">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-2 text-left">Category</th>
                        <th className="border p-2 text-left">Where it Shows</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border p-2">
                          <code className="bg-blue-100 text-blue-700 px-1 rounded">support</code>{' '}
                          <code className="bg-blue-100 text-blue-700 px-1 rounded">floating</code>{' '}
                          <code className="bg-blue-100 text-blue-700 px-1 rounded">chat</code>{' '}
                          <code className="bg-blue-100 text-blue-700 px-1 rounded">global</code>
                        </td>
                        <td className="border p-2"><strong>ALL</strong> storefront pages</td>
                      </tr>
                      <tr>
                        <td className="border p-2"><code className="bg-gray-100 px-1 rounded">product</code></td>
                        <td className="border p-2">Product pages only</td>
                      </tr>
                      <tr>
                        <td className="border p-2"><code className="bg-gray-100 px-1 rounded">cart</code></td>
                        <td className="border p-2">Cart page only</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="text-lg font-semibold mb-3">Real Example: Floating Chat Button</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    A complete live chat widget with expandable chat window:
                  </p>
                  <CodeBlock title="widgets/ChatButton.js" code={`function ChatButton({ config = {} }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [sessionId, setSessionId] = React.useState(null);

  const {
    primaryColor = '#3b82f6',
    position = 'right',
    welcomeMessage = 'Hi! How can we help you today?'
  } = config;

  const getHeaders = (json = false) => {
    const headers = {};
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    if (storeId) headers['x-store-id'] = storeId;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  };

  // Initialize chat session
  React.useEffect(() => {
    let stored = localStorage.getItem('chat_session_id');
    if (!stored) {
      stored = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chat_session_id', stored);
    }
    setSessionId(stored);
    setMessages([{ from: 'agent', text: welcomeMessage, time: new Date() }]);
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { from: 'user', text: input, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      await fetch('/api/plugins/live-chat/exec/send', {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ session_id: sessionId, message: input, from: 'customer' })
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const positionStyle = position === 'left' ? { left: 20 } : { right: 20 };

  // Floating button when closed
  if (!isOpen) {
    return React.createElement('button', {
      onClick: () => setIsOpen(true),
      style: {
        position: 'fixed', bottom: 20, ...positionStyle,
        width: 60, height: 60, borderRadius: '50%',
        background: primaryColor, color: 'white', border: 'none',
        cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontSize: 24, zIndex: 9999
      }
    }, '\u{1F4AC}');
  }

  // Chat window when open
  return React.createElement('div', {
    style: {
      position: 'fixed', bottom: 20, ...positionStyle,
      width: 350, height: 450, background: 'white', borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex',
      flexDirection: 'column', zIndex: 9999, overflow: 'hidden'
    }
  },
    // Header
    React.createElement('div', {
      style: { background: primaryColor, color: 'white', padding: '12px 16px',
               display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
    },
      React.createElement('span', { style: { fontWeight: 'bold' } }, 'Chat with us'),
      React.createElement('button', {
        onClick: () => setIsOpen(false),
        style: { background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }
      }, '\u00D7')
    ),
    // Messages
    React.createElement('div', {
      style: { flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }
    },
      messages.map((msg, i) => React.createElement('div', {
        key: i,
        style: {
          padding: '8px 12px', borderRadius: 12, maxWidth: '80%',
          alignSelf: msg.from === 'user' ? 'flex-end' : 'flex-start',
          background: msg.from === 'user' ? primaryColor : '#f1f1f1',
          color: msg.from === 'user' ? 'white' : 'black'
        }
      }, msg.text))
    ),
    // Input
    React.createElement('div', {
      style: { padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }
    },
      React.createElement('input', {
        value: input,
        onChange: (e) => setInput(e.target.value),
        onKeyPress: (e) => e.key === 'Enter' && sendMessage(),
        placeholder: 'Type a message...',
        style: { flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 20 }
      }),
      React.createElement('button', {
        onClick: sendMessage,
        style: { background: primaryColor, color: 'white', border: 'none', borderRadius: 20, padding: '8px 16px', cursor: 'pointer' }
      }, 'Send')
    )
  );
}`} />

                  <h3 className="text-lg font-semibold mt-6 mb-3">Real Example: Announcement Bar</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    A sticky announcement bar at the top of the page:
                  </p>
                  <CodeBlock title="widgets/AnnouncementBar.js" code={`function AnnouncementBar({ config = {} }) {
  const [dismissed, setDismissed] = React.useState(false);

  const {
    message = 'Free shipping on orders over $50!',
    backgroundColor = '#1f2937',
    textColor = '#ffffff',
    linkText = 'Shop Now',
    linkUrl = '/products'
  } = config;

  // Check if previously dismissed
  React.useEffect(() => {
    const dismissedAt = localStorage.getItem('announcement_dismissed');
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
      if (hoursSince < 24) setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('announcement_dismissed', Date.now().toString());
  };

  if (dismissed) return null;

  return React.createElement('div', {
    style: {
      position: 'fixed', top: 0, left: 0, right: 0,
      background: backgroundColor, color: textColor,
      padding: '10px 20px', display: 'flex',
      justifyContent: 'center', alignItems: 'center', gap: 16,
      zIndex: 9998, fontSize: 14
    }
  },
    React.createElement('span', null, message),
    linkText && React.createElement('a', {
      href: linkUrl,
      style: { color: textColor, fontWeight: 'bold', textDecoration: 'underline' }
    }, linkText),
    React.createElement('button', {
      onClick: handleDismiss,
      style: {
        position: 'absolute', right: 16, background: 'none', border: 'none',
        color: textColor, fontSize: 18, cursor: 'pointer', opacity: 0.7
      }
    }, '\u00D7')
  );
}`} />

                  <h3 className="text-lg font-semibold mt-6 mb-3">Real Example: Product Review Stars</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Display star ratings on product pages (category: product):
                  </p>
                  <CodeBlock title="widgets/ProductRating.js" code={`function ProductRating({ config = {}, slotData = {} }) {
  const [rating, setRating] = React.useState(null);
  const [reviewCount, setReviewCount] = React.useState(0);

  const { starColor = '#fbbf24', showCount = true } = config;
  const { productId } = slotData;

  const getHeaders = () => {
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    return storeId ? { 'x-store-id': storeId } : {};
  };

  React.useEffect(() => {
    if (!productId) return;

    fetch('/api/plugins/reviews/exec/rating?product_id=' + productId, { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setRating(data.averageRating);
          setReviewCount(data.totalReviews);
        }
      })
      .catch(err => console.error('Failed to load rating:', err));
  }, [productId]);

  if (rating === null) return null;

  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }
  },
    React.createElement('div', { style: { display: 'flex', gap: 2 } },
      ...Array(fullStars).fill(null).map((_, i) =>
        React.createElement('span', { key: 'full-' + i, style: { color: starColor, fontSize: 18 } }, '\u2605')
      ),
      hasHalf && React.createElement('span', { key: 'half', style: { color: starColor, fontSize: 18 } }, '\u2605'),
      ...Array(emptyStars).fill(null).map((_, i) =>
        React.createElement('span', { key: 'empty-' + i, style: { color: '#ddd', fontSize: 18 } }, '\u2605')
      )
    ),
    showCount && React.createElement('span', { style: { color: '#666', fontSize: 14 } }, '(' + reviewCount + ' reviews)')
  );
}`} />

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                    <h4 className="font-medium text-yellow-900 mb-2">Important Widget Rules</h4>
                    <ul className="text-yellow-800 text-sm space-y-1">
                      <li><strong>No JSX</strong> - Must use <code className="bg-gray-100 px-1 rounded">React.createElement()</code></li>
                      <li><strong>Store ID header</strong> - Include in all API calls</li>
                      <li><strong>Category matters</strong> - Use &quot;floating&quot;, &quot;support&quot;, &quot;chat&quot;, or &quot;global&quot; for all pages</li>
                    </ul>
                  </div>
                </section>
              )}

              {/* ADMIN PAGES */}
              {activeSection === 'admin' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Settings className="w-6 h-6 text-purple-600" />
                    Admin Pages
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Admin pages are dashboard UI for store owners. They appear in the admin sidebar when you configure <code className="bg-gray-100 px-1 rounded">adminNavigation</code> in your <strong>manifest.json</strong> (see <button onClick={() => setActiveSection('manifest')} className="text-blue-600 hover:underline">Manifest section</button>).
                  </p>

                  <h3 className="text-lg font-semibold mb-3">Admin Page Code Format</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Admin pages <strong>can use JSX</strong> syntax (unlike widgets). The code is transformed on the backend.
                  </p>

                  <h3 className="text-lg font-semibold mt-6 mb-3">Available Imports</h3>
                  <CodeBlock code={`// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Icons (any from lucide-react)
import { MessageCircle, Send, Settings } from 'lucide-react';`} />

                  <CodeBlock title="Example Admin Page" code={`import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';

export default function ChatDashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const headers = {};
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    if (storeId) headers['x-store-id'] = storeId;
    return headers;
  };

  useEffect(() => {
    fetch('/api/plugins/my-chat/exec/sessions', { headers: getHeaders() })
      .then(r => r.json())
      .then(data => { if (data.success) setSessions(data.sessions); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p>Loading...</p> : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="p-3 border rounded flex justify-between">
                  <span>{s.customer_name || 'Anonymous'}</span>
                  <Badge>{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}`} />
                </section>
              )}

              {/* CONTROLLERS */}
              {activeSection === 'controllers' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Code className="w-6 h-6 text-green-600" />
                    Controllers
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Controllers are API endpoints that run on the server. They receive <code className="bg-gray-100 px-1 rounded">{'{ supabase }'}</code> for database access.
                  </p>

                  <h3 className="text-lg font-semibold mb-3">Endpoint URL Pattern</h3>
                  <div className="bg-gray-100 rounded p-3 font-mono text-sm mb-4">
                    /api/plugins/<span className="text-blue-600">{'{plugin-slug}'}</span>/exec/<span className="text-green-600">{'{controller-path}'}</span>
                  </div>

                  <h3 className="text-lg font-semibold mb-3">Controller Function Signature</h3>
                  <CodeBlock code={`async function controllerName(req, res, { supabase }) {
  // req.body   - POST/PUT request body (parsed JSON)
  // req.query  - URL query params (?status=active)
  // req.headers - HTTP headers
  // supabase - Supabase client for database
  // res.json() - Send JSON response
  // res.status(400).json() - Set status code
}`} />

                  <h3 className="text-lg font-semibold mt-6 mb-3">Supabase Query Reference</h3>
                  <CodeBlock code={`// SELECT with filters
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(10);

// INSERT (returns inserted row)
const { data, error } = await supabase
  .from('table')
  .insert({ name: 'Test', value: 123 })
  .select()
  .single();

// UPDATE
await supabase.from('table').update({ name: 'Updated' }).eq('id', id);

// DELETE
await supabase.from('table').delete().eq('id', id);`} />
                </section>
              )}

              {/* MIGRATIONS */}
              {activeSection === 'migrations' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Database className="w-6 h-6 text-orange-600" />
                    Migrations
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Migrations are SQL scripts that create database tables for your plugin.
                  </p>

                  <h3 className="text-lg font-semibold mb-3">How to Run Migrations Manually</h3>
                  <div className="border rounded-lg p-4 mb-6">
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                      <li><strong>Find the migration file</strong> in the file tree</li>
                      <li><strong>Click the database icon</strong> <Database className="w-4 h-4 inline text-orange-600" /> next to the file</li>
                      <li><strong>Select &quot;Run Migration&quot;</strong> from the dropdown</li>
                      <li><strong>Wait for completion</strong> - green checkmark = success</li>
                    </ol>
                  </div>

                  <h3 className="text-lg font-semibold mb-3">Migration SQL Example</h3>
                  <CodeBlock code={`-- Always use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  from_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);`} />

                  <h3 className="text-lg font-semibold mt-6 mb-3">Common Column Types</h3>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr><td className="border p-2 w-1/3"><code>UUID</code></td><td className="border p-2">Primary keys, IDs</td></tr>
                      <tr><td className="border p-2"><code>VARCHAR(n)</code></td><td className="border p-2">Short text (names, emails)</td></tr>
                      <tr><td className="border p-2"><code>TEXT</code></td><td className="border p-2">Long text (messages)</td></tr>
                      <tr><td className="border p-2"><code>JSONB</code></td><td className="border p-2">JSON data (configs)</td></tr>
                      <tr><td className="border p-2"><code>TIMESTAMP WITH TIME ZONE</code></td><td className="border p-2">Dates/times</td></tr>
                    </tbody>
                  </table>
                </section>
              )}

              {/* COMPONENTS */}
              {activeSection === 'components' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Puzzle className="w-6 h-6 text-indigo-600" />
                    Components
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Components are reusable UI pieces for hooks, admin pages, or widgets.
                  </p>

                  <h3 className="text-lg font-semibold mb-3">Component Example</h3>
                  <CodeBlock title="components/WelcomeBanner.js" code={`function WelcomeBanner(config) {
  const { title, message, backgroundColor } = config;

  return \`
    <div style="background: \${backgroundColor || '#3b82f6'}; color: white; padding: 16px; border-radius: 8px;">
      <h2 style="margin: 0 0 8px 0;">\${title || 'Welcome!'}</h2>
      <p style="margin: 0;">\${message || 'Thanks for visiting.'}</p>
    </div>
  \`;
}

module.exports = WelcomeBanner;`} />

                  <h3 className="text-lg font-semibold mt-6 mb-3">Using in Hooks</h3>
                  <CodeBlock code={`class MyPlugin {
  onAppReady(context) {
    const WelcomeBanner = require('./components/WelcomeBanner');
    const bannerHtml = WelcomeBanner({ title: this.config.bannerTitle });

    const container = document.createElement('div');
    container.innerHTML = bannerHtml;
    document.body.prepend(container);

    return context;
  }
}`} />
                </section>
              )}

              {/* SERVICES */}
              {activeSection === 'services' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Wrench className="w-6 h-6 text-amber-600" />
                    Services
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Services are classes that handle business logic and data operations.
                  </p>

                  <CodeBlock title="services/ChatService.js" code={`class ChatService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createSession(customerEmail) {
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const { data, error } = await this.supabase
      .from('chat_sessions')
      .insert({ session_id: sessionId, customer_email: customerEmail, status: 'active' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getActiveChats() {
    const { data, error } = await this.supabase
      .from('chat_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

module.exports = ChatService;`} />
                </section>
              )}

              {/* UTILITIES */}
              {activeSection === 'utils' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <FolderCode className="w-6 h-6 text-teal-600" />
                    Utilities
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Utilities are pure helper functions with no side effects.
                  </p>

                  <CodeBlock title="utils/format.js" code={`const formatUtils = {
  formatPrice(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  },

  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  },

  timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
  }
};

module.exports = formatUtils;`} />
                </section>
              )}

              {/* HOOKS */}
              {activeSection === 'hooks' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-cyan-600" />
                    Hooks
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Hooks are <strong>filter functions</strong> that intercept and modify data. They <strong>must return a value</strong>.
                  </p>

                  <h3 className="text-lg font-semibold mb-3">Available Hooks</h3>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {['app.ready', 'app.init', 'cart.processLoadedItems', 'checkout.processLoadedItems', 'page.render'].map(hook => (
                      <code key={hook} className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-sm">{hook}</code>
                    ))}
                  </div>

                  <CodeBlock title="cart.processLoadedItems" code={`function onCartLoaded(items, context) {
  const modifiedItems = items.map(item => ({
    ...item,
    customBadge: item.quantity > 5 ? 'Bulk Order!' : null
  }));

  // IMPORTANT: Hooks must return a value
  return modifiedItems;
}`} />

                  <CodeBlock title="app.ready" code={`function onAppReady(context) {
  const banner = document.createElement('div');
  banner.innerHTML = '<div style="background: blue; color: white; padding: 10px;">Welcome!</div>';
  document.body.prepend(banner);

  return context;
}`} />
                </section>
              )}

              {/* EVENTS */}
              {activeSection === 'events' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-rose-600" />
                    Events & Lifecycle
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Events are <strong>fire-and-forget</strong> - they don&apos;t return values.
                  </p>

                  <h3 className="text-lg font-semibold mb-3">Plugin Lifecycle Events</h3>
                  <div className="space-y-3 mb-6">
                    <div className="border rounded-lg p-3">
                      <div className="font-medium text-rose-700">install()</div>
                      <p className="text-sm text-gray-600">Called once when plugin is first installed.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="font-medium text-green-700">onEnable()</div>
                      <p className="text-sm text-gray-600">Called when plugin is enabled/activated.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="font-medium text-orange-700">onDisable()</div>
                      <p className="text-sm text-gray-600">Called when plugin is disabled.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="font-medium text-blue-700">onConfigUpdate(newConfig, oldConfig)</div>
                      <p className="text-sm text-gray-600">Called when settings change.</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="font-medium text-red-700">uninstall()</div>
                      <p className="text-sm text-gray-600">Called when plugin is uninstalled.</p>
                    </div>
                  </div>
                </section>
              )}

              {/* CRON JOBS */}
              {activeSection === 'cron' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-pink-600" />
                    Cron Jobs
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Scheduled tasks that run automatically at specified intervals.
                  </p>

                  <h3 className="text-lg font-semibold mb-3">Cron Schedule Format</h3>
                  <div className="grid grid-cols-4 gap-2 text-sm mb-6">
                    <div className="bg-pink-50 rounded p-2 text-center">
                      <code className="text-pink-700">*/15 * * * *</code>
                      <div className="text-pink-600 text-xs">Every 15 min</div>
                    </div>
                    <div className="bg-pink-50 rounded p-2 text-center">
                      <code className="text-pink-700">0 * * * *</code>
                      <div className="text-pink-600 text-xs">Every hour</div>
                    </div>
                    <div className="bg-pink-50 rounded p-2 text-center">
                      <code className="text-pink-700">0 9 * * *</code>
                      <div className="text-pink-600 text-xs">Daily at 9 AM</div>
                    </div>
                    <div className="bg-pink-50 rounded p-2 text-center">
                      <code className="text-pink-700">0 0 * * 1</code>
                      <div className="text-pink-600 text-xs">Monday midnight</div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-3">Real Example: Abandoned Cart Recovery</h3>
                  <CodeBlock title="Runs every 2 hours (0 */2 * * *)" code={`async function abandonedCartReminder(context) {
  const { supabase } = context;

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: abandonedCarts } = await supabase
    .from('carts')
    .select('id, customer_email, items, total')
    .eq('status', 'active')
    .eq('reminder_sent', false)
    .lt('updated_at', twoHoursAgo)
    .not('customer_email', 'is', null);

  for (const cart of abandonedCarts || []) {
    await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: cart.customer_email,
        template: 'abandoned-cart',
        data: { items: cart.items, total: cart.total }
      })
    });

    await supabase.from('carts').update({ reminder_sent: true }).eq('id', cart.id);
  }
}`} />
                </section>
              )}

              {/* MANIFEST */}
              {activeSection === 'manifest' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <FileJson className="w-6 h-6 text-yellow-600" />
                    Manifest
                  </h2>

                  <p className="text-gray-600 mb-4">
                    Defines your plugin&apos;s metadata, configuration, and permissions.
                  </p>

                  <CodeBlock title="manifest.json" code={`{
  "name": "Live Chat",
  "slug": "live-chat",
  "version": "1.0.0",
  "description": "Real-time customer support chat",
  "category": "support",

  "adminNavigation": {
    "enabled": true,
    "label": "Live Chat",
    "icon": "MessageCircle",
    "route": "/admin/plugins/live-chat/dashboard",
    "order": 100
  },

  "configSchema": {
    "properties": {
      "primaryColor": { "type": "string", "default": "#3b82f6", "title": "Button Color" },
      "welcomeMessage": { "type": "string", "default": "Hi! How can we help?", "title": "Welcome Message" },
      "position": { "type": "string", "enum": ["left", "right"], "default": "right", "title": "Position" }
    }
  },

  "permissions": ["customers:read", "orders:read"]
}`} />

                  <h3 className="text-lg font-semibold mt-6 mb-3">Available Icons</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Use any icon from <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">lucide.dev/icons</a>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['MessageCircle', 'Settings', 'Star', 'Package', 'ShoppingCart', 'Users', 'BarChart', 'Mail', 'Bell'].map(icon => (
                      <code key={icon} className="bg-gray-100 px-2 py-1 rounded text-sm">{icon}</code>
                    ))}
                  </div>
                </section>
              )}

              {/* TROUBLESHOOTING */}
              {activeSection === 'troubleshooting' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    Troubleshooting
                  </h2>

                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 mb-2">Widget not showing on storefront</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li><strong>Check category</strong> - Must be support, floating, chat, or global</li>
                        <li><strong>Check is_enabled</strong> - Widget must have is_enabled: true</li>
                        <li><strong>Check plugin status</strong> - Plugin must be active</li>
                      </ul>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 mb-2">401 Unauthorized error</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li><strong>Missing store ID</strong> - Add x-store-id header to all fetch requests</li>
                      </ul>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 mb-2">Widget shows JSX/createElement error</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li><strong>Widgets cannot use JSX</strong> - Use React.createElement() instead</li>
                      </ul>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 mb-2">Admin page shows 404</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li><strong>Route mismatch</strong> - adminNavigation.route must match adminPages[].route</li>
                      </ul>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 mb-2">Controller &quot;supabase is not defined&quot;</h4>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>Controller must receive {'{ supabase }'} as third parameter</li>
                        <li>Correct: <code className="bg-green-100 px-1 rounded">async function handler(req, res, {'{ supabase }'})</code></li>
                      </ul>
                    </div>
                  </div>
                </section>
              )}

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PluginHowToDialog;
