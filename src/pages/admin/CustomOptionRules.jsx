
import React, { useState, useEffect } from 'react';
import { CustomOptionRule } from '@/api/entities';
import CustomOptionRuleForm from '@/components/admin/products/CustomOptionRuleForm';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Settings, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FlashMessage from '@/components/storefront/FlashMessage';
import { useAlertTypes } from '@/hooks/useAlert';
import { PageLoader } from '@/components/ui/page-loader';

export default function CustomOptionRules() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showConfirm, AlertComponent } = useAlertTypes();
  const [flashMessage, setFlashMessage] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadRules();
    }
  }, [selectedStore]);

  const loadRules = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      console.warn('No store selected');
      setRules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await CustomOptionRule.filter({ 
        store_id: storeId,
        order_by: '-created_at'
      });
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (selectedRule) {
        await CustomOptionRule.update(selectedRule.id, formData);
        setFlashMessage({ type: 'success', message: 'Custom option rule updated successfully!' });
      } else {
        await CustomOptionRule.create(formData);
        setFlashMessage({ type: 'success', message: 'Custom option rule created successfully!' });
      }
      closeForm();
      loadRules();
    } catch (error) {
      console.error("Failed to save rule", error);
      setFlashMessage({ type: 'error', message: 'Failed to save custom option rule' });
    }
  };

  const handleEdit = (rule) => {
    setSelectedRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (ruleId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this rule?", "Delete Rule");
    if (confirmed) {
      try {
        await CustomOptionRule.delete(ruleId);
        setFlashMessage({ type: 'success', message: 'Custom option rule deleted successfully!' });
        loadRules();
      } catch (error) {
        console.error("Failed to delete rule", error);
        setFlashMessage({ type: 'error', message: 'Failed to delete custom option rule' });
      }
    }
  };

  const handleToggleActive = async (rule) => {
    try {
      await CustomOptionRule.update(rule.id, { ...rule, is_active: !rule.is_active });
      setFlashMessage({ type: 'success', message: `Rule ${rule.is_active ? 'deactivated' : 'activated'} successfully!` });
      loadRules();
    } catch (error) {
      console.error("Failed to toggle rule status", error);
      setFlashMessage({ type: 'error', message: 'Failed to toggle rule status' });
    }
  };
  
  const closeForm = () => {
    setShowForm(false);
    setSelectedRule(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />
      <AlertComponent />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Custom Option Rules</h1>
            <p className="text-gray-600 mt-1">Configure which custom options are available for different products</p>
          </div>
          <Button 
            onClick={() => handleEdit(null)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Rule
          </Button>
        </div>

        {loading ? (
          <PageLoader size="lg" fullScreen={false} className="h-64" />
        ) : rules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rules.map(rule => (
              <Card key={rule.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Filter className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{rule.name}</CardTitle>
                        <p className="text-sm text-gray-500">
                          {rule.conditions?.categories?.length || rule.conditions?.attribute_sets?.length || rule.conditions?.skus?.length
                            ? 'Has conditions'
                            : 'Applies to all products'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div>
                    {rule.display_label && (
                      <div className="text-sm mb-4">
                        <span className="font-medium">Display Label:</span>
                        <p className="text-gray-600 mt-1">{rule.display_label}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                      <span className="text-sm font-medium">Active</span>
                      {rule.demo && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                          Demo
                        </Badge>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No custom option rules found</h3>
              <p className="text-gray-600 mb-6">
                Create rules to configure which custom options are available for different products.
              </p>
              <Button
                onClick={() => handleEdit(null)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showForm} onOpenChange={closeForm}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRule ? 'Edit' : 'Create'} Custom Option Rule</DialogTitle>
            </DialogHeader>
            <CustomOptionRuleForm
              rule={selectedRule}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
