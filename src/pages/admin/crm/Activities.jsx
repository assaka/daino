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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, Plus, Edit, Trash2, Phone, Mail, Calendar,
  CheckSquare, FileText, Clock, User, Building, Check
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

const ACTIVITY_TYPES = {
  call: { label: 'Call', icon: Phone, color: 'bg-blue-100 text-blue-600' },
  email: { label: 'Email', icon: Mail, color: 'bg-green-100 text-green-600' },
  meeting: { label: 'Meeting', icon: Calendar, color: 'bg-purple-100 text-purple-600' },
  task: { label: 'Task', icon: CheckSquare, color: 'bg-orange-100 text-orange-600' },
  note: { label: 'Note', icon: FileText, color: 'bg-gray-100 text-gray-600' }
};

export default function Activities() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [activities, setActivities] = useState([]);
  const [deals, setDeals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingActivity, setEditingActivity] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [formData, setFormData] = useState({
    activityType: 'task',
    subject: '',
    description: '',
    dueDate: '',
    dueTime: '',
    dealId: '',
    leadId: '',
    completed: false
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

      const [activitiesRes, dealsRes, leadsRes] = await Promise.all([
        fetch(`/api/crm/activities?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/crm/deals?store_id=${storeId}&limit=100`, { headers: getAuthHeaders() }),
        fetch(`/api/crm/leads?store_id=${storeId}&limit=100`, { headers: getAuthHeaders() })
      ]);

      if (activitiesRes.ok) {
        const data = await activitiesRes.json();
        setActivities(data.activities || []);
      }

      if (dealsRes.ok) {
        const data = await dealsRes.json();
        setDeals(data.deals || []);
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      showError('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch =
      (activity.subject?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (activity.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || activity.activity_type === typeFilter;
    const matchesCompleted = showCompleted || !activity.completed;
    return matchesSearch && matchesType && matchesCompleted;
  });

  const groupedActivities = {
    overdue: filteredActivities.filter(a => !a.completed && a.due_date && new Date(a.due_date) < new Date()),
    today: filteredActivities.filter(a => {
      if (a.completed) return false;
      if (!a.due_date) return false;
      const dueDate = new Date(a.due_date);
      const today = new Date();
      return dueDate.toDateString() === today.toDateString();
    }),
    upcoming: filteredActivities.filter(a => {
      if (a.completed) return false;
      if (!a.due_date) return false;
      const dueDate = new Date(a.due_date);
      const today = new Date();
      return dueDate > today && dueDate.toDateString() !== today.toDateString();
    }),
    completed: filteredActivities.filter(a => a.completed),
    noDate: filteredActivities.filter(a => !a.completed && !a.due_date)
  };

  const handleCreateNew = () => {
    setEditingActivity(null);
    setFormData({
      activityType: 'task',
      subject: '',
      description: '',
      dueDate: '',
      dueTime: '',
      dealId: '',
      leadId: '',
      completed: false
    });
    setIsEditModalOpen(true);
  };

  const handleEditActivity = (activity) => {
    setEditingActivity(activity);
    setFormData({
      activityType: activity.activity_type || 'task',
      subject: activity.subject || '',
      description: activity.description || '',
      dueDate: activity.due_date?.split('T')[0] || '',
      dueTime: activity.due_time || '',
      dealId: activity.deal_id || '',
      leadId: activity.lead_id || '',
      completed: activity.completed || false
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteActivity = async (activityId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this activity?',
      'Delete Activity'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/crm/activities/${activityId}?store_id=${storeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setActivities(activities.filter(a => a.id !== activityId));
        setFlashMessage({ type: 'success', message: 'Activity deleted successfully' });
      } else {
        throw new Error('Failed to delete activity');
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      showError('Failed to delete activity');
    }
  };

  const handleToggleComplete = async (activity) => {
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(`/api/crm/activities/${activity.id}?store_id=${storeId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ completed: !activity.completed })
      });

      if (response.ok) {
        setActivities(activities.map(a =>
          a.id === activity.id ? { ...a, completed: !a.completed } : a
        ));
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      showError('Failed to update activity');
    }
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();

    if (!formData.subject.trim()) {
      showError('Subject is required');
      return;
    }

    setSaveSuccess(false);
    setSaving(true);

    try {
      const storeId = getSelectedStoreId();
      const url = editingActivity
        ? `/api/crm/activities/${editingActivity.id}?store_id=${storeId}`
        : `/api/crm/activities?store_id=${storeId}`;

      const response = await fetch(url, {
        method: editingActivity ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();

        if (editingActivity) {
          setActivities(activities.map(a => a.id === editingActivity.id ? data.activity : a));
        } else {
          setActivities([data.activity, ...activities]);
        }

        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsEditModalOpen(false);
          setEditingActivity(null);
        }, 1000);

        setFlashMessage({
          type: 'success',
          message: editingActivity ? 'Activity updated successfully' : 'Activity created successfully'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save activity');
      }
    } catch (error) {
      console.error('Error saving activity:', error);
      showError(error.message || 'Failed to save activity');
    } finally {
      setSaving(false);
    }
  };

  const renderActivityList = (activityList, title, emptyMessage) => {
    if (activityList.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-3">{title} ({activityList.length})</h3>
        <div className="space-y-2">
          {activityList.map(activity => {
            const TypeConfig = ACTIVITY_TYPES[activity.activity_type] || ACTIVITY_TYPES.note;
            const Icon = TypeConfig.icon;

            return (
              <div
                key={activity.id}
                className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 ${
                  activity.completed ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => handleToggleComplete(activity)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    activity.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {activity.completed && <Check className="w-3 h-3" />}
                </button>

                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${TypeConfig.color}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${activity.completed ? 'line-through text-gray-500' : ''}`}>
                    {activity.subject}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {activity.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.due_date).toLocaleDateString()}
                        {activity.due_time && ` at ${activity.due_time}`}
                      </span>
                    )}
                    {activity.deal_name && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {activity.deal_name}
                      </span>
                    )}
                    {activity.lead_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {activity.lead_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleEditActivity(activity)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteActivity(activity.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-600 mt-1">Track calls, meetings, tasks, and notes</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Add Activity
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(ACTIVITY_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              Show completed
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {groupedActivities.overdue.length > 0 && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              {renderActivityList(groupedActivities.overdue, 'Overdue')}
            </div>
          )}

          {renderActivityList(groupedActivities.today, 'Today')}
          {renderActivityList(groupedActivities.upcoming, 'Upcoming')}
          {renderActivityList(groupedActivities.noDate, 'No Due Date')}
          {showCompleted && renderActivityList(groupedActivities.completed, 'Completed')}

          {filteredActivities.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No activities found</h3>
              <p className="text-gray-600 mb-4">Start tracking your sales activities</p>
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Add Activity
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Activity Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Edit Activity' : 'Add Activity'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveActivity} className="space-y-4">
            <div>
              <Label htmlFor="activityType">Activity Type</Label>
              <Select
                value={formData.activityType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, activityType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="e.g., Follow up on proposal"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add details..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="dueTime">Time</Label>
                <Input
                  id="dueTime"
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dealId">Related Deal</Label>
                <Select
                  value={formData.dealId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, dealId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select deal..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {deals.map(deal => (
                      <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="leadId">Related Lead</Label>
                <Select
                  value={formData.leadId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, leadId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {leads.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.first_name} {lead.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingActivity && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="completed"
                  checked={formData.completed}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, completed: checked }))}
                />
                <Label htmlFor="completed">Mark as completed</Label>
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
                defaultText={editingActivity ? 'Save Changes' : 'Add Activity'}
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
