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

export default function SuperAdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/superadmin/users');
      if (response?.success) {
        setUsers(response.data?.users || []);
      } else {
        throw new Error(response?.error || 'Failed to load users');
      }
    } catch (error) {
      toast({
        title: "Error loading users",
        description: error.message || 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(search.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500">Admin</Badge>;
      case 'store_owner':
        return <Badge className="bg-blue-500">Store Owner</Badge>;
      case 'customer':
        return <Badge variant="secondary">Customer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm sm:text-base text-gray-500">All registered users on the platform</p>
        </div>
        <Button variant="outline" onClick={loadUsers} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Users</p>
          <p className="text-xl sm:text-2xl font-bold">{users.length}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Store Owners</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {users.filter(u => u.role === 'store_owner').length}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Admins</p>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">
            {users.filter(u => u.role === 'admin').length}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Verified</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {users.filter(u => u.email_verified).length}
          </p>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="hidden sm:table-cell">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="hidden md:table-cell">Store ID</TableHead>
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
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {search ? 'No users match your search' : 'No users found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{user.email}</div>
                      <div className="text-xs text-gray-400 sm:hidden">{user.full_name || '-'}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-600">{user.full_name || '-'}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.email_verified ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.store_id ? (
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {user.store_id.slice(0, 8)}...
                        </code>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
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
