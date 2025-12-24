import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import NoStoreSelected from '@/components/admin/NoStoreSelected';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, Target, TrendingUp, ArrowUp, ArrowDown,
  Handshake, UserPlus, ListTodo, Calendar
} from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';

export default function CrmDashboard() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDeals: 0,
    totalValue: 0,
    wonDeals: 0,
    wonValue: 0,
    openLeads: 0,
    convertedLeads: 0,
    activitiesThisWeek: 0,
    overdueActivities: 0
  });
  const [recentDeals, setRecentDeals] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);

  useEffect(() => {
    if (selectedStore) {
      loadDashboardData();
    }
  }, [selectedStore]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
  });

  const loadDashboardData = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load CRM stats
      const [dealsRes, leadsRes] = await Promise.all([
        fetch(`/api/crm/deals?store_id=${storeId}&limit=5`, { headers: getAuthHeaders() }),
        fetch(`/api/crm/leads?store_id=${storeId}&limit=5`, { headers: getAuthHeaders() })
      ]);

      if (dealsRes.ok) {
        const data = await dealsRes.json();
        setRecentDeals(data.deals || []);

        // Calculate deal stats
        const deals = data.deals || [];
        const wonDeals = deals.filter(d => d.status === 'won');
        setStats(prev => ({
          ...prev,
          totalDeals: data.total || deals.length,
          totalValue: deals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0),
          wonDeals: wonDeals.length,
          wonValue: wonDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)
        }));
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setRecentLeads(data.leads || []);

        const leads = data.leads || [];
        setStats(prev => ({
          ...prev,
          openLeads: leads.filter(l => l.status === 'new' || l.status === 'contacted').length,
          convertedLeads: leads.filter(l => l.status === 'converted').length
        }));
      }
    } catch (error) {
      console.error('Error loading CRM dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
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
        <h1 className="text-3xl font-bold text-gray-900">CRM Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your sales pipeline and customer relationships</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Deals</p>
                <p className="text-2xl font-bold">{stats.totalDeals}</p>
                <p className="text-sm text-gray-400">{formatCurrency(stats.totalValue)} value</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Handshake className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Won Deals</p>
                <p className="text-2xl font-bold">{stats.wonDeals}</p>
                <p className="text-sm text-green-600 flex items-center">
                  <ArrowUp className="w-3 h-3 mr-1" />
                  {formatCurrency(stats.wonValue)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Open Leads</p>
                <p className="text-2xl font-bold">{stats.openLeads}</p>
                <p className="text-sm text-gray-400">{stats.convertedLeads} converted</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Activities</p>
                <p className="text-2xl font-bold">{stats.activitiesThisWeek}</p>
                <p className="text-sm text-orange-600 flex items-center">
                  {stats.overdueActivities > 0 && (
                    <><ArrowDown className="w-3 h-3 mr-1" />{stats.overdueActivities} overdue</>
                  )}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <ListTodo className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Handshake className="w-5 h-5" />
                Recent Deals
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/crm/deals'}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentDeals.length > 0 ? (
              <div className="space-y-3">
                {recentDeals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{deal.name}</p>
                      <p className="text-sm text-gray-500">{deal.company_name || 'No company'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(deal.value || 0)}</p>
                      <p className={`text-xs ${
                        deal.status === 'won' ? 'text-green-600' :
                        deal.status === 'lost' ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {deal.status?.charAt(0).toUpperCase() + deal.status?.slice(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Handshake className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No deals yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => window.location.href = '/admin/crm/deals'}
                >
                  Create your first deal
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Recent Leads
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/crm/leads'}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentLeads.length > 0 ? (
              <div className="space-y-3">
                {recentLeads.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-purple-600">
                          {(lead.first_name?.[0] || lead.email?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{lead.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Score: {lead.score || 0}</p>
                      <p className={`text-xs ${
                        lead.status === 'converted' ? 'text-green-600' :
                        lead.status === 'qualified' ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {lead.status?.charAt(0).toUpperCase() + lead.status?.slice(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No leads yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => window.location.href = '/admin/crm/leads'}
                >
                  Add your first lead
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.href = '/admin/crm/deals'}>
              <Handshake className="w-4 h-4 mr-2" />
              New Deal
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/admin/crm/leads'}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/admin/crm/activities'}>
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Activity
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/admin/crm/pipelines'}>
              <Target className="w-4 h-4 mr-2" />
              Manage Pipelines
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
