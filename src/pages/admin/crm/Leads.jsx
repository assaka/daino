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
  Search, Plus, Edit, Trash2, UserPlus, Mail, Phone,
  Building, Star, ArrowRight, TrendingUp
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  contacted: { label: 'Contacted', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  qualified: { label: 'Qualified', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  unqualified: { label: 'Unqualified', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  converted: { label: 'Converted', color: 'bg-green-100 text-green-800 border-green-200' }
};

const SOURCE_OPTIONS = [
  'website', 'referral', 'social_media', 'email_campaign',
  'cold_call', 'trade_show', 'partner', 'other'
];

export default function Leads() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingLead, setEditingLead] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    jobTitle: '',
    source: '',
    status: 'new',
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
      const response = await fetch(`/api/crm/leads?store_id=${storeId}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Error loading leads:', error);
      showError('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      (lead.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateNew = () => {
    setEditingLead(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyName: '',
      jobTitle: '',
      source: '',
      status: 'new',
      notes: ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditLead = (lead) => {
    setEditingLead(lead);
    setFormData({
      firstName: lead.first_name || '',
      lastName: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      companyName: lead.company_name || '',
      jobTitle: lead.job_title || '',
      source: lead.source || '',
      status: lead.status || 'new',
      notes: lead.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteLead = async (leadId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this lead?',
      'Delete Lead'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/crm/leads/${leadId}?store_id=${storeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setLeads(leads.filter(l => l.id !== leadId));
        setFlashMessage({ type: 'success', message: 'Lead deleted successfully' });
      } else {
        throw new Error('Failed to delete lead');
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      showError('Failed to delete lead');
    }
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      showError('Email is required');
      return;
    }

    setSaveSuccess(false);
    setSaving(true);

    try {
      const storeId = getSelectedStoreId();
      const url = editingLead
        ? `/api/crm/leads/${editingLead.id}?store_id=${storeId}`
        : `/api/crm/leads?store_id=${storeId}`;

      const response = await fetch(url, {
        method: editingLead ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();

        if (editingLead) {
          setLeads(leads.map(l => l.id === editingLead.id ? data.lead : l));
        } else {
          setLeads([data.lead, ...leads]);
        }

        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditModalOpen(false);
          setEditingLead(null);
        }, 1000);

        setFlashMessage({
          type: 'success',
          message: editingLead ? 'Lead updated successfully' : 'Lead created successfully'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save lead');
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      showError(error.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenConvert = (lead) => {
    setConvertingLead(lead);
    setIsConvertModalOpen(true);
  };

  const handleConvertLead = async () => {
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/crm/leads/${convertingLead.id}/convert?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setLeads(leads.map(l =>
          l.id === convertingLead.id ? { ...l, status: 'converted' } : l
        ));
        setIsConvertModalOpen(false);
        setConvertingLead(null);
        setFlashMessage({
          type: 'success',
          message: `Lead converted! Deal "${data.deal?.name}" created.`
        });
      } else {
        throw new Error('Failed to convert lead');
      }
    } catch (error) {
      console.error('Error converting lead:', error);
      showError('Failed to convert lead');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
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
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600 mt-1">Manage and qualify your sales leads</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            All Leads ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-lg font-medium text-purple-600">
                      {(lead.first_name?.[0] || lead.email?.[0] || '?').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <Badge variant="outline" className={STATUS_CONFIG[lead.status]?.color || ''}>
                        {STATUS_CONFIG[lead.status]?.label || lead.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {lead.email}
                      </span>
                      {lead.company_name && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {lead.company_name}
                        </span>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lead.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(lead.score || 0)}`}>
                      <Star className="w-3 h-3" />
                      {lead.score || 0}
                    </div>
                    {lead.source && (
                      <p className="text-xs text-gray-400 mt-1">
                        via {lead.source.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {lead.status !== 'converted' && lead.status !== 'unqualified' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenConvert(lead)}
                        title="Convert to deal"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleEditLead(lead)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteLead(lead.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredLeads.length === 0 && (
              <div className="text-center py-12">
                <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No leads found</h3>
                <p className="text-gray-600 mb-4">Start capturing leads to grow your pipeline</p>
                <Button onClick={handleCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lead
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Lead Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add Lead'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveLead} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@company.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(source => (
                      <SelectItem key={source} value={source}>
                        {source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Company</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Company Inc."
                />
              </div>
              <div>
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  placeholder="Marketing Manager"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                defaultText={editingLead ? 'Save Changes' : 'Add Lead'}
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Convert Lead Modal */}
      <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Lead to Deal</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Convert "{convertingLead?.first_name} {convertingLead?.last_name}" to a new deal?
              This will create a deal in your pipeline with the lead's information.
            </p>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium">A new deal will be created</p>
                  <p className="text-sm text-gray-500">
                    Company: {convertingLead?.company_name || 'N/A'}<br />
                    Contact: {convertingLead?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConvertModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleConvertLead}>
                <ArrowRight className="w-4 h-4 mr-2" />
                Convert to Deal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertComponent />
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
    </div>
  );
}
