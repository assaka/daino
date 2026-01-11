import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api/client";
import {
  Store,
  Users,
  Database,
  AlertCircle,
  ArrowRight,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    stores: 0,
    users: 0,
    migrations: 0,
    pendingMigrations: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [storesRes, usersRes, migrationsRes] = await Promise.allSettled([
        apiClient.get('/superadmin/stores'),
        apiClient.get('/superadmin/users'),
        apiClient.get('/superadmin/migrations/status')
      ]);

      const stores = storesRes.status === 'fulfilled' ? storesRes.value?.data?.stores || [] : [];
      const users = usersRes.status === 'fulfilled' ? usersRes.value?.data?.users || [] : [];
      const migrationStatus = migrationsRes.status === 'fulfilled' ? migrationsRes.value?.data?.stores || [] : [];
      const pendingStores = migrationStatus.filter(s => s.hasPendingMigrations);

      setStats({
        stores: stores.length,
        users: users.length,
        migrations: migrationStatus.length > 0 ? migrationStatus[0]?.latestVersion || 0 : 0,
        pendingMigrations: pendingStores.length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Stores',
      value: stats.stores,
      icon: Store,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      link: '/superadmin/stores'
    },
    {
      title: 'Total Users',
      value: stats.users,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      link: '/superadmin/users'
    },
    {
      title: 'Migration Version',
      value: `v${stats.migrations}`,
      icon: Database,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      link: '/superadmin/migrations'
    },
    {
      title: 'Pending Migrations',
      value: stats.pendingMigrations,
      icon: AlertCircle,
      color: stats.pendingMigrations > 0 ? 'text-orange-500' : 'text-green-500',
      bgColor: stats.pendingMigrations > 0 ? 'bg-orange-50' : 'bg-green-50',
      link: '/superadmin/migrations'
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Platform overview and quick stats</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link key={stat.title} to={stat.link}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                          <p className="text-3xl font-bold">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-full ${stat.bgColor}`}>
                          <Icon className={`h-6 w-6 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store className="h-5 w-5 text-blue-500" />
                  Manage Stores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 text-sm mb-4">
                  View and manage all stores on the platform.
                </p>
                <Link
                  to="/superadmin/stores"
                  className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
                >
                  View all stores <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-500" />
                  Manage Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 text-sm mb-4">
                  View all registered users and their details.
                </p>
                <Link
                  to="/superadmin/users"
                  className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
                >
                  View all users <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-500" />
                  Run Migrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 text-sm mb-4">
                  Manage and run tenant database migrations.
                </p>
                <Link
                  to="/superadmin/migrations"
                  className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
                >
                  Manage migrations <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
