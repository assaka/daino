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
  ChevronRight,
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

              {/* COMPONENTS */}
              <section id="section-components" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Puzzle className="w-6 h-6 text-indigo-600" />
                  Components
                </h2>

                <p className="text-gray-600 mb-4">
                  Components are reusable UI pieces that can be used in hooks, admin pages, or other parts of your plugin. They help organize your code by separating UI logic into smaller, manageable files.
                </p>

                <h3 className="text-lg font-semibold mb-3">When to Use Components</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm mb-6">
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>Reusable UI</strong> - Create once, use in multiple places (modals, cards, banners)</li>
                    <li>• <strong>Hook injection</strong> - Return HTML strings to inject into pages via hooks</li>
                    <li>• <strong>Complex widgets</strong> - Break large widgets into smaller sub-components</li>
                  </ul>
                </div>

                <h3 className="text-lg font-semibold mb-3">Component File Location</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Components go in the <code className="bg-gray-100 px-1 rounded">components/</code> folder of your plugin:
                </p>
                <div className="bg-gray-100 rounded p-3 font-mono text-xs mb-4">
                  <div>my-plugin/</div>
                  <div className="ml-4">├── components/</div>
                  <div className="ml-8">├── WelcomeBanner.js</div>
                  <div className="ml-8">├── ProductBadge.js</div>
                  <div className="ml-8">└── NotificationPopup.js</div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Component Examples</h3>
                <CodeBlock title="components/WelcomeBanner.js" code={`// components/WelcomeBanner.js
// Components return HTML strings for hook injection

function WelcomeBanner(config) {
  const { title, message, backgroundColor } = config;

  return \`
    <div class="welcome-banner" style="
      background: \${backgroundColor || '#3b82f6'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      margin-bottom: 20px;
    ">
      <h2 style="margin: 0 0 8px 0;">\${title || 'Welcome!'}</h2>
      <p style="margin: 0; opacity: 0.9;">\${message || 'Thanks for visiting.'}</p>
    </div>
  \`;
}

module.exports = WelcomeBanner;`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Using Components in Hooks</h3>
                <CodeBlock title="index.js - Using component in a hook" code={`// index.js
class MyPlugin {
  onAppReady(context) {
    // Load the component
    const WelcomeBanner = require('./components/WelcomeBanner');

    // Generate HTML with config from plugin settings
    const bannerHtml = WelcomeBanner({
      title: this.config.bannerTitle,
      message: this.config.bannerMessage,
      backgroundColor: this.config.primaryColor
    });

    // Inject into page
    const container = document.createElement('div');
    container.innerHTML = bannerHtml;
    document.body.prepend(container);

    return context;
  }
}

module.exports = MyPlugin;`} />
              </section>

              {/* SERVICES */}
              <section id="section-services" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Wrench className="w-6 h-6 text-amber-600" />
                  Services
                </h2>

                <p className="text-gray-600 mb-4">
                  Services are classes that handle business logic, data operations, and external integrations. They keep your hooks and controllers clean by extracting complex logic into reusable modules.
                </p>

                <h3 className="text-lg font-semibold mb-3">When to Use Services</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm mb-6">
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>Data operations</strong> - Complex database queries, data transformations</li>
                    <li>• <strong>External APIs</strong> - Email services, payment gateways, third-party integrations</li>
                    <li>• <strong>Business rules</strong> - Pricing calculations, inventory checks, validation</li>
                    <li>• <strong>Shared logic</strong> - Code used by multiple controllers or hooks</li>
                  </ul>
                </div>

                <h3 className="text-lg font-semibold mb-3">Service File Location</h3>
                <div className="bg-gray-100 rounded p-3 font-mono text-xs mb-4">
                  <div>my-plugin/</div>
                  <div className="ml-4">├── services/</div>
                  <div className="ml-8">├── ChatService.js</div>
                  <div className="ml-8">├── NotificationService.js</div>
                  <div className="ml-8">└── AnalyticsService.js</div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Service Example</h3>
                <CodeBlock title="services/ChatService.js" code={`// services/ChatService.js
class ChatService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createSession(customerEmail) {
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const { data, error } = await this.supabase
      .from('chat_sessions')
      .insert({
        session_id: sessionId,
        customer_email: customerEmail,
        status: 'active'
      })
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

  async closeSession(sessionId) {
    await this.supabase
      .from('chat_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('session_id', sessionId);
  }
}

module.exports = ChatService;`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Using Services in Controllers</h3>
                <CodeBlock code={`// In a controller
async function getActiveChats(req, res, { supabase }) {
  // Import and instantiate the service
  const ChatService = require('./services/ChatService');
  const chatService = new ChatService(supabase);

  try {
    const chats = await chatService.getActiveChats();
    return res.json({ success: true, chats });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}`} />
              </section>

              {/* UTILITIES */}
              <section id="section-utils" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <FolderCode className="w-6 h-6 text-teal-600" />
                  Utilities
                </h2>

                <p className="text-gray-600 mb-4">
                  Utilities are pure helper functions with no side effects. They perform common operations like formatting, validation, and data transformation that can be used anywhere in your plugin.
                </p>

                <h3 className="text-lg font-semibold mb-3">Utility vs Service</h3>
                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div className="border rounded-lg p-3">
                    <div className="font-semibold text-teal-700 mb-2">Utilities</div>
                    <ul className="text-gray-600 space-y-1">
                      <li>• Pure functions (no state)</li>
                      <li>• No database access</li>
                      <li>• No external API calls</li>
                      <li>• Same input = same output</li>
                    </ul>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-semibold text-amber-700 mb-2">Services</div>
                    <ul className="text-gray-600 space-y-1">
                      <li>• Classes with state</li>
                      <li>• Database operations</li>
                      <li>• External integrations</li>
                      <li>• Business logic</li>
                    </ul>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Utility File Location</h3>
                <div className="bg-gray-100 rounded p-3 font-mono text-xs mb-4">
                  <div>my-plugin/</div>
                  <div className="ml-4">├── utils/</div>
                  <div className="ml-8">├── format.js</div>
                  <div className="ml-8">├── validation.js</div>
                  <div className="ml-8">└── helpers.js</div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Utility Examples</h3>
                <CodeBlock title="utils/format.js" code={`// utils/format.js
const formatUtils = {
  formatPrice(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  },

  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

                <CodeBlock title="utils/validation.js" code={`// utils/validation.js
const validation = {
  isValidEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  },

  sanitizeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  truncate(str, maxLength = 100) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }
};

module.exports = validation;`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Using Utilities</h3>
                <CodeBlock code={`// In a controller or component
const { formatPrice, formatDate } = require('./utils/format');
const { isValidEmail, sanitizeHtml } = require('./utils/validation');

async function sendMessage(req, res, { supabase }) {
  const { email, message } = req.body;

  // Validate email
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Sanitize user input before saving
  const cleanMessage = sanitizeHtml(message);

  // Save to database...
}`} />
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

              {/* EVENTS */}
              <section id="section-events" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-rose-600" />
                  Events & Lifecycle
                </h2>

                <p className="text-gray-600 mb-4">
                  Events are triggered at specific points in your plugin's lifecycle. Unlike hooks, events are <strong>fire-and-forget</strong> - they don't need to return a value and can't modify behavior.
                </p>

                <h3 className="text-lg font-semibold mb-3">Plugin Lifecycle Events</h3>
                <p className="text-sm text-gray-600 mb-3">
                  These methods are called automatically at different stages of your plugin's life:
                </p>
                <div className="space-y-3 mb-6">
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-rose-700">install()</div>
                    <p className="text-sm text-gray-600">Called once when the plugin is first installed. Use for initial setup, creating default config, etc.</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-green-700">onEnable()</div>
                    <p className="text-sm text-gray-600">Called when the plugin is enabled/activated. Use to start background tasks, register listeners.</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-orange-700">onDisable()</div>
                    <p className="text-sm text-gray-600">Called when the plugin is disabled. Use to cleanup resources, stop background tasks.</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-blue-700">onConfigUpdate(newConfig, oldConfig)</div>
                    <p className="text-sm text-gray-600">Called when store owner changes plugin settings. Use to apply new configuration.</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-red-700">uninstall()</div>
                    <p className="text-sm text-gray-600">Called when the plugin is uninstalled. Use to clean up data, remove tables if needed.</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-3">Lifecycle Example</h3>
                <CodeBlock title="index.js" code={`// index.js
class MyPlugin {
  // Called when plugin is installed
  async install() {
    console.log('Plugin installed!');
    // Create default settings, initialize data
  }

  // Called when plugin is enabled
  onEnable() {
    console.log('Plugin enabled!');
    // Start background tasks, register listeners
  }

  // Called when plugin is disabled
  onDisable() {
    console.log('Plugin disabled!');
    // Stop background tasks, cleanup
  }

  // Called when settings change
  onConfigUpdate(newConfig, oldConfig) {
    if (newConfig.apiKey !== oldConfig.apiKey) {
      // Reconnect to external service with new key
      this.reconnectService(newConfig.apiKey);
    }
  }

  // Called when plugin is uninstalled
  async uninstall() {
    console.log('Plugin uninstalled!');
    // Cleanup data, remove plugin-specific data
  }
}

module.exports = MyPlugin;`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">System Events</h3>
                <p className="text-sm text-gray-600 mb-3">
                  React to system-wide events like orders, user actions, etc. Define in your manifest and implement handlers:
                </p>
                <CodeBlock title="events/order-completed.js" code={`// events/order-completed.js
// Called when any order is completed

async function onOrderCompleted(event, context) {
  const { order, customer, items } = event;

  // Send thank you email
  await context.services.email.send({
    to: customer.email,
    subject: 'Thank you for your order!',
    body: \`Order #\${order.id} has been confirmed.\`
  });

  // Track analytics
  await context.services.analytics.track('purchase', {
    orderId: order.id,
    total: order.total,
    itemCount: items.length
  });

  // Note: Events don't return values
}

module.exports = onOrderCompleted;`} />
              </section>

              {/* CRON JOBS */}
              <section id="section-cron" className="pt-6 border-t">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-pink-600" />
                  Cron Jobs
                </h2>

                <p className="text-gray-600 mb-4">
                  Cron jobs are scheduled tasks that run automatically at specified intervals. Use them for recurring tasks like sending reminder emails, cleaning up old data, or generating reports.
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

                <h3 className="text-lg font-semibold mb-3">Cron Job Definition in Plugin JSON</h3>
                <CodeBlock title="In your plugin's cronJobs array" code={`{
  "cronJobs": [
    {
      "name": "abandoned-cart-reminder",
      "schedule": "0 */2 * * *",
      "description": "Send reminder emails for abandoned carts every 2 hours",
      "handlerCode": "async function abandonedCartReminder(context) { ... }",
      "isEnabled": true
    },
    {
      "name": "cleanup-old-sessions",
      "schedule": "0 3 * * *",
      "description": "Delete chat sessions older than 30 days at 3 AM daily",
      "handlerCode": "async function cleanupOldSessions(context) { ... }",
      "isEnabled": true
    }
  ]
}`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Real Example: Abandoned Cart Recovery</h3>
                <p className="text-sm text-gray-600 mb-2">
                  This cron job finds carts abandoned for 2+ hours and sends reminder emails:
                </p>
                <CodeBlock title="Abandoned Cart Reminder (runs every 2 hours)" code={`async function abandonedCartReminder(context) {
  const { supabase } = context;

  // Find carts updated 2-24 hours ago that haven't been emailed yet
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: abandonedCarts, error } = await supabase
    .from('carts')
    .select('id, customer_email, items, total, updated_at')
    .eq('status', 'active')
    .eq('reminder_sent', false)
    .lt('updated_at', twoHoursAgo)
    .gt('updated_at', oneDayAgo)
    .not('customer_email', 'is', null);

  if (error) {
    console.error('Failed to fetch abandoned carts:', error);
    return;
  }

  console.log(\`Found \${abandonedCarts.length} abandoned carts\`);

  for (const cart of abandonedCarts) {
    // Send reminder email (using your email service)
    try {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cart.customer_email,
          template: 'abandoned-cart',
          data: {
            items: cart.items,
            total: cart.total,
            cartUrl: \`https://yourstore.com/cart?restore=\${cart.id}\`
          }
        })
      });

      // Mark as reminder sent
      await supabase
        .from('carts')
        .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
        .eq('id', cart.id);

      console.log(\`Sent reminder to \${cart.customer_email}\`);
    } catch (err) {
      console.error(\`Failed to send reminder for cart \${cart.id}:\`, err);
    }
  }
}`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Real Example: Low Stock Alert</h3>
                <p className="text-sm text-gray-600 mb-2">
                  This cron job checks inventory daily and notifies the store owner of low stock items:
                </p>
                <CodeBlock title="Low Stock Alert (runs daily at 8 AM)" code={`async function lowStockAlert(context) {
  const { supabase } = context;

  // Find products with stock below threshold
  const { data: lowStockProducts, error } = await supabase
    .from('products')
    .select('id, name, sku, stock_quantity, low_stock_threshold')
    .lt('stock_quantity', supabase.raw('low_stock_threshold'))
    .eq('track_inventory', true)
    .gt('stock_quantity', 0);  // Not completely out of stock

  if (error) {
    console.error('Failed to check inventory:', error);
    return;
  }

  if (lowStockProducts.length === 0) {
    console.log('No low stock items found');
    return;
  }

  // Build alert message
  const alertItems = lowStockProducts.map(p =>
    \`• \${p.name} (SKU: \${p.sku}) - Only \${p.stock_quantity} left\`
  ).join('\\n');

  // Send notification to store owner
  await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'low-stock-alert',
      title: \`Low Stock Alert: \${lowStockProducts.length} products need restocking\`,
      message: alertItems,
      priority: 'high'
    })
  });

  console.log(\`Sent low stock alert for \${lowStockProducts.length} products\`);
}`} />

                <h3 className="text-lg font-semibold mt-6 mb-3">Real Example: Cleanup Old Data</h3>
                <p className="text-sm text-gray-600 mb-2">
                  This cron job runs weekly to clean up old chat sessions and maintain database performance:
                </p>
                <CodeBlock title="Weekly Cleanup (runs every Sunday at 3 AM)" code={`async function weeklyCleanup(context) {
  const { supabase } = context;
  const stats = { sessions: 0, messages: 0 };

  // Delete chat sessions older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // First, get the sessions to delete (for counting)
  const { data: oldSessions } = await supabase
    .from('chat_sessions')
    .select('session_id')
    .eq('status', 'closed')
    .lt('updated_at', thirtyDaysAgo.toISOString());

  if (oldSessions && oldSessions.length > 0) {
    const sessionIds = oldSessions.map(s => s.session_id);

    // Delete messages first (foreign key constraint)
    const { count: deletedMessages } = await supabase
      .from('chat_messages')
      .delete()
      .in('session_id', sessionIds)
      .select('*', { count: 'exact', head: true });

    stats.messages = deletedMessages || 0;

    // Then delete sessions
    const { count: deletedSessions } = await supabase
      .from('chat_sessions')
      .delete()
      .in('session_id', sessionIds)
      .select('*', { count: 'exact', head: true });

    stats.sessions = deletedSessions || 0;
  }

  console.log(\`Weekly cleanup complete: Deleted \${stats.sessions} sessions and \${stats.messages} messages\`);
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
