import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Rocket,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Loader2,
  History,
  Eye,
  X,
  Undo,
  Trash2
} from 'lucide-react';
import slotConfigurationService from '@/services/slotConfigurationService';
import FlashMessage from '@/components/storefront/FlashMessage';
import { formatDistanceToNow } from 'date-fns';
import { DestroyLayoutModal } from './SlotComponents';

const PublishPanel = ({
  draftConfig,
  storeId,
  pageType = 'cart',
  onPublished,
  onReverted,
  hasUnsavedChanges = false,
  unpublishedStatus = null,
  globalPublish = false
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [revertingVersionId, setRevertingVersionId] = useState(null);
  const [latestPublished, setLatestPublished] = useState(null);
  const [undoingRevert, setUndoingRevert] = useState(false);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [isDestroying, setIsDestroying] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  // Load version history
  const loadVersionHistory = async () => {
    if (!storeId) return;

    setLoadingHistory(true);
    try {
      const response = await slotConfigurationService.getVersionHistory(storeId, pageType, 50);
      if (response.success) {
        setVersionHistory(response.data || []);
        // Set the latest published version
        if (response.data && response.data.length > 0) {
          setLatestPublished(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load version history:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load version history' });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load history on mount and when storeId changes
  useEffect(() => {
    if (storeId) {
      loadVersionHistory();
    }
  }, [storeId, pageType]);

  // Publish draft configuration (global or single page)
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      let response;

      if (globalPublish) {
        // Publish all pages with unpublished changes
        response = await slotConfigurationService.publishAll(storeId);
        if (response.success) {
          const count = response.data?.publishedCount || 0;
          if (count > 0) {
            setFlashMessage({ type: 'success', message: `Successfully published ${count} page(s)!` });
          } else {
            setFlashMessage({ type: 'info', message: 'No changes to publish' });
          }
        }
      } else {
        // Single page publish (legacy behavior)
        if (!draftConfig?.id) {
          setFlashMessage({ type: 'error', message: 'No draft configuration to publish' });
          setIsPublishing(false);
          return;
        }
        response = await slotConfigurationService.publishDraft(draftConfig.id, storeId);
        if (response.success) {
          setFlashMessage({ type: 'success', message: 'Configuration published successfully!' });
        }
      }

      if (response.success) {
        // Reload version history
        await loadVersionHistory();

        // Notify parent component
        if (onPublished) {
          onPublished(response.data);
        }
      } else {
        setFlashMessage({ type: 'error', message: response.error || 'Failed to publish configuration' });
      }
    } catch (error) {
      console.error('Error publishing configuration:', error);
      setFlashMessage({ type: 'error', message: 'Failed to publish configuration' });
    } finally {
      setIsPublishing(false);
    }
  };

  // Create revert draft
  const handleRevert = async (versionId, versionNumber) => {
    if (!versionId) return;

    setRevertingVersionId(versionId);
    try {
      const response = await slotConfigurationService.createRevertDraft(versionId, storeId);
      if (response.success) {
        setFlashMessage({ type: 'success', message: `Created revert draft from version ${versionNumber}. Publish to apply changes.` });

        // Reload version history
        await loadVersionHistory();

        // Notify parent component to reload draft
        if (onReverted) {
          onReverted(response.data);
        }
      } else {
        setFlashMessage({ type: 'error', message: response.error || 'Failed to create revert draft' });
      }
    } catch (error) {
      console.error('Error creating revert draft:', error);
      setFlashMessage({ type: 'error', message: 'Failed to create revert draft' });
    } finally {
      setRevertingVersionId(null);
    }
  };

  // Smart undo revert - either deletes draft or restores previous draft state
  const handleUndoRevert = async () => {
    if (!draftConfig?.id) return;

    // Only allow undo if this is a revert draft (has current_edit_id pointing to a version)
    if (!draftConfig.current_edit_id) {
      setFlashMessage({ type: 'error', message: 'No revert to undo' });
      return;
    }

    setUndoingRevert(true);
    try {
      const response = await slotConfigurationService.undoRevert(draftConfig.id, storeId);
      if (response.success) {
        if (response.restored) {
          setFlashMessage({ type: 'success', message: 'Previous draft state restored' });
        } else {
          setFlashMessage({ type: 'success', message: 'Revert undone - no previous draft to restore' });
        }

        // Reload version history
        await loadVersionHistory();

        // Notify parent component to reload draft
        if (onReverted) {
          onReverted(response.data); // Pass the restored draft or null
        }
      } else {
        setFlashMessage({ type: 'error', message: response.error || 'Failed to undo revert' });
      }
    } catch (error) {
      console.error('Error undoing revert:', error);
      setFlashMessage({ type: 'error', message: 'Failed to undo revert' });
    } finally {
      setUndoingRevert(false);
    }
  };

  // Destroy layout - reset to default and delete all versions
  const handleDestroy = async () => {
    if (!storeId) return;

    setIsDestroying(true);
    try {
      const response = await slotConfigurationService.destroyLayout(storeId, pageType);
      if (response.success) {
        setFlashMessage({ type: 'success', message: `Layout destroyed successfully. Deleted ${response.deletedCount} versions and created fresh draft.` });

        // Clear version history
        setVersionHistory([]);

        // Notify parent component to reload draft
        if (onReverted) {
          onReverted(response.data);
        }
      } else {
        setFlashMessage({ type: 'error', message: response.error || 'Failed to destroy layout' });
      }
    } catch (error) {
      console.error('Error destroying layout:', error);
      setFlashMessage({ type: 'error', message: 'Failed to destroy layout' });
    } finally {
      setIsDestroying(false);
    }
  };

  // Get status display
  const getStatusDisplay = () => {
    if (!draftConfig) {
      return {
        label: 'No Configuration',
        color: 'text-gray-500',
        icon: <AlertCircle className="w-4 h-4" />
      };
    }

    if (draftConfig.status === 'draft') {
      // Check if this is a revert draft
      if (draftConfig.current_edit_id) {
        return {
          label: 'Revert draft - ready to publish',
          color: 'text-orange-600',
          icon: <RotateCcw className="w-4 h-4" />,
          isRevertDraft: true
        };
      }

      if (hasUnsavedChanges || draftConfig.has_unpublished_changes) {
        return {
          label: 'Draft with unpublished changes',
          color: 'text-yellow-600',
          icon: <AlertCircle className="w-4 h-4" />
        };
      }
      return {
        label: 'Draft',
        color: 'text-blue-600',
        icon: <Clock className="w-4 h-4" />
      };
    }

    if (draftConfig.status === 'published') {
      return {
        label: 'Published',
        color: 'text-green-600',
        icon: <Check className="w-4 h-4" />
      };
    }

    return {
      label: draftConfig.status,
      color: 'text-gray-600',
      icon: <Clock className="w-4 h-4" />
    };
  };

  const status = getStatusDisplay();

  // For global publish, check if any page has unpublished changes
  // For single page, check the current draft
  const canPublish = globalPublish
    ? (unpublishedStatus?.hasAnyUnpublishedChanges || hasUnsavedChanges)
    : (draftConfig && draftConfig.status === 'draft' && (hasUnsavedChanges || draftConfig.has_unpublished_changes));

  // Get list of pages with unpublished changes for global mode
  const pagesWithChanges = globalPublish && unpublishedStatus?.pageTypes
    ? Object.entries(unpublishedStatus.pageTypes)
        .filter(([_, status]) => status.hasUnpublishedChanges)
        .map(([pageType]) => pageType)
    : [];

  // Format page type for display
  const formatPageType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Publish Settings</h3>
          {!globalPublish && (
            <div className={`flex items-center gap-1 ${status.color}`}>
              {status.icon}
              <span className="text-sm">{status.label}</span>
            </div>
          )}
        </div>

        {/* Global publish: show pages with changes */}
        {globalPublish && pagesWithChanges.length > 0 && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-2">Pages with unpublished changes:</p>
            <div className="flex flex-wrap gap-1">
              {pagesWithChanges.map(pageType => (
                <span
                  key={pageType}
                  className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full"
                >
                  {formatPageType(pageType)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Single page: show current version info */}
        {!globalPublish && draftConfig && (
          <div className="text-sm text-gray-600 mt-2">
            <div>Version: {draftConfig.version_number || 1}</div>
            {draftConfig.updated_at && (
              <div>
                Last modified: {formatDistanceToNow(new Date(draftConfig.updated_at), { addSuffix: true })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Publish Button */}
      <div className="p-4 border-b border-gray-200">
        {status.isRevertDraft && !globalPublish && (
          <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <div className="flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900">
                  Revert Draft Ready
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Configuration reverted to previous version. Publish to apply or undo to cancel.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handlePublish}
            disabled={!canPublish || isPublishing}
            className="flex-1"
            variant={canPublish ? "default" : "secondary"}
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                {canPublish
                  ? (globalPublish ? `Publish All (${pagesWithChanges.length})` : 'Publish Changes')
                  : 'No Changes to Publish'}
              </>
            )}
          </Button>

          {status.isRevertDraft && !globalPublish && (
            <Button
              onClick={handleUndoRevert}
              disabled={undoingRevert}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {undoingRevert ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Undo className="w-4 h-4 mr-1" />
                  Undo
                </>
              )}
            </Button>
          )}
        </div>

        {canPublish && !status.isRevertDraft && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            {globalPublish
              ? 'This will publish all pages with changes to production'
              : 'This will make your changes live on the storefront'}
          </p>
        )}

        {status.isRevertDraft && (
          <p className="text-xs text-orange-600 mt-2 text-center">
            Publish to apply revert or click Undo to cancel
          </p>
        )}
      </div>

      {/* Version History Toggle */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-600" />
            <span className="font-medium">Version History</span>
            {versionHistory.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {versionHistory.length}
              </span>
            )}
          </div>
          {showHistory ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Version History List */}
      {showHistory && (
        <div className="max-h-96 overflow-y-auto">
          {loadingHistory ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Loading version history...</p>
            </div>
          ) : versionHistory.length > 0 ? (
            <>
              <div className="divide-y divide-gray-100">
                {versionHistory.map((version, index) => {
                  const isLatest = index === 0;
                  const isReverted = version.status === 'reverted';
                  const isCurrent = draftConfig?.parent_version_id === version.id;

                  return (
                    <div
                      key={version.id}
                      className={`p-3 hover:bg-gray-50 ${isReverted ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              Version {version.version_number}
                            </span>
                            {isLatest && !isReverted && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                Latest
                              </span>
                            )}
                            {isReverted && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                Reverted
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Current Base
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {version.published_at && (
                              <div>
                                Published {formatDistanceToNow(new Date(version.published_at), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Revert button - show for any version that is not reverted and not current base */}
                        {!isReverted && !isCurrent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevert(version.id, version.version_number)}
                            disabled={revertingVersionId === version.id}
                            className="ml-2"
                          >
                            {revertingVersionId === version.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Revert
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Destroy Layout Button - Below versions */}
              <div className="p-4 border-t border-gray-200 flex justify-center">
                <Button
                  onClick={() => setShowDestroyModal(true)}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Destroy Layout
                </Button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No version history yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Publish your first version to start tracking changes
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview Mode Info */}
      {draftConfig?.status === 'acceptance' && (
        <div className="p-4 bg-blue-50 border-t border-blue-100">
          <div className="flex items-start gap-2">
            <Eye className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Preview Mode Active
              </p>
              <p className="text-xs text-blue-700 mt-1">
                This version is available in the acceptance environment
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Destroy Layout Modal */}
      <DestroyLayoutModal
        isOpen={showDestroyModal}
        onClose={() => setShowDestroyModal(false)}
        onConfirm={handleDestroy}
        isDestroying={isDestroying}
      />
    </div>
  );
};

export default PublishPanel;