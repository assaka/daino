/**
 * Plugin How-To Dialog
 * Wiki-style guide with sidebar navigation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  ChevronRight
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
  { id: 'hooks', label: 'Hooks', icon: Zap },
  { id: 'cron', label: 'Cron Jobs', icon: Clock },
  { id: 'manifest', label: 'Manifest', icon: FileJson },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle },
];

const PluginHowToDialog = ({ open, onOpenChange }) => {
  const [activeSection, setActiveSection] = useState('start');
  const contentRef = useRef(null);

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(`section-${id}`);
    if (element && contentRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Update active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const scrollTop = contentRef.current.scrollTop;
      let current = 'start';

      sections.forEach(({ id }) => {
        const element = document.getElementById(`section-${id}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          const containerRect = contentRef.current.getBoundingClientRect();
          if (rect.top <= containerRect.top + 100) {
            current = id;
          }
        }
      });

      setActiveSection(current);
    };

    const content = contentRef.current;
    if (content) {
      content.addEventListener('scroll', handleScroll);
      return () => content.removeEventListener('scroll', handleScroll);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex h-[85vh]">
          {/* Sidebar Navigation */}
          <div className="w-56 border-r bg-gray-50 shrink-0">
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
                  onClick={() => scrollToSection(id)}
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

          {/* Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-12">

              {/* GETTING STARTED */}
              <section id="section-start">
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
                      <p className="text-sm text-gray-600">Click <strong>"Plugins"</strong> in the top navigation bar</p>
                      <p className="text-sm text-gray-600">Click <strong>"Create New Plugin"</strong> button to start a new plugin project</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">2</div>
                    <div>
                      <p className="font-medium">Describe your plugin to the AI</p>
                      <p className="text-sm text-gray-600">In the chat panel on the left, type what you want to build:</p>
                      <div className="bg-gray-100 rounded p-2 mt-1 text-sm text-gray-700 italic">
                        "Create a live chat plugin with a floating chat button on the storefront and an admin dashboard to view and respond to customer messages"
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
                        <li>Click <strong>"Run Migration"</strong> in the dropdown menu</li>
                        <li>Wait for the green checkmark <span className="text-green-600">✅</span> indicating success</li>
                      </ol>
                      <p className="text-sm text-gray-500 mt-1">Migrations create the database tables your plugin needs to store data.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">5</div>
                    <div>
                      <p className="font-medium">Save and publish your plugin</p>
                      <p className="text-sm text-gray-600">Click the <strong>"Save Plugin"</strong> button in the top right corner</p>
                      <p className="text-sm text-gray-600">Your plugin is now installed and active on your store!</p>
                      <p className="text-sm text-gray-500 mt-1">Go to <code className="bg-gray-100 px-1 rounded">/admin/plugins</code> to manage your installed plugins.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-green-900 mb-2">Tips for Better Results</h4>
                  <ul className="text-green-800 text-sm space-y-1">
                    <li>• Be specific: "floating chat button in bottom-right corner" vs "add chat"</li>
                    <li>• Mention all features: "with admin dashboard to view messages and reply"</li>
                    <li>• Ask for iterations: "make the button blue" or "add sound notifications"</li>
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

                <h3 className="text-lg font-semibold mt-8 mb-3">How Components Interact</h3>
                <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                  <pre>{`┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    STOREFRONT   │         │     SERVER      │         │   ADMIN PANEL   │
│                 │         │                 │         │                 │
│  Widget         │──────▶  │  Controller     │  ◀──────│  Admin Page     │
│  (customer UI)  │ fetch() │  (API endpoint) │ fetch() │  (owner UI)     │
└─────────────────┘         └────────┬────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │    DATABASE     │
                            │   (Supabase)    │
                            │                 │
                            │ Tables created  │
                            │ by Migrations   │
                            └─────────────────┘`}</pre>
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

              {/* WIDGETS */}
              <section id="section-widgets" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Box className="w-6 h-6 text-blue-600" />
                  Widgets
                </h2>

                <p className="text-gray-600 mb-4">
                  Widgets are React components that display on the storefront. They're loaded by <code className="bg-gray-100 px-1 rounded">GlobalPluginWidgets</code> based on their category.
                </p>

                <h3 className="text-lg font-semibold mt-6 mb-3">Widget Categories</h3>
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

                <h3 className="text-lg font-semibold mb-3">How Widgets Appear on the Storefront</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm mb-6">
                  <p className="text-gray-700 mb-3">
                    The <code className="bg-gray-100 px-1 rounded">GlobalPluginWidgets</code> component automatically loads and displays widgets on every storefront page. Here's how it works:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      <strong>Page loads</strong> - Customer visits your store
                    </li>
                    <li>
                      <strong>Fetches active plugins</strong> - Calls <code className="bg-gray-100 px-1 rounded">/api/plugins/active</code> to get all installed plugins
                    </li>
                    <li>
                      <strong>Filters by category</strong> - Only shows widgets with category: <code className="bg-blue-100 text-blue-700 px-1 rounded">support</code>, <code className="bg-blue-100 text-blue-700 px-1 rounded">floating</code>, <code className="bg-blue-100 text-blue-700 px-1 rounded">chat</code>, or <code className="bg-blue-100 text-blue-700 px-1 rounded">global</code>
                    </li>
                    <li>
                      <strong>Renders widgets</strong> - Each matching widget is rendered using <code className="bg-gray-100 px-1 rounded">PluginWidgetRenderer</code>
                    </li>
                  </ol>
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                    <strong>Important:</strong> If your widget doesn't appear, check that its category is one of the global categories listed above. Widgets with category "product" only show on product pages.
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Widget Code Format</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Widgets must use <code className="bg-gray-100 px-1 rounded">React.createElement()</code> syntax (not JSX).
                </p>
                <CodeBlock title="Example Widget" code={`function ChatWidget({ config = {} }) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const { primaryColor = '#3b82f6' } = config;

  // REQUIRED: Include store ID header
  const getHeaders = () => {
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    return storeId ? { 'x-store-id': storeId } : {};
  };

  // Fetch messages from controller
  const loadMessages = async () => {
    const res = await fetch('/api/plugins/my-chat/exec/messages', {
      headers: getHeaders()
    });
    const data = await res.json();
    if (data.success) setMessages(data.messages);
  };

  React.useEffect(() => { loadMessages(); }, []);

  // Use React.createElement, NOT JSX
  return React.createElement('div', {
    style: { position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }
  },
    React.createElement('button', {
      onClick: () => setOpen(!open),
      style: { background: primaryColor, color: 'white', padding: 16, borderRadius: '50%' }
    }, '💬')
  );
}`} />
              </section>

              {/* ADMIN PAGES */}
              <section id="section-admin" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Settings className="w-6 h-6 text-purple-600" />
                  Admin Pages
                </h2>

                <p className="text-gray-600 mb-4">
                  Admin pages are dashboard UI for store owners. They appear in the admin sidebar when you configure <code className="bg-gray-100 px-1 rounded">adminNavigation</code> in your plugin's <strong>manifest.json</strong> (see <button onClick={() => scrollToSection('manifest')} className="text-blue-600 hover:underline">Manifest section</button>).
                </p>

                <h3 className="text-lg font-semibold mb-3">How Admin Pages Work</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm mb-6">
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li><strong>Define the page</strong> in your plugin's <code className="bg-gray-100 px-1 rounded">adminPages</code> array with a route and component code</li>
                    <li><strong>Configure navigation</strong> in <code className="bg-gray-100 px-1 rounded">manifest.json</code> → <code className="bg-gray-100 px-1 rounded">adminNavigation</code> to add a sidebar menu item</li>
                    <li><strong>Match routes</strong> - The <code className="bg-gray-100 px-1 rounded">adminNavigation.route</code> must match one of your <code className="bg-gray-100 px-1 rounded">adminPages[].route</code></li>
                    <li>When store owners click the menu item, your admin page component renders</li>
                  </ol>
                </div>

                <h3 className="text-lg font-semibold mb-3">Admin Page Code Format</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Admin pages <strong>can use JSX</strong> syntax (unlike widgets). The code is transformed on the backend when the plugin is saved.
                </p>

                <h3 className="text-lg font-semibold mt-6 mb-3">Available Imports</h3>
                <CodeBlock code={`// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

// Icons (any from lucide-react)
import { MessageCircle, Send, Settings, Check, X, Trash2 } from 'lucide-react';`} />

                <CodeBlock title="Example Admin Page" code={`import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';

export default function ChatDashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = (json = false) => {
    const headers = {};
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    if (storeId) headers['x-store-id'] = storeId;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  };

  useEffect(() => {
    fetch('/api/plugins/my-chat/exec/sessions', { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.success) setSessions(data.sessions);
      })
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

              {/* CONTROLLERS */}
              <section id="section-controllers" className="pt-6 border-t">
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
  // req.params - URL path params (:id)
  // req.headers - HTTP headers

  // supabase - Supabase client for database

  // res.json() - Send JSON response
  // res.status(400).json() - Set status code
}`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Supabase Query Reference</h3>
                <CodeBlock code={`// SELECT all
const { data, error } = await supabase.from('table').select('*');

// SELECT with filters
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
await supabase.from('table').delete().eq('id', id);

// COUNT
const { count } = await supabase
  .from('table')
  .select('*', { count: 'exact', head: true });`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Complete Controller Example</h3>
                <CodeBlock code={`async function getMessages(req, res, { supabase }) {
  const { session_id } = req.query;

  try {
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function sendMessage(req, res, { supabase }) {
  const { session_id, message, from } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message required' });
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ session_id, message, from_type: from })
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  return res.json({ success: true, message: data });
}`} />
              </section>

              {/* MIGRATIONS */}
              <section id="section-migrations" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Database className="w-6 h-6 text-orange-600" />
                  Migrations
                </h2>

                <p className="text-gray-600 mb-4">
                  Migrations are SQL scripts that create database tables for your plugin. They define the structure where your plugin stores its data (chat messages, sessions, settings, etc.).
                </p>

                <h3 className="text-lg font-semibold mb-3">When Migrations Run</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm mb-6">
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600 shrink-0">Automatic:</span>
                      <span>When a store owner installs your plugin from the marketplace, migrations run automatically before the plugin activates.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-purple-600 shrink-0">Manual:</span>
                      <span>During development in AI Workspace, you need to run migrations manually to create the tables.</span>
                    </li>
                  </ul>
                </div>

                <h3 className="text-lg font-semibold mb-3">How to Run Migrations Manually</h3>
                <div className="border rounded-lg p-4 mb-6">
                  <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                    <li>
                      <strong>Find the migration file</strong> in the file tree (right side of AI Workspace)
                      <p className="text-gray-500 ml-5 mt-1">Usually located at <code className="bg-gray-100 px-1 rounded">migrations/001_create_tables.sql</code></p>
                    </li>
                    <li>
                      <strong>Click the database icon</strong> <Database className="w-4 h-4 inline text-orange-600" /> that appears next to the migration file when you hover over it
                    </li>
                    <li>
                      <strong>Select "Run Migration"</strong> from the dropdown menu
                    </li>
                    <li>
                      <strong>Wait for completion</strong> - A loading spinner will show while the migration runs
                      <ul className="text-gray-500 ml-5 mt-1 space-y-0.5">
                        <li>• <span className="text-green-600">✅</span> Green checkmark = Migration successful, tables created</li>
                        <li>• <span className="text-red-500">❌</span> Red X = Migration failed, check console for errors</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <h3 className="text-lg font-semibold mb-3">Migration Status Indicators</h3>
                <div className="grid grid-cols-3 gap-4 text-sm mb-6">
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl mb-1">✅</div>
                    <div className="font-medium text-green-700">Applied</div>
                    <div className="text-xs text-gray-500">Tables created successfully</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl mb-1">⏳</div>
                    <div className="font-medium text-orange-600">Pending</div>
                    <div className="text-xs text-gray-500">Needs to be run</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl mb-1">❌</div>
                    <div className="font-medium text-red-600">Failed</div>
                    <div className="text-xs text-gray-500">Error occurred - check logs</div>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Migration SQL Example</h3>
                <CodeBlock code={`-- Always use IF NOT EXISTS to prevent errors on re-run
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  from_type VARCHAR(20) NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Common Column Types</h3>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr><td className="border p-2 w-1/3"><code>UUID</code></td><td className="border p-2">Primary keys, IDs</td></tr>
                    <tr><td className="border p-2"><code>VARCHAR(n)</code></td><td className="border p-2">Short text (names, emails, status)</td></tr>
                    <tr><td className="border p-2"><code>TEXT</code></td><td className="border p-2">Long text (messages, descriptions)</td></tr>
                    <tr><td className="border p-2"><code>JSONB</code></td><td className="border p-2">JSON data (configs, metadata)</td></tr>
                    <tr><td className="border p-2"><code>BOOLEAN</code></td><td className="border p-2">True/false flags</td></tr>
                    <tr><td className="border p-2"><code>TIMESTAMP WITH TIME ZONE</code></td><td className="border p-2">Dates/times</td></tr>
                  </tbody>
                </table>
              </section>

              {/* HOOKS */}
              <section id="section-hooks" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-cyan-600" />
                  Hooks
                </h2>

                <p className="text-gray-600 mb-4">
                  Hooks are <strong>filter functions</strong> that intercept and modify data at specific points. They receive data, can transform it, and <strong>must return a value</strong>.
                </p>

                <h3 className="text-lg font-semibold mb-3">Available Hooks</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {['app.ready', 'app.init', 'cart.processLoadedItems', 'checkout.processLoadedItems', 'page.render', 'page.onRender', 'product.processInventory', 'order.processShipment', 'frontend.render'].map(hook => (
                    <code key={hook} className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-sm">{hook}</code>
                  ))}
                </div>

                <h3 className="text-lg font-semibold mb-3">Hook Examples</h3>
                <CodeBlock title="cart.processLoadedItems - Modify cart items" code={`function onCartLoaded(items, context) {
  // Add a custom field to each item
  const modifiedItems = items.map(item => ({
    ...item,
    customBadge: item.quantity > 5 ? 'Bulk Order!' : null
  }));

  // IMPORTANT: Hooks must return a value
  return modifiedItems;
}`} />

                <CodeBlock title="app.ready - Initialize when app loads" code={`function onAppReady(context) {
  // Add a welcome banner
  const banner = document.createElement('div');
  banner.innerHTML = '<div style="background: blue; color: white; padding: 10px;">Welcome!</div>';
  document.body.prepend(banner);

  return context;
}`} />

                <CodeBlock title="page.render - Inject content into pages" code={`function onPageRender(context) {
  const { page } = context;

  // Only inject on product pages
  if (!page.path.includes('/product/')) {
    return context;
  }

  // Add custom script
  if (!context.bodyScripts) context.bodyScripts = [];
  context.bodyScripts.push('<script>console.log("Product page loaded")</script>');

  return context;
}`} />

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-blue-900 mb-2">Hook vs Event</h4>
                  <ul className="text-blue-800 text-sm space-y-1">
                    <li>• <strong>Hooks</strong>: Filter data, must return a value, can modify behavior</li>
                    <li>• <strong>Events</strong>: React to actions, fire-and-forget, don't return values</li>
                  </ul>
                </div>
              </section>

              {/* CRON JOBS */}
              <section id="section-cron" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-pink-600" />
                  Cron Jobs
                </h2>

                <p className="text-gray-600 mb-4">
                  Cron jobs are scheduled tasks that run automatically at specified intervals (daily reports, weekly cleanup).
                </p>

                <h3 className="text-lg font-semibold mb-3">Cron Schedule Format</h3>
                <div className="bg-gray-100 rounded p-3 font-mono text-sm mb-3">
                  <pre>{`┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *`}</pre>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm mb-6">
                  <div className="bg-pink-50 rounded p-2 text-center">
                    <code className="text-pink-700">* * * * *</code>
                    <div className="text-pink-600 text-xs">Every minute</div>
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
                    <code className="text-pink-700">0 0 * * 0</code>
                    <div className="text-pink-600 text-xs">Weekly (Sunday)</div>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Cron Job Definition</h3>
                <CodeBlock title="In plugin JSON" code={`{
  "cronJobs": [
    {
      "name": "daily-report",
      "schedule": "0 9 * * *",
      "description": "Send daily sales report at 9 AM",
      "handlerCode": "async function dailyReport(context) { ... }",
      "isEnabled": true
    }
  ]
}`} />

                <CodeBlock title="Cron Handler Example" code={`async function dailyReport(context) {
  const { supabase } = context;

  // Get today's stats
  const today = new Date().toISOString().split('T')[0];
  const { count: ordersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  console.log(\`Daily Report: \${ordersCount} orders today\`);
}

async function cleanupOldSessions(context) {
  const { supabase } = context;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  await supabase
    .from('chat_sessions')
    .delete()
    .lt('updated_at', sevenDaysAgo.toISOString());
}`} />
              </section>

              {/* MANIFEST */}
              <section id="section-manifest" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <FileJson className="w-6 h-6 text-yellow-600" />
                  Manifest
                </h2>

                <p className="text-gray-600 mb-4">
                  The manifest defines your plugin's metadata, configuration, admin navigation, and permissions.
                </p>

                <h3 className="text-lg font-semibold mb-3">Complete Manifest Example</h3>
                <CodeBlock code={`{
  "name": "Live Chat",
  "slug": "live-chat",
  "version": "1.0.0",
  "description": "Real-time customer support chat",
  "author": "Your Name",
  "category": "support",
  "type": "utility",
  "framework": "react",

  "adminNavigation": {
    "enabled": true,
    "label": "Live Chat",
    "icon": "MessageCircle",
    "route": "/admin/plugins/live-chat/dashboard",
    "order": 100
  },

  "configSchema": {
    "properties": {
      "primaryColor": {
        "type": "string",
        "default": "#3b82f6",
        "title": "Button Color"
      },
      "welcomeMessage": {
        "type": "string",
        "default": "Hi! How can we help?",
        "title": "Welcome Message"
      },
      "position": {
        "type": "string",
        "enum": ["left", "right"],
        "default": "right",
        "title": "Button Position"
      }
    }
  },

  "permissions": ["customers:read", "orders:read"]
}`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Manifest Fields</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-2 text-left">Field</th>
                      <th className="border p-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="border p-2"><code>name</code></td><td className="border p-2">Display name</td></tr>
                    <tr><td className="border p-2"><code>slug</code></td><td className="border p-2">URL-safe identifier (used in API paths)</td></tr>
                    <tr><td className="border p-2"><code>version</code></td><td className="border p-2">Semantic version (1.0.0)</td></tr>
                    <tr><td className="border p-2"><code>category</code></td><td className="border p-2">support, marketing, analytics, etc.</td></tr>
                    <tr><td className="border p-2"><code>adminNavigation</code></td><td className="border p-2">Shows plugin in admin sidebar</td></tr>
                    <tr><td className="border p-2"><code>configSchema</code></td><td className="border p-2">Defines configurable settings</td></tr>
                    <tr><td className="border p-2"><code>permissions</code></td><td className="border p-2">Required permissions</td></tr>
                  </tbody>
                </table>

                <h3 className="text-lg font-semibold mt-6 mb-3">Available Icons</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Use any icon from <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">lucide.dev/icons</a>
                </p>
                <div className="flex flex-wrap gap-2">
                  {['MessageCircle', 'Settings', 'Star', 'Package', 'ShoppingCart', 'Users', 'BarChart', 'Mail', 'Bell', 'Heart'].map(icon => (
                    <code key={icon} className="bg-gray-100 px-2 py-1 rounded text-sm">{icon}</code>
                  ))}
                </div>
              </section>

              {/* TROUBLESHOOTING */}
              <section id="section-troubleshooting" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  Troubleshooting
                </h2>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-red-700 mb-2">Widget not showing on storefront</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Check category</strong> - Must be <code className="bg-gray-100 px-1 rounded">support</code>, <code className="bg-gray-100 px-1 rounded">floating</code>, <code className="bg-gray-100 px-1 rounded">chat</code>, or <code className="bg-gray-100 px-1 rounded">global</code> to show on all pages</li>
                      <li>• <strong>Check is_enabled</strong> - Widget must have <code className="bg-gray-100 px-1 rounded">is_enabled: true</code> (or not set)</li>
                      <li>• <strong>Check plugin status</strong> - Plugin must be active in <code className="bg-gray-100 px-1 rounded">/admin/plugins</code></li>
                      <li>• <strong>Clear cache</strong> - Hard refresh the page (Ctrl+Shift+R)</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-red-700 mb-2">401 Unauthorized error on API calls</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Missing store ID header</strong> - Add <code className="bg-gray-100 px-1 rounded">x-store-id</code> to all fetch requests</li>
                      <li>• Use the <code className="bg-gray-100 px-1 rounded">getHeaders()</code> helper function shown in examples</li>
                    </ul>
                    <CodeBlock code={`const getHeaders = () => {
  const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
  return storeId ? { 'x-store-id': storeId } : {};
};`} />
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-red-700 mb-2">Widget shows JSX/createElement error</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Widgets cannot use JSX</strong> - Use <code className="bg-gray-100 px-1 rounded">React.createElement()</code> instead</li>
                      <li>• Change: <code className="bg-red-100 px-1 rounded text-red-700">{'<div>Hello</div>'}</code></li>
                      <li>• To: <code className="bg-green-100 px-1 rounded text-green-700">React.createElement('div', null, 'Hello')</code></li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-red-700 mb-2">Admin page shows 404</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Route mismatch</strong> - The <code className="bg-gray-100 px-1 rounded">adminNavigation.route</code> in manifest must match the <code className="bg-gray-100 px-1 rounded">adminPages[].route</code></li>
                      <li>• Example: If adminNavigation.route is <code className="bg-gray-100 px-1 rounded">/admin/plugins/my-plugin/dashboard</code></li>
                      <li>• Then adminPages must have a page with the same route</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-red-700 mb-2">Migration failed</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Check SQL syntax</strong> - Open browser console for error details</li>
                      <li>• <strong>Use IF NOT EXISTS</strong> - Prevents errors when table already exists</li>
                      <li>• <strong>Check column types</strong> - PostgreSQL types differ from MySQL</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-red-700 mb-2">Controller returns "supabase is not defined"</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• <strong>Wrong function signature</strong> - Controller must receive <code className="bg-gray-100 px-1 rounded">{'{ supabase }'}</code> as third parameter</li>
                      <li>• Correct: <code className="bg-green-100 px-1 rounded text-green-700">async function handler(req, res, {'{ supabase }'})</code></li>
                      <li>• Wrong: <code className="bg-red-100 px-1 rounded text-red-700">async function handler(req, res)</code></li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Bottom padding */}
              <div className="h-12"></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PluginHowToDialog;
