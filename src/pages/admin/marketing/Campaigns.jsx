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
  Search, Plus, Edit, Trash2, Send, Clock, Copy,
  Mail, Users, BarChart3, Eye, Calendar, CheckCircle,
  AlertCircle, Loader2, Lightbulb, ChevronDown, ChevronUp,
  Target, FileText, Zap
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Edit },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Calendar },
  sending: { label: 'Sending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Loader2 },
  sent: { label: 'Sent', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle }
};

export default function Campaigns() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedulingCampaign, setSchedulingCampaign] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sending, setSending] = useState(null);
  const [showTutorial, setShowTutorial] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    previewText: '',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    contentHtml: '',
    segmentId: ''
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

      const [campaignsRes, segmentsRes] = await Promise.all([
        fetch(`/api/campaigns?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/segments?store_id=${storeId}&is_active=true`, { headers: getAuthHeaders() })
      ]);

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns || []);
      }

      if (segmentsRes.ok) {
        const data = await segmentsRes.json();
        setSegments(data.segments || []);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      showError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch =
      (campaign.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (campaign.subject?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateNew = () => {
    setEditingCampaign(null);
    setFormData({
      name: '',
      subject: '',
      previewText: '',
      fromName: '',
      fromEmail: '',
      replyTo: '',
      contentHtml: '',
      segmentId: ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name || '',
      subject: campaign.subject || '',
      previewText: campaign.preview_text || '',
      fromName: campaign.from_name || '',
      fromEmail: campaign.from_email || '',
      replyTo: campaign.reply_to || '',
      contentHtml: campaign.content_html || '',
      segmentId: campaign.segment_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteCampaign = async (campaignId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this campaign? This action cannot be undone.',
      'Delete Campaign'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/campaigns/${campaignId}?store_id=${storeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setCampaigns(campaigns.filter(c => c.id !== campaignId));
        setFlashMessage({ type: 'success', message: 'Campaign deleted successfully' });
      } else {
        throw new Error('Failed to delete campaign');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      showError('Failed to delete campaign');
    }
  };

  const handleDuplicateCampaign = async (campaign) => {
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/campaigns/${campaign.id}/duplicate?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setCampaigns([data.campaign, ...campaigns]);
        setFlashMessage({ type: 'success', message: 'Campaign duplicated successfully' });
      } else {
        throw new Error('Failed to duplicate campaign');
      }
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      showError('Failed to duplicate campaign');
    }
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showError('Campaign name is required');
      return;
    }

    if (!formData.subject.trim()) {
      showError('Subject line is required');
      return;
    }

    setSaveSuccess(false);
    setSaving(true);

    try {
      const storeId = getSelectedStoreId();
      const url = editingCampaign
        ? `/api/campaigns/${editingCampaign.id}?store_id=${storeId}`
        : `/api/campaigns?store_id=${storeId}`;

      const response = await fetch(url, {
        method: editingCampaign ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();

        if (editingCampaign) {
          setCampaigns(campaigns.map(c => c.id === editingCampaign.id ? data.campaign : c));
        } else {
          setCampaigns([data.campaign, ...campaigns]);
        }

        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditModalOpen(false);
          setEditingCampaign(null);
        }, 1000);

        setFlashMessage({
          type: 'success',
          message: editingCampaign ? 'Campaign updated successfully' : 'Campaign created successfully'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save campaign');
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      showError(error.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSchedule = (campaign) => {
    setSchedulingCampaign(campaign);
    setScheduleDate('');
    setIsScheduleModalOpen(true);
  };

  const handleScheduleCampaign = async () => {
    if (!scheduleDate) {
      showError('Please select a date and time');
      return;
    }

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/campaigns/${schedulingCampaign.id}/schedule?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ scheduledAt: scheduleDate })
      });

      if (response.ok) {
        const data = await response.json();
        setCampaigns(campaigns.map(c => c.id === schedulingCampaign.id ? data.campaign : c));
        setIsScheduleModalOpen(false);
        setSchedulingCampaign(null);
        setFlashMessage({ type: 'success', message: 'Campaign scheduled successfully' });
      } else {
        throw new Error('Failed to schedule campaign');
      }
    } catch (error) {
      console.error('Error scheduling campaign:', error);
      showError('Failed to schedule campaign');
    }
  };

  const handleSendCampaign = async (campaign) => {
    if (!campaign.segment_id) {
      showError('Please select a segment before sending');
      return;
    }

    const confirmed = await showConfirm(
      'Are you sure you want to send this campaign now? This action cannot be undone.',
      'Send Campaign'
    );
    if (!confirmed) return;

    try {
      setSending(campaign.id);
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/campaigns/${campaign.id}/send?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setCampaigns(campaigns.map(c =>
          c.id === campaign.id ? { ...c, status: 'sending' } : c
        ));
        setFlashMessage({
          type: 'success',
          message: `Campaign queued for sending to ${data.recipientCount} recipients`
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send campaign');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      showError(error.message || 'Failed to send campaign');
    } finally {
      setSending(null);
    }
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className={`w-3 h-3 mr-1 ${status === 'sending' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  };

  const getSegmentName = (segmentId) => {
    const segment = segments.find(s => s.id === segmentId);
    return segment?.name || 'No segment';
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
          <h1 className="text-3xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-600 mt-1">Create and send email broadcasts to your customers</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search campaigns..."
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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            All Campaigns ({filteredCampaigns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCampaigns.map(campaign => (
              <div key={campaign.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                        {getStatusBadge(campaign.status)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{campaign.subject}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {getSegmentName(campaign.segment_id)}
                        </span>
                        {campaign.scheduled_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(campaign.scheduled_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {campaign.status === 'sent' && (
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-semibold">{campaign.sent_count || 0}</div>
                          <div className="text-xs text-gray-500">Sent</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold">{campaign.open_count || 0}</div>
                          <div className="text-xs text-gray-500">Opens</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold">{campaign.click_count || 0}</div>
                          <div className="text-xs text-gray-500">Clicks</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenSchedule(campaign)}
                            className="h-8"
                            title="Schedule"
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Schedule
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSendCampaign(campaign)}
                            disabled={sending === campaign.id}
                            className="h-8"
                            title="Send now"
                          >
                            {sending === campaign.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-1" />
                            )}
                            Send
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDuplicateCampaign(campaign)}
                        className="h-8 w-8 p-0"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditCampaign(campaign)}
                          className="h-8 w-8 p-0"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {campaign.status === 'sent' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {/* View stats */}}
                          className="h-8 w-8 p-0"
                          title="View stats"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredCampaigns.length === 0 && (
              <div className="py-8">
                {/* Getting Started Tutorial */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6 mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <Lightbulb className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Create Your First Email Campaign</h3>
                        <p className="text-sm text-gray-600">Follow these steps to send your first broadcast</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTutorial(!showTutorial)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showTutorial ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {showTutorial && (
                    <div className="space-y-4">
                      {/* Step 1 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          1
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-500" />
                            Create a Segment First
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Go to <a href="/admin/marketing/segments" className="text-indigo-600 hover:underline font-medium">Marketing → Segments</a> and create a customer segment.
                            Use RFM segments like "Champions" or "New Customers", or create custom filters.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          2
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            Create Your Campaign
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Click <strong>"Create Campaign"</strong> above. Fill in:
                          </p>
                          <ul className="text-sm text-gray-600 mt-2 ml-4 space-y-1">
                            <li>• <strong>Campaign Name</strong> – Internal name (customers won't see this)</li>
                            <li>• <strong>Subject Line</strong> – What appears in the inbox</li>
                            <li>• <strong>Select Segment</strong> – Choose who receives this email</li>
                            <li>• <strong>Email Content</strong> – Your message in HTML format</li>
                          </ul>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          3
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-indigo-500" />
                            Send or Schedule
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            After creating your campaign, you can:
                          </p>
                          <ul className="text-sm text-gray-600 mt-2 ml-4 space-y-1">
                            <li>• <strong>Send Now</strong> – Immediately sends to all segment members</li>
                            <li>• <strong>Schedule</strong> – Pick a future date/time to send</li>
                          </ul>
                        </div>
                      </div>

                      {/* Tips */}
                      <div className="bg-white/60 rounded-lg p-4 mt-4">
                        <h4 className="font-medium text-gray-900 text-sm mb-2">Pro Tips</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• Test your email by creating a segment with just your own email first</li>
                          <li>• Use personalization: <code className="bg-gray-100 px-1 rounded">{"{{customer_first_name}}"}</code> inserts the customer's name</li>
                          <li>• Send at 10am local time for best open rates</li>
                          <li>• Keep subject lines under 50 characters</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Empty state CTA */}
                <div className="text-center">
                  <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No campaigns yet. Ready to create your first one?</p>
                  <Button onClick={handleCreateNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Campaign
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Campaign Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCampaign} className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Summer Sale Announcement"
                required
              />
            </div>

            <div>
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="e.g., Don't miss our biggest sale of the year!"
                required
              />
            </div>

            <div>
              <Label htmlFor="previewText">Preview Text</Label>
              <Input
                id="previewText"
                value={formData.previewText}
                onChange={(e) => setFormData(prev => ({ ...prev, previewText: e.target.value }))}
                placeholder="Text shown after subject in inbox"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={formData.fromName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
                  placeholder="Your Store Name"
                />
              </div>
              <div>
                <Label htmlFor="fromEmail">From Email</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={formData.fromEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromEmail: e.target.value }))}
                  placeholder="hello@yourstore.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="replyTo">Reply-To Email</Label>
              <Input
                id="replyTo"
                type="email"
                value={formData.replyTo}
                onChange={(e) => setFormData(prev => ({ ...prev, replyTo: e.target.value }))}
                placeholder="support@yourstore.com"
              />
            </div>

            <div>
              <Label htmlFor="segmentId">Send To Segment</Label>
              <Select
                value={formData.segmentId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, segmentId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a segment..." />
                </SelectTrigger>
                <SelectContent>
                  {segments.map(segment => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name} ({segment.member_count || 0} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contentHtml">Email Content (HTML)</Label>
              <Textarea
                id="contentHtml"
                value={formData.contentHtml}
                onChange={(e) => setFormData(prev => ({ ...prev, contentHtml: e.target.value }))}
                placeholder="<html>...</html>"
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your email HTML content or use the visual editor (coming soon)
              </p>
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
                defaultText={editingCampaign ? 'Save Changes' : 'Create Campaign'}
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Modal */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose when to send "{schedulingCampaign?.name}"
            </p>

            <div>
              <Label htmlFor="scheduleDate">Send Date & Time</Label>
              <Input
                id="scheduleDate"
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleScheduleCampaign}>
                <Calendar className="w-4 h-4 mr-2" />
                Schedule
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
