import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ArrowDown, Users, Search, X } from 'lucide-react';
import apiClient from '@/api/client';

export default function ScrollDepthMap({ storeId, pageUrl: initialPageUrl, dateRange }) {
  const [scrollData, setScrollData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // URL Search state
  const [pageUrl, setPageUrl] = useState(initialPageUrl || '');
  const [urlSearchQuery, setUrlSearchQuery] = useState('');
  const [urlsWithEvents, setUrlsWithEvents] = useState([]);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);

  useEffect(() => {
    if (storeId && pageUrl) {
      loadScrollData();
    }
  }, [storeId, pageUrl, dateRange]);

  // Load URLs with events when store changes
  useEffect(() => {
    if (storeId) {
      loadUrlsWithEvents();
    }
  }, [storeId]);

  // Sync with initial page URL prop
  useEffect(() => {
    if (initialPageUrl && initialPageUrl !== pageUrl) {
      setPageUrl(initialPageUrl);
    }
  }, [initialPageUrl]);

  // Helper function to convert full URL to relative path
  const toRelativeUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      return url;
    }
  };

  const loadUrlsWithEvents = async () => {
    if (!storeId) return;

    setLoadingUrls(true);
    try {
      const response = await apiClient.get(`heatmap/summary/${storeId}?group_by=page_url`);
      if (response.data && Array.isArray(response.data)) {
        const urlMap = new Map();
        response.data.forEach(item => {
          const url = item.page_url;
          if (url) {
            const existing = urlMap.get(url) || { url, count: 0 };
            existing.count += item.interaction_count || 0;
            urlMap.set(url, existing);
          }
        });
        const urls = Array.from(urlMap.values()).sort((a, b) => b.count - a.count);
        setUrlsWithEvents(urls);
      }
    } catch (err) {
      console.warn('Error loading URLs with events:', err);
      setUrlsWithEvents([]);
    } finally {
      setLoadingUrls(false);
    }
  };

  // Filter URLs (exclude admin, show relative)
  const filteredUrls = urlsWithEvents
    .filter(item => {
      const relativeUrl = toRelativeUrl(item.url);
      if (relativeUrl.includes('/admin')) return false;
      return relativeUrl.toLowerCase().includes(urlSearchQuery.toLowerCase());
    })
    .map(item => ({
      ...item,
      displayUrl: toRelativeUrl(item.url)
    }));

  const loadScrollData = async () => {
    if (!storeId || !pageUrl) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page_url: pageUrl,
        bucket_size: 10
      });

      // Add date range
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        let startDate;

        switch (dateRange) {
          case '1d':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        if (startDate) {
          params.append('start_date', startDate.toISOString());
          params.append('end_date', now.toISOString());
        }
      }

      const response = await apiClient.get(`heatmap/scroll-depth/${storeId}?${params}`);
      setScrollData(response.data || []);
    } catch (err) {
      console.error('Error loading scroll depth data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getColorForPercentage = (percentage) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTextColorForPercentage = (percentage) => {
    if (percentage >= 80) return 'text-green-700';
    if (percentage >= 60) return 'text-yellow-700';
    if (percentage >= 40) return 'text-orange-700';
    return 'text-red-700';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDown className="w-5 h-5" />
            Scroll Depth Map
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadScrollData}
            disabled={loading || !pageUrl}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* URL Search */}
        <div className="relative mb-6">
          <Label htmlFor="scroll-page-url">Page URL</Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <Input
              id="scroll-page-url"
              value={urlSearchQuery}
              onChange={(e) => {
                setUrlSearchQuery(e.target.value);
                setShowUrlDropdown(true);
              }}
              onFocus={() => setShowUrlDropdown(true)}
              placeholder={pageUrl ? toRelativeUrl(pageUrl) : "Search URLs..."}
              className="w-full pl-9 pr-8"
            />
            {(pageUrl || urlSearchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setPageUrl('');
                  setUrlSearchQuery('');
                  setShowUrlDropdown(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* URL Search Dropdown */}
          {showUrlDropdown && (
            <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-[500px]">
              {loadingUrls ? (
                <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading URLs with events...
                </div>
              ) : filteredUrls.length > 0 ? (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                    URLs with recorded events ({filteredUrls.length})
                  </div>
                  {filteredUrls.slice(0, 20).map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setPageUrl(item.url);
                        setUrlSearchQuery('');
                        setShowUrlDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between group"
                    >
                      <span className="text-sm text-gray-700 truncate flex-1 mr-2" title={item.displayUrl}>
                        {item.displayUrl}
                      </span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {item.count.toLocaleString()} events
                      </Badge>
                    </button>
                  ))}
                  {filteredUrls.length > 20 && (
                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                      Showing 20 of {filteredUrls.length} URLs
                    </div>
                  )}
                </>
              ) : urlsWithEvents.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No URLs with recorded events yet
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No matching URLs found
                </div>
              )}
            </div>
          )}
          {/* Click outside to close dropdown */}
          {showUrlDropdown && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUrlDropdown(false)}
            />
          )}
        </div>

        {!pageUrl && (
          <div className="text-center py-8 text-gray-500">
            <ArrowDown className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Select a page URL to see scroll depth analytics</p>
          </div>
        )}
        {error && (
          <div className="text-center py-4 text-red-600">
            <p>Error loading scroll data: {error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading scroll depth data...</p>
          </div>
        )}

        {!loading && !error && scrollData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No scroll data available for this page</p>
          </div>
        )}

        {!loading && !error && scrollData.length > 0 && (
          <div className="space-y-4">
            {/* Description */}
            <div className="text-sm text-gray-600 mb-4">
              <p>Shows what percentage of users scrolled to each page depth</p>
            </div>

            {/* Scroll depth visualization */}
            <div className="space-y-2">
              {scrollData.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-700">
                        {item.depth_range}
                      </span>
                      <span className={`text-xs ${getTextColorForPercentage(item.percentage)}`}>
                        {item.percentage.toFixed(1)}% of users
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      {item.users_reached} users
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative w-full h-8 bg-gray-100 rounded overflow-hidden">
                    <div
                      className={`h-full ${getColorForPercentage(item.percentage)} transition-all duration-300 flex items-center justify-end pr-2`}
                      style={{ width: `${item.percentage}%` }}
                    >
                      {item.percentage > 15 && (
                        <span className="text-xs font-semibold text-white">
                          {item.percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {item.percentage <= 15 && item.percentage > 0 && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600">
                        {item.percentage.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>High retention (80%+)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span>Good (60-79%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span>Fair (40-59%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>Low (&lt;40%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Insights */}
            {scrollData.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 mb-2">Insights:</p>
                  <ul className="space-y-1 text-blue-700">
                    {scrollData[0]?.percentage < 50 && (
                      <li>• Only {scrollData[0].percentage.toFixed(0)}% of users reach the fold - consider moving key content higher</li>
                    )}
                    {scrollData.find(d => d.depth_percent >= 50 && d.percentage < 25) && (
                      <li>• Significant drop-off at 50% depth - content may not be engaging enough</li>
                    )}
                    {scrollData.find(d => d.depth_percent >= 90 && d.percentage >= 30) && (
                      <li>• {scrollData.find(d => d.depth_percent >= 90).percentage.toFixed(0)}% of users scroll to the bottom - great engagement!</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
