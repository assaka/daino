import React, { useState, useRef } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Store } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';

const StoreLogoUpload = ({
  value = '',
  onChange,
  storeId,
  maxFileSizeMB = 5,
  allowedTypes = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
  disabled = false
}) => {
  const { getSelectedStoreId } = useStoreSelection();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef();
  const dragCounter = useRef(0);

  const getToken = () => {
    return localStorage.getItem('store_owner_auth_token') ||
           localStorage.getItem('customer_auth_token') ||
           localStorage.getItem('auth_token');
  };

  const validateFile = (file) => {
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      throw new Error(`File size must be less than ${maxFileSizeMB}MB`);
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      throw new Error(`File type must be one of: ${allowedTypes.join(', ')}`);
    }
  };

  const uploadFile = async (file) => {
    const currentStoreId = storeId || getSelectedStoreId();
    if (!currentStoreId) {
      throw new Error('Store not selected');
    }

    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', 'store-logos');
    formData.append('public', 'true');

    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-store-id': currentStoreId
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || 'Upload failed');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    return result;
  };

  const saveLogoUrl = async (logoUrl) => {
    const currentStoreId = storeId || getSelectedStoreId();
    if (!currentStoreId) {
      throw new Error('Store not selected');
    }

    setSaving(true);
    try {
      await Store.updateSettings(currentStoreId, { logo_url: logoUrl });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    setError(null);
    setSuccess(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      const file = files[0];
      validateFile(file);

      setUploadProgress(30);
      const result = await uploadFile(file);
      setUploadProgress(70);

      const logoUrl = result.data?.publicUrl || result.data?.url;

      // Update local state
      onChange(logoUrl);

      // Auto-save to database
      setUploadProgress(90);
      await saveLogoUrl(logoUrl);
      setUploadProgress(100);

      setSuccess('Logo uploaded and saved');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (event) => {
    handleFileSelect(event.target.files);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragActive(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeLogo = async () => {
    setError(null);
    try {
      onChange('');
      await saveLogoUrl('');
      setSuccess('Logo removed');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Remove error:', error);
      setError(error.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Messages */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Upload Progress */}
      {(uploading || saving) && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">
              {saving ? 'Saving...' : 'Uploading...'}
            </span>
            <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Logo Preview */}
        {value && (
          <div className="relative group">
            <div className="w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img
                src={value}
                alt="Store logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={removeLogo}
              title="Remove logo"
              disabled={disabled || saving}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Upload Area */}
        <div
          className={`
            flex-1 border-2 border-dashed rounded-lg p-4 text-center transition-colors
            ${dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          onDragEnter={!disabled ? handleDragEnter : undefined}
          onDragLeave={!disabled ? handleDragLeave : undefined}
          onDragOver={!disabled ? handleDragOver : undefined}
          onDrop={!disabled ? handleDrop : undefined}
          onClick={!disabled && !uploading && !saving ? () => fileInputRef.current?.click() : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedTypes.map(type => `.${type}`).join(',')}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || uploading || saving}
          />

          {uploading || saving ? (
            <div className="flex flex-col items-center py-2">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              <p className="text-sm text-blue-700">
                {saving ? 'Saving logo...' : 'Uploading logo...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-2">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">
                {value ? 'Replace logo' : 'Upload logo'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Drag & drop or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {allowedTypes.map(t => t.toUpperCase()).join(', ')} up to {maxFileSizeMB}MB
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreLogoUpload;
