import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StoreSelector from '@/components/admin/StoreSelector';
import { UserIcon, LogOut, ShoppingBag, Wallet, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { handleLogout } from '@/utils/auth';
import { createPageUrl, getExternalStoreUrl, getStoreBaseUrl } from '@/utils/urlUtils';
import { Store } from '@/api/entities';

const ModeHeader = ({ user, currentMode, showExtraButtons = false, extraButtons = null, hideModeSwitcher = false, hideStoreSelector = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedStore = JSON.parse(localStorage.getItem('selectedStore') || '{}');

  // Test comment to trigger deployment sync

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
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentMode === 'plugins'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Plugins
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToAIWorkspace}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  currentMode === 'aiworkspace'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                AI Workspace
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
                      const baseUrl = getStoreBaseUrl(fullStore);
                      const storeUrl = getExternalStoreUrl(storeSlug, '', baseUrl);
                      const separator = storeUrl.includes('?') ? '&' : '?';
                      window.open(`${storeUrl}${separator}version=published`, '_blank');
                    } else {
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
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  data-testid="logout-mobile"
                  className="w-full flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    try {
                      await handleLogout();
                    } catch (error) {
                      console.error('❌ Mobile logout error:', error);
                      window.location.href = '/admin/auth';
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
        </div>
        <div className="flex items-center space-x-4">
          {showExtraButtons && (
            <div className="flex items-center space-x-2">
              {extraButtons}
            </div>
          )}
          {/* Hide StoreSelector on onboarding */}
          {!hideStoreSelector && <StoreSelector />}
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
                      const baseUrl = getStoreBaseUrl(fullStore);
                      // Add ?version=published to view published/live version
                      const storeUrl = getExternalStoreUrl(storeSlug, '', baseUrl);
                      const separator = storeUrl.includes('?') ? '&' : '?';
                      window.open(`${storeUrl}${separator}version=published`, '_blank');
                    } else {
                      // Use preview URL when store is not running (still add version=published to bypass pause modal)
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
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  data-testid="logout"
                  className="w-full flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    try {
                      await handleLogout();
                    } catch (error) {
                      console.error('❌ Desktop logout error:', error);
                      window.location.href = '/admin/auth';
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
    </>
  );
};

export default ModeHeader;