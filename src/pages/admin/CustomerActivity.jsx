import React, { useState, useEffect } from "react";
import { CustomerActivity } from "@/api/entities";
import { Store } from "@/api/entities";
import { User } from "@/api/entities";
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye, ShoppingCart, Search, Heart, CreditCard, Package, RefreshCw, Calendar, ChevronLeft, ChevronRight, Activity, Users, CheckCircle, TrendingUp, BarChart3, Clock, Monitor, Smartphone, Tablet, Globe } from "lucide-react";
import SimpleLineChart from "@/components/admin/analytics/SimpleLineChart";
import DonutChart from "@/components/admin/analytics/DonutChart";
import apiClient from "@/api/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function CustomerActivityPage() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [activities, setActivities] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");

  // Analytics dashboard state
  const [analytics, setAnalytics] = useState({
    topProducts: [],
    topPages: [],
    bestSellers: [],
    conversionFunnel: {},
    timeSeriesData: []
  });

  // Widget visibility (localStorage persistence)
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem('analytics_widgets');
      return saved ? JSON.parse(saved) : {
        traffic: true, demographics: true, topProducts: true,
        bestSellers: true, funnel: true, geo: true, searches: true
      };
    } catch {
      return { traffic: true, demographics: true, topProducts: true,
        bestSellers: true, funnel: true, geo: true, searches: true };
    }
  });

  const toggleWidget = (key) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    localStorage.setItem('analytics_widgets', JSON.stringify(updated));
  };

  // Real-time and session analytics
  const [realtimeData, setRealtimeData] = useState({
    users_online: 0,
    logged_in_users: 0,
    guest_users: 0,
    active_pages: []
  });
  const [sessionAnalytics, setSessionAnalytics] = useState({
    total_sessions: 0,
    avg_session_duration: 0,
    avg_events_per_session: 0,
    device_breakdown: {},
    browser_breakdown: {},
    os_breakdown: {},
    country_breakdown: {},
    city_breakdown: {},
    language_breakdown: {}
  });
  const [timeSeriesData, setTimeSeriesData] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Date range filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (selectedStore) {
      loadData(1); // Reset to page 1 when store changes
      loadRealtimeData(); // Load real-time users
      loadSessionAnalytics(); // Load session data
      loadTimeSeriesData(); // Load time-series chart data
    }
  }, [selectedStore, startDate, endDate]);

  // Auto-refresh real-time data every 30 seconds
  useEffect(() => {
    if (!selectedStore) return;

    const interval = setInterval(() => {
      loadRealtimeData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [selectedStore]);

  const loadRealtimeData = async () => {
    if (!selectedStore) return;

    try {
      const response = await apiClient.get(`/analytics-dashboard/${selectedStore.id}/realtime`);
      // apiClient auto-unwraps { success: true, data: {...} } responses
      // So response.data is already the realtime data object
      if (response.data && response.data.users_online !== undefined) {
        setRealtimeData(response.data);
      }
    } catch (error) {
      console.error('Error loading realtime data:', error);
    }
  };

  const loadSessionAnalytics = async () => {
    if (!selectedStore) return;

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await apiClient.get(`/analytics-dashboard/${selectedStore.id}/sessions?${params}`);
      // apiClient auto-unwraps { success: true, data: {...} } responses
      // So response.data is already the analytics data object
      if (response.data && response.data.total_sessions !== undefined) {
        setSessionAnalytics(response.data);
      }
    } catch (error) {
      console.error('Error loading session analytics:', error);
    }
  };

  const loadTimeSeriesData = async () => {
    if (!selectedStore) return;

    try {
      const params = new URLSearchParams({ interval: 'hour' });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await apiClient.get(`/analytics-dashboard/${selectedStore.id}/timeseries?${params}`);
      // apiClient auto-unwraps { success: true, data: [...] } responses
      // So response.data is already the array of time series data
      if (response.data && Array.isArray(response.data)) {
        const chartData = response.data.map(d => ({
          label: new Date(d.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric'
          }),
          value: d.events,
          sessions: d.unique_sessions
        }));
        setTimeSeriesData(chartData);
      }
    } catch (error) {
      console.error('Error loading timeseries data:', error);
    }
  };

  // Reload data when filters change
  useEffect(() => {
    if (selectedStore) {
      setCurrentPage(1); // Reset to page 1 when filters change
      loadData(1);
    }
  }, [activityFilter, startDate, endDate, searchQuery]);

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadData(page);
  };

  const loadData = async (page = currentPage) => {
    try {
      setLoading(true);
      
      if (!selectedStore) {
        setActivities([]);
        setStore(null);
        setTotalItems(0);
        setTotalPages(0);
        setLoading(false);
        return;
      }
      
      setStore(selectedStore);
      
      // Build filter parameters
      const filters = {
        store_id: selectedStore.id,
        page: page,
        limit: itemsPerPage
      };
      
      // Add activity type filter
      if (activityFilter !== "all") {
        filters.activity_type = activityFilter;
      }
      
      // Add date range filters
      if (startDate) {
        filters.start_date = startDate;
      }
      if (endDate) {
        filters.end_date = endDate;
      }
      
      // Add search query filter
      if (searchQuery.trim()) {
        // The API should support searching across multiple fields
        filters.search = searchQuery.trim();
      }

      // Use findPaginated for proper pagination support
      const paginatedResult = await CustomerActivity.findPaginated(
        page,
        itemsPerPage,
        filters
      );
      
      if (paginatedResult && paginatedResult.data) {
        setActivities(paginatedResult.data || []);
        setTotalItems(paginatedResult.pagination?.total || 0);
        setTotalPages(paginatedResult.pagination?.total_pages || 0);
        setCurrentPage(paginatedResult.pagination?.current_page || page);
      } else {
        // Fallback to filter method if findPaginated doesn't work
        const activitiesData = await CustomerActivity.filter(filters);
        setActivities(activitiesData || []);
        setTotalItems(activitiesData?.length || 0);
        setTotalPages(Math.ceil((activitiesData?.length || 0) / itemsPerPage));
      }
      
    } catch (error) {
      console.error("Error loading customer activity:", error);
      setActivities([]);
      setStore(null);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type) => {
    const icons = {
      page_view: Eye,
      product_view: Package,
      add_to_cart: ShoppingCart,
      remove_from_cart: ShoppingCart,
      checkout_started: CreditCard,
      order_completed: CreditCard,
      search: Search,
      wishlist_add: Heart
    };
    return icons[type] || Eye;
  };

  const getActivityColor = (type) => {
    const colors = {
      page_view: "bg-blue-100 text-blue-800",
      product_view: "bg-green-100 text-green-800",
      add_to_cart: "bg-purple-100 text-purple-800",
      remove_from_cart: "bg-red-100 text-red-800",
      checkout_started: "bg-yellow-100 text-yellow-800",
      order_completed: "bg-emerald-100 text-emerald-800",
      search: "bg-gray-100 text-gray-800",
      wishlist_add: "bg-pink-100 text-pink-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  // Pagination component
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const getVisiblePages = () => {
      const pages = [];
      const showEllipsis = totalPages > 7;

      if (!showEllipsis) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 4) {
          for (let i = 1; i <= 5; i++) pages.push(i);
          pages.push('ellipsis');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 3) {
          pages.push(1);
          pages.push('ellipsis');
          for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
        } else {
          pages.push(1);
          pages.push('ellipsis');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
          pages.push('ellipsis');
          pages.push(totalPages);
        }
      }
      return pages;
    };

    return (
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
        <div className="text-sm text-gray-700">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} activities
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden md:inline">Previous</span>
            <span className="md:hidden">Prev</span>
          </Button>

          {/* Mobile: Show current page indicator */}
          <span className="md:hidden text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>

          {/* Desktop: Page Numbers */}
          <div className="hidden md:flex items-center gap-1">
            {getVisiblePages().map((page, index) => (
              <React.Fragment key={index}>
                {page === 'ellipsis' ? (
                  <span className="px-3 py-1 text-gray-500">...</span>
                ) : (
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="min-w-[2.5rem]"
                  >
                    {page}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1"
          >
            <span className="hidden md:inline">Next</span>
            <span className="md:hidden">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // No need for client-side filtering since we're doing server-side filtering
  const filteredActivities = activities;

  if (loading) {
    return <PageLoader size="lg" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Activity</h1>
            <p className="text-gray-600 mt-1">Track customer behavior and interactions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => loadData(currentPage)}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* First row: Search and Activity Filter */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by email, query, or page..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activities</SelectItem>
                    <SelectItem value="page_view">Page Views</SelectItem>
                    <SelectItem value="product_view">Product Views</SelectItem>
                    <SelectItem value="add_to_cart">Add to Cart</SelectItem>
                    <SelectItem value="remove_from_cart">Remove from Cart</SelectItem>
                    <SelectItem value="checkout_started">Checkout Started</SelectItem>
                    <SelectItem value="order_completed">Orders Completed</SelectItem>
                    <SelectItem value="search">Searches</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Second row: Date Range Filter */}
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Date Range:</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="flex-1">
                    <Input
                      type="date"
                      placeholder="Start date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="date"
                      placeholder="End date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="text-sm"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Widget Toggle Badges */}
              <div className="pt-4 border-t">
                <p className="text-xs font-medium text-gray-500 mb-2">CUSTOMIZE DASHBOARD:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={widgets.traffic ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWidget('traffic')}>
                    📈 Traffic
                  </Badge>
                  <Badge variant={widgets.demographics ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWidget('demographics')}>
                    📱 Demographics
                  </Badge>
                  <Badge variant={widgets.topProducts ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWidget('topProducts')}>
                    ⭐ Top Products
                  </Badge>
                  <Badge variant={widgets.bestSellers ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWidget('bestSellers')}>
                    🏆 Best Sellers
                  </Badge>
                  <Badge variant={widgets.funnel ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWidget('funnel')}>
                    🎯 Funnel
                  </Badge>
                  <Badge variant={widgets.geo ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWidget('geo')}>
                    🌍 Geography
                  </Badge>
                  <Badge variant={widgets.searches ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWidget('searches')}>
                    🔍 Searches
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Grid - Always Visible */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-xs text-green-700 uppercase font-medium">Online Now</p>
                </div>
                <p className="text-3xl font-bold text-green-700">{realtimeData.users_online}</p>
                <p className="text-xs text-green-600 mt-1">{realtimeData.logged_in_users} / {realtimeData.guest_users}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Events</p>
                  <p className="text-2xl font-bold">{totalItems.toLocaleString()}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Sessions</p>
                  <p className="text-2xl font-bold">{new Set(activities.map(a => a.session_id)).size}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Products</p>
                  <p className="text-2xl font-bold">{activities.filter(a => a.activity_type === 'product_view').length}</p>
                </div>
                <Eye className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Orders</p>
                  <p className="text-2xl font-bold">{activities.filter(a => a.activity_type === 'order_completed').length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Widget Sections - Shown based on badge toggles */}
        <div className="mb-6 space-y-6">
            {/* Traffic Over Time Chart */}
            {widgets.traffic && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Traffic Overview
                  </CardTitle>
                </CardHeader>
              <CardContent>
                {timeSeriesData.length > 0 ? (
                  <SimpleLineChart
                    data={timeSeriesData}
                    height={250}
                    color="#4F46E5"
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No traffic data available for selected period</p>
                  </div>
                )}
              </CardContent>
              </Card>
            )}

            {/* Session Analytics Row */}
            {widgets.demographics && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Device Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-blue-600" />
                    Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(sessionAnalytics.device_breakdown || {}).length > 0 ? (
                    <div className="[&>div]:flex-col [&>div]:items-center [&>div]:gap-4">
                      <DonutChart
                        data={sessionAnalytics.device_breakdown}
                        size={180}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Smartphone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No device data</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Browser Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-purple-600" />
                    Browsers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(sessionAnalytics.browser_breakdown || {}).length > 0 ? (
                    <div className="[&>div]:flex-col [&>div]:items-center [&>div]:gap-4">
                      <DonutChart
                        data={sessionAnalytics.browser_breakdown}
                        size={180}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Globe className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No browser data</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Session Duration Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    Session Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Total Sessions</span>
                      <span className="text-lg font-bold text-blue-900">
                        {sessionAnalytics.total_sessions?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Avg. Duration</span>
                      <span className="text-lg font-bold text-green-900">
                        {sessionAnalytics.avg_session_duration
                          ? `${Math.floor(sessionAnalytics.avg_session_duration / 60)}m ${Math.floor(sessionAnalytics.avg_session_duration % 60)}s`
                          : '0s'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Avg. Events</span>
                      <span className="text-lg font-bold text-purple-900">
                        {sessionAnalytics.avg_events_per_session?.toFixed(1) || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
            )}

            {/* Top Products & Pages */}
            {widgets.topProducts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Viewed Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Top Viewed Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const productViews = activities.filter(a => a.activity_type === 'product_view' && a.metadata?.product_name);
                    const productCounts = {};
                    productViews.forEach(a => {
                      const key = a.product_id;
                      if (!productCounts[key]) {
                        productCounts[key] = {
                          count: 0,
                          name: a.metadata.product_name,
                          sku: a.metadata.product_sku,
                          price: a.metadata.product_price
                        };
                      }
                      productCounts[key].count++;
                    });

                    const topProducts = Object.entries(productCounts)
                      .sort((a, b) => b[1].count - a[1].count)
                      .slice(0, 5);

                    return topProducts.length > 0 ? (
                      <div className="space-y-2">
                        {topProducts.map(([id, data], index) => (
                          <div key={id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-gray-400">#{index + 1}</span>
                              <div>
                                <p className="font-medium text-sm">{data.name}</p>
                                <p className="text-xs text-gray-500">SKU: {data.sku || 'N/A'}</p>
                              </div>
                            </div>
                            <Badge variant="secondary">{data.count} views</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-8">No product views yet</p>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Top Pages */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    Top Pages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const pageViews = activities.filter(a => a.page_url);
                    const pageCounts = {};
                    pageViews.forEach(a => {
                      const url = a.page_url;
                      pageCounts[url] = (pageCounts[url] || 0) + 1;
                    });

                    const topPages = Object.entries(pageCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5);

                    return topPages.length > 0 ? (
                      <div className="space-y-2">
                        {topPages.map(([url, count], index) => (
                          <div key={url} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="font-bold text-gray-400">#{index + 1}</span>
                              <p className="font-medium text-sm truncate">{url}</p>
                            </div>
                            <Badge variant="secondary">{count} visits</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-8">No page views yet</p>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
            )}

            {/* Best Sellers & Conversion Funnel */}
            {widgets.bestSellers && widgets.funnel && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Best Sellers (by add_to_cart) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-green-600" />
                    Best Sellers (Add to Cart)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const cartAdds = activities.filter(a => a.activity_type === 'add_to_cart' && a.metadata?.product_name);
                    const productCounts = {};
                    cartAdds.forEach(a => {
                      const key = a.product_id;
                      if (!productCounts[key]) {
                        productCounts[key] = {
                          count: 0,
                          name: a.metadata.product_name,
                          sku: a.metadata.product_sku,
                          totalQty: 0,
                          totalValue: 0
                        };
                      }
                      productCounts[key].count++;
                      productCounts[key].totalQty += parseInt(a.metadata.quantity || 1);
                      productCounts[key].totalValue += parseFloat(a.metadata.cart_value || 0);
                    });

                    const bestSellers = Object.entries(productCounts)
                      .sort((a, b) => b[1].count - a[1].count)
                      .slice(0, 5);

                    return bestSellers.length > 0 ? (
                      <div className="space-y-2">
                        {bestSellers.map(([id, data], index) => (
                          <div key={id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-gray-400">#{index + 1}</span>
                              <div>
                                <p className="font-medium text-sm">{data.name}</p>
                                <p className="text-xs text-gray-500">
                                  {data.totalQty} units • ${data.totalValue.toFixed(2)} value
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary">{data.count} carts</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-8">No cart activity yet</p>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    Conversion Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const productViews = activities.filter(a => a.activity_type === 'product_view').length;
                    const cartAdds = activities.filter(a => a.activity_type === 'add_to_cart').length;
                    const checkouts = activities.filter(a => a.activity_type === 'checkout_started').length;
                    const orders = activities.filter(a => a.activity_type === 'order_completed').length;

                    const addToCartRate = productViews > 0 ? ((cartAdds / productViews) * 100).toFixed(1) : 0;
                    const checkoutRate = cartAdds > 0 ? ((checkouts / cartAdds) * 100).toFixed(1) : 0;
                    const purchaseRate = checkouts > 0 ? ((orders / checkouts) * 100).toFixed(1) : 0;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-sm">Product Views</span>
                          </div>
                          <span className="font-bold text-blue-900">{productViews}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-sm">Add to Cart</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-green-900">{cartAdds}</span>
                            <span className="text-xs text-green-600 ml-2">({addToCartRate}%)</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-orange-600" />
                            <span className="font-medium text-sm">Checkouts Started</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-orange-900">{checkouts}</span>
                            <span className="text-xs text-orange-600 ml-2">({checkoutRate}%)</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium text-sm">Orders Completed</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-900">{orders}</span>
                            <span className="text-xs text-emerald-600 ml-2">({purchaseRate}%)</span>
                          </div>
                        </div>

                        {productViews > 0 && (
                          <div className="pt-3 border-t">
                            <p className="text-xs text-gray-600 text-center">
                              Overall Conversion: <strong>{orders > 0 && productViews > 0 ? ((orders / productViews) * 100).toFixed(2) : 0}%</strong>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
            )}

            {/* Geographic & Language Breakdown */}
            {widgets.geo && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Countries */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    Top Countries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(sessionAnalytics.country_breakdown || {}).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(sessionAnalytics.country_breakdown)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([country, count], index) => (
                          <div key={country} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-gray-400">#{index + 1}</span>
                              <span className="font-medium text-sm">{country}</span>
                            </div>
                            <Badge variant="secondary">{count} visits</Badge>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">No country data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Languages */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-purple-600" />
                    Languages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(sessionAnalytics.language_breakdown || {}).length > 0 ? (
                    <DonutChart
                      data={sessionAnalytics.language_breakdown}
                      size={180}
                    />
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">No language data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
            )}

            {/* Search Terms & Popular Searches */}
            {widgets.searches && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-gray-600" />
                  Popular Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const searches = activities.filter(a => a.activity_type === 'search' && a.search_query);
                  const searchCounts = {};
                  searches.forEach(a => {
                    const query = a.search_query.toLowerCase();
                    searchCounts[query] = (searchCounts[query] || 0) + 1;
                  });

                  const topSearches = Object.entries(searchCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);

                  return topSearches.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topSearches.map(([query, count]) => (
                        <Badge key={query} variant="outline" className="text-sm">
                          "{query}" ({count})
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No searches yet</p>
                  );
                })()}
              </CardContent>
            </Card>
            )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log ({totalItems} total, page {currentPage} of {totalPages})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredActivities.length > 0 ? (
              <div className="space-y-4">
                {filteredActivities.map((activity) => {
                  const Icon = getActivityIcon(activity.activity_type);
                  return (
                    <div key={activity.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getActivityColor(activity.activity_type)}>
                            {activity.activity_type.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {(() => {
                              const timestamp = activity.created_at || activity.createdAt || activity.updated_at || activity.updatedAt;
                              if (!timestamp) return 'No timestamp';
                              try {
                                const date = new Date(timestamp);
                                if (isNaN(date.getTime())) return 'Invalid timestamp';
                                return date.toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                });
                              } catch (e) {
                                return 'Invalid timestamp';
                              }
                            })()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.customer_email || 'Anonymous'}
                        </p>
                        {activity.page_url && (
                          <p className="text-sm text-gray-600">{activity.page_url}</p>
                        )}
                        {activity.search_query && (
                          <p className="text-sm text-gray-600">Search: "{activity.search_query}"</p>
                        )}
                        {activity.product_id && activity.metadata?.product_name && (
                          <p className="text-sm text-gray-600">
                            <strong>{activity.metadata.product_name}</strong>
                            {activity.metadata.product_sku && <span className="text-gray-500"> (SKU: {activity.metadata.product_sku})</span>}
                          </p>
                        )}
                        {activity.metadata?.quantity && (
                          <p className="text-xs text-gray-500">
                            Qty: {activity.metadata.quantity}
                            {activity.metadata.cart_value && <span> • Value: ${parseFloat(activity.metadata.cart_value).toFixed(2)}</span>}
                          </p>
                        )}
                        {activity.metadata?.variant && (
                          <p className="text-xs text-gray-500">
                            Variant: {activity.metadata.variant.name || activity.metadata.variant.options?.join(' / ')}
                          </p>
                        )}
                        {activity.metadata?.list_name && (
                          <p className="text-xs text-gray-500">
                            From: {activity.metadata.list_name}
                          </p>
                        )}
                        {activity.metadata?.order_total && (
                          <p className="text-sm text-gray-600">
                            Order Total: ${parseFloat(activity.metadata.order_total).toFixed(2)}
                            {activity.metadata.order_items_count && <span className="text-gray-500"> ({activity.metadata.order_items_count} items)</span>}
                          </p>
                        )}
                        {(activity.country_name || activity.city || activity.language) && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            {activity.country_name && (
                              <Badge variant="outline" className="text-xs">
                                {activity.city ? `${activity.city}, ${activity.country_name}` : activity.country_name}
                              </Badge>
                            )}
                            {activity.language && (
                              <Badge variant="outline" className="text-xs">
                                {activity.language.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Found</h3>
                <p className="text-gray-600">
                  {searchQuery || activityFilter !== "all" 
                    ? "Try adjusting your filters to see more results." 
                    : "Customer activity will appear here as visitors interact with your store."}
                </p>
              </div>
            )}
            
            {/* Pagination */}
            {renderPagination()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}