import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StoreSelector from '@/components/admin/StoreSelector';
import { UserIcon, LogOut, ShoppingBag, Wallet, Users, Store as StoreIcon, KeyRound, Coins, Wand2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { handleLogoutWithNavigate } from '@/utils/auth';
import { createPageUrl, getExternalStoreUrl, getStoreBaseUrl } from '@/utils/urlUtils';
import { Store } from '@/api/entities';
import apiClient from '@/api/client';

const ModeHeader = ({ user, currentMode, showExtraButtons = false, extraButtons = null, hideModeSwitcher = false, hideStoreSelector = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedStore = JSON.parse(localStorage.getItem('selectedStore') || '{}');
  const [credits, setCredits] = useState(user?.credits || 0);
  const [showBillingModal, setShowBillingModal] = useState(false);

  // Show credits badge only on plugins/ai-workspace pages
  const showCredits = currentMode === 'plugins' || currentMode === 'aiworkspace';

  // Fetch credits balance
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const response = await apiClient.get('credits/balance');
        // Handle response format: {data:{balance:X}} or {balance:X}
        if (response?.data?.balance !== undefined) {
          setCredits(response.data.balance);
        } else if (response?.balance !== undefined) {
          setCredits(response.balance);
        }
      } catch (error) {
        console.error('Error fetching credits:', error);
      }
    };

    if (showCredits && user?.id) {
      fetchCredits();
    }

    // Listen for credits updates
    const handleCreditsUpdate = () => fetchCredits();
    window.addEventListener('creditsUpdated', handleCreditsUpdate);
    return () => window.removeEventListener('creditsUpdated', handleCreditsUpdate);
  }, [user?.id, showCredits]);

  const switchToAdmin = () => {
    if (currentMode !== 'admin') {
      currentMode = 'admin';
      navigate('/admin/dashboard');
    }
  };

  const switchToPlugins = () => {
    if (currentMode !== 'plugins') {
      currentMode = 'plugins';
      navigate('/plugins');
    }
  };
  const switchToAIImageOptimizer = () => {
    if (currentMode !== 'aiimageoptimizer') {
      currentMode = 'aiimageoptimizer';
      navigate('/ai-image-optimizer');
    }
  };
  const switchToAIWorkspace = () => {
    if (currentMode !== 'aiworkspace') {
      currentMode = 'aiworkspace';
      navigate('/ai-workspace');
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {/* Show logo on onboarding (mobile) */}
          {hideModeSwitcher && (
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-bold text-gray-900">DainoStore</span>
            </div>
          )}

          {/* Show mode switcher only if not on onboarding */}
          {!hideModeSwitcher && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToAdmin}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentMode === 'admin'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Admin
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToPlugins}
                className={`hidden sm:block px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentMode === 'plugins'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Plugins
                <span className="hidden sm:block ml-1 px-1 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded">
                  Experimental
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToAIWorkspace}
                className={`hidden sm:block px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentMode === 'aiworkspace'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                AI Workspace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToAIImageOptimizer}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentMode === 'aiimageoptimizer'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                AI Image Optimizer
              </Button>
            </div>
          )}
        </div>
        {showExtraButtons && (
          <div className="flex items-center space-x-2">
            {extraButtons}
          </div>
        )}
        <div className="flex items-center space-x-2">
          {/* Show StoreSelector on mobile/tablet */}
          {!hideStoreSelector && <StoreSelector className="hidden sm:flex" />}
          {/* Credits Balance - mobile */}
          {showCredits && (
            <button
              onClick={() => setShowBillingModal(true)}
              className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full transition-colors"
              title="Click to purchase credits"
            >
              <Coins className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">
                {credits?.toLocaleString() || 0}
              </span>
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <UserIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.first_name || user?.name || user?.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Show StoreSelector in dropdown for smallest screens */}
              {!hideStoreSelector && (
                <>
                  <div className="px-2 py-2 sm:hidden">
                    <StoreSelector />
                  </div>
                  <DropdownMenuSeparator className="sm:hidden" />
                </>
              )}
              <DropdownMenuItem onClick={async () => {
                try {
                  if (!selectedStore?.id) return;

                  const fullStoreData = await Store.findById(selectedStore.id);
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
                  } else {
                    console.warn('Store slug not found for store:', selectedStore);
                  }
                } catch (error) {
                  console.error('Error loading store data for View Storefront:', error);
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
              <DropdownMenuItem onClick={() => navigate("/admin/access-requests")}>
                <KeyRound className="mr-2 h-4 w-4" />
                <span>Access Requests</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin/stores")}>
                <StoreIcon className="mr-2 h-4 w-4" />
                <span>Stores</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  data-testid="logout-mobile"
                  className="w-full flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    try {
                      await handleLogoutWithNavigate(navigate);
                    } catch (error) {
                      console.error('❌ Mobile logout error:', error);
                      navigate('/admin/auth');
                    }
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop Header with Store Selector */}
      <div className="w-full hidden lg:flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {/* Show logo on onboarding */}
          {hideModeSwitcher && (
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Daino</span>
            </div>
          )}

          {/* Show mode switcher only if not on onboarding */}
          {!hideModeSwitcher && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToAdmin}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentMode === 'admin'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Admin
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToPlugins}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentMode === 'plugins'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Plugins
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">
                  Experimental
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToAIWorkspace}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentMode === 'aiworkspace'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                AI Workspace
              </Button>
            </div>
          )}

          {/* AI Image Optimizer Quick Access */}
          {currentMode === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/ai-image-optimizer')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                location.pathname === '/admin/ai-image-optimizer'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:text-purple-700 hover:bg-purple-50'
              }`}
            >
              <Wand2 className="w-4 h-4 mr-1.5" />
              AI Image Optimizer
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {showExtraButtons && (
            <div className="flex items-center space-x-2">
              {extraButtons}
            </div>
          )}
          {/* Hide StoreSelector on onboarding */}
          {!hideStoreSelector && <StoreSelector />}
          {/* Credits Balance - shown on plugins/ai-workspace pages */}
          {showCredits && (
            <button
              onClick={() => setShowBillingModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full transition-colors cursor-pointer"
              title="Click to purchase credits"
            >
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {credits?.toLocaleString() || 0}
              </span>
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <UserIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.first_name || user?.name || user?.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => {
                try {
                  if (!selectedStore?.id) return;

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
                  } else {
                    console.warn('Store slug not found for store:', selectedStore);
                  }
                } catch (error) {
                  console.error('Error loading store data for View Storefront:', error);
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
              <DropdownMenuItem onClick={() => navigate("/admin/access-requests")}>
                <KeyRound className="mr-2 h-4 w-4" />
                <span>Access Requests</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin/stores")}>
                <StoreIcon className="mr-2 h-4 w-4" />
                <span>Stores</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  data-testid="logout"
                  className="w-full flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    try {
                      await handleLogoutWithNavigate(navigate);
                    } catch (error) {
                      console.error('❌ Desktop logout error:', error);
                      navigate('/admin/auth');
                    }
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Billing Modal */}
      <Dialog open={showBillingModal} onOpenChange={setShowBillingModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-600" />
              Credits Balance
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-100">
              <p className="text-sm text-gray-500 mb-1">Current Balance</p>
              <p className="text-4xl font-bold text-amber-600">{credits?.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500 mt-1">credits</p>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Plugin AI generation: <span className="font-medium">5 credits</span> per request</p>
              <p>• Store uptime: <span className="font-medium">3 credits</span> per day</p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setShowBillingModal(false);
                navigate(createPageUrl("Billing"));
              }}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Purchase Credits
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModeHeader;