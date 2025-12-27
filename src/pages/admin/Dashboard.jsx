
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Store } from "@/api/entities";
import { Product } from "@/api/entities";
import { Order } from "@/api/entities"; // Added Order import
import { Customer } from "@/api/entities"; // Added Customer import
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import { Link, useNavigate } from "react-router-dom"; // Added useNavigate import
import { createPageUrl } from "@/utils";
import apiClient from "@/api/client";
import { 
  ShoppingBag, 
  Store as StoreIcon, 
  Package, 
  TrendingUp,
  Users,
  DollarSign,
  Plus,
  ArrowRight,
  BarChart3,
  Calendar,
  Eye,
  Settings,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Circle,
  Activity, // Added Activity
  Globe, // Added Globe
  CheckCircle, // Added CheckCircle
  AlertCircle // Added AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Added CardDescription
import { PageLoader } from "@/components/ui/page-loader";
import { Badge } from "@/components/ui/badge";
import { SetupGuide } from '@/components/admin/dashboard/SetupGuide'; // Moved SetupGuide to its own file
import { checkStripeConnectStatus } from '@/api/functions';
import { createStripeConnectLink } from '@/api/functions';

// Add retry utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 5, baseDelay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      // Check for specific error message or status code related to rate limiting
      // Assuming the error object or message contains '429' or 'Rate limit' for simplicity
      const errorMessage = error.response?.status === 429 ? '429' : error.message;

      if (errorMessage?.includes('429') || errorMessage?.includes('Rate limit')) {
        if (i < maxRetries - 1) {
          const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 1000;
          console.warn(`Dashboard: Rate limit hit, retrying in ${delayTime.toFixed(0)}ms...`);
          await delay(delayTime);
          continue;
        }
      }
      throw error; // Re-throw if not a rate limit error or max retries reached
    }
  }
};


export default function Dashboard() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]); // Kept for general list of stores if needed
  const [products, setProducts] = useState([]);
  const [store, setStore] = useState(null); // State to hold the current active store (e.g., first one found)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0
  });
  const [performanceMetrics, setPerformanceMetrics] = useState({
    salesGrowth: 0,
    ordersGrowth: 0,
    ordersThisMonth: 0,
    ordersLastMonth: 0,
    customersGrowth: 0,
    customersThisMonth: 0,
    customersLastMonth: 0,
    pageViewsGrowth: 0,
    pageViewsThisWeek: 0,
    pageViewsLastWeek: 0,
    loadingPerformance: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stripeSuccessMessage, setStripeSuccessMessage] = useState('');
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const navigate = useNavigate();


  useEffect(() => {
    if (selectedStore) {
      loadDashboardData();
    }
  }, [selectedStore]);

  useEffect(() => {

    // Handle setup completion from Google OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('setup') && urlParams.get('setup') === 'complete') {
      setShowWelcomeMessage(true);
      // Clean up URL
      navigate(createPageUrl('Dashboard'), { replace: true });
      // Auto-hide welcome message after 10 seconds
      setTimeout(() => setShowWelcomeMessage(false), 10000);
    }

    // Handle Stripe Connect return - only run if selectedStore is available
    const handleStripeReturn = async () => {
      if (!selectedStore?.id) {
        // If store isn't loaded yet, don't process Stripe return
        return;
      }

      if (urlParams.has('stripe_return')) {
        try {
          // Check Stripe Connect status - backend returns: onboardingComplete, details_submitted, charges_enabled
          const { data } = await checkStripeConnectStatus(selectedStore.id);

          // Check if onboarding is complete
          if (data.onboardingComplete) {
            setStripeSuccessMessage('Stripe account connected successfully!');
            // Re-load data to get updated store status
            loadDashboardData();
          } else if (data.connected && !data.charges_enabled) {
            setError('Stripe account connected but not yet enabled for charges. This may take a few moments.');
          } else if (data.connected && !data.details_submitted) {
            setError('Stripe onboarding is not complete. Please finish the setup process.');
          } else {
            setError('Stripe connection was not completed. Please try again.');
          }
        } catch (err) {
          console.error("Error verifying Stripe connection:", err);
          setError('Failed to verify Stripe connection status. Please try again.');
        } finally {
          // Clean up URL params
          navigate(createPageUrl('Dashboard'), { replace: true });
        }
      } else if (urlParams.has('stripe_refresh')) {
        // The link expired, trigger the flow again
        try {
            const currentUrl = window.location.origin + window.location.pathname;
            const returnUrl = `${currentUrl}?stripe_return=true`;
            const refreshUrl = `${currentUrl}?stripe_refresh=true`;

            // Assuming createStripeConnectLink returns { data: { url: string } }
            const { data } = await createStripeConnectLink(returnUrl, refreshUrl, selectedStore.id);
            if (data.url) {
                window.location.href = data.url;
            } else {
                setError('Could not generate a new Stripe connection link. Please try again.');
            }
        } catch(err) {
             console.error("Error refreshing Stripe connection link:", err);
             setError('Could not refresh Stripe connection link. Please try again.');
        } finally {
             // Clean up URL params (this will only happen if the redirect didn't occur)
            navigate(createPageUrl('Dashboard'), { replace: true });
        }
      }
    };
    handleStripeReturn();

  }, [selectedStore]);


  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      setStripeSuccessMessage(''); // Clear success message on new load
      
      const userData = await retryApiCall(() => User.me());
      setUser(userData);
      
      // Removed await delay(500); for performance improvement
      
      const storeId = getSelectedStoreId();
      if (!storeId) {
        console.warn("No store selected");
        setLoading(false);
        return;
      }
      
      setStore(selectedStore);
      
      const productsData = await retryApiCall(() => Product.filter({ store_id: storeId }));
      setProducts(productsData || []);

      const allOrders = await retryApiCall(() => Order.filter({ store_id: storeId }), 3, 1000);
      const customers = await retryApiCall(() => Customer.filter({ store_id: storeId }), 3, 1000);
      
      const totalOrders = Array.isArray(allOrders) ? allOrders.length : 0;
      const totalRevenue = Array.isArray(allOrders) ? allOrders.reduce((sum, order) => {
        const amount = parseFloat(order?.total_amount || 0);
        if (order?.total_amount && isNaN(amount)) {
          console.warn('Invalid total_amount in order:', order.id, order.total_amount);
        }
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0) : 0;
      const totalProductsCount = Array.isArray(productsData) ? productsData.length : 0;
      const totalCustomers = Array.isArray(customers) ? customers.length : 0;

      setStats({
        totalRevenue,
        totalOrders,
        totalProducts: totalProductsCount,
        totalCustomers
      });

      // Load performance metrics
      loadPerformanceMetrics(storeId, allOrders, customers);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setError("Failed to load dashboard data. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceMetrics = async (storeId, allOrders, customers) => {
    try {
      setPerformanceMetrics(prev => ({ ...prev, loadingPerformance: true }));

      // Calculate date ranges
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const thisWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const lastWeekEnd = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Helper function to calculate growth percentage
      const calculateGrowth = (current, previous) => {
        if (previous > 0) {
          return Math.round(((current - previous) / previous) * 100);
        } else if (current > 0) {
          return 100;
        }
        return 0;
      };

      // Calculate Sales Growth (current month vs last month)
      let salesGrowth = 0;
      if (Array.isArray(allOrders) && allOrders.length > 0) {
        const currentMonthRevenue = allOrders
          .filter(order => {
            const orderDate = new Date(order.created_at || order.createdAt);
            return orderDate >= currentMonthStart;
          })
          .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

        const lastMonthRevenue = allOrders
          .filter(order => {
            const orderDate = new Date(order.created_at || order.createdAt);
            return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
          })
          .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

        salesGrowth = calculateGrowth(currentMonthRevenue, lastMonthRevenue);
      }

      // Calculate Orders Growth (current month vs last month)
      let ordersThisMonth = 0;
      let ordersLastMonth = 0;
      let ordersGrowth = 0;
      if (Array.isArray(allOrders) && allOrders.length > 0) {
        ordersThisMonth = allOrders.filter(order => {
          const orderDate = new Date(order.created_at || order.createdAt);
          return orderDate >= currentMonthStart;
        }).length;

        ordersLastMonth = allOrders.filter(order => {
          const orderDate = new Date(order.created_at || order.createdAt);
          return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
        }).length;

        ordersGrowth = calculateGrowth(ordersThisMonth, ordersLastMonth);
      }

      // Calculate Customers Growth (current month vs last month)
      let customersThisMonth = 0;
      let customersLastMonth = 0;
      let customersGrowth = 0;
      if (Array.isArray(customers) && customers.length > 0) {
        customersThisMonth = customers.filter(customer => {
          const customerDate = new Date(customer.created_at || customer.createdAt);
          return customerDate >= currentMonthStart;
        }).length;

        customersLastMonth = customers.filter(customer => {
          const customerDate = new Date(customer.created_at || customer.createdAt);
          return customerDate >= lastMonthStart && customerDate <= lastMonthEnd;
        }).length;

        customersGrowth = calculateGrowth(customersThisMonth, customersLastMonth);
      }

      // Fetch Page Views from analytics-dashboard API (this week vs last week)
      let pageViewsThisWeek = 0;
      let pageViewsLastWeek = 0;
      let pageViewsGrowth = 0;
      try {
        // Fetch this week's data
        const thisWeekParams = new URLSearchParams({
          start_date: thisWeekStart.toISOString(),
          interval: 'day'
        });
        const thisWeekResponse = await apiClient.get(`/analytics-dashboard/${storeId}/timeseries?${thisWeekParams}`);
        if (thisWeekResponse.data && Array.isArray(thisWeekResponse.data)) {
          pageViewsThisWeek = thisWeekResponse.data.reduce((sum, d) => sum + (d.page_views || 0), 0);
        }

        // Fetch last week's data
        const lastWeekParams = new URLSearchParams({
          start_date: lastWeekStart.toISOString(),
          end_date: lastWeekEnd.toISOString(),
          interval: 'day'
        });
        const lastWeekResponse = await apiClient.get(`/analytics-dashboard/${storeId}/timeseries?${lastWeekParams}`);
        if (lastWeekResponse.data && Array.isArray(lastWeekResponse.data)) {
          pageViewsLastWeek = lastWeekResponse.data.reduce((sum, d) => sum + (d.page_views || 0), 0);
        }

        pageViewsGrowth = calculateGrowth(pageViewsThisWeek, pageViewsLastWeek);
      } catch (analyticsError) {
        console.warn('Could not load analytics data:', analyticsError);
        // Continue without analytics data
      }

      setPerformanceMetrics({
        salesGrowth,
        ordersGrowth,
        ordersThisMonth,
        ordersLastMonth,
        customersGrowth,
        customersThisMonth,
        customersLastMonth,
        pageViewsGrowth,
        pageViewsThisWeek,
        pageViewsLastWeek,
        loadingPerformance: false
      });
    } catch (error) {
      console.error('Error loading performance metrics:', error);
      setPerformanceMetrics(prev => ({ ...prev, loadingPerformance: false }));
    }
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <div className="flex gap-3">
          <Button onClick={loadDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      title: "Add Product",
      description: "Add new products to your store",
      icon: Package,
      link: "Products",
      color: "bg-blue-500"
    },
    {
      title: "Manage Categories",
      description: "Organize your product categories",
      icon: StoreIcon,
      link: "Categories",
      color: "bg-green-500"
    },
    {
      title: "Customers",
      description: "View and manage your customers",
      icon: Users,
      link: "Customers",
      color: "bg-purple-500"
    },
    {
      title: "Orders",
      description: "View and manage orders",
      icon: ShoppingBag,
      link: "Orders",
      color: "bg-orange-500"
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.full_name?.split(' ')[0] || 'User'} 👋
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your store today
            </p>
          </div>
        </div>

        {/* Welcome Message for new Google OAuth users */}
        {showWelcomeMessage && (
          <div className="mb-6 p-4 bg-blue-100 border border-blue-400 text-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>🎉 Welcome! Your account has been set up successfully. Connect Stripe below to start accepting payments.</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowWelcomeMessage(false)}
              className="text-blue-800 hover:text-blue-900"
            >
              ✕
            </Button>
          </div>
        )}

        {stripeSuccessMessage && (
            <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                {stripeSuccessMessage}
            </div>
        )}


        {/* Setup Guide Component */}
        <SetupGuide store={store} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">${Math.round(stats.totalRevenue || 0).toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalCustomers}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <Card className="material-elevation-1 border-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-gray-900">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quickActions.map((action, index) => (
                    <Link key={index} to={createPageUrl(action.link)}>
                      <Card className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center material-elevation-1`}>
                              <action.icon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{action.title}</h3>
                              <p className="text-sm text-gray-600">{action.description}</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Products */}
          <div>
            <Card className="material-elevation-1 border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-gray-900">Recent Products</CardTitle>
                  <Link to={createPageUrl("Products")}>
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {products.slice(0, 5).map((product) => (
                    <div key={product.id} className="flex items-center space-x-3">
                      {product.images?.[0]?.url || product.images?.[0] ? (
                        <img
                          src={product.images[0]?.url || product.images[0]}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-sm text-gray-500">${product.price}</p>
                      </div>
                      <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                        {product.status}
                      </Badge>
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">No products yet</p>
                      <p className="text-sm text-gray-500 mb-4">Start by adding your first product</p>
                      <Link to={createPageUrl("Products")}>
                        <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Product
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Store Performance */}
        <div className="mt-8">
          <Card className="material-elevation-1 border-0">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-900">Store Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className={`w-16 h-16 ${performanceMetrics.salesGrowth >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <TrendingUp className={`w-8 h-8 ${performanceMetrics.salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Sales Growth</h3>
                  {performanceMetrics.loadingPerformance ? (
                    <div className="animate-pulse h-8 bg-gray-200 rounded w-16 mx-auto"></div>
                  ) : (
                    <p className={`text-2xl font-bold ${performanceMetrics.salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {performanceMetrics.salesGrowth >= 0 ? '+' : ''}{performanceMetrics.salesGrowth}%
                    </p>
                  )}
                  <p className="text-sm text-gray-500">vs last month</p>
                </div>
                <div className="text-center">
                  <div className={`w-16 h-16 ${performanceMetrics.ordersGrowth >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <ShoppingBag className={`w-8 h-8 ${performanceMetrics.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Orders</h3>
                  {performanceMetrics.loadingPerformance ? (
                    <div className="animate-pulse h-8 bg-gray-200 rounded w-16 mx-auto"></div>
                  ) : (
                    <p className={`text-2xl font-bold ${performanceMetrics.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {performanceMetrics.ordersGrowth >= 0 ? '+' : ''}{performanceMetrics.ordersGrowth}%
                    </p>
                  )}
                  <p className="text-sm text-gray-500">vs last month</p>
                </div>
                <div className="text-center">
                  <div className={`w-16 h-16 ${performanceMetrics.customersGrowth >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Users className={`w-8 h-8 ${performanceMetrics.customersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">New Customers</h3>
                  {performanceMetrics.loadingPerformance ? (
                    <div className="animate-pulse h-8 bg-gray-200 rounded w-16 mx-auto"></div>
                  ) : (
                    <p className={`text-2xl font-bold ${performanceMetrics.customersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {performanceMetrics.customersGrowth >= 0 ? '+' : ''}{performanceMetrics.customersGrowth}%
                    </p>
                  )}
                  <p className="text-sm text-gray-500">vs last month</p>
                </div>
                <div className="text-center">
                  <div className={`w-16 h-16 ${performanceMetrics.pageViewsGrowth >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Eye className={`w-8 h-8 ${performanceMetrics.pageViewsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Page Views</h3>
                  {performanceMetrics.loadingPerformance ? (
                    <div className="animate-pulse h-8 bg-gray-200 rounded w-16 mx-auto"></div>
                  ) : (
                    <p className={`text-2xl font-bold ${performanceMetrics.pageViewsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {performanceMetrics.pageViewsGrowth >= 0 ? '+' : ''}{performanceMetrics.pageViewsGrowth}%
                    </p>
                  )}
                  <p className="text-sm text-gray-500">vs last week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
