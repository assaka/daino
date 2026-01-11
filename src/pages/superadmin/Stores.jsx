import React, { useState, useEffect } from "react";
import apiClient from "@/api/client";
import {
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
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
      if (response.data.success) {
        setStores(response.data.stores || []);
      }
    } catch (error) {
      toast({
        title: "Error loading stores",
        description: error.message,
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
          <p className="text-gray-500">Manage all stores on the platform</p>
        </div>
        <Button variant="outline" onClick={loadStores} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
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
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total Stores</p>
          <p className="text-2xl font-bold">{stores.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {stores.filter(s => s.status === 'active' || s.status === 'demo').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Provisioning</p>
          <p className="text-2xl font-bold text-blue-600">
            {stores.filter(s => s.status === 'provisioning').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Pending Migration</p>
          <p className="text-2xl font-bold text-orange-600">
            {stores.filter(s => s.has_pending_migration).length}
          </p>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Schema</TableHead>
              <TableHead>Migration</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredStores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {search ? 'No stores match your search' : 'No stores found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{store.slug}</code>
                  </TableCell>
                  <TableCell className="text-gray-600">{store.owner_email || '-'}</TableCell>
                  <TableCell>{getStatusBadge(store)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">v{store.schema_version || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    {store.has_pending_migration ? (
                      <span className="flex items-center text-orange-600 text-sm">
                        <XCircle className="h-4 w-4 mr-1" />
                        Pending
                      </span>
                    ) : (
                      <span className="flex items-center text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Up to date
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(store.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
