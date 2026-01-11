import React, { useState, useEffect } from "react";
import apiClient from "@/api/client";
import {
  RefreshCw,
  Loader2,
  Search
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
import { useToast } from "@/components/ui/use-toast";

export default function SuperAdminStores() {
  const { toast } = useToast();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/superadmin/stores');
      if (response?.success) {
        setStores(response.data?.stores || []);
      } else {
        throw new Error(response?.error || 'Failed to load stores');
      }
    } catch (error) {
      toast({
        title: "Error loading stores",
        description: error.message || 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStores = stores.filter(store =>
    store.name?.toLowerCase().includes(search.toLowerCase()) ||
    store.slug?.toLowerCase().includes(search.toLowerCase()) ||
    store.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (store) => {
    if (store.status === 'active' || store.status === 'demo') {
      return <Badge className="bg-green-500">Active</Badge>;
    }
    if (store.status === 'provisioning') {
      return <Badge className="bg-blue-500">Provisioning</Badge>;
    }
    if (store.status === 'suspended') {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    return <Badge variant="secondary">{store.status}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Stores</h1>
          <p className="text-sm sm:text-base text-gray-500">Manage all stores on the platform</p>
        </div>
        <Button variant="outline" onClick={loadStores} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, slug, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Stores</p>
          <p className="text-xl sm:text-2xl font-bold">{stores.length}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Active</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {stores.filter(s => s.status === 'active' || s.status === 'demo').length}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Provisioning</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {stores.filter(s => s.status === 'provisioning').length}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Suspended</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">
            {stores.filter(s => s.status === 'suspended').length}
          </p>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                <TableHead className="hidden md:table-cell">Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schema</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {search ? 'No stores match your search' : 'No stores found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div className="font-medium">{store.name}</div>
                      <code className="text-xs text-gray-400 sm:hidden">{store.slug}</code>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{store.slug}</code>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-600">{store.owner_email || '-'}</TableCell>
                    <TableCell>{getStatusBadge(store)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">v{store.schema_version || 0}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                      {new Date(store.created_at).toLocaleDateString()}
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
