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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Plus, Edit, Trash2, Handshake, DollarSign,
  Building, User, Calendar, ArrowRight, GripVertical
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  won: { label: 'Won', color: 'bg-green-100 text-green-800 border-green-200' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-800 border-red-200' }
};

export default function Deals() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [deals, setDeals] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [editingDeal, setEditingDeal] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    value: '',
    companyName: '',
    contactName: '',
    contactEmail: '',
    pipelineId: '',
    stageId: '',
    expectedCloseDate: '',
    notes: ''
  });

  useEffect(() => {
    if (selectedStore) {
      loadData();
    }
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

      const [dealsRes, pipelinesRes] = await Promise.all([
        fetch(`/api/crm/deals?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/crm/pipelines?store_id=${storeId}`, { headers: getAuthHeaders() })
      ]);

      if (dealsRes.ok) {
        const data = await dealsRes.json();
        setDeals(data.deals || []);
      }

      if (pipelinesRes.ok) {
        const data = await pipelinesRes.json();
        setPipelines(data.pipelines || []);
        if (data.pipelines?.length > 0 && !selectedPipeline) {
          setSelectedPipeline(data.pipelines[0].id);
          setStages(data.pipelines[0].stages || []);
        }
      }
    } catch (error) {
      console.error('Error loading deals:', error);
      showError('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const handlePipelineChange = (pipelineId) => {
    setSelectedPipeline(pipelineId);
    const pipeline = pipelines.find(p => p.id === pipelineId);
    setStages(pipeline?.stages || []);
  };

  const filteredDeals = deals.filter(deal => {
    const matchesSearch =
      (deal.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (deal.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesPipeline = !selectedPipeline || deal.pipeline_id === selectedPipeline;
    return matchesSearch && matchesPipeline;
  });

  const getDealsByStage = (stageId) => {
    return filteredDeals.filter(deal => deal.stage_id === stageId);
  };

  const handleCreateNew = () => {
    setEditingDeal(null);
    setFormData({
      name: '',
      value: '',
      companyName: '',
      contactName: '',
      contactEmail: '',
      pipelineId: selectedPipeline || '',
      stageId: stages[0]?.id || '',
      expectedCloseDate: '',
      notes: ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditDeal = (deal) => {
    setEditingDeal(deal);
    setFormData({
      name: deal.name || '',
      value: deal.value || '',
      companyName: deal.company_name || '',
      contactName: deal.contact_name || '',
      contactEmail: deal.contact_email || '',
      pipelineId: deal.pipeline_id || '',
      stageId: deal.stage_id || '',
      expectedCloseDate: deal.expected_close_date?.split('T')[0] || '',
      notes: deal.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteDeal = async (dealId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this deal?',
      'Delete Deal'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/crm/deals/${dealId}?store_id=${storeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setDeals(deals.filter(d => d.id !== dealId));
        setFlashMessage({ type: 'success', message: 'Deal deleted successfully' });
      } else {
        throw new Error('Failed to delete deal');
      }
    } catch (error) {
      console.error('Error deleting deal:', error);
      showError('Failed to delete deal');
    }
  };

  const handleSaveDeal = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showError('Deal name is required');
      return;
    }

    setSaveSuccess(false);
    setSaving(true);

    try {
      const storeId = getSelectedStoreId();
      const url = editingDeal
        ? `/api/crm/deals/${editingDeal.id}?store_id=${storeId}`
        : `/api/crm/deals?store_id=${storeId}`;

      const response = await fetch(url, {
        method: editingDeal ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();

        if (editingDeal) {
          setDeals(deals.map(d => d.id === editingDeal.id ? data.deal : d));
        } else {
          setDeals([data.deal, ...deals]);
        }

        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditModalOpen(false);
          setEditingDeal(null);
        }, 1000);

        setFlashMessage({
          type: 'success',
          message: editingDeal ? 'Deal updated successfully' : 'Deal created successfully'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save deal');
      }
    } catch (error) {
      console.error('Error saving deal:', error);
      showError(error.message || 'Failed to save deal');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (dealId, newStageId) => {
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/crm/deals/${dealId}/stage?store_id=${storeId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ stageId: newStageId })
      });

      if (response.ok) {
        const data = await response.json();
        setDeals(deals.map(d => d.id === dealId ? data.deal : d));
      }
    } catch (error) {
      console.error('Error moving deal:', error);
      showError('Failed to move deal');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deals</h1>
          <p className="text-gray-600 mt-1">Manage your sales opportunities</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Add Deal
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {pipelines.length > 0 && (
              <Select value={selectedPipeline || ''} onValueChange={handlePipelineChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(pipeline => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{stage.name}</h3>
                  <Badge variant="outline">{getDealsByStage(stage.id).length}</Badge>
                </div>

                <div className="space-y-2">
                  {getDealsByStage(stage.id).map(deal => (
                    <Card
                      key={deal.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleEditDeal(deal)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{deal.name}</p>
                            {deal.company_name && (
                              <p className="text-sm text-gray-500 flex items-center gap-1 truncate">
                                <Building className="w-3 h-3" />
                                {deal.company_name}
                              </p>
                            )}
                          </div>
                          <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(deal.value)}
                          </span>
                          {deal.expected_close_date && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(deal.expected_close_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {getDealsByStage(stage.id).length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      No deals in this stage
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {stages.length === 0 && (
            <div className="flex-1 text-center py-12">
              <Handshake className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No pipeline configured</h3>
              <p className="text-gray-600 mb-4">Create a pipeline to start tracking deals</p>
              <Button onClick={() => window.location.href = '/admin/crm/pipelines'}>
                Create Pipeline
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="w-5 h-5" />
              All Deals ({filteredDeals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredDeals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Handshake className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{deal.name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {deal.company_name && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {deal.company_name}
                          </span>
                        )}
                        {deal.contact_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {deal.contact_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatCurrency(deal.value)}</p>
                      <Badge variant="outline" className={STATUS_CONFIG[deal.status]?.color || ''}>
                        {STATUS_CONFIG[deal.status]?.label || deal.status}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEditDeal(deal)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteDeal(deal.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredDeals.length === 0 && (
                <div className="text-center py-12">
                  <Handshake className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No deals found</h3>
                  <p className="text-gray-600 mb-4">Start tracking your sales opportunities</p>
                  <Button onClick={handleCreateNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Deal
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Deal Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDeal ? 'Edit Deal' : 'Add Deal'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveDeal} className="space-y-4">
            <div>
              <Label htmlFor="name">Deal Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Enterprise License"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value">Deal Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="expectedCloseDate">Expected Close</Label>
                <Input
                  id="expectedCloseDate"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Company</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Company name"
                />
              </div>
              <div>
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                  placeholder="Contact person"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="email@company.com"
              />
            </div>

            {stages.length > 0 && (
              <div>
                <Label htmlFor="stageId">Stage</Label>
                <Select
                  value={formData.stageId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, stageId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

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
                defaultText={editingDeal ? 'Save Changes' : 'Add Deal'}
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
