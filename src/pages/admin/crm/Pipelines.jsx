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
import {
  Plus, Edit, Trash2, GitBranch, GripVertical, ChevronUp, ChevronDown, Settings
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

export default function Pipelines() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    stages: [{ name: 'New', order: 1 }]
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
      const response = await fetch(`/api/crm/pipelines?store_id=${storeId}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setPipelines(data.pipelines || []);
      }
    } catch (error) {
      console.error('Error loading pipelines:', error);
      showError('Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingPipeline(null);
    setFormData({
      name: '',
      stages: [
        { name: 'Lead', order: 1 },
        { name: 'Qualified', order: 2 },
        { name: 'Proposal', order: 3 },
        { name: 'Negotiation', order: 4 },
        { name: 'Won', order: 5 }
      ]
    });
    setIsEditModalOpen(true);
  };

  const handleEditPipeline = (pipeline) => {
    setEditingPipeline(pipeline);
    setFormData({
      name: pipeline.name || '',
      stages: pipeline.stages?.map((s, idx) => ({
        id: s.id,
        name: s.name,
        order: s.order || idx + 1
      })) || [{ name: 'New', order: 1 }]
    });
    setIsEditModalOpen(true);
  };

  const handleDeletePipeline = async (pipelineId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this pipeline? All deals in this pipeline will need to be reassigned.',
      'Delete Pipeline'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/crm/pipelines/${pipelineId}?store_id=${storeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setPipelines(pipelines.filter(p => p.id !== pipelineId));
        setFlashMessage({ type: 'success', message: 'Pipeline deleted successfully' });
      } else {
        throw new Error('Failed to delete pipeline');
      }
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      showError('Failed to delete pipeline');
    }
  };

  const handleSavePipeline = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showError('Pipeline name is required');
      return;
    }

    if (formData.stages.length === 0) {
      showError('At least one stage is required');
      return;
    }

    setSaveSuccess(false);
    setSaving(true);

    try {
      const storeId = getSelectedStoreId();
      const url = editingPipeline
        ? `/api/crm/pipelines/${editingPipeline.id}?store_id=${storeId}`
        : `/api/crm/pipelines?store_id=${storeId}`;

      const response = await fetch(url, {
        method: editingPipeline ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();

        if (editingPipeline) {
          setPipelines(pipelines.map(p => p.id === editingPipeline.id ? data.pipeline : p));
        } else {
          setPipelines([...pipelines, data.pipeline]);
        }

        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditModalOpen(false);
          setEditingPipeline(null);
        }, 1000);

        setFlashMessage({
          type: 'success',
          message: editingPipeline ? 'Pipeline updated successfully' : 'Pipeline created successfully'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save pipeline');
      }
    } catch (error) {
      console.error('Error saving pipeline:', error);
      showError(error.message || 'Failed to save pipeline');
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    setFormData(prev => ({
      ...prev,
      stages: [...prev.stages, { name: '', order: prev.stages.length + 1 }]
    }));
  };

  const updateStage = (index, name) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages.map((s, i) => i === index ? { ...s, name } : s)
    }));
  };

  const removeStage = (index) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }))
    }));
  };

  const moveStage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= formData.stages.length) return;

    setFormData(prev => {
      const newStages = [...prev.stages];
      const [moved] = newStages.splice(fromIndex, 1);
      newStages.splice(toIndex, 0, moved);
      return {
        ...prev,
        stages: newStages.map((s, i) => ({ ...s, order: i + 1 }))
      };
    });
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Pipelines</h1>
          <p className="text-gray-600 mt-1">Configure your sales process stages</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Create Pipeline
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pipelines.map(pipeline => (
          <Card key={pipeline.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-indigo-600" />
                  {pipeline.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditPipeline(pipeline)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeletePipeline(pipeline.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pipeline.stages?.sort((a, b) => a.order - b.order).map((stage, index) => (
                  <div
                    key={stage.id || index}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                  >
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm">{stage.name}</span>
                    {stage.deal_count > 0 && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        {stage.deal_count} deals
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                {pipeline.stages?.length || 0} stages
              </div>
            </CardContent>
          </Card>
        ))}

        {pipelines.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No pipelines yet</h3>
              <p className="text-gray-600 mb-4">Create a pipeline to organize your sales process</p>
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Create Pipeline
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Pipeline Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPipeline ? 'Edit Pipeline' : 'Create Pipeline'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePipeline} className="space-y-4">
            <div>
              <Label htmlFor="name">Pipeline Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Sales Pipeline"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Stages</Label>
                <Button type="button" size="sm" variant="outline" onClick={addStage}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Stage
                </Button>
              </div>

              <div className="space-y-2">
                {formData.stages.map((stage, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {index + 1}
                    </span>
                    <Input
                      value={stage.name}
                      onChange={(e) => updateStage(index, e.target.value)}
                      placeholder="Stage name"
                      className="flex-1"
                    />
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveStage(index, index - 1)}
                        disabled={index === 0}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveStage(index, index + 1)}
                        disabled={index === formData.stages.length - 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeStage(index)}
                        disabled={formData.stages.length <= 1}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
                defaultText={editingPipeline ? 'Save Changes' : 'Create Pipeline'}
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
