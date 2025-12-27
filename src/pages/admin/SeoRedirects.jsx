import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Plus, Trash2, Download, Upload, HelpCircle, AlertCircle, CheckCircle, Info, ChevronDown, AlertTriangle } from "lucide-react";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import adminApiClient from "@/api/admin-client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAlertTypes } from "@/hooks/useAlert";
import SaveButton from "@/components/ui/save-button.jsx";
import FlashMessage from "@/components/storefront/FlashMessage.jsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SeoRedirects() {
  const { getSelectedStoreId } = useStoreSelection();
  const { showConfirm, AlertComponent } = useAlertTypes();
  const [redirects, setRedirects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromUrl, setFromUrl] = useState('');
  const [toUrl, setToUrl] = useState('');
  const [redirectType, setRedirectType] = useState('301');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [redirectToDelete, setRedirectToDelete] = useState(null);

  // Check if To URL is an absolute URL
  const isAbsoluteUrl = toUrl.startsWith('http://') || toUrl.startsWith('https://');

  useEffect(() => {
    loadRedirects();
  }, []);

  const loadRedirects = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'No store selected' });
      return;
    }

    try {
      setLoading(true);
      const response = await adminApiClient.get(`/redirects?store_id=${storeId}`);
      setRedirects(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading redirects:', error);

      // Extract error message from various possible locations
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to load redirects';

      setFlashMessage({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to ensure relative URLs start with /
  const normalizeUrl = (url) => {
    const trimmedUrl = url.trim();

    // If it's an absolute URL (starts with http:// or https://), don't modify it
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }

    // For relative URLs, ensure they start with /
    if (!trimmedUrl.startsWith('/')) {
      return '/' + trimmedUrl;
    }

    return trimmedUrl;
  };

  const handleAddRedirect = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'No store selected' });
      return;
    }

    if (!fromUrl || !toUrl) {
      setFlashMessage({ type: 'error', message: 'Please enter both From and To URLs' });
      return;
    }

    // Normalize URLs to ensure relative URLs start with /
    const normalizedFromUrl = normalizeUrl(fromUrl);
    const normalizedToUrl = normalizeUrl(toUrl);

    try {
      setLoading(true);
      await adminApiClient.post('/redirects', {
        store_id: storeId,
        from_url: normalizedFromUrl,
        to_url: normalizedToUrl,
        type: redirectType,
        is_active: true
      });

      setFlashMessage({ type: 'success', message: 'Redirect added successfully!' });
      setFromUrl('');
      setToUrl('');
      setRedirectType('301');
      await loadRedirects();
    } catch (error) {
      console.error('Error adding redirect:', error);

      // Extract error message from various possible locations
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to add redirect';

      setFlashMessage({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRedirect = (redirect) => {
    setRedirectToDelete(redirect);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!redirectToDelete) return;

    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'No store selected' });
      setDeleteModalOpen(false);
      return;
    }

    try {
      setLoading(true);
      await adminApiClient.delete(`/redirects/${redirectToDelete.id}?store_id=${storeId}`);
      setFlashMessage({ type: 'success', message: 'Redirect deleted successfully' });
      await loadRedirects();
    } catch (error) {
      console.error('Error deleting redirect:', error);

      // Extract error message from various possible locations
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to delete redirect';

      setFlashMessage({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setRedirectToDelete(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-6 w-6" />
          <h1 className="text-3xl font-bold">URL Redirects</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New Redirect</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Use relative URLs for internal pages (e.g., <code className="bg-muted px-1 py-0.5 rounded">/category/old-name</code>) or absolute URLs for external sites (e.g., <code className="bg-muted px-1 py-0.5 rounded">https://example.com</code>)
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-url">From URL (relative)</Label>
              <Input
                id="from-url"
                placeholder="/category/old-name"
                value={fromUrl}
                onChange={(e) => setFromUrl(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">The old path to redirect from</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to-url">To URL (relative or absolute)</Label>
              <Input
                id="to-url"
                placeholder="/category/new-name or https://example.com"
                value={toUrl}
                onChange={(e) => setToUrl(e.target.value)}
                disabled={loading}
              />
              {isAbsoluteUrl && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <span className="font-semibold">🌐 External URL detected</span> - Will redirect to external website
                </p>
              )}
              {!isAbsoluteUrl && toUrl && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <span className="font-semibold">🏠 Internal URL</span> - Will redirect within your store
                </p>
              )}
              {!toUrl && (
                <p className="text-xs text-muted-foreground">The new path to redirect to (internal or external)</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="redirect-type">Type</Label>
              <Select
                value={redirectType}
                onValueChange={setRedirectType}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 (Permanent)</SelectItem>
                  <SelectItem value="302">302 (Temporary)</SelectItem>
                  <SelectItem value="307">307 (Temporary)</SelectItem>
                  <SelectItem value="308">308 (Permanent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end mt-4 mb-8">
        <SaveButton
            onClick={handleAddRedirect}
            loading={loading}
            defaultText="Add Redirect"
            icon={<Plus className="w-4 h-4 mr-2" />}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Active Redirects</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Hits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading redirects...
                  </TableCell>
                </TableRow>
              ) : redirects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No redirects found. Add your first redirect above.
                  </TableCell>
                </TableRow>
              ) : (
                redirects.map(redirect => (
                  <TableRow key={redirect.id}>
                    <TableCell className="font-mono text-sm">{redirect.from_url}</TableCell>
                    <TableCell className="font-mono text-sm">{redirect.to_url}</TableCell>
                    <TableCell className="hidden md:table-cell">{redirect.type}</TableCell>
                    <TableCell className="hidden md:table-cell">{redirect.hit_count || 0}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${
                        redirect.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {redirect.is_active ? 'active' : 'inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRedirect(redirect)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Collapsible open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Help & Best Practices</CardTitle>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-blue-600 transition-transform duration-200 ${
                    isHelpOpen ? 'transform rotate-180' : ''
                  }`}
                />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">How Redirects Work</h4>
                <p className="text-sm text-gray-700">
                  When a visitor accesses a URL, the system checks if a redirect exists. If found, they're automatically sent to the new URL.
                  This is essential for maintaining SEO rankings when you change URLs.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Internal vs External Redirects</h4>
                <p className="text-sm text-gray-700 mb-2">
                  For <strong>internal redirects</strong> (within your store), use relative paths without the store prefix.
                  For <strong>external redirects</strong> (to other websites), use absolute URLs.
                </p>
                <div className="bg-white p-2 rounded border border-gray-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <div>
                      <strong>Internal Redirect:</strong>
                      <div className="font-mono text-gray-600 mt-1">
                        From: <code className="bg-gray-100 px-1">/category/old-name</code><br />
                        To: <code className="bg-gray-100 px-1">/category/new-name</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <div>
                      <strong>External Redirect:</strong>
                      <div className="font-mono text-gray-600 mt-1">
                        From: <code className="bg-gray-100 px-1">/blog</code><br />
                        To: <code className="bg-gray-100 px-1">https://blog.example.com</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    <div>
                      <strong>Wrong - Don't include store prefix:</strong>
                      <div className="font-mono text-gray-600 mt-1">
                        From: <code className="bg-gray-100 px-1">/public/your-store/category/old-name</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Redirect Types</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li><strong>301 (Permanent):</strong> Use when the old URL is permanently moved. Best for SEO as it transfers link equity.</li>
                  <li><strong>302 (Temporary):</strong> Use for temporary changes. Search engines won't transfer ranking signals.</li>
                  <li><strong>307 (Temporary):</strong> Like 302 but preserves the HTTP method (POST/GET).</li>
                  <li><strong>308 (Permanent):</strong> Like 301 but preserves the HTTP method (POST/GET).</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Common Use Cases</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Product URL changed:</strong> <code className="bg-gray-100 px-1 text-xs">/product/old-sku</code> → <code className="bg-gray-100 px-1 text-xs">/product/new-sku</code></li>
                  <li>• <strong>Category renamed:</strong> <code className="bg-gray-100 px-1 text-xs">/category/electronics</code> → <code className="bg-gray-100 px-1 text-xs">/category/tech</code></li>
                  <li>• <strong>Page moved:</strong> <code className="bg-gray-100 px-1 text-xs">/about-us</code> → <code className="bg-gray-100 px-1 text-xs">/company/about</code></li>
                  <li>• <strong>External blog:</strong> <code className="bg-gray-100 px-1 text-xs">/blog</code> → <code className="bg-gray-100 px-1 text-xs">https://blog.example.com</code></li>
                  <li>• <strong>Social media:</strong> <code className="bg-gray-100 px-1 text-xs">/instagram</code> → <code className="bg-gray-100 px-1 text-xs">https://instagram.com/yourstore</code></li>
                  <li>• <strong>Partner site:</strong> <code className="bg-gray-100 px-1 text-xs">/support</code> → <code className="bg-gray-100 px-1 text-xs">https://support.yourcompany.com</code></li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Best Practices</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Always test redirects after creating them</li>
                  <li>• Avoid redirect chains (A → B → C). Redirect directly (A → C)</li>
                  <li>• Use 301 for SEO benefits when the change is permanent</li>
                  <li>• Monitor hit counts to track which redirects are being used</li>
                  <li>• Clean up old redirects that are no longer needed</li>
                  <li>• Redirects are automatically created when you change category/product slugs</li>
                </ul>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-3 flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong className="text-amber-900">Note:</strong>
                <span className="text-amber-800"> Redirects only work on storefront pages. Admin pages and API endpoints are not affected by redirects.</span>
              </div>
            </div>
          </div>
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      <AlertComponent />

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>Delete Redirect</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-3">
              Are you sure you want to delete this redirect? This action cannot be undone.
              {redirectToDelete && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <div className="text-sm font-mono">
                    <div className="text-muted-foreground">From:</div>
                    <div className="font-semibold text-foreground">{redirectToDelete.from_url}</div>
                    <div className="text-muted-foreground mt-2">To:</div>
                    <div className="font-semibold text-foreground">{redirectToDelete.to_url}</div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}