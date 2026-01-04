import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { ScrollArea } from "@/components/ui/scroll-area.jsx";
import {
  Clock,
  GitBranch,
  Tag,
  Download,
  RotateCcw,
  GitCompare,
  Package,
  FileCode,
  X,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Eye
} from 'lucide-react';

/**
 * VersionHistoryPanel
 * Displays version history timeline for a plugin with git-like interface
 * Features:
 * - Timeline view of all versions
 * - Filtering by type (all, snapshots, patches, published)
 * - Version tags display
 * - Compare and restore actions
 * - Stats (files changed, lines added/deleted)
 */
const VersionHistoryPanel = ({
  pluginId,
  onClose,
  onCompare,
  onCompareWithCurrent,
  onRestore,
  onViewVersion,
  className = ''
}) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, snapshots, patches, published
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [expandedVersions, setExpandedVersions] = useState(new Set());

  // Load versions
  useEffect(() => {
    loadVersions();
  }, [pluginId, filter, currentPage]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const storeId = localStorage.getItem('selectedStoreId');
      const response = await fetch(
        `/api/plugins/${pluginId}/versions?page=${currentPage}&limit=20&filter=${filter}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(storeId && storeId !== 'undefined' ? { 'x-store-id': storeId } : {})
          }
        }
      );

      if (!response.ok) throw new Error('Failed to load versions');

      const data = await response.json();
      setVersions(data.versions || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter versions by search query
  const filteredVersions = versions.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.version_number?.toLowerCase().includes(query) ||
      v.commit_message?.toLowerCase().includes(query) ||
      v.tags?.some(t => t.name?.toLowerCase().includes(query))
    );
  });

  // Toggle version selection for comparison
  const toggleVersionSelection = (versionId) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      } else if (prev.length < 2) {
        return [...prev, versionId];
      } else {
        // Replace oldest selection
        return [prev[1], versionId];
      }
    });
  };

  // Compare selected versions
  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      onCompare(selectedVersions[0], selectedVersions[1]);
    }
  };

  // Toggle version details expansion
  const toggleExpanded = (versionId) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  };

  // Get version type badge
  const getTypeBadge = (version) => {
    if (version.version_type === 'snapshot') {
      return (
        <Badge variant="default" className="bg-blue-500 text-white">
          <Package className="w-3 h-3 mr-1" />
          Snapshot
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-gray-600">
          <FileCode className="w-3 h-3 mr-1" />
          Patch
        </Badge>
      );
    }
  };

  // Get version stats
  const getStatsDisplay = (version) => {
    if (!version.files_changed && !version.lines_added && !version.lines_deleted) {
      return null;
    }

    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
        {version.files_changed > 0 && (
          <span>{version.files_changed} files</span>
        )}
        {version.lines_added > 0 && (
          <span className="text-green-600">+{version.lines_added}</span>
        )}
        {version.lines_deleted > 0 && (
          <span className="text-red-600">-{version.lines_deleted}</span>
        )}
      </div>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className={`h-full flex flex-col bg-background ${className}`}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Version History</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Info banner */}
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
          <p className="font-medium mb-1">💡 Auto-Versioning Enabled</p>
          <p>Every save creates a new version. Full snapshots are created every 10 versions for performance.</p>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search versions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'snapshots' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('snapshots')}
          >
            <Package className="w-3 h-3 mr-1" />
            Snapshots
          </Button>
          <Button
            variant={filter === 'patches' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('patches')}
          >
            <FileCode className="w-3 h-3 mr-1" />
            Patches
          </Button>
          <Button
            variant={filter === 'published' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('published')}
          >
            <Tag className="w-3 h-3 mr-1" />
            Tagged
          </Button>
        </div>

        {/* Compare action */}
        {selectedVersions.length === 1 && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
            <span className="text-sm text-green-800">
              1 version selected - compare with current or select another
            </span>
            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => onCompareWithCurrent && onCompareWithCurrent(selectedVersions[0])}>
              <GitCompare className="w-4 h-4 mr-1" />
              Compare with Current
            </Button>
          </div>
        )}
        {selectedVersions.length === 2 && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
            <span className="text-sm text-blue-800">
              2 versions selected for comparison
            </span>
            <Button size="sm" onClick={handleCompare}>
              <GitCompare className="w-4 h-4 mr-1" />
              Compare
            </Button>
          </div>
        )}
      </div>

      {/* Version Timeline */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading versions...</p>
            </div>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <GitBranch className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">No versions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? 'Try a different search query' : 'Versions will appear here as you save changes'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

              {/* Version items */}
              <div className="space-y-4">
                {filteredVersions.map((version, index) => {
                  const isExpanded = expandedVersions.has(version.id);
                  const isSelected = selectedVersions.includes(version.id);

                  return (
                    <div
                      key={version.id}
                      className={`relative pl-12 ${isSelected ? 'bg-blue-50 -ml-4 -mr-4 px-4 py-2 rounded-lg' : ''}`}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-5 w-3 h-3 rounded-full border-2 ${
                        version.is_current
                          ? 'bg-green-500 border-green-500'
                          : isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-background border-border'
                      }`} />

                      {/* Version card */}
                      <div className="bg-card border rounded-lg p-3 hover:shadow-md transition-shadow relative">
                        {/* Actions - absolute positioned on right */}
                        <div style={{ position: 'absolute', right: '8px', top: '8px' }}>
                          <button
                            onClick={() => toggleVersionSelection(version.id)}
                            className={`block p-1.5 rounded hover:bg-gray-100 mb-1 ${isSelected ? 'bg-blue-100' : ''}`}
                            title="Select for comparison"
                          >
                            <GitCompare className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onViewVersion && onViewVersion(version.id)}
                            className="block p-1.5 rounded hover:bg-gray-100 mb-1"
                            title="View version code"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!version.is_current && (
                            <button
                              onClick={() => onRestore(version.id)}
                              className="block p-1.5 rounded hover:bg-gray-100 mb-1"
                              title="Restore to this version"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            className="block p-1.5 rounded hover:bg-gray-100"
                            title="Download version"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Content */}
                        <div className="pr-10">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => toggleExpanded(version.id)}
                              className="p-0 hover:bg-transparent"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>

                            <span className="font-mono text-sm font-semibold">
                              {version.version_number}
                            </span>

                            {getTypeBadge(version)}

                            {version.is_current && (
                              <Badge variant="default" className="bg-green-500 text-white">
                                Current
                              </Badge>
                            )}

                            {version.is_published && (
                              <Badge variant="default" className="bg-purple-500 text-white">
                                <Tag className="w-3 h-3 mr-1" />
                                Published
                              </Badge>
                            )}

                            {/* Tags */}
                            {version.tags && version.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                {version.tags.map((tag, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Commit message */}
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {version.commit_message || 'No message'}
                          </p>

                          {/* Stats */}
                          {getStatsDisplay(version)}

                          {/* Metadata */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{formatDate(version.created_at)}</span>
                            {version.created_by_name && (
                              <span>by {version.created_by_name}</span>
                            )}
                            {version.snapshot_distance > 0 && (
                              <span className="text-blue-600">
                                +{version.snapshot_distance} from snapshot
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && version.changelog && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium mb-1">Changelog:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {version.changelog}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default VersionHistoryPanel;
