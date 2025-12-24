import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users, TrendingUp, RefreshCw, DollarSign,
  Calendar, ShoppingCart, Star, UserCheck,
  AlertCircle, Heart, UserX, Zap
} from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';

// Segment colors and icons
const SEGMENT_CONFIG = {
  champions: { color: '#10b981', bgColor: '#d1fae5', icon: Star, label: 'Champions' },
  loyal_customers: { color: '#3b82f6', bgColor: '#dbeafe', icon: Heart, label: 'Loyal Customers' },
  potential_loyalist: { color: '#8b5cf6', bgColor: '#ede9fe', icon: TrendingUp, label: 'Potential Loyalists' },
  new_customers: { color: '#06b6d4', bgColor: '#cffafe', icon: Zap, label: 'New Customers' },
  promising: { color: '#f59e0b', bgColor: '#fef3c7', icon: UserCheck, label: 'Promising' },
  need_attention: { color: '#f97316', bgColor: '#ffedd5', icon: AlertCircle, label: 'Need Attention' },
  about_to_sleep: { color: '#ef4444', bgColor: '#fee2e2', icon: AlertCircle, label: 'About to Sleep' },
  at_risk: { color: '#dc2626', bgColor: '#fecaca', icon: AlertCircle, label: 'At Risk' },
  cant_lose_them: { color: '#be123c', bgColor: '#ffe4e6', icon: Heart, label: "Can't Lose Them" },
  hibernating: { color: '#6b7280', bgColor: '#f3f4f6', icon: UserX, label: 'Hibernating' },
  lost: { color: '#374151', bgColor: '#e5e7eb', icon: UserX, label: 'Lost' }
};

export default function RfmDashboard() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [segments, setSegments] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentCustomers, setSegmentCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [isCustomersModalOpen, setIsCustomersModalOpen] = useState(false);

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

      const [segmentsRes, distributionRes, statsRes, matrixRes] = await Promise.all([
        fetch(`/api/rfm/segments?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/rfm/distribution?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/rfm/statistics?store_id=${storeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/rfm/matrix?store_id=${storeId}`, { headers: getAuthHeaders() })
      ]);

      if (segmentsRes.ok) {
        const data = await segmentsRes.json();
        setSegments(data.segments || []);
      }

      if (distributionRes.ok) {
        const data = await distributionRes.json();
        setDistribution(data.distribution || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data.statistics || null);
      }

      if (matrixRes.ok) {
        const data = await matrixRes.json();
        setMatrix(data.matrix || null);
      }
    } catch (error) {
      console.error('Error loading RFM data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    try {
      setCalculating(true);

      const response = await fetch(`/api/rfm/calculate?store_id=${storeId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        // Reload data after calculation
        await loadData();
      }
    } catch (error) {
      console.error('Error calculating RFM:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleViewSegmentCustomers = async (segmentKey) => {
    const storeId = getSelectedStoreId();
    if (!storeId) return;

    setSelectedSegment(segmentKey);
    setIsCustomersModalOpen(true);
    setCustomersLoading(true);

    try {
      const response = await fetch(`/api/rfm/customers/${segmentKey}?store_id=${storeId}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSegmentCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error loading segment customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
  };

  const getSegmentConfig = (key) => {
    return SEGMENT_CONFIG[key] || {
      color: '#6b7280',
      bgColor: '#f3f4f6',
      icon: Users,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    };
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  const totalCustomers = distribution.reduce((sum, d) => sum + (d.count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">RFM Analysis</h2>
          <p className="text-gray-600">Customer segmentation based on Recency, Frequency, and Monetary value</p>
        </div>
        <Button onClick={handleRecalculate} disabled={calculating}>
          <RefreshCw className={`w-4 h-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
          {calculating ? 'Calculating...' : 'Recalculate Scores'}
        </Button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Customers</p>
                  <p className="text-2xl font-bold">{formatNumber(statistics.totalCustomers)}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Average Order Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(statistics.avgOrderValue)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Purchase Frequency</p>
                  <p className="text-2xl font-bold">{(statistics.avgFrequency || 0).toFixed(1)}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Days Since Purchase</p>
                  <p className="text-2xl font-bold">{Math.round(statistics.avgRecency || 0)}</p>
                </div>
                <Calendar className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Segment Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Segments</CardTitle>
          <CardDescription>
            Distribution of customers across RFM segments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {distribution.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No RFM data available yet.</p>
              <p className="text-sm">Click "Recalculate Scores" to analyze your customers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Distribution bars */}
              <div className="space-y-3">
                {distribution.map((item) => {
                  const config = getSegmentConfig(item.segment);
                  const percentage = totalCustomers > 0 ? (item.count / totalCustomers * 100) : 0;
                  const Icon = config.icon;

                  return (
                    <div
                      key={item.segment}
                      className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                      onClick={() => handleViewSegmentCustomers(item.segment)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: config.bgColor }}
                          >
                            <Icon className="w-4 h-4" style={{ color: config.color }} />
                          </div>
                          <span className="font-medium text-gray-900">{config.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" style={{ borderColor: config.color, color: config.color }}>
                            {item.count} customers
                          </Badge>
                          <span className="text-sm text-gray-500 w-16 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: config.color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RFM Matrix Visualization */}
      {matrix && (
        <Card>
          <CardHeader>
            <CardTitle>RFM Matrix</CardTitle>
            <CardDescription>
              Frequency vs Recency scores (cell color intensity = monetary value)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Matrix header */}
                <div className="flex items-center mb-2">
                  <div className="w-20 text-sm text-gray-500" />
                  <div className="flex-1 text-center text-sm font-medium text-gray-700">
                    Frequency Score
                  </div>
                </div>
                <div className="flex">
                  <div className="w-20 flex flex-col justify-center">
                    <span className="text-sm text-gray-500 transform -rotate-90 whitespace-nowrap origin-center">
                      Recency Score
                    </span>
                  </div>
                  <div className="flex-1">
                    {/* Column headers (Frequency 1-5) */}
                    <div className="flex gap-1 mb-1 ml-6">
                      {[1, 2, 3, 4, 5].map(f => (
                        <div key={f} className="w-16 text-center text-xs font-medium text-gray-500">
                          {f}
                        </div>
                      ))}
                    </div>
                    {/* Matrix rows */}
                    {[5, 4, 3, 2, 1].map(r => (
                      <div key={r} className="flex items-center gap-1 mb-1">
                        <div className="w-6 text-xs font-medium text-gray-500 text-right">
                          {r}
                        </div>
                        {[1, 2, 3, 4, 5].map(f => {
                          const cell = matrix.find(m => m.r === r && m.f === f);
                          const count = cell?.count || 0;
                          const avgMonetary = cell?.avgMonetary || 0;
                          // Calculate intensity based on monetary value
                          const maxMonetary = Math.max(...matrix.map(m => m.avgMonetary || 0), 1);
                          const intensity = avgMonetary / maxMonetary;

                          return (
                            <div
                              key={`${r}-${f}`}
                              className="w-16 h-12 rounded flex items-center justify-center text-xs font-medium transition-colors cursor-pointer hover:ring-2 hover:ring-indigo-400"
                              style={{
                                backgroundColor: count > 0
                                  ? `rgba(99, 102, 241, ${0.1 + intensity * 0.7})`
                                  : '#f3f4f6',
                                color: intensity > 0.5 ? 'white' : '#374151'
                              }}
                              title={`R:${r} F:${f} - ${count} customers, Avg: ${formatCurrency(avgMonetary)}`}
                            >
                              {count > 0 ? count : '-'}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }} />
                    <span>Low monetary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(99, 102, 241, 0.8)' }} />
                    <span>High monetary</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Segment Definitions */}
      <Card>
        <CardHeader>
          <CardTitle>Segment Definitions</CardTitle>
          <CardDescription>
            How RFM scores map to customer segments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((segment) => {
              const config = getSegmentConfig(segment.key);
              const Icon = config.icon;

              return (
                <div
                  key={segment.key}
                  className="p-4 rounded-lg border"
                  style={{ borderColor: config.color, backgroundColor: config.bgColor }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                    <span className="font-semibold" style={{ color: config.color }}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{segment.description}</p>
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">RFM Range:</span> R:{segment.recencyRange}, F:{segment.frequencyRange}, M:{segment.monetaryRange}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Segment Customers Modal */}
      <Dialog open={isCustomersModalOpen} onOpenChange={setIsCustomersModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSegment && (
                <>
                  {React.createElement(getSegmentConfig(selectedSegment).icon, {
                    className: "w-5 h-5",
                    style: { color: getSegmentConfig(selectedSegment).color }
                  })}
                  {getSegmentConfig(selectedSegment).label} Customers
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {customersLoading ? (
            <div className="py-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading customers...</p>
            </div>
          ) : segmentCustomers.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No customers in this segment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {segmentCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">R: {customer.recency_score}</Badge>
                      <Badge variant="outline" className="text-xs">F: {customer.frequency_score}</Badge>
                      <Badge variant="outline" className="text-xs">M: {customer.monetary_score}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Total: {formatCurrency(customer.total_spent)} | Orders: {customer.order_count}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
