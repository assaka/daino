import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/utils/auth";
import apiClient from "@/api/client";
import {
  Shield,
  Store,
  Users,
  Database,
  RefreshCw,
  Play,
  Flag,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

// Allowed superadmin emails
const SUPERADMIN_EMAILS = ['hello@dainostore.com', 'hamid@dainostore.com'];

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stores");

  // Data states
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [migrations, setMigrations] = useState([]);
  const [migrationStatus, setMigrationStatus] = useState([]);

  // Loading states
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMigrations, setLoadingMigrations] = useState(false);
  const [runningMigrations, setRunningMigrations] = useState(false);
  const [flaggingStores, setFlaggingStores] = useState(false);

  // Check authorization on mount
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/admin/auth');
      return;
    }
    if (!SUPERADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      navigate('/admin/dashboard');
      return;
    }
    setAuthorized(true);
    setLoading(false);
  }, [navigate]);

  // Load data when tab changes
  useEffect(() => {
    if (!authorized) return;

    if (activeTab === "stores" && stores.length === 0) {
      loadStores();
    } else if (activeTab === "users" && users.length === 0) {
      loadUsers();
    } else if (activeTab === "migrations" && migrations.length === 0) {
      loadMigrations();
    }
  }, [activeTab, authorized]);

  const loadStores = async () => {
    setLoadingStores(true);
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
      setLoadingStores(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await apiClient.get('/superadmin/users');
      if (response.data.success) {
        setUsers(response.data.users || []);
      }
    } catch (error) {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMigrations = async () => {
    setLoadingMigrations(true);
    try {
      const [migrationsRes, statusRes] = await Promise.all([
        apiClient.get('/superadmin/migrations'),
        apiClient.get('/superadmin/migrations/status')
      ]);

      if (migrationsRes.data.success) {
        setMigrations(migrationsRes.data.migrations || []);
      }
      if (statusRes.data.success) {
        setMigrationStatus(statusRes.data.stores || []);
      }
    } catch (error) {
      toast({
        title: "Error loading migrations",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingMigrations(false);
    }
  };

  const handleFlagAllStores = async () => {
    setFlaggingStores(true);
    try {
      const response = await apiClient.post('/superadmin/migrations/flag-all');
      if (response.data.success) {
        toast({
          title: "Stores flagged",
          description: `${response.data.storesFlagged} stores flagged for migration`,
        });
        loadMigrations();
      }
    } catch (error) {
      toast({
        title: "Error flagging stores",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setFlaggingStores(false);
    }
  };

  const handleRunAllMigrations = async () => {
    setRunningMigrations(true);
    try {
      const response = await apiClient.post('/superadmin/migrations/run-all');
      if (response.data.success) {
        toast({
          title: "Migrations completed",
          description: response.data.message,
        });
        loadMigrations();
      } else {
        toast({
          title: "Some migrations failed",
          description: response.data.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error running migrations",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setRunningMigrations(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const pendingStores = migrationStatus.filter(s => s.hasPendingMigrations);
  const latestVersion = migrations.length > 0 ? Math.max(...migrations.map(m => m.version)) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage stores, users, and migrations</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Migrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{migrations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Migrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{pendingStores.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stores" className="gap-2">
            <Store className="h-4 w-4" />
            Stores
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="migrations" className="gap-2">
            <Database className="h-4 w-4" />
            Migrations
          </TabsTrigger>
        </TabsList>

        {/* Stores Tab */}
        <TabsContent value="stores" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">All Stores</h2>
            <Button variant="outline" size="sm" onClick={loadStores} disabled={loadingStores}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingStores ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schema Version</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStores ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No stores found
                    </TableCell>
                  </TableRow>
                ) : (
                  stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">{store.name}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-1 py-0.5 rounded">{store.store_code}</code></TableCell>
                      <TableCell>{store.owner_email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={store.is_active ? "default" : "secondary"}>
                          {store.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{store.schema_version || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(store.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">All Users</h2>
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={loadingUsers}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingUsers ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.full_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.email_verified ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Migrations Tab */}
        <TabsContent value="migrations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Tenant Migrations</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadMigrations} disabled={loadingMigrations}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingMigrations ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleFlagAllStores} disabled={flaggingStores}>
                <Flag className={`h-4 w-4 mr-2 ${flaggingStores ? 'animate-spin' : ''}`} />
                Flag All Stores
              </Button>
              <Button size="sm" onClick={handleRunAllMigrations} disabled={runningMigrations || pendingStores.length === 0}>
                <Play className={`h-4 w-4 mr-2 ${runningMigrations ? 'animate-spin' : ''}`} />
                Run All Migrations
              </Button>
            </div>
          </div>

          {/* Available Migrations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Migrations</CardTitle>
              <CardDescription>Migration definitions stored in the database</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMigrations ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : migrations.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No migrations found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {migrations.map((migration) => (
                      <TableRow key={migration.id}>
                        <TableCell>
                          <Badge variant="outline">v{migration.version}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{migration.name}</TableCell>
                        <TableCell className="text-muted-foreground">{migration.description}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(migration.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Store Migration Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store Migration Status</CardTitle>
              <CardDescription>
                {pendingStores.length > 0
                  ? `${pendingStores.length} store(s) need migrations`
                  : "All stores are up to date"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMigrations ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : migrationStatus.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No stores found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store ID</TableHead>
                      <TableHead>Current Version</TableHead>
                      <TableHead>Latest Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Migration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {migrationStatus.map((store) => (
                      <TableRow key={store.storeId}>
                        <TableCell className="font-mono text-xs">{store.storeId.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline">v{store.schemaVersion}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">v{store.latestVersion}</Badge>
                        </TableCell>
                        <TableCell>
                          {store.hasPendingMigrations ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant="default" className="gap-1 bg-green-500">
                              <CheckCircle className="h-3 w-3" />
                              Up to date
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {store.lastMigrationAt
                            ? new Date(store.lastMigrationAt).toLocaleString()
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
