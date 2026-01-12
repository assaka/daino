import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/api/client";
import {
  RefreshCw,
  Loader2,
  Search,
  UserPlus,
  Eye,
  Check,
  X,
  Ban,
  MoreHorizontal,
  DollarSign,
  Users,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function SuperAdminAffiliates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    loadAffiliates();
    loadStats();
  }, []);

  const loadAffiliates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await apiClient.get(`/superadmin/affiliates?${params.toString()}`);
      if (response?.success) {
        setAffiliates(response.data?.affiliates || []);
      } else {
        throw new Error(response?.error || 'Failed to load affiliates');
      }
    } catch (error) {
      toast({
        title: "Error loading affiliates",
        description: error.message || 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/superadmin/affiliates/stats');
      if (response?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleApprove = async (affiliateId) => {
    try {
      const response = await apiClient.put(`/superadmin/affiliates/${affiliateId}/approve`);
      if (response?.success) {
        toast({ title: "Affiliate approved" });
        loadAffiliates();
        loadStats();
      } else {
        throw new Error(response?.error || 'Failed to approve');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleReject = async (affiliateId) => {
    try {
      const response = await apiClient.put(`/superadmin/affiliates/${affiliateId}/reject`);
      if (response?.success) {
        toast({ title: "Affiliate rejected" });
        loadAffiliates();
        loadStats();
      } else {
        throw new Error(response?.error || 'Failed to reject');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSuspend = async (affiliateId) => {
    try {
      const response = await apiClient.put(`/superadmin/affiliates/${affiliateId}/suspend`);
      if (response?.success) {
        toast({ title: "Affiliate suspended" });
        loadAffiliates();
        loadStats();
      } else {
        throw new Error(response?.error || 'Failed to suspend');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAffiliates();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, typeFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'suspended':
        return <Badge className="bg-red-500">Suspended</Badge>;
      case 'rejected':
        return <Badge variant="secondary">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'individual':
        return <Badge variant="outline">Individual</Badge>;
      case 'business':
        return <Badge className="bg-blue-500">Business</Badge>;
      case 'influencer':
        return <Badge className="bg-purple-500">Influencer</Badge>;
      case 'agency':
        return <Badge className="bg-indigo-500">Agency</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Affiliates</h1>
          <p className="text-sm sm:text-base text-gray-500">Manage affiliate program members</p>
        </div>
        <Button variant="outline" onClick={() => { loadAffiliates(); loadStats(); }} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-gray-400" />
            <p className="text-xs sm:text-sm text-gray-500">Total Affiliates</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{stats?.total || 0}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="h-4 w-4 text-yellow-500" />
            <p className="text-xs sm:text-sm text-gray-500">Pending</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats?.pending || 0}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <p className="text-xs sm:text-sm text-gray-500">Active</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{stats?.approved || 0}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <p className="text-xs sm:text-sm text-gray-500">Pending Payouts</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{formatCurrency(stats?.pendingPayoutAmount)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="influencer">Influencer</SelectItem>
            <SelectItem value="agency">Agency</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Tier</TableHead>
                <TableHead className="hidden md:table-cell">Referrals</TableHead>
                <TableHead className="hidden md:table-cell">Earnings</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : affiliates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {search || statusFilter !== 'all' || typeFilter !== 'all'
                      ? 'No affiliates match your filters'
                      : 'No affiliates found'}
                  </TableCell>
                </TableRow>
              ) : (
                affiliates.map((affiliate) => (
                  <TableRow key={affiliate.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{affiliate.email}</div>
                      <div className="text-xs text-gray-400">
                        {affiliate.first_name} {affiliate.last_name}
                      </div>
                      <div className="text-xs text-blue-500 sm:hidden">
                        {affiliate.referral_code}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(affiliate.affiliate_type)}</TableCell>
                    <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {affiliate.affiliate_tiers?.name || '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="font-medium">{affiliate.total_conversions || 0}</span>
                      <span className="text-gray-400 text-xs ml-1">/ {affiliate.total_referrals || 0}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatCurrency(affiliate.total_earnings)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                      {new Date(affiliate.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/superadmin/affiliates/${affiliate.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {affiliate.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprove(affiliate.id)}>
                                <Check className="h-4 w-4 mr-2 text-green-500" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(affiliate.id)}>
                                <X className="h-4 w-4 mr-2 text-red-500" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {affiliate.status === 'approved' && (
                            <DropdownMenuItem onClick={() => handleSuspend(affiliate.id)}>
                              <Ban className="h-4 w-4 mr-2 text-red-500" />
                              Suspend
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
