

import React, { useState, useEffect, Fragment } from "react";
import { NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { createAdminUrl, getExternalStoreUrl, getStoreBaseUrl } from "@/utils/urlUtils";
import { User, Auth } from "@/api/entities";
import apiClient from "@/api/client";
import { Store } from "@/api/entities";
import { hasBothRolesLoggedIn, handleLogout } from "@/utils/auth";
import { shouldSkipStoreContext } from "@/utils/domainConfig";
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import StoreSelector from '@/components/admin/StoreSelector';
import useRoleProtection from '@/hooks/useRoleProtection';
import RoleSwitcher from '@/components/admin/RoleSwitcher';
import ModeHeader from '@/components/shared/ModeHeader';

import {
  Menu,
  X,
  Bell,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  ShoppingBag,
  Tag,
  ClipboardList,
  CreditCard,
  Ticket,
  FileText,
  Megaphone,
  Settings as SettingsIcon,
  ChevronDown,
  Store as StoreIcon,
  Palette,
  Globe,
  DollarSign,
  KeyRound,
  FileCode,
  Box,
  Users,
  BarChart2,
  BookOpen,
  Book,
  Mail,
  Shield,
  LifeBuoy,
  Plus,
  Package,
  Puzzle,
  ChevronRight,
  Home,
  Building2,
  Crown,
  Receipt,
  Truck,
  Calendar,
  Upload,
  Camera,
  Search,
  BarChart3,
  Bot,
  Wallet,
  RefreshCw,
  Link2 as LinkIcon,
  Share2,
  Activity,
  FlaskConical,
  Image,
  Database,
  Cloud,
  MessageSquare,
  LayoutList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StoreProvider } from "@/components/storefront/StoreProvider";
import { PriceUtilsProvider } from "@/utils/PriceUtilsProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoader } from "@/components/ui/page-loader";
import { useStoreSelection } from "@/contexts/StoreSelectionContext";


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 5, baseDelay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      const isRateLimit = error.response?.status === 429 ||
                         error.message?.includes('Rate limit') ||
                         error.message?.includes('429');

      if (isRateLimit && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 2000;
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

// Icon mapping for dynamic navigation items (Plugin Architecture Phase 1)
const iconMap = {
  Home, LayoutDashboard, ShoppingBag, Tag, ClipboardList, CreditCard, Ticket,
  FileText, Megaphone, SettingsIcon, Store: StoreIcon, Palette, Globe, DollarSign,
  KeyRound, FileCode, Box, Users, BarChart2, BookOpen, Book, Mail, Shield,
  LifeBuoy, Plus, Package, Puzzle, ChevronRight, Building2, Crown, Receipt,
  Truck, Calendar, Upload, Camera, Search, BarChart3, Bot, Wallet, RefreshCw,
  Link: LinkIcon, Share2, Activity, FlaskConical, Image, Database, Cloud
};

function getIconComponent(iconName) {
  if (!iconName) return Puzzle; // Default to Puzzle icon
  return iconMap[iconName] || Puzzle;
}

function LayoutInner({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedStore } = useStoreSelection();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState({
    "Catalog": false,
    "Sales": false,
    "Content": false,
    "Marketing": false,
    "SEO": false, // Added new group for SEO
    "Plugins": false, // Added new group for Plugins
    "Import & Export": false, // Added new group for Import & Export
    "Store": false,
    "Advanced": false, // Added new group for Advanced features
  });
  const [dynamicNavItems, setDynamicNavItems] = useState([]);


  // Add this block to handle the RobotsTxt page
  if (currentPageName === 'RobotsTxt') {
    return <>{children}</>;
  }
  // End of new block

  useEffect(() => {
    const loadData = async () => {
        await loadUserAndHandleCredits(); // Combined function

        // Only load dynamic navigation for admin pages
        const isStorefrontPath = location.pathname.startsWith('/public/');
        const isCustomerPath = location.pathname.startsWith('/customerdashboard');
        const isLandingPath = location.pathname === '/' || location.pathname === '/landing';

        // Load navigation only if we're in admin area
        if (!isStorefrontPath && !isCustomerPath && !isLandingPath) {
          await loadDynamicNavigation();
        }
    }
    loadData();

    // Listen for user data ready event
    const handleUserDataReady = () => {
      loadUserAndHandleCredits();
    };

    // Listen for credits updated event (e.g., after credit purchase)
    const handleCreditsUpdated = () => {
      loadUserAndHandleCredits();
    };

    // Listen for navigation updated event (from NavigationManager)
    const handleNavigationUpdated = () => {
      loadDynamicNavigation();
    };

    // Listen for store selection changes (e.g., after first store creation)
    const handleStoreSelectionChanged = () => {
      loadDynamicNavigation();
    };

    // Add global click detector to debug logout issues
    const globalClickHandler = (e) => {
      if (e.target.textContent?.includes('Logout') || e.target.closest('[data-testid="logout"]')) {
        // Logout click detected
      }
    };

    document.addEventListener('click', globalClickHandler, true);
    window.addEventListener('userDataReady', handleUserDataReady);
    window.addEventListener('creditsUpdated', handleCreditsUpdated);
    window.addEventListener('navigation-updated', handleNavigationUpdated);
    window.addEventListener('storeSelectionChanged', handleStoreSelectionChanged);

    return () => {
      document.removeEventListener('click', globalClickHandler, true);
      window.removeEventListener('userDataReady', handleUserDataReady);
      window.removeEventListener('creditsUpdated', handleCreditsUpdated);
      window.removeEventListener('navigation-updated', handleNavigationUpdated);
      window.removeEventListener('storeSelectionChanged', handleStoreSelectionChanged);
    };
  }, [location.pathname]);

  const loadUserAndHandleCredits = async () => {
    try {
      const hasStoreOwnerToken = !!localStorage.getItem('store_owner_auth_token');

      if (hasStoreOwnerToken) {
        try {
          // Fetch fresh user data from database (single source of truth for credits)
          const userData = await User.me();
          setUser(userData);
        } catch (apiError) {
          // Fallback to localStorage if API fails
          const storeOwnerUserData = localStorage.getItem('store_owner_user_data');
          if (storeOwnerUserData) {
            const cachedUserData = JSON.parse(storeOwnerUserData);
            setUser(cachedUserData);
          } else {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };


  const loadDynamicNavigation = async () => {
    try {
      // Load dynamic navigation from Plugin Architecture API (Phase 1 integration)
      const response = await retryApiCall(() =>
        apiClient.get('/admin/navigation')
      );

      if (response.success && response.navigation && Array.isArray(response.navigation)) {
        // Backend returns hierarchical structure - flatten it first
        const flattenNavigation = (items, parentKey = null) => {
          let result = [];
          items.forEach(item => {
            result.push({
              key: item.key,
              name: item.label,
              path: item.route?.replace('/admin/', ''), // Remove /admin/ prefix
              icon: getIconComponent(item.icon),
              badge: item.badge,
              type: item.type || 'standard',
              isPremium: item.type === 'premium',
              isPlugin: false,
              parent_key: item.parent_key || parentKey,
              order_position: item.order_position || 0
            });
            // Recursively add children
            if (item.children && item.children.length > 0) {
              result = result.concat(flattenNavigation(item.children, item.key));
            }
          });
          return result;
        };

        const allItems = flattenNavigation(response.navigation);

        // Find all main categories (parent_key is null and no route - these are headers)
        const mainCategories = allItems
          .filter(item => !item.parent_key && !item.path)
          .sort((a, b) => a.order_position - b.order_position);

        // Find standalone items (items with routes but no parent - like plugin items)
        const standaloneItems = allItems
          .filter(item => !item.parent_key && item.path)
          .sort((a, b) => a.order_position - b.order_position);

        // Build navigation groups with children (including nested children)
        const navigationGroups = mainCategories.map(category => {
          // Get direct children of the category
          const directChildren = allItems
            .filter(item => item.parent_key === category.key);

          // For each direct child, also get their children (to support plugins under items like "products")
          const allCategoryItems = [...directChildren];
          directChildren.forEach(child => {
            const grandchildren = allItems.filter(item => item.parent_key === child.key);
            allCategoryItems.push(...grandchildren);
          });

          // Sort all items together by order_position
          const sortedItems = allCategoryItems.sort((a, b) => a.order_position - b.order_position);

          return {
            name: category.name,
            key: category.key,
            items: sortedItems
          };
        }).filter(group => group.items.length > 0);

        // If there are standalone items, create a "Plugins & Tools" group for them
        if (standaloneItems.length > 0) {
          navigationGroups.push({
            name: 'Plugins & Tools',
            key: 'plugins-tools',
            items: standaloneItems
          });
        }

        setDynamicNavItems(navigationGroups);
      }
    } catch (error) {
    }
  };

  const publicPages = ['Landing', 'Auth', 'Pricing', 'Onboarding'];
  const storefrontPages = ['Storefront', 'Category', 'ProductDetail', 'Cart', 'Checkout', 'CustomerAuth', 'CustomerDashboard', 'CmsPageViewer', 'OrderSuccess', 'SitemapPublic', 'NotFound', 'EmailVerification'];
  const editorPages = ['AIContextWindow']; // Pages that use the editor mode
  const pluginPages = ['Plugins']; // Pages that use the plugins mode
  const aiWorkspacePages = ['AIWorkspace']; // Pages that use the AI Workspace mode (full-screen editor)

  // Use centralized config to check for pages that skip store context
  const skipStoreContext = shouldSkipStoreContext(location.pathname);

  const isPublicPage = publicPages.includes(currentPageName) || skipStoreContext;
  const isStorefrontPage = storefrontPages.includes(currentPageName) && !skipStoreContext;
  const isCustomerDashboard = currentPageName === 'CustomerDashboard';
  const isEditorPage = editorPages.includes(currentPageName) || location.pathname.startsWith('/editor/');
  const isPluginPage = pluginPages.includes(currentPageName) || location.pathname.startsWith('/plugins');
  const isAIWorkspacePage = aiWorkspacePages.includes(currentPageName) || location.pathname.startsWith('/ai-workspace');
  // Onboarding check - included in skipStoreContext but we need this for layout decisions
  const isOnboardingPage = currentPageName === 'StoreOnboarding' ||
                           location.pathname === '/admin/onboarding';
  const isAdminPage = !isPublicPage && !isStorefrontPage && !isCustomerDashboard && !isEditorPage && !isPluginPage && !isAIWorkspacePage && !isOnboardingPage;

  // Determine current mode for ModeHeader
  const currentMode = isEditorPage ? 'editor' : isPluginPage ? 'plugins' : isAIWorkspacePage ? 'aiworkspace' : 'admin';
  
  // Apply role-based access control for admin, editor, plugin, AI Studio, and AI Workspace pages
  useRoleProtection(isAdminPage || isEditorPage || isPluginPage || isAIWorkspacePage);

  if (isLoading && (isAdminPage || isEditorPage || isPluginPage || isAIWorkspacePage)) {
    return <PageLoader size="lg" />;
  }

  if (isStorefrontPage || isCustomerDashboard) {
      return (
        <StoreProvider>
            <PriceUtilsProvider>
                <StorefrontLayout>{children}</StorefrontLayout>
            </PriceUtilsProvider>
        </StoreProvider>
      );
  }

  // Pages that skip store context - render without StoreProvider wrapper
  // This uses the centralized shouldSkipStoreContext from domainConfig.js
  if (skipStoreContext) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    );
  }

  // Role-based access control is now handled by RoleProtectedRoute at the route level

  // Handle admin, editor, plugin, AI Studio, and AI Workspace pages
  if (isAdminPage || isEditorPage || isPluginPage || isAIWorkspacePage) {
      
      // Use token-only validation for admin/editor access like RoleProtectedRoute
      const hasStoreOwnerToken = !!localStorage.getItem('store_owner_auth_token');
      
      if (!isLoading && !hasStoreOwnerToken) {
          navigate(createAdminUrl('ADMIN_AUTH'));
          return <PageLoader size="lg" text="Redirecting..." />;
      }
      
  }

  // For public pages
  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <RoleSwitcher />

        <style>{`
          :root {
            --primary: 220 90% 56%;
            --primary-foreground: 220 90% 98%;
            --secondary: 45 93% 58%;
            --secondary-foreground: 45 93% 15%;
            --accent: 262 83% 58%;
            --accent-foreground: 210 40% 98%;
            --destructive: 0 84% 60%;
            --destructive-foreground: 210 40% 98%;
            --muted: 210 40% 96%;
            --muted-foreground: 215 16% 47%;
            --card: 0 0% 100%;
            --card-foreground: 222 84% 5%;
            --popover: 0 0% 100%;
            --popover-foreground: 222 84% 5%;
            --border: 214 32% 91%;
            --input: 214 32% 91%;
            --ring: 220 90% 56%;
            --background: 0 0% 100%;
            --foreground: 222 84% 5%;
          }

          .material-elevation-1 {
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
          }

          .material-elevation-2 {
            box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
          }

          .material-ripple {
            position: relative;
            overflow: hidden;
          }

          .material-ripple:before {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255,255,255,0.5);
            transition: width 0.6s, height 0.6s, top 0.6s, left 0.6s;
            transform: translate(-50%, -50%);
          }

          .material-ripple:active:before {
            width: 300px;
            height: 300px;
          }
        `}</style>
        {children}
      </div>
    );
  }

  // Navigation groups are now loaded dynamically from database using parent_key hierarchy
  const navigationGroups = dynamicNavItems || [];

  const toggleGroup = (groupName) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Don't show sidebar for editor, plugin, AI Studio, AI Workspace, and onboarding
  const showSidebar = !isEditorPage && !isPluginPage && !isAIWorkspacePage && !isOnboardingPage;

  return (
    <StoreProvider>
      <PriceUtilsProvider>
      <div className="h-screen bg-gray-50 flex overflow-hidden">
        <RoleSwitcher />
      <style>{`
        :root {
          --primary: 220 90% 56%;
          --primary-foreground: 220 90% 98%;
          --secondary: 45 93% 58%;
          --secondary-foreground: 45 93% 15%;
          --accent: 210 40% 98%;
          --accent-foreground: 220 13% 13%;
          --destructive: 0 72% 51%;
          --destructive-foreground: 0 0% 98%;
          --border: 220 13% 91%;
          --input: 220 13% 91%;
          --ring: 220 90% 56%;
          --radius: 8px;
          --background: 0 0% 100%;
          --foreground: 222 84% 5%;
          --card: 0 0% 100%;
          --card-foreground: 222 84% 5%;
          --popover: 0 0% 100%;
          --popover-foreground: 222 84% 5%;
          --muted: 210 40% 96%;
          --muted-foreground: 215 16% 47%;
        }

        /* Fix dropdown and select styling globally */
        [data-radix-select-trigger] {
          background-color: white !important;
          border: 1px solid hsl(var(--border)) !important;
          color: hsl(var(--foreground)) !important;
        }

        [data-radix-select-trigger]:hover {
          background-color: hsl(var(--muted)) !important;
        }

        [data-radix-select-trigger]:focus {
          border-color: hsl(var(--ring)) !important;
          box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2) !important;
        }

        [data-radix-select-content] {
          background-color: white !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
        }

        [data-radix-select-item] {
          color: hsl(var(--foreground)) !important;
          background-color: transparent !important;
        }

        [data-radix-select-item]:hover,
        [data-radix-select-item][data-highlighted] {
          background-color: hsl(var(--muted)) !important;
        }

        [data-radix-select-item][data-state="checked"] {
          background-color: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
        }

        /* Also fix Popover components used in multi-selects */
        [data-radix-popover-content] {
          background-color: white !important;
          border: 1px solid hsl(var(--border)) !important;
          color: hsl(var(--foreground)) !important;
        }

        /* Fix Command components */
        [cmdk-root] {
          background-color: white !important;
          color: hsl(var(--foreground)) !important;
        }

        [cmdk-item] {
          color: hsl(var(--foreground)) !important;
        }

        [cmdk-item][data-selected="true"] {
          background-color: hsl(var(--muted)) !important;
        }

        .material-elevation-1 {
          box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
        }

        .material-elevation-2 {
          box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
        }

        .material-elevation-3 {
          box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23);
        }

        .material-ripple {
          position: relative;
          overflow: hidden;
          transform: translate3d(0, 0, 0);
        }

        .material-ripple:after {
          content: "";
          display: block;
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          pointer-events: none;
          background-image: radial-gradient(circle, #fff 10%, transparent 10.01%);
          background-repeat: no-repeat;
          background-position: 50%;
          transform: scale(10, 10);
          opacity: 0;
          transition: transform .5s, opacity 1s;
        }

        .material-ripple:active:after {
          transform: scale(0, 0);
          opacity: .3;
          transition: 0s;
        }
      `}</style>

      {showSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {showSidebar && (
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white material-elevation-2 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <StoreIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">DainoStore</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>{user?.first_name || user?.name || user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => {
                    try {
                        if (!selectedStore?.id) return;

                        // Fetch complete store data to ensure we have the slug
                        const fullStoreData = await Store.findById(selectedStore.id);
                        // Extract store from nested response structure
                        const storeData = fullStoreData?.data?.store || fullStoreData?.store || fullStoreData;
                        const fullStore = Array.isArray(storeData) ? storeData[0] : storeData;

                        const storeSlug = fullStore?.slug || selectedStore?.slug;

                        if (storeSlug) {
                            if (fullStore?.published) {
                                // Store is running - open directly without version param
                                const baseUrl = getStoreBaseUrl(fullStore);
                                const storeUrl = getExternalStoreUrl(storeSlug, '', baseUrl);
                                window.open(storeUrl, '_blank');
                            } else {
                                // Store is paused - add version=published to bypass pause modal
                                window.open(`/public/${storeSlug}?version=published`, '_blank');
                            }
                        }
                    } catch (error) {
                    }
                }}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    <span>View Storefront</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(createPageUrl("Billing"))}>
                    <Wallet className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/team")}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Team</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/stores")}>
                    <StoreIcon className="mr-2 h-4 w-4" />
                    <span>Stores</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                    try {
                        await handleLogout();
                    } catch (error) {
                        window.location.href = '/admin/auth';
                    }
                }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col h-full">
          <div className="px-6 pt-6 pb-1 flex-shrink-0">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.first_name || user?.full_name || user?.name || user?.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
               <div className="text-sm text-gray-600 mt-2">
                  Credits: <span className="font-bold text-gray-900">{user?.credits || 0}</span>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-6 pb-6 space-y-1">
            {/* Dashboard as direct menu item */}
            <Link
              to={createAdminUrl("Dashboard")}
              className={`flex items-center space-x-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === 'Dashboard'
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="w-5 h-5" />
              <span className="flex-1">Dashboard</span>
              {currentPageName === 'Dashboard' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>

            {/* Manage Navigation Meta-Tool */}
            <Link
              to="/admin/navigation-manager"
              className={`flex items-center space-x-3 py-1 rounded-lg text-sm font-medium transition-colors mb-6 ${
                location.pathname === '/admin/navigation-manager'
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <LayoutList className="w-5 h-5" />
              <span className="flex-1">Manage Navigation</span>
              {location.pathname === '/admin/navigation-manager' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>

            {navigationGroups.map((group) => (
              <Collapsible key={group.name} open={openGroups[group.name]} onOpenChange={() => toggleGroup(group.name)}>
                <CollapsibleTrigger asChild>
                   <div className="flex items-center justify-between w-full cursor-pointer py-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group.name}
                      </h3>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openGroups[group.name] ? 'rotate-180' : ''}`} />
                   </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  {group.items.map((item) => {
                    let isActive = false;
                    const itemHasTab = item.path?.includes('?tab=') || false;
                    const isPathBased = item.path?.includes('/') && !item.path?.includes('?');
                    
                    if (itemHasTab) {
                        const [basePath, query] = item.path.split('?');
                        if (currentPageName === basePath) {
                            const itemTab = new URLSearchParams(query).get('tab');
                            const currentTab = new URLSearchParams(location.search).get('tab') || 'settings'; // Default tab is settings
                            isActive = itemTab === currentTab;
                        }
                    } else if (isPathBased) {
                        // For path-based items like seo-tools/settings, check if current path matches
                        const currentPath = location.pathname.replace('/admin/', '');
                        isActive = currentPath === item.path;
                    } else {
                        // For items without tabs, check if the current page name matches the item's path (ignoring any query params on item.path)
                        isActive = item.path ? currentPageName === item.path.split('?')[0] : false;
                    }

                    // Skip items without a path (these are typically category headers)
                    if (!item.path) {
                        return null;
                    }

                    let itemClass = `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`;

                    if (item.path === "Billing") {
                        itemClass += " animate-pulse bg-red-50 text-red-700";
                    }

                    return (
                      <div key={item.name} className="relative">
                        {item.type === 'premium' && (
                          <Crown className="absolute top-0 right-0 w-4 h-4 text-yellow-500 font-bold z-10 pointer-events-none" />
                        )}
                        {item.type === 'coming_soon' && (
                          <Badge className="absolute top-0 right-0 text-[8px] px-1 py-0 h-4 bg-gray-500 text-white z-10 pointer-events-none">Soon</Badge>
                        )}
                        {item.type === 'beta' && (
                          <Badge className="absolute top-0 right-0 text-[8px] px-1 py-0 h-4 bg-blue-500 text-white z-10 pointer-events-none">Beta</Badge>
                        )}
                        {item.type === 'new' && (
                          <Badge className="absolute top-0 right-0 text-[8px] px-1 py-0 h-4 bg-green-500 text-white z-10 pointer-events-none">New</Badge>
                        )}
                        <Link
                          to={createAdminUrl(item.path)}
                          className={itemClass}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="flex-1">{item.name}</span>
                          {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                        </Link>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </nav>
        </div>
      </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <ModeHeader
          user={user}
          currentMode={currentMode}
          showExtraButtons={true}
          hideModeSwitcher={isOnboardingPage}
          hideStoreSelector={isOnboardingPage}
          extraButtons={
            showSidebar && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )
          }
        />

        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>
      </div>


      </div>
      </PriceUtilsProvider>
    </StoreProvider>
  );
}

export default function Layout(props) {
  return <LayoutInner {...props} />;
}

