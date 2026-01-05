import React, { useState, useEffect, useMemo } from 'react';
import { User, CreditUsage, Store } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Coins,
  Filter,
  Calendar as CalendarIcon,
  TrendingDown,
  Store as StoreIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Download,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Usage type badge colors
const usageTypeColors = {
  'store_publishing': 'bg-blue-100 text-blue-800',
  'custom_domain': 'bg-purple-100 text-purple-800',
  'akeneo_schedule': 'bg-green-100 text-green-800',
  'akeneo_manual': 'bg-emerald-100 text-emerald-800',
  'ai_translation': 'bg-orange-100 text-orange-800',
  'manual_import': 'bg-yellow-100 text-yellow-800',
  'ai_image': 'bg-pink-100 text-pink-800',
  'ai_seo': 'bg-indigo-100 text-indigo-800',
  'ai_content': 'bg-cyan-100 text-cyan-800'
};

// Usage type labels
const usageTypeLabels = {
  'store_publishing': 'Store Publishing',
  'custom_domain': 'Custom Domain',
  'akeneo_schedule': 'Akeneo Scheduled',
  'akeneo_manual': 'Akeneo Manual',
  'ai_translation': 'AI Translation',
  'manual_import': 'Manual Import',
  'ai_image': 'AI Image',
  'ai_seo': 'AI SEO',
  'ai_content': 'AI Content'
};

export default function Credits() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [usageData, setUsageData] = useState({ usage: [], pagination: {}, summary: {} });
  const [usageTypes, setUsageTypes] = useState([]);
  const [usageStats, setUsageStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [filters, setFilters] = useState({
    store_id: 'all',
    usage_type: 'all',
    start_date: null,
    end_date: null,
    limit: 20,
    offset: 0
  });

  // Date picker state
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    loadUserData();
    loadStores();
    loadUsageTypes();
  }, []);

  // Load usage data when filters change
  useEffect(() => {
    loadUsageData();
  }, [filters]);

  // Load usage stats
  useEffect(() => {
    loadUsageStats();
  }, [filters.store_id]);

  const loadUserData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadStores = async () => {
    try {
      const storeData = await Store.findAll();
      setStores(storeData || []);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadUsageTypes = async () => {
    try {
      const types = await CreditUsage.getUsageTypes();
      setUsageTypes(types || []);
    } catch (error) {
      console.error('Error loading usage types:', error);
    }
  };

  const loadUsageData = async () => {
    setLoading(true);
    try {
      const params = {
        limit: filters.limit,
        offset: filters.offset
      };

      if (filters.store_id && filters.store_id !== 'all') {
        params.store_id = filters.store_id;
      }
      if (filters.usage_type && filters.usage_type !== 'all') {
        params.usage_type = filters.usage_type;
      }
      if (filters.start_date) {
        params.start_date = format(filters.start_date, 'yyyy-MM-dd');
      }
      if (filters.end_date) {
        params.end_date = format(filters.end_date, 'yyyy-MM-dd');
      }

      const data = await CreditUsage.getUsage(params);
      setUsageData(data || { usage: [], pagination: {}, summary: {} });
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async () => {
    setStatsLoading(true);
    try {
      const params = { days: 30 };
      if (filters.store_id && filters.store_id !== 'all') {
        params.store_id = filters.store_id;
      }
      const stats = await CreditUsage.getStats(params);
      setUsageStats(stats || {});
    } catch (error) {
      console.error('Error loading usage stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset pagination when filters change
    }));
  };

  const clearFilters = () => {
    setFilters({
      store_id: 'all',
      usage_type: 'all',
      start_date: null,
      end_date: null,
      limit: 20,
      offset: 0
    });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.store_id !== 'all' ||
      filters.usage_type !== 'all' ||
      filters.start_date !== null ||
      filters.end_date !== null
    );
  }, [filters]);

  // Pagination
  const handlePrevPage = () => {
    if (filters.offset > 0) {
      setFilters(prev => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit)
      }));
    }
  };

  const handleNextPage = () => {
    if (usageData.pagination?.hasMore) {
      setFilters(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
    }
  };

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil((usageData.pagination?.total || 0) / filters.limit);

  // Export to CSV
  const exportToCSV = () => {
    if (!usageData.usage || usageData.usage.length === 0) return;

    const headers = ['Date', 'Type', 'Store', 'Credits Used', 'Description'];
    const rows = usageData.usage.map(u => [
      format(new Date(u.created_at), 'yyyy-MM-dd HH:mm'),
      usageTypeLabels[u.usage_type] || u.usage_type,
      u.store_name || 'N/A',
      u.credits_used.toFixed(2),
      u.description || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `credit-usage-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading && !usageData.usage?.length) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Credit Usage</h1>
          <p className="text-gray-600 mt-1">Track how your credits are being used across stores</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl('Billing'))}
          >
            <Coins className="w-4 h-4 mr-2" />
            Buy Credits
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.credits?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">Available credits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (usageStats.total_credits_used?.toFixed(2) || '0.00')}
            </div>
            <p className="text-xs text-muted-foreground">Credits used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (usageStats.daily_average?.toFixed(2) || '0.00')}
            </div>
            <p className="text-xs text-muted-foreground">Credits per day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <StoreIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
            <p className="text-xs text-muted-foreground">Total stores</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!usageData.usage?.length}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Store Filter */}
            <div className="w-48">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Store</label>
              <Select value={filters.store_id} onValueChange={(value) => handleFilterChange('store_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="w-48">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
              <Select value={filters.usage_type} onValueChange={(value) => handleFilterChange('usage_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {usageTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="w-48">
              <label className="text-sm font-medium text-gray-700 mb-1 block">From Date</label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.start_date ? format(filters.start_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.start_date}
                    onSelect={(date) => {
                      handleFilterChange('start_date', date);
                      setStartDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="w-48">
              <label className="text-sm font-medium text-gray-700 mb-1 block">To Date</label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.end_date ? format(filters.end_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.end_date}
                    onSelect={(date) => {
                      handleFilterChange('end_date', date);
                      setEndDateOpen(false);
                    }}
                    disabled={(date) => filters.start_date && date < filters.start_date}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>
                {usageData.pagination?.total || 0} total records
                {usageData.summary?.total_credits_used ? ` | ${usageData.summary.total_credits_used.toFixed(2)} credits used` : ''}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadUsageData} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : usageData.usage?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Coins className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No usage records found</p>
              <p className="text-sm">Credit usage will appear here once you start using services</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageData.usage.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-normal", usageTypeColors[item.usage_type] || 'bg-gray-100 text-gray-800')}>
                          {usageTypeLabels[item.usage_type] || item.usage_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {item.store_name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        -{item.credits_used.toFixed(2)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-500">
                        {item.description || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {filters.offset + 1} - {Math.min(filters.offset + filters.limit, usageData.pagination.total)} of {usageData.pagination.total}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={filters.offset === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!usageData.pagination?.hasMore}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
