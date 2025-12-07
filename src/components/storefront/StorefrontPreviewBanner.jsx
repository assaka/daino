/**
 * StorefrontPreviewBanner - Shows when previewing a storefront
 *
 * Displays a banner at the top of the page when:
 * - Previewing a storefront variant (e.g., Black Friday theme, B2B theme)
 * - Viewing in published preview mode (?version=published)
 * - Viewing in workspace/draft mode (?mode=workspace)
 */

import React from 'react';
import { useStore } from '@/components/storefront/StoreProvider';
import { usePreviewMode } from '@/contexts/PreviewModeContext';
import { X, Eye, Calendar, FileText, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StorefrontPreviewBanner() {
  const { storefront, isPreviewMode } = useStore();
  const { isPublishedPreview, isWorkspaceMode, clearPreviewMode } = usePreviewMode();

  const handleExitStorefrontPreview = () => {
    // Remove storefront param from URL and reload
    const url = new URL(window.location.href);
    url.searchParams.delete('storefront');
    window.location.href = url.toString();
  };

  const handleExitVersionPreview = () => {
    // Clear localStorage and remove params from URL
    clearPreviewMode();
    const url = new URL(window.location.href);
    url.searchParams.delete('version');
    url.searchParams.delete('mode');
    window.location.href = url.toString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show storefront variant preview banner
  if (isPreviewMode && storefront && !storefront.is_primary) {
    const hasSchedule = storefront.publish_start_at || storefront.publish_end_at;

    return (
      <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white px-4 py-2 z-[100] shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5" />
            <div>
              <span className="font-medium">Preview Mode:</span>
              <span className="ml-2">{storefront.name}</span>
              {hasSchedule && (
                <span className="ml-3 text-amber-100 text-sm flex items-center gap-1 inline-flex">
                  <Calendar className="w-4 h-4" />
                  {storefront.publish_start_at && (
                    <span>Starts: {formatDate(storefront.publish_start_at)}</span>
                  )}
                  {storefront.publish_end_at && (
                    <span className="ml-2">Ends: {formatDate(storefront.publish_end_at)}</span>
                  )}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitStorefrontPreview}
            className="text-white hover:bg-amber-600 hover:text-white"
          >
            <X className="w-4 h-4 mr-1" />
            Exit Preview
          </Button>
        </div>
      </div>
    );
  }

  // Show published version preview banner
  if (isPublishedPreview) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white px-4 py-2 z-[100] shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <div>
              <span className="font-medium">Published Preview</span>
              <span className="ml-2 text-blue-200 text-sm">Viewing the published version of this store</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitVersionPreview}
            className="text-white hover:bg-blue-700 hover:text-white"
          >
            <X className="w-4 h-4 mr-1" />
            Exit Preview
          </Button>
        </div>
      </div>
    );
  }

  // Show workspace/draft mode banner
  if (isWorkspaceMode) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-purple-600 text-white px-4 py-2 z-[100] shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Pencil className="w-5 h-5" />
            <div>
              <span className="font-medium">AI Workspace Mode</span>
              <span className="ml-2 text-purple-200 text-sm">Viewing draft/workspace version</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitVersionPreview}
            className="text-white hover:bg-purple-700 hover:text-white"
          >
            <X className="w-4 h-4 mr-1" />
            Exit Workspace
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
