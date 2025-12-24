import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import NoStoreSelected from '@/components/admin/NoStoreSelected';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SaveButton from '@/components/ui/save-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, Search, Plus, Edit, Trash2, RefreshCw, Eye,
  Filter, UserCheck, ChevronDown, ChevronUp, Layers, BarChart3
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';
import SegmentBuilder from '@/components/admin/marketing/SegmentBuilder';
import RfmDashboard from '@/components/admin/marketing/RfmDashboard';

export default function Segments() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSegment, setEditingSegment] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [availableFields, setAvailableFields] = useState([]);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedSegment, setExpandedSegment] = useState(null);
  const [segmentMembers, setSegmentMembers] = useState({});

  // Form state for segment
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    segmentType: 'dynamic',
    isActive: true,
    filters: { conditions: [], logic: 'AND' }
  });

  useEffect(() => {
    if (selectedStore) {
      loadData();
    }
  }, [selectedStore]);

  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        loadData();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
  });

  const loadData = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [segmentsRes, fieldsRes] = await Promise.all([
        fetch(`/api/segments?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/segments/fields?store_id=${storeId}`, { headers: getAuthHeaders() })
      ]);

      if (segmentsRes.ok) {
        const segmentsData = await segmentsRes.json();
        setSegments(segmentsData.segments || []);
      }

      if (fieldsRes.ok) {
        const fieldsData = await fieldsRes.json();
        setAvailableFields(fieldsData.fields || []);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
      showError('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const filteredSegments = segments.filter(segment =>
    (segment.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (segment.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleCreateNew = () => {
    setEditingSegment(null);
    setFormData({
      name: '',
      description: '',
      segmentType: 'dynamic',
      isActive: true,
      filters: { conditions: [], logic: 'AND' }
    });
    setPreviewCount(null);
    setIsEditModalOpen(true);
  };

  const handleEditSegment = (segment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name || '',
      description: segment.description || '',
      segmentType: segment.segment_type || 'dynamic',
      isActive: segment.is_active !== false,
      filters: segment.filters || { conditions: [], logic: 'AND' }
    });
    setPreviewCount(segment.member_count);
    setIsEditModalOpen(true);
  };

  const handleDeleteSegment = async (segmentId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this segment? This action cannot be undone.',
      'Delete Segment'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/segments/${segmentId}?store_id=${storeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setSegments(segments.filter(s => s.id !== segmentId));
        setFlashMessage({ type: 'success', message: 'Segment deleted successfully' });
      } else {
        throw new Error('Failed to delete segment');
      }
    } catch (error) {
      console.error('Error deleting segment:', error);
      showError('Failed to delete segment. Please try again.');
    }
  };

  const handleRecalculate = async (segmentId) => {
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/segments/${segmentId}/recalculate?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSegments(segments.map(s =>
          s.id === segmentId ? { ...s, member_count: data.memberCount } : s
        ));
        setFlashMessage({ type: 'success', message: `Segment recalculated: ${data.memberCount} members` });
      } else {
        throw new Error('Failed to recalculate segment');
      }
    } catch (error) {
      console.error('Error recalculating segment:', error);
      showError('Failed to recalculate segment');
    }
  };

  const handlePreview = async () => {
    if (formData.segmentType !== 'dynamic') {
      setPreviewCount(0);
      return;
    }

    try {
      setPreviewLoading(true);
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/segments/preview?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ filters: formData.filters })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewCount(data.count);
      }
    } catch (error) {
      console.error('Error previewing segment:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveSegment = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showError('Segment name is required');
      return;
    }

    setSaveSuccess(false);
    setSaving(true);

    try {
      const storeId = getSelectedStoreId();
      const url = editingSegment
        ? `/api/segments/${editingSegment.id}?store_id=${storeId}`
        : `/api/segments?store_id=${storeId}`;

      const response = await fetch(url, {
        method: editingSegment ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();

        if (editingSegment) {
          setSegments(segments.map(s => s.id === editingSegment.id ? data.segment : s));
        } else {
          setSegments([data.segment, ...segments]);
        }

        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditModalOpen(false);
          setEditingSegment(null);
        }, 1000);

        setFlashMessage({
          type: 'success',
          message: editingSegment ? 'Segment updated successfully' : 'Segment created successfully'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save segment');
      }
    } catch (error) {
      console.error('Error saving segment:', error);
      showError(error.message || 'Failed to save segment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMembers = async (segmentId) => {
    if (expandedSegment === segmentId) {
      setExpandedSegment(null);
      return;
    }

    if (!segmentMembers[segmentId]) {
      try {
        const storeId = getSelectedStoreId();
        const response = await fetch(`/api/segments/${segmentId}/members?store_id=${storeId}&limit=10`, {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          setSegmentMembers(prev => ({ ...prev, [segmentId]: data.members || [] }));
        }
      } catch (error) {
        console.error('Error loading segment members:', error);
      }
    }

    setExpandedSegment(segmentId);
  };

  const getSegmentTypeBadge = (type) => {
    const styles = {
      dynamic: 'bg-blue-100 text-blue-800 border-blue-200',
      static: 'bg-purple-100 text-purple-800 border-purple-200',
      rfm: 'bg-orange-100 text-orange-800 border-orange-200'
    };

    const labels = {
      dynamic: 'Dynamic',
      static: 'Static',
      rfm: 'RFM'
    };

    return (
      <Badge variant="outline" className={styles[type] || styles.dynamic}>
        {labels[type] || type}
      </Badge>
    );
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Customer Segments</h1>
        <p className="text-gray-600 mt-1">Create and manage audience segments for targeted marketing</p>
      </div>

      <Tabs defaultValue="segments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="segments" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Segments
          </TabsTrigger>
          <TabsTrigger value="rfm" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            RFM Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="segments">
          <div className="flex justify-end mb-6">
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create Segment
            </Button>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search segments by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                All Segments ({filteredSegments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
          <div className="space-y-4">
            {filteredSegments.map(segment => (
              <div key={segment.id} className="border rounded-lg">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Filter className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{segment.name}</h3>
                        {getSegmentTypeBadge(segment.segment_type)}
                        {!segment.is_active && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {segment.description && (
                        <p className="text-sm text-gray-500 mt-1">{segment.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-lg font-semibold text-gray-900">
                        <UserCheck className="w-4 h-4 text-gray-400" />
                        {segment.member_count || 0}
                      </div>
                      <span className="text-xs text-gray-500">members</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleMembers(segment.id)}
                        className="h-8 w-8 p-0"
                        title="View members"
                      >
                        {expandedSegment === segment.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      {segment.segment_type === 'dynamic' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecalculate(segment.id)}
                          className="h-8 w-8 p-0"
                          title="Recalculate members"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditSegment(segment)}
                        className="h-8 w-8 p-0"
                        title="Edit segment"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteSegment(segment.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete segment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {expandedSegment === segment.id && (
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Members</h4>
                    {segmentMembers[segment.id]?.length > 0 ? (
                      <div className="space-y-2">
                        {segmentMembers[segment.id].map(member => (
                          <div key={member.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                              {(member.first_name?.[0] || member.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {member.first_name} {member.last_name}
                              </div>
                              <div className="text-xs text-gray-500">{member.email}</div>
                            </div>
                          </div>
                        ))}
                        {segment.member_count > 10 && (
                          <p className="text-xs text-gray-500 text-center pt-2">
                            Showing 10 of {segment.member_count} members
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No members in this segment</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {filteredSegments.length === 0 && (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No segments found</h3>
                <p className="text-gray-600 mb-4">Create your first segment to start targeting customers.</p>
                <Button onClick={handleCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Segment
                </Button>
              </div>
            )}
          </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="rfm">
          <RfmDashboard />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Segment Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? 'Edit Segment' : 'Create Segment'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSegment} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Segment Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., High-Value Customers"
                  required
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this segment..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="segmentType">Segment Type</Label>
                <Select
                  value={formData.segmentType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, segmentType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dynamic">Dynamic (auto-updates)</SelectItem>
                    <SelectItem value="static">Static (manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            {formData.segmentType === 'dynamic' && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Filter Conditions</h3>
                  <div className="flex items-center gap-3">
                    {previewCount !== null && (
                      <span className="text-sm text-gray-600">
                        <UserCheck className="w-4 h-4 inline mr-1" />
                        {previewCount} matching customers
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePreview}
                      disabled={previewLoading}
                    >
                      {previewLoading ? (
                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-1" />
                      )}
                      Preview
                    </Button>
                  </div>
                </div>

                <SegmentBuilder
                  filters={formData.filters}
                  onChange={(filters) => setFormData(prev => ({ ...prev, filters }))}
                  availableFields={availableFields}
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <SaveButton
                type="submit"
                loading={saving}
                success={saveSuccess}
                defaultText={editingSegment ? 'Save Changes' : 'Create Segment'}
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertComponent />
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
    </div>
  );
}
