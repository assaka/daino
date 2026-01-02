import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  AlertCircle,
  Zap,
  Package,
  Brain,
  Database,
  HardDrive,
  Network,
  MoreHorizontal
} from 'lucide-react';
import FlashMessage from '@/components/storefront/FlashMessage';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CATEGORY_ICONS = {
  store_operations: Package,
  plugin_management: Zap,
  ai_services: Brain,
  data_migration: Database,
  storage: HardDrive,
  akeneo_integration: Network,
  other: MoreHorizontal
};

const CATEGORY_COLORS = {
  store_operations: 'bg-blue-100 text-blue-800 border-blue-200',
  plugin_management: 'bg-purple-100 text-purple-800 border-purple-200',
  ai_services: 'bg-pink-100 text-pink-800 border-pink-200',
  data_migration: 'bg-orange-100 text-orange-800 border-orange-200',
  storage: 'bg-green-100 text-green-800 border-green-200',
  akeneo_integration: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200'
};

const BILLING_TYPES = [
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_use', label: 'Per Use' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_item', label: 'Per Item' },
  { value: 'per_mb', label: 'Per MB' },
  { value: 'flat_rate', label: 'Flat Rate' }
];

const CATEGORIES = [
  { value: 'store_operations', label: 'Store Operations' },
  { value: 'plugin_management', label: 'Plugin Management' },
  { value: 'ai_services', label: 'AI Services' },
  { value: 'data_migration', label: 'Data Migration' },
  { value: 'storage', label: 'Storage' },
  { value: 'akeneo_integration', label: 'Akeneo Integration' },
  { value: 'other', label: 'Other' }
];

export default function ServiceCreditCostsManager() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [flashMessage, setFlashMessage] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    service_key: '',
    service_name: '',
    service_category: 'other',
    description: '',
    cost_per_unit: 0,
    billing_type: 'per_use',
    is_active: true,
    is_visible: true,
    display_order: 0,
    metadata: {}
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/service-credit-costs`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setServices(response.data.services);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load service credit costs' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/service-credit-costs`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setFlashMessage({ type: 'success', message: 'Service created successfully' });
        setCreateDialogOpen(false);
        resetForm();
        fetchServices();
      }
    } catch (error) {
      console.error('Error creating service:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.message || 'Failed to create service' });
    }
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/service-credit-costs/${selectedService.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setFlashMessage({ type: 'success', message: 'Service updated successfully' });
        setEditDialogOpen(false);
        resetForm();
        fetchServices();
      }
    } catch (error) {
      console.error('Error updating service:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.message || 'Failed to update service' });
    }
  };

  const handleDelete = async (serviceId) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${API_URL}/api/service-credit-costs/${serviceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setFlashMessage({ type: 'success', message: 'Service deleted successfully' });
        fetchServices();
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.message || 'Failed to delete service' });
    }
  };

  const handleToggleActive = async (service) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `${API_URL}/api/service-credit-costs/${service.service_key}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setFlashMessage({ type: 'success', message: `Service ${service.is_active ? 'deactivated' : 'activated'}` });
        fetchServices();
      }
    } catch (error) {
      console.error('Error toggling service:', error);
      setFlashMessage({ type: 'error', message: error.response?.data?.message || 'Failed to toggle service' });
    }
  };

  const openEditDialog = (service) => {
    setSelectedService(service);
    setFormData({
      service_key: service.service_key,
      service_name: service.service_name,
      service_category: service.service_category,
      description: service.description || '',
      cost_per_unit: service.cost_per_unit,
      billing_type: service.billing_type,
      is_active: service.is_active,
      is_visible: service.is_visible,
      display_order: service.display_order || 0,
      metadata: service.metadata || {}
    });
    setEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      service_key: '',
      service_name: '',
      service_category: 'other',
      description: '',
      cost_per_unit: 0,
      billing_type: 'per_use',
      is_active: true,
      is_visible: true,
      display_order: 0,
      metadata: {}
    });
    setSelectedService(null);
  };

  const filteredServices = activeTab === 'all'
    ? services
    : services.filter(s => s.service_category === activeTab);

  const groupedServices = services.reduce((acc, service) => {
    const category = service.service_category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {});

  const renderServiceRow = (service) => {
    const Icon = CATEGORY_ICONS[service.service_category] || MoreHorizontal;

    return (
      <TableRow key={service.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-500" />
            <div>
              <div className="font-medium">{service.service_name}</div>
              <div className="text-xs text-gray-500">{service.service_key}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge className={CATEGORY_COLORS[service.service_category]}>
            {CATEGORIES.find(c => c.value === service.service_category)?.label}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="font-medium">{service.cost_per_unit} credits</div>
          <div className="text-xs text-gray-500">
            {BILLING_TYPES.find(t => t.value === service.billing_type)?.label}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            {service.is_active ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                Inactive
              </Badge>
            )}
            {service.is_visible && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Eye className="h-3 w-3 mr-1" />
                Visible
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(service)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleActive(service)}
            >
              {service.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(service.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="service_key">Service Key *</Label>
        <Input
          id="service_key"
          value={formData.service_key}
          onChange={(e) => setFormData({ ...formData, service_key: e.target.value })}
          placeholder="e.g., plugin_install"
          disabled={selectedService !== null}
        />
        <p className="text-xs text-gray-500 mt-1">Unique identifier used in code (cannot be changed after creation)</p>
      </div>

      <div>
        <Label htmlFor="service_name">Service Name *</Label>
        <Input
          id="service_name"
          value={formData.service_name}
          onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
          placeholder="e.g., Plugin Installation"
        />
      </div>

      <div>
        <Label htmlFor="service_category">Category *</Label>
        <Select
          value={formData.service_category}
          onValueChange={(value) => setFormData({ ...formData, service_category: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this service"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cost_per_unit">Cost Per Unit *</Label>
          <Input
            id="cost_per_unit"
            type="number"
            step="0.0001"
            min="0"
            value={formData.cost_per_unit}
            onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="billing_type">Billing Type *</Label>
          <Select
            value={formData.billing_type}
            onValueChange={(value) => setFormData({ ...formData, billing_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="display_order">Display Order</Label>
        <Input
          id="display_order"
          type="number"
          value={formData.display_order}
          onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label>Active</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_visible}
            onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
          />
          <Label>Visible in Pricing</Label>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading service credit costs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Service Credit Costs
              </CardTitle>
              <CardDescription>
                Manage credit costs for all services across the platform
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Services ({services.length})</TabsTrigger>
              {CATEGORIES.map(cat => {
                const count = groupedServices[cat.value]?.length || 0;
                if (count === 0) return null;
                return (
                  <TabsTrigger key={cat.value} value={cat.value}>
                    {cat.label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeTab}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        No services found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServices.map(renderServiceRow)
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Service</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              <Save className="h-4 w-4 mr-2" />
              Create Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
