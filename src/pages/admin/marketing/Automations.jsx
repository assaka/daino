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
  Search, Plus, Edit, Trash2, Play, Pause, Eye,
  Zap, Mail, Clock, GitBranch, Users, Settings,
  ChevronDown, ChevronUp, Activity
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';
import WorkflowCanvas from '@/components/admin/marketing/WorkflowCanvas';

const TRIGGER_ICONS = {
  customer_created: Users,
  abandoned_cart: Clock,
  order_placed: Mail,
  order_fulfilled: Mail,
  tag_added: Settings,
  segment_entered: Users,
  date_based: Clock,
  manual: Settings
};

const TRIGGER_LABELS = {
  customer_created: 'Customer Created',
  abandoned_cart: 'Abandoned Cart',
  order_placed: 'Order Placed',
  order_fulfilled: 'Order Fulfilled',
  tag_added: 'Tag Added',
  segment_entered: 'Enters Segment',
  date_based: 'Date Based',
  manual: 'Manual Trigger'
};

export default function Automations() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [triggerTypes, setTriggerTypes] = useState([]);
  const [stepTypes, setStepTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedWorkflow, setExpandedWorkflow] = useState(null);
  const [workflowStats, setWorkflowStats] = useState({});

  // Form state for workflow
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'customer_created',
    triggerConfig: {},
    steps: []
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

      const [workflowsRes, templatesRes, triggersRes, stepsRes] = await Promise.all([
        fetch(`/api/automations?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/automations/templates?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/automations/triggers?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/automations/steps?store_id=${storeId}`, { headers: getAuthHeaders() })
      ]);

      if (workflowsRes.ok) {
        const data = await workflowsRes.json();
        setWorkflows(data.workflows || []);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }

      if (triggersRes.ok) {
        const data = await triggersRes.json();
        setTriggerTypes(data.triggers || []);
      }

      if (stepsRes.ok) {
        const data = await stepsRes.json();
        setStepTypes(data.steps || []);
      }
    } catch (error) {
      console.error('Error loading automations:', error);
      showError('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkflows = workflows.filter(workflow =>
    (workflow.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (workflow.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleCreateNew = () => {
    setEditingWorkflow(null);
    setFormData({
      name: '',
      description: '',
      triggerType: 'customer_created',
      triggerConfig: {},
      steps: []
    });
    setIsEditModalOpen(true);
  };

  const handleCreateFromTemplate = () => {
    setIsTemplateModalOpen(true);
  };

  const handleSelectTemplate = async (template) => {
    setIsTemplateModalOpen(false);

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/automations/from-template?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ templateId: template.id })
      });

      if (response.ok) {
        const data = await response.json();
        setWorkflows([data.workflow, ...workflows]);
        setFlashMessage({ type: 'success', message: `Workflow "${template.name}" created from template` });
      } else {
        throw new Error('Failed to create from template');
      }
    } catch (error) {
      console.error('Error creating from template:', error);
      showError('Failed to create workflow from template');
    }
  };

  const handleEditWorkflow = (workflow) => {
    setEditingWorkflow(workflow);
    setFormData({
      name: workflow.name || '',
      description: workflow.description || '',
      triggerType: workflow.trigger_type || 'customer_created',
      triggerConfig: workflow.trigger_config || {},
      steps: workflow.steps || []
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteWorkflow = async (workflowId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this automation? This will stop any active enrollments.',
      'Delete Automation'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/automations/${workflowId}?store_id=${storeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setWorkflows(workflows.filter(w => w.id !== workflowId));
        setFlashMessage({ type: 'success', message: 'Automation deleted successfully' });
      } else {
        throw new Error('Failed to delete automation');
      }
    } catch (error) {
      console.error('Error deleting automation:', error);
      showError('Failed to delete automation. Please try again.');
    }
  };

  const handleToggleActive = async (workflow) => {
    try {
      const storeId = getSelectedStoreId();
      const endpoint = workflow.is_active ? 'pause' : 'activate';
      const response = await fetch(`/api/automations/${workflow.id}/${endpoint}?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setWorkflows(workflows.map(w =>
          w.id === workflow.id ? data.workflow : w
        ));
        setFlashMessage({
          type: 'success',
          message: `Automation ${workflow.is_active ? 'paused' : 'activated'}`
        });
      } else {
        throw new Error('Failed to toggle automation');
      }
    } catch (error) {
      console.error('Error toggling automation:', error);
      showError('Failed to update automation status');
    }
  };

  const handleSaveWorkflow = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showError('Workflow name is required');
      return;
    }

    setSaveSuccess(false);
    setSaving(true);

    try {
      const storeId = getSelectedStoreId();
      const url = editingWorkflow
        ? `/api/automations/${editingWorkflow.id}?store_id=${storeId}`
        : `/api/automations?store_id=${storeId}`;

      const response = await fetch(url, {
        method: editingWorkflow ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();

        if (editingWorkflow) {
          setWorkflows(workflows.map(w => w.id === editingWorkflow.id ? data.workflow : w));
        } else {
          setWorkflows([data.workflow, ...workflows]);
        }

        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditModalOpen(false);
          setEditingWorkflow(null);
        }, 1000);

        setFlashMessage({
          type: 'success',
          message: editingWorkflow ? 'Automation updated successfully' : 'Automation created successfully'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save automation');
      }
    } catch (error) {
      console.error('Error saving automation:', error);
      showError(error.message || 'Failed to save automation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStats = async (workflowId) => {
    if (expandedWorkflow === workflowId) {
      setExpandedWorkflow(null);
      return;
    }

    if (!workflowStats[workflowId]) {
      try {
        const storeId = getSelectedStoreId();
        const response = await fetch(`/api/automations/${workflowId}/stats?store_id=${storeId}`, {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          setWorkflowStats(prev => ({ ...prev, [workflowId]: data.stats }));
        }
      } catch (error) {
        console.error('Error loading workflow stats:', error);
      }
    }

    setExpandedWorkflow(workflowId);
  };

  const getStatusBadge = (workflow) => {
    if (workflow.is_active) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
          <Activity className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
        Paused
      </Badge>
    );
  };

  const getTriggerIcon = (triggerType) => {
    const Icon = TRIGGER_ICONS[triggerType] || Zap;
    return <Icon className="w-5 h-5 text-indigo-600" />;
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
          <h1 className="text-3xl font-bold text-gray-900">Marketing Automations</h1>
          <p className="text-gray-600 mt-1">Create automated workflows to engage customers</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleCreateFromTemplate}>
            <GitBranch className="w-4 h-4 mr-2" />
            From Template
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Automation
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search automations by name or description..."
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
            <Zap className="w-5 h-5" />
            All Automations ({filteredWorkflows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredWorkflows.map(workflow => (
              <div key={workflow.id} className="border rounded-lg">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      {getTriggerIcon(workflow.trigger_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{workflow.name}</h3>
                        {getStatusBadge(workflow)}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <span>{TRIGGER_LABELS[workflow.trigger_type] || workflow.trigger_type}</span>
                        {workflow.steps?.length > 0 && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{workflow.steps.length} steps</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">{workflow.total_enrolled || 0}</span>
                          <span className="text-gray-400 ml-1">enrolled</span>
                        </div>
                        <div>
                          <span className="font-medium">{workflow.total_completed || 0}</span>
                          <span className="text-gray-400 ml-1">completed</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStats(workflow.id)}
                        className="h-8 w-8 p-0"
                        title="View stats"
                      >
                        {expandedWorkflow === workflow.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(workflow)}
                        className={`h-8 w-8 p-0 ${workflow.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={workflow.is_active ? 'Pause' : 'Activate'}
                      >
                        {workflow.is_active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditWorkflow(workflow)}
                        className="h-8 w-8 p-0"
                        title="Edit automation"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete automation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {expandedWorkflow === workflow.id && workflowStats[workflow.id] && (
                  <div className="border-t bg-gray-50 p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Performance Stats</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-3 rounded border text-center">
                        <div className="text-2xl font-bold text-indigo-600">
                          {workflowStats[workflow.id].totalEnrolled || 0}
                        </div>
                        <div className="text-xs text-gray-500">Total Enrolled</div>
                      </div>
                      <div className="bg-white p-3 rounded border text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {workflowStats[workflow.id].totalCompleted || 0}
                        </div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                      <div className="bg-white p-3 rounded border text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {workflowStats[workflow.id].totalExited || 0}
                        </div>
                        <div className="text-xs text-gray-500">Exited Early</div>
                      </div>
                      <div className="bg-white p-3 rounded border text-center">
                        <div className="text-2xl font-bold text-gray-600">
                          {workflowStats[workflow.id].status || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">Status</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredWorkflows.length === 0 && (
              <div className="text-center py-12">
                <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No automations found</h3>
                <p className="text-gray-600 mb-2">Create your first automation to engage customers automatically.</p>
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 max-w-lg mx-auto mb-6">
                  <p className="text-sm text-purple-800 font-medium mb-2">Popular automations to start with:</p>
                  <ul className="text-sm text-purple-700 text-left space-y-1">
                    <li className="flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Abandoned Cart Recovery - recover 5-15% of lost sales
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="w-3 h-3" /> Welcome Series - introduce your brand to new customers
                    </li>
                    <li className="flex items-center gap-2">
                      <Mail className="w-3 h-3" /> Post-Purchase - thank customers and ask for reviews
                    </li>
                  </ul>
                </div>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={handleCreateFromTemplate}>
                    <GitBranch className="w-4 h-4 mr-2" />
                    Start from Template
                  </Button>
                  <Button onClick={handleCreateNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Custom
                  </Button>
                  <Button variant="ghost" onClick={() => window.location.href = '/admin/marketing/help'}>
                    Learn More
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Workflow Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow ? 'Edit Automation' : 'Create Automation'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveWorkflow} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="name">Automation Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Welcome Series"
                  required
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this automation does..."
                  rows={2}
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <Label htmlFor="triggerType">Trigger</Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, triggerType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map(trigger => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        {trigger.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  When this event occurs, the workflow will start
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Workflow Steps</h3>
                <span className="text-sm text-gray-500">
                  {formData.steps.length} steps
                </span>
              </div>

              <WorkflowCanvas
                steps={formData.steps}
                onChange={(steps) => setFormData(prev => ({ ...prev, steps }))}
                stepTypes={stepTypes}
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
                defaultText={editingWorkflow ? 'Save Changes' : 'Create Automation'}
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template Selection Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a Template</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto py-4">
            {templates.map(template => (
              <div
                key={template.id}
                className="border rounded-lg p-4 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    {getTriggerIcon(template.triggerType)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {TRIGGER_LABELS[template.triggerType] || template.triggerType}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {template.steps?.length || 0} steps
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No templates available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertComponent />
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
    </div>
  );
}
