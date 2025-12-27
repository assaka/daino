import React from 'react';
import TeamManagement from '@/components/admin/TeamManagement';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';

export default function TeamPage() {
  const { selectedStore } = useStoreSelection();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-1">Manage your store team members and their permissions</p>
        </div>
      </div>

      <TeamManagement storeId={selectedStore?.id} storeName={selectedStore?.name} />
    </div>
  );
}