import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Calendar, DollarSign, TrendingUp, Download } from 'lucide-react';
import apiClient from '@/api/client';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';

export default function UptimeReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedDays, setSelectedDays] = useState(30);
  const [dailyPublishingCost, setDailyPublishingCost] = useState(1); // Default fallback
  const { selectedStoreId, selectedStoreName } = useStoreSelection();

  useEffect(() => {
    if (selectedStoreId) {
      loadUptimeReport();
    }
  }, [selectedDays, selectedStoreId]);

  useEffect(() => {
    loadPublishingCost();
  }, []);

  const loadPublishingCost = async () => {
    try {
      const response = await apiClient.get('service-credit-costs/key/store_daily_publishing');
      if (response.success && response.service) {
        setDailyPublishingCost(response.service.cost_per_unit);
      }
    } catch (error) {
      console.error('Error loading publishing cost:', error);
      // Keep using default fallback value
    }
  };

  const loadUptimeReport = async () => {
    setLoading(true);
    try {
      if (!selectedStoreId) {
        setData({
          summary: { total_stores: 0, total_days: 0, total_credits_charged: 0 },
          store_breakdown: [],
          records: []
        });
        setLoading(false);
        return;
      }

      // Fetch uptime data for the currently selected store only
      const response = await apiClient.get(
        `credits/uptime-report?days=${selectedDays}&store_id=${selectedStoreId}`
      );

      if (response) {
        setData(response);
      } else {
        setData({
          summary: { total_stores: 0, total_days: 0, total_credits_charged: 0 },
          store_breakdown: [],
          records: []
        });
      }
    } catch (error) {
      console.error('Error loading uptime report:', error);
      setData({
        summary: { total_stores: 0, total_days: 0, total_credits_charged: 0 },
        store_breakdown: [],
        records: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Store Uptime Report</h1>
          <p className="text-gray-600 mt-1">
            {selectedStoreName ? `Showing uptime for: ${selectedStoreName}` : 'Track daily charges for running stores'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map(days => (
            <Button
              key={days}
              variant={selectedDays === days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDays(days)}
            >
              {days} Days
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Stores</CardTitle>
            <Activity className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.total_stores || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Stores with uptime charges</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Days Running</CardTitle>
            <Calendar className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.total_days || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Combined uptime across all stores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Credits Charged</CardTitle>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.total_credits_charged || 0}</div>
            <p className="text-xs text-gray-500 mt-1">{dailyPublishingCost} credit{dailyPublishingCost !== 1 ? 's' : ''} per store per day</p>
          </CardContent>
        </Card>
      </div>

      {/* Store Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Store Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.store_breakdown && data.store_breakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="pb-3">Store Name</th>
                    <th className="pb-3 text-center">Days Running</th>
                    <th className="pb-3 text-center">Total Credits</th>
                    <th className="pb-3">First Charge</th>
                    <th className="pb-3">Last Charge</th>
                    <th className="pb-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.store_breakdown.map((store) => (
                    <tr key={store.store_id} className="text-sm">
                      <td className="py-3 font-medium">{store.store_name}</td>
                      <td className="py-3 text-center">{store.days_running}</td>
                      <td className="py-3 text-center font-semibold">{store.total_credits}</td>
                      <td className="py-3 text-gray-600">
                        {new Date(store.first_charge).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-gray-600">
                        {new Date(store.last_charge).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-center">
                        <Badge className={store.currently_published ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {store.currently_published ? 'Running' : 'Paused'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No uptime charges recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Daily Charge History */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Charge History</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.records && data.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Store Name</th>
                    <th className="pb-3 text-center">Credits Charged</th>
                    <th className="pb-3 text-right">Balance Before</th>
                    <th className="pb-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.records.map((record) => (
                    <tr key={record.id} className="text-sm">
                      <td className="py-3 text-gray-900">
                        {new Date(record.charged_date).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{record.store_name}</span>
                          {record.currently_published && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              Running
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-center font-semibold text-red-600">
                        -{record.credits_charged}
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {record.user_balance_before}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {record.user_balance_after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No uptime records yet</h3>
              <p className="text-gray-600 mb-6">
                Daily charges will appear here when stores are running.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
