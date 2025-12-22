import React from 'react';
import AccessRequestsManagement from '@/components/admin/AccessRequestsManagement';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';

export default function AccessRequestsPage() {
  const { selectedStore } = useStoreSelection();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Access Requests</h1>
        <p className="text-gray-600 mt-1">Manage access requests for your paused store</p>
      </div>

      <AccessRequestsManagement storeId={selectedStore?.id} storeName={selectedStore?.name} />
    </div>
  );
}
