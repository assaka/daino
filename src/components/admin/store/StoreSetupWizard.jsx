import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { CheckCircle, ArrowRight, Database, Shield, Settings, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SupabaseIntegration from '@/components/admin/integrations/SupabaseIntegration';

const StoreSetupWizard = ({ storeId, storeName, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [selectedDatabaseType, setSelectedDatabaseType] = useState(null);

  const steps = [
    {
      id: 1,
      title: 'Database Selection',
      description: 'Choose your database provider',
      icon: Database
    },
    {
      id: 2,
      title: 'Database Connection',
      description: 'Connect to your selected database provider',
      icon: Shield
    },
    {
      id: 3,
      title: 'Database Migration',
      description: 'Initialize your store database with required tables',
      icon: Database
    },
    {
      id: 4,
      title: 'Store Configuration',
      description: 'Complete your store setup',
      icon: Settings
    }
  ];

  useEffect(() => {
    checkExistingConnection();
  }, [storeId]);

  const checkExistingConnection = async () => {
    if (!storeId || storeId === 'undefined') {
      console.warn('StoreSetupWizard: Invalid storeId, skipping connection check:', storeId);
      return;
    }

    try {
      // Check if database is already configured
      const dbResponse = await apiClient.get(`/store-database/status?store_id=${storeId}`);
      if (dbResponse.success && dbResponse.database) {
        const provider = dbResponse.database.provider;
        setSelectedDatabaseType(provider);
        setConnectionStatus(dbResponse.database);
        setSupabaseConnected(true);
        setCurrentStep(3); // Skip to migration step
      }
    } catch (error) {
      console.error('Failed to check existing connection:', error);
    }
  };

  // Poll for database connection status changes
  useEffect(() => {
    if (currentStep === 2 && !supabaseConnected && storeId && storeId !== 'undefined' && selectedDatabaseType) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await apiClient.get(`/store-database/status?store_id=${storeId}`);
          if (response.success && response.database && !supabaseConnected) {
            setSupabaseConnected(true);
            setConnectionStatus(response.database);
            setCurrentStep(3);
            toast.success(`${selectedDatabaseType} connected! Ready to initialize database.`);
            clearInterval(pollInterval);
          }
        } catch (error) {
          // Silently continue polling on error
        }
      }, 2000); // Poll every 2 seconds

      // Clean up interval on component unmount or when connection is established
      return () => clearInterval(pollInterval);
    }
  }, [currentStep, storeId, supabaseConnected, selectedDatabaseType]);

  const handleDatabaseMigration = async () => {
    if (!storeId || storeId === 'undefined') {
      toast.error('Invalid store ID. Please refresh and try again.');
      return;
    }
    
    try {
      setLoading(true);
      setMigrationStatus({ status: 'running', message: 'Initializing database migration...' });

      const response = await apiClient.post('/supabase/migrate', 
        { store_id: storeId }
      );

      if (response.success) {
        setMigrationStatus({ 
          status: 'success', 
          message: 'Database migration completed successfully!',
          details: response.details
        });
        toast.success('Database migration completed!');
        setCurrentStep(4);
      } else {
        setMigrationStatus({ 
          status: 'error', 
          message: response.message || 'Migration failed'
        });
        toast.error('Database migration failed');
      }
    } catch (error) {
      console.error('Database migration failed:', error);
      setMigrationStatus({ 
        status: 'error', 
        message: error.response?.data?.message || 'Migration failed'
      });
      toast.error('Database migration failed');
    } finally {
      setLoading(false);
    }
  };


  const databaseOptions = [
    {
      id: 'supabase',
      name: 'Supabase',
      description: 'PostgreSQL with built-in authentication, real-time, and storage',
      icon: Database,
      color: 'green',
      recommended: true
    },
    {
      id: 'neon',
      name: 'Neon',
      description: 'Serverless PostgreSQL with auto-scaling and branching',
      icon: Database,
      color: 'blue'
    },
    {
      id: 'planetscale',
      name: 'PlanetScale',
      description: 'MySQL-compatible serverless database platform',
      icon: Database,
      color: 'purple'
    }
  ];

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Database className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Choose Your Database</h3>
        <p className="text-gray-600">
          Select a database provider for your store. You can change this later if needed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {databaseOptions.map((option) => (
          <Card
            key={option.id}
            className={`cursor-pointer transition-all ${
              selectedDatabaseType === option.id
                ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50'
                : 'hover:border-gray-400'
            }`}
            onClick={() => setSelectedDatabaseType(option.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg bg-${option.color}-100`}>
                  <option.icon className={`w-6 h-6 text-${option.color}-600`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{option.name}</h4>
                    {option.recommended && (
                      <Badge variant="secondary" className="text-xs">Recommended</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
                {selectedDatabaseType === option.id && (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={() => setCurrentStep(2)}
        disabled={!selectedDatabaseType}
        className="w-full"
        size="lg"
      >
        <ArrowRight className="w-5 h-5 mr-2" />
        Continue with {selectedDatabaseType ? databaseOptions.find(o => o.id === selectedDatabaseType)?.name : 'Selected Database'}
      </Button>
    </div>
  );

  const renderStep2 = () => {
    const renderDatabaseConnection = () => {
      if (selectedDatabaseType === 'supabase') {
        return <SupabaseIntegration storeId={storeId} context="wizard" />;
      } else if (selectedDatabaseType === 'neon') {
        return (
          <div className="text-center py-6">
            <Button
              onClick={async () => {
                try {
                  const response = await apiClient.get(`/database-oauth/neon/authorize?store_id=${storeId}`);
                  if (response.authUrl) {
                    window.location.href = response.authUrl;
                  }
                } catch (error) {
                  toast.error('Failed to initiate Neon connection');
                }
              }}
              size="lg"
            >
              Connect to Neon
            </Button>
          </div>
        );
      } else if (selectedDatabaseType === 'planetscale') {
        return (
          <div className="text-center py-6">
            <Button
              onClick={async () => {
                try {
                  const response = await apiClient.get(`/database-oauth/planetscale/authorize?store_id=${storeId}`);
                  if (response.authUrl) {
                    window.location.href = response.authUrl;
                  }
                } catch (error) {
                  toast.error('Failed to initiate PlanetScale connection');
                }
              }}
              size="lg"
            >
              Connect to PlanetScale
            </Button>
          </div>
        );
      }
    };

    return (
      <div className="space-y-6">
        <div className="text-center">
          <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Connect to {databaseOptions.find(o => o.id === selectedDatabaseType)?.name}
          </h3>
          <p className="text-gray-600">
            Set up your store's backend infrastructure with {databaseOptions.find(o => o.id === selectedDatabaseType)?.name} for data storage.
          </p>
        </div>

        {renderDatabaseConnection()}

        {connectionStatus && (
          <Card className={connectionStatus.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            <CardContent className="pt-4">
              <div className="flex items-start space-x-2">
                {connectionStatus.connected ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${connectionStatus.connected ? 'text-green-800' : 'text-red-800'}`}>
                    {connectionStatus.message || (connectionStatus.connected ? 'Connected Successfully' : 'Connection Failed')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Database className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Database Migration</h3>
        <p className="text-gray-600">
          Initialize your store database with all required tables and configurations.
        </p>
      </div>

      {connectionStatus && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {databaseOptions.find(o => o.id === selectedDatabaseType)?.name} Connected Successfully
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Ready to initialize database
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Database Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            This will create the following tables in your Supabase database:
          </p>
          <ul className="text-sm text-gray-600 space-y-1 mb-6">
            <li>• Products (for your store catalog)</li>
            <li>• Categories (for product organization)</li>
            <li>• Orders (for customer purchases)</li>
            <li>• Customers (for user management)</li>
            <li>• Store settings and configurations</li>
          </ul>

          <Button
            onClick={handleDatabaseMigration}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Running Migration...
              </>
            ) : (
              <>
                <Database className="w-5 h-5 mr-2" />
                Initialize Database
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {migrationStatus && (
        <Card className={
          migrationStatus.status === 'success' ? 'bg-green-50 border-green-200' :
          migrationStatus.status === 'error' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }>
          <CardContent className="pt-4">
            <div className="flex items-start space-x-2">
              {migrationStatus.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : migrationStatus.status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              ) : (
                <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5 animate-spin" />
              )}
              <div>
                <p className={`text-sm font-medium ${
                  migrationStatus.status === 'success' ? 'text-green-800' :
                  migrationStatus.status === 'error' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {migrationStatus.message}
                </p>
                {migrationStatus.details && (
                  <div className="text-xs text-gray-600 mt-2">
                    <p>Tables created: {migrationStatus.details.tablesCreated}</p>
                    <p>Migration time: {migrationStatus.details.migrationTime}ms</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Setup Complete!</h3>
        <p className="text-gray-600">
          Your store is now ready with {databaseOptions.find(o => o.id === selectedDatabaseType)?.name} database.
        </p>
      </div>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-4">
          <h4 className="font-medium text-green-900 mb-2">What's been configured:</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>✓ {databaseOptions.find(o => o.id === selectedDatabaseType)?.name} database connected</li>
            <li>✓ Database tables initialized</li>
            <li>✓ Store configurations applied</li>
            <li>✓ Ready for product management</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex space-x-3">
        <Button
          onClick={onComplete}
          className="flex-1"
          size="lg"
        >
          <Settings className="w-5 h-5 mr-2" />
          Go to Store Dashboard
        </Button>
        <Button
          variant="outline"
          onClick={() => window.open(`/store/${storeId}?version=published`, '_blank')}
          size="lg"
        >
          <ExternalLink className="w-5 h-5 mr-2" />
          View Store
        </Button>
      </div>
    </div>
  );

  // Show error message if storeId is invalid
  if (!storeId || storeId === 'undefined') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Store</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-800 font-medium">Invalid Store Configuration</p>
            </div>
            <p className="text-red-700 mt-2">
              Store ID is missing or invalid. Please go back to the stores page and try creating a new store.
            </p>
            <Button 
              onClick={onSkip} 
              variant="outline" 
              className="mt-4"
            >
              Go Back to Stores
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Store</h2>
        <p className="text-gray-600">
          Configure authentication and database for <strong>{storeName}</strong>
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                currentStep > step.id ? 'bg-green-600 text-white' :
                currentStep === step.id ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {currentStep > step.id ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <p className={`text-xs mt-2 text-center ${
                currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {step.title}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${
                currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </CardContent>
      </Card>

      {/* Footer Actions */}
      {currentStep < 4 && (
        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            onClick={onSkip}
            className="text-gray-600"
          >
            Skip Setup
          </Button>
          {currentStep > 1 && currentStep !== 3 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Previous
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default StoreSetupWizard;