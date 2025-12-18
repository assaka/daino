import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  BarChart3,
  AlertTriangle,
  Power,
  Activity,
  Users,
  Target,
  ArrowDown
} from 'lucide-react';

import HeatmapVisualization from '@/components/admin/heatmap/HeatmapVisualization';
import HeatmapTrackerComponent from '@/components/admin/heatmap/HeatmapTracker';
import ScrollDepthMap from '@/components/admin/heatmap/ScrollDepthMap';
import ScrollDepthOverlay from '@/components/admin/heatmap/ScrollDepthOverlay';
import TimeOnPageMap from '@/components/admin/heatmap/TimeOnPageMap';
import ElementClickRanking from '@/components/admin/heatmap/ElementClickRanking';
import SessionList from '@/components/admin/heatmap/SessionList';
import SessionReplay from '@/components/admin/heatmap/SessionReplay';

export default function HeatmapAnalytics() {
  const { selectedStore } = useStoreSelection();
  const [loading, setLoading] = useState(false);
  const [selectedPageUrl, setSelectedPageUrl] = useState('');
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('7d');
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeTab, setActiveTab] = useState('heatmaps');

  // Heatmap enable state
  const [heatmapEnabled, setHeatmapEnabled] = useState(true); // Default enabled for alpha

  useEffect(() => {
    if (selectedStore) {
      setLoading(false);
    }
  }, [selectedStore]);

  if (!selectedStore) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Store Selected</h2>
          <p className="text-gray-600">Please select a store to view heatmap analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Add heatmap tracking to this page */}
      <HeatmapTrackerComponent storeId={selectedStore.id} />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Heatmaps</h1>
            </div>
            <p className="text-gray-600">
              Visualize customer interactions and movement patterns on your store pages
            </p>
          </div>

          {/* Alpha Disclaimer Banner */}
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="pt-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">Alpha Preliminary Version</h3>
                  <p className="text-sm text-amber-700 mb-2">
                    This heatmap analytics dashboard is currently in alpha development.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enable Toggle */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Power className={`w-5 h-5 ${heatmapEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <Label className="text-base font-semibold">Enable Heatmap Tracking</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Record user interactions, clicks, scrolls, and mouse movements
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Currently free. Future billing (1 credit per day) will only begin after advance notification.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={heatmapEnabled}
                  onCheckedChange={setHeatmapEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Heatmap Visualizations with Tabs */}
          {heatmapEnabled ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full max-w-2xl grid-cols-3">
                <TabsTrigger value="heatmaps" className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Clicks
                </TabsTrigger>
                <TabsTrigger value="scroll" className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" />
                  Scroll
                </TabsTrigger>
                <TabsTrigger value="sessions" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Sessions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="heatmaps" className="space-y-6">
                {/* Main Heatmap */}
                <HeatmapVisualization
                  storeId={selectedStore.id}
                  initialPageUrl={selectedPageUrl}
                  onPageUrlChange={setSelectedPageUrl}
                  onDateRangeChange={setDateRange}
                />

                {/* Element Click Rankings */}
                {selectedPageUrl && (
                  <ElementClickRanking
                    storeId={selectedStore.id}
                    pageUrl={selectedPageUrl}
                    dateRange={dateRange}
                    limit={15}
                  />
                )}
              </TabsContent>

              <TabsContent value="scroll" className="space-y-6">
                {/* Scroll Depth Map - has its own URL search dropdown */}
                <ScrollDepthMap
                  storeId={selectedStore.id}
                  dateRange={dateRange}
                />
              </TabsContent>

              <TabsContent value="sessions">
                <SessionList
                  storeId={selectedStore.id}
                  dateRange={dateRange}
                  onSessionSelect={setSelectedSession}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Power className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Heatmap Tracking Disabled</h3>
                  <p className="text-gray-600 mb-4">
                    Enable heatmap tracking above to start recording customer interactions
                  </p>
                  <p className="text-sm text-gray-500">
                    Heatmaps help you understand how customers interact with your pages
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Session Replay Modal */}
          {selectedSession && (
            <SessionReplay
              storeId={selectedStore.id}
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
