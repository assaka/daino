import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Image, 
  File, 
  FileText, 
  Film, 
  Music, 
  Archive, 
  X,
  Check,
  Upload,
  Grid,
  List,
  AlertCircle,
  Settings,
  ExternalLink
} from 'lucide-react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { PageLoader } from '@/components/ui/page-loader';

const MediaBrowser = ({ isOpen, onClose, onInsert, onSelectFile, allowMultiple = false, uploadFolder = 'library' }) => {
  const { selectedStore } = useStoreSelection();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [uploading, setUploading] = useState(false);
  const [showUploadOnOpen, setShowUploadOnOpen] = useState(false);
  const [storageConnected, setStorageConnected] = useState(true);
  const [storageError, setStorageError] = useState(null);

  // File type icons
  const getFileIcon = (mimeType) => {
    if (!mimeType) return <File className="w-8 h-8" />;
    
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <Film className="w-8 h-8 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8 text-pink-500" />;
    if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) 
      return <Archive className="w-8 h-8 text-yellow-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Load files from storage
  const loadFiles = async () => {
    console.log('🔍 MediaBrowser: loadFiles called', {
      uploadFolder,
      selectedStoreId: selectedStore?.id
    });

    try {
      setLoading(true);

      if (!selectedStore?.id) {
        console.warn('⚠️ MediaBrowser: No store selected');
        toast.error('No store selected');
        setFiles([]);
        setLoading(false);
        return;
      }

      // Use media-assets endpoint for normalized data with media_asset_id
      const requestUrl = '/storage/media-assets';
      const params = { limit: 100 };

      // Add folder filter if specified
      if (uploadFolder === 'category') {
        params.folder = 'category';
      } else if (uploadFolder === 'product') {
        params.folder = 'product';
      }

      console.log('📡 MediaBrowser: Fetching media assets...', { requestUrl, params });

      const response = await apiClient.get(requestUrl, { params });

      console.log('✅ MediaBrowser: Response received', {
        success: response?.success,
        hasFiles: !!response?.files,
        filesCount: response?.files?.length
      });

      if (response.success && response.files) {
        // Files already have consistent format with media_asset_id
        const transformedFiles = response.files.map(file => ({
          id: file.id,
          media_asset_id: file.media_asset_id || file.id,
          name: file.name,
          url: file.url,
          path: file.path,
          size: file.size || 0,
          mimeType: file.mimeType || 'application/octet-stream',
          folder: file.folder,
          uploadedAt: file.createdAt || new Date().toISOString()
        }));

        console.log(`📁 MediaBrowser: Loaded ${transformedFiles.length} files`);
        setFiles(transformedFiles);
      } else {
        console.warn('⚠️ MediaBrowser: No files in response');
        setFiles([]);
      }
    } catch (error) {
      console.error('❌ MediaBrowser: Error loading files:', error);

      // Graceful fallback for errors
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        setFiles([]);
      } else {
        toast.error(`Failed to load media files: ${error.message || 'Unknown error'}`);
        setFiles([]);
      }
    } finally {
      console.log('🏁 MediaBrowser: loadFiles complete');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedStore?.id) {
      loadFiles();
      checkStorageConnection();
      
      // Check if we should show upload interface by default
      const shouldShowUpload = sessionStorage.getItem('mediaBrowserShowUpload');
      if (shouldShowUpload === 'true') {
        setShowUploadOnOpen(true);
        // Auto-click the upload button after a brief delay to open file picker
        setTimeout(() => {
          const uploadInput = document.getElementById('media-upload');
          if (uploadInput) {
            uploadInput.click();
          }
        }, 100);
        // Clear the flag
        sessionStorage.removeItem('mediaBrowserShowUpload');
      }
    }
  }, [isOpen, selectedStore?.id]);

  // Check storage connection status (using same approach as FileLibrary)
  const checkStorageConnection = async () => {
    console.log('🔍 MediaBrowser: checkStorageConnection called');
    try {
      if (!selectedStore?.id) {
        console.warn('⚠️ MediaBrowser: No store ID for storage check');
        return;
      }

      console.log('📡 MediaBrowser: Checking Supabase storage stats...');
      // Use same endpoint as FileLibrary for consistent behavior
      const response = await apiClient.get('/supabase/storage/stats');

      console.log('✅ MediaBrowser: Storage stats response:', response);

      if (response.success) {
        console.log('✅ Storage connected: Supabase');
        setStorageConnected(true);
        setStorageError(null);
      } else {
        console.warn('⚠️ Storage connection failed');
        setStorageConnected(false);
        setStorageError('Storage connection failed');
      }
    } catch (error) {
      console.error('❌ MediaBrowser: Error checking storage connection:', error);
      setStorageConnected(false);
      setStorageError('Unable to check storage connection status');
    }
  };

  // Handle file upload (using same approach as FileLibrary)
  const handleFileUpload = async (filesArray) => {
    if (!storageConnected || storageError) {
      toast.error("Media storage is not connected. Please configure storage in Media Storage settings first.", {
        action: {
          label: "Configure Storage",
          onClick: () => window.open('/admin/media-storage', '_blank')
        }
      });
      return;
    }

    if (filesArray.length === 0) return;

    setUploading(true);

    try {
      for (const file of filesArray) {
        console.log('📤 MediaBrowser: Uploading file:', {
          name: file.name,
          size: file.size,
          type: file.type
        });

        // Use same upload endpoint as FileLibrary
        const additionalData = {
          folder: uploadFolder || 'library',
          public: 'true',
          type: 'general'
        };

        const response = await apiClient.uploadFile('/supabase/storage/upload', file, additionalData);

        if (response.success) {
          toast.success(`${file.name} uploaded successfully`);
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      // Reload files to show new uploads
      await loadFiles();
    } catch (error) {
      console.error('❌ MediaBrowser: Upload error:', error);
      toast.error(`Failed to upload files: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Toggle file selection
  const toggleFileSelection = (file) => {
    if (allowMultiple) {
      setSelectedFiles(prev => {
        const isSelected = prev.some(f => f.id === file.id);
        if (isSelected) {
          return prev.filter(f => f.id !== file.id);
        } else {
          return [...prev, file];
        }
      });
    } else {
      setSelectedFiles([file]);
    }
  };

  // Insert selected files
  const handleInsert = () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    // If onSelectFile callback is provided, use structured data (for category images, etc.)
    if (onSelectFile) {
      // For single file selection, pass the file object directly
      const file = selectedFiles[0];
      onSelectFile({
        media_asset_id: file.media_asset_id,
        url: file.url,
        name: file.name,
        path: file.path,
        mimeType: file.mimeType
      });
      setSelectedFiles([]);
      onClose();
      return;
    }

    // Otherwise, generate HTML for CMS insertion
    const htmlContent = selectedFiles.map(file => {
      if (file.mimeType.startsWith('image/')) {
        return `<img src="${file.url}" alt="${file.name}" class="cms-image" />`;
      } else {
        const icon = file.mimeType.includes('pdf') ? '📄' : '📎';
        return `<a href="${file.url}" target="_blank" rel="noopener noreferrer" class="cms-file-link">${icon} ${file.name}</a>`;
      }
    }).join('\n');

    onInsert(htmlContent);
    setSelectedFiles([]);
    onClose();
  };

  // Filter files based on search
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.mimeType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSelected = (file) => selectedFiles.some(f => f.id === file.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {uploadFolder === 'category' ? 'Category Images' : 'Media Library'}
          </DialogTitle>
        </DialogHeader>

        {/* Storage Connection Warning */}
        {(!storageConnected || storageError) && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">
                  Media Storage Not Connected
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  {storageError || "Media storage is not properly configured. Files cannot be uploaded until storage is connected."}
                </p>
                <a 
                  href="/admin/media-storage" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Configure Storage
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 py-4 border-b">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="file"
              multiple
              onChange={(e) => handleFileUpload(Array.from(e.target.files))}
              className="hidden"
              id="media-upload"
              disabled={uploading || !storageConnected || storageError}
            />
            <label htmlFor="media-upload">
              <Button variant="outline" asChild disabled={uploading || !storageConnected || storageError}>
                <span className="flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </span>
              </Button>
            </label>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-gray-100' : ''}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-gray-100' : ''}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* File Display */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <PageLoader size="lg" fullScreen={false} className="h-full" />
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <File className="w-16 h-16 mb-4" />
              <p>No files found</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => toggleFileSelection(file)}
                  className={`
                    relative border rounded-lg overflow-hidden cursor-pointer transition-all
                    ${isSelected(file) 
                      ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  {/* Selection indicator */}
                  {isSelected(file) && (
                    <div className="absolute top-2 right-2 z-10 bg-blue-500 text-white rounded-full p-1">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  
                  {/* Preview */}
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {file.mimeType?.startsWith('image/') ? (
                      <img 
                        src={file.url} 
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      getFileIcon(file.mimeType)
                    )}
                  </div>
                  
                  {/* File Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => toggleFileSelection(file)}
                  className={`
                    flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all
                    ${isSelected(file)
                      ? 'bg-blue-50 border border-blue-300'
                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }
                  `}
                >
                  {/* Checkbox/Icon */}
                  <div className="flex-shrink-0">
                    {isSelected(file) ? (
                      <div className="bg-blue-500 text-white rounded p-1">
                        <Check className="w-5 h-5" />
                      </div>
                    ) : file.mimeType?.startsWith('image/') ? (
                      <img 
                        src={file.url} 
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center">
                        {React.cloneElement(getFileIcon(file.mimeType), { className: "w-6 h-6" })}
                      </div>
                    )}
                  </div>
                  
                  {/* File details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {file.mimeType} • {formatFileSize(file.size)}
                    </p>
                  </div>
                  
                  {/* Upload date */}
                  <div className="text-xs text-gray-500">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-gray-600">
            {selectedFiles.length > 0 && (
              <span>{selectedFiles.length} file(s) selected</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleInsert}
              disabled={selectedFiles.length === 0}
            >
              Insert {selectedFiles.length > 0 && `(${selectedFiles.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaBrowser;