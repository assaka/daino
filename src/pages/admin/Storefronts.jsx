/**
 * Storefronts Admin Page
 *
 * Manage multiple theme/layout configurations per store.
 * Uses same layout as SalesSettings.jsx
 */

import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Palette,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Eye,
  Star,
  Copy,
  Calendar,
  ExternalLink,
  Info
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import apiClient from '@/api/client';
import { PageLoader } from '@/components/ui/page-loader';

export default function Storefronts() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showWarning, showConfirm, AlertComponent } = useAlertTypes();
  const [flashMessage, setFlashMessage] = useState(null);

  const [storefronts, setStorefronts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStorefront, setEditingStorefront] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicatingStorefront, setDuplicatingStorefront] = useState(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateSlug, setDuplicateSlug] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    settings_override: {},
    publish_start_at: '',
    publish_end_at: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadStorefronts();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (flashMessage) {
      const timer = setTimeout(() => setFlashMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [flashMessage]);

  const loadStorefronts = async () => {
    setLoading(true);
    try {
      const storeId = getSelectedStoreId();
      if (!storeId) {
        setLoading(false);
        return;
      }

      const response = await apiClient.get(`/storefronts?store_id=${storeId}`);
      // apiClient transforms paginated responses and returns the array directly
      let storefrontsList = Array.isArray(response) ? response : (response.data?.data || []);

      // If no storefronts exist, create a default one from current store data
      if (storefrontsList.length === 0) {
        await createDefaultStorefront(storeId);
        // Reload after creating default
        const reloadResponse = await apiClient.get(`/storefronts?store_id=${storeId}`);
        storefrontsList = Array.isArray(reloadResponse) ? reloadResponse : (reloadResponse.data?.data || []);
      }

      setStorefronts(storefrontsList);
    } catch (error) {
      console.error('Failed to load storefronts:', error);
      setFlashMessage({
        type: 'error',
        message: `Failed to load storefronts: ${error.response?.data?.error || error.message}`
      });
      setStorefronts([]);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultStorefront = async (storeId) => {
    try {
      await apiClient.post('/storefronts', {
        store_id: storeId,
        name: 'Default',
        slug: 'default',
        description: 'Default storefront with current store settings',
        is_primary: true,
        settings_override: {}
      });
      setFlashMessage({ type: 'info', message: 'Created default storefront from current store settings' });
    } catch (error) {
      console.error('Failed to create default storefront:', error);
      setFlashMessage({
        type: 'error',
        message: `Failed to create default storefront: ${error.response?.data?.error || error.message}. Run the migration first.`
      });
    }
  };

  const handleCreate = () => {
    setEditingStorefront(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      settings_override: {},
      publish_start_at: '',
      publish_end_at: ''
    });
    setShowForm(true);
  };

  const handleEdit = (storefront) => {
    setEditingStorefront(storefront);
    setFormData({
      name: storefront.name,
      slug: storefront.slug,
      description: storefront.description || '',
      settings_override: storefront.settings_override || {},
      publish_start_at: storefront.publish_start_at ? storefront.publish_start_at.slice(0, 16) : '',
      publish_end_at: storefront.publish_end_at ? storefront.publish_end_at.slice(0, 16) : ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const storeId = getSelectedStoreId();

    if (!formData.name?.trim()) {
      showWarning('Please enter a name for the storefront.');
      return;
    }

    if (!formData.slug?.trim()) {
      showWarning('Please enter a slug for the storefront.');
      return;
    }

    try {
      const payload = {
        ...formData,
        store_id: storeId,
        publish_start_at: formData.publish_start_at || null,
        publish_end_at: formData.publish_end_at || null
      };

      if (editingStorefront) {
        await apiClient.put(`/storefronts/${editingStorefront.id}`, payload);
        setFlashMessage({ type: 'success', message: 'Storefront updated successfully!' });
      } else {
        await apiClient.post('/storefronts', payload);
        setFlashMessage({ type: 'success', message: 'Storefront created successfully!' });
      }

      setShowForm(false);
      loadStorefronts();
    } catch (error) {
      console.error('Failed to save storefront:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.error || 'Failed to save storefront' });
    }
  };

  const handleDelete = async (storefront) => {
    if (storefront.is_primary) {
      showWarning('Cannot delete the primary storefront. Set another storefront as primary first.');
      return;
    }

    const confirmed = await showConfirm(
      `Are you sure you want to delete "${storefront.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await apiClient.delete(`/storefronts/${storefront.id}?store_id=${getSelectedStoreId()}`);
      setFlashMessage({ type: 'success', message: 'Storefront deleted successfully!' });
      loadStorefronts();
    } catch (error) {
      console.error('Failed to delete storefront:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.error || 'Failed to delete storefront' });
    }
  };

  const handleSetPrimary = async (storefront) => {
    const confirmed = await showConfirm(
      `Set "${storefront.name}" as the primary storefront? This will be shown to all visitors.`
    );

    if (!confirmed) return;

    try {
      await apiClient.post(`/storefronts/${storefront.id}/set-primary`, {
        store_id: getSelectedStoreId()
      });
      setFlashMessage({ type: 'success', message: `"${storefront.name}" is now the primary storefront!` });
      loadStorefronts();
    } catch (error) {
      console.error('Failed to set primary storefront:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.error || 'Failed to set primary' });
    }
  };

  const handleDuplicate = (storefront) => {
    setDuplicatingStorefront(storefront);
    setDuplicateName(`${storefront.name} (Copy)`);
    setDuplicateSlug(`${storefront.slug}-copy`);
    setShowDuplicateDialog(true);
  };

  const handleDuplicateSubmit = async () => {
    if (!duplicateName?.trim() || !duplicateSlug?.trim()) {
      showWarning('Please enter both name and slug for the duplicate.');
      return;
    }

    try {
      await apiClient.post(`/storefronts/${duplicatingStorefront.id}/duplicate`, {
        store_id: getSelectedStoreId(),
        new_name: duplicateName,
        new_slug: duplicateSlug
      });
      setFlashMessage({ type: 'success', message: 'Storefront duplicated successfully!' });
      setShowDuplicateDialog(false);
      loadStorefronts();
    } catch (error) {
      console.error('Failed to duplicate storefront:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.error || 'Failed to duplicate' });
    }
  };

  const handlePreview = (storefront) => {
    const storeSlug = selectedStore?.slug;
    if (!storeSlug) return;
    const previewUrl = `/public/${storeSlug}?storefront=${storefront.slug}`;
    window.open(previewUrl, '_blank');
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStorefrontStatus = (storefront) => {
    const now = new Date();

    if (storefront.is_primary) {
      return { label: 'Primary', variant: 'default', color: 'bg-blue-100 text-blue-800' };
    }

    if (storefront.publish_start_at) {
      const start = new Date(storefront.publish_start_at);
      const end = storefront.publish_end_at ? new Date(storefront.publish_end_at) : null;

      if (start <= now && (!end || end >= now)) {
        return { label: 'Active (Scheduled)', variant: 'success', color: 'bg-green-100 text-green-800' };
      } else if (start > now) {
        return { label: 'Scheduled', variant: 'secondary', color: 'bg-yellow-100 text-yellow-800' };
      } else if (end && end < now) {
        return { label: 'Expired', variant: 'outline', color: 'bg-gray-100 text-gray-600' };
      }
    }

    return { label: 'Draft', variant: 'outline', color: 'bg-gray-100 text-gray-600' };
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />
      <AlertComponent />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Storefronts</h1>
            <p className="text-gray-600 mt-1">Manage multiple theme and layout variants for your store</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Storefront
          </Button>
        </div>

        {/* Info Card */}
        <Card className="material-elevation-1 border-0 bg-blue-50 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
              <Info className="w-5 h-5" />
              How Storefronts Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">
              Create different theme variants for campaigns (Black Friday), A/B testing, or B2B vs B2C experiences.
              The <strong>Primary</strong> storefront is shown to all visitors. Use <strong>scheduling</strong> to
              automatically activate a storefront during specific dates. Preview any storefront using the preview button.
            </p>
          </CardContent>
        </Card>

        {/* Storefronts List */}
        <Card className="material-elevation-1 border-0 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Your Storefronts
            </CardTitle>
            <CardDescription>Click on a storefront to edit its settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {storefronts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No storefronts found</p>
                <p className="text-sm mt-1">Click "New Storefront" to create your first storefront.</p>
                <p className="text-xs mt-2 text-gray-400">
                  Make sure the storefronts table exists in your database.
                </p>
              </div>
            )}
            {storefronts.map((storefront, index) => {
              const status = getStorefrontStatus(storefront);
              return (
                <React.Fragment key={storefront.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-gray-900">{storefront.name}</span>
                        {storefront.is_primary && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 font-mono">/{storefront.slug}</p>
                      {storefront.description && (
                        <p className="text-sm text-gray-600 mt-1">{storefront.description}</p>
                      )}
                      {(storefront.publish_start_at || storefront.publish_end_at) && (
                        <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {storefront.publish_start_at && (
                            <span>Starts: {formatDate(storefront.publish_start_at)}</span>
                          )}
                          {storefront.publish_end_at && (
                            <span className="ml-2">Ends: {formatDate(storefront.publish_end_at)}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(storefront)}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(storefront)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(storefront)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          {!storefront.is_primary && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSetPrimary(storefront)}>
                                <Star className="w-4 h-4 mr-2" />
                                Set as Primary
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(storefront)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingStorefront ? 'Edit Storefront' : 'Create Storefront'}
            </DialogTitle>
            <DialogDescription>
              {editingStorefront
                ? 'Update the storefront settings'
                : 'Create a new theme variant for your store'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Black Friday Theme"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({
                  ...formData,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                })}
                placeholder="e.g., black-friday"
              />
              <p className="text-xs text-gray-500">
                Preview URL: ?storefront={formData.slug || 'slug'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this storefront variant..."
                rows={2}
              />
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Scheduling (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="publish_start">Start Date/Time</Label>
                  <Input
                    id="publish_start"
                    type="datetime-local"
                    value={formData.publish_start_at}
                    onChange={(e) => setFormData({ ...formData, publish_start_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publish_end">End Date/Time</Label>
                  <Input
                    id="publish_end"
                    type="datetime-local"
                    value={formData.publish_end_at}
                    onChange={(e) => setFormData({ ...formData, publish_end_at: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Schedule when this storefront becomes active. Leave empty for manual control.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingStorefront ? 'Update' : 'Create'} Storefront
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Storefront</DialogTitle>
            <DialogDescription>
              Create a copy of "{duplicatingStorefront?.name}" with a new name and slug.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dup-name">Name *</Label>
              <Input
                id="dup-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dup-slug">Slug *</Label>
              <Input
                id="dup-slug"
                value={duplicateSlug}
                onChange={(e) => setDuplicateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicateSubmit}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
