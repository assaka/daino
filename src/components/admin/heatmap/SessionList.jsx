import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw,
  Users,
  Clock,
  MousePointer,
  Eye,
  Smartphone,
  Monitor,
  Tablet,
  ChevronRight,
  Play,
  Filter
} from 'lucide-react';
import apiClient from '@/api/client';

export default function SessionList({ storeId, dateRange, onSessionSelect }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [interactionTypeFilter, setInteractionTypeFilter] = useState('all');
  const [pageFilter, setPageFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (storeId) {
      loadSessions();
    }
  }, [storeId, dateRange, deviceFilter, interactionTypeFilter, currentPage]);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString()
      });

      if (deviceFilter && deviceFilter !== 'all') {
        params.append('device_type', deviceFilter);
      }

      if (interactionTypeFilter && interactionTypeFilter !== 'all') {
        params.append('interaction_type', interactionTypeFilter);
      }

      if (pageFilter) {
        params.append('page_url', pageFilter);
      }

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

      const response = await apiClient.get(`heatmap/sessions/${storeId}?${params}`);
      setSessions(response.data || []);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getDeviceIcon = (device) => {
    switch (device) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      case 'desktop': return <Monitor className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getBrowserFromUserAgent = (userAgent) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Sessions
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label htmlFor="device-filter">Device Type</Label>
            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="tablet">Tablet</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="interaction-type-filter">Interaction Type</Label>
            <Select value={interactionTypeFilter} onValueChange={setInteractionTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interactions</SelectItem>
                <SelectItem value="click">Clicks</SelectItem>
                <SelectItem value="hover">Hovers</SelectItem>
                <SelectItem value="scroll">Scrolling</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="page-filter">Filter by Page</Label>
            <Input
              id="page-filter"
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              placeholder="Enter page URL"
            />
          </div>
        </div>

        {error && (
          <div className="text-center py-4 text-red-600">
            <p>Error loading sessions: {error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading sessions...</p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No sessions found</p>
            <p className="text-sm mt-2">Try adjusting the filters</p>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">Total Sessions</span>
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {sessions.length}
                </div>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Avg Duration</span>
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {formatDuration(
                    Math.round(
                      sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length
                    )
                  )}
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 text-purple-600 mb-1">
                  <MousePointer className="w-4 h-4" />
                  <span className="text-xs font-medium">Avg Interactions</span>
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {Math.round(
                    sessions.reduce((sum, s) => sum + parseInt(s.interaction_count || 0), 0) / sessions.length
                  )}
                </div>
              </div>
            </div>

            {/* Sessions list */}
            <div className="space-y-2">
              {sessions.map((session, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onSessionSelect && onSessionSelect(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Session header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(session.device_type)}
                          <Badge variant="outline" className="text-xs">
                            {session.device_type || 'desktop'}
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {getBrowserFromUserAgent(session.user_agent)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatTime(session.session_start)}
                        </span>
                      </div>

                      {/* Session metrics */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(session.duration_seconds || 0)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Eye className="w-3 h-3" />
                          <span>{session.pages_visited || 0} pages</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <MousePointer className="w-3 h-3" />
                          <span>{session.interaction_count || 0} interactions</span>
                        </div>
                        {session.click_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {session.click_count} clicks
                          </Badge>
                        )}
                      </div>

                      {/* Session ID */}
                      <div className="mt-2 text-xs text-gray-500 font-mono">
                        Session: {session.session_id.substring(0, 24)}...
                      </div>
                    </div>

                    {/* Play button */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSessionSelect && onSessionSelect(session);
                        }}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={sessions.length < pageSize}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
