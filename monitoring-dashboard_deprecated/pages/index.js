// Monitoring Dashboard - Main Page
// Real-time monitoring for DainoStore e-commerce platform

import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function MonitoringDashboard() {
  const [healthData, setHealthData] = useState(null);
  const [deploymentData, setDeploymentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch health data
  const fetchHealthData = async () => {
    try {
      const healthResponse = await fetch('/api/health-check');
      const healthJson = await healthResponse.json();
      setHealthData(healthJson);

      const deploymentResponse = await fetch('/api/deployment-status');
      const deploymentJson = await deploymentResponse.json();
      setDeploymentData(deploymentJson);
      
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusEmoji = (healthy) => {
    return healthy ? '✅' : '❌';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>DainoStore Monitoring Dashboard</title>
        <meta name="description" content="Real-time monitoring for DainoStore e-commerce platform" />
      </Head>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="border-b border-gray-200 pb-5">
            <h1 className="text-3xl font-bold leading-6 text-gray-900">
              🚀 DainoStore Monitoring Dashboard
            </h1>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              Real-time monitoring of Render + Vercel + Supabase deployment stack
              {lastUpdated && (
                <span className="ml-4">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Overall Status */}
        {healthData && (
          <div className="px-4 sm:px-0 mb-8">
            <div className={`rounded-lg p-6 ${getStatusColor(healthData.overallStatus)}`}>
              <div className="flex items-center">
                <div className="text-2xl font-bold">
                  {healthData.overallStatus === 'healthy' ? '🟢' : 
                   healthData.overallStatus === 'degraded' ? '🟡' : '🔴'} 
                  System Status: {healthData.overallStatus.toUpperCase()}
                </div>
                <div className="ml-auto text-sm">
                  Check duration: {healthData.checkDuration}ms
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Platform Status Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 mb-8">
          {/* Render Backend */}
          {healthData?.platforms?.render && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-2xl">
                      {getStatusEmoji(healthData.platforms.render.healthy)}
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Render Backend
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {healthData.platforms.render.healthy ? 'Healthy' : 'Issues Detected'}
                      </dd>
                      <dd className="text-sm text-gray-500">
                        Status: {healthData.platforms.render.status} • 
                        Response: {healthData.platforms.render.responseTime}ms
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vercel Frontend */}
          {healthData?.platforms?.vercel && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-2xl">
                      {getStatusEmoji(healthData.platforms.vercel.healthy)}
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Vercel Frontend
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {healthData.platforms.vercel.healthy ? 'Healthy' : 'Issues Detected'}
                      </dd>
                      <dd className="text-sm text-gray-500">
                        Status: {healthData.platforms.vercel.status} • 
                        Response: {healthData.platforms.vercel.responseTime}ms
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Supabase Database */}
          {healthData?.platforms?.database && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-2xl">
                      {getStatusEmoji(healthData.platforms.database.healthy)}
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Supabase Database
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {healthData.platforms.database.healthy ? 'Connected' : 'Connection Issues'}
                      </dd>
                      <dd className="text-sm text-gray-500">
                        Test endpoint: {healthData.platforms.database.testEndpoint}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Mappings (The Bug Endpoint!) */}
          {healthData?.platforms?.customMappings && (
            <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-2xl">
                      {healthData.platforms.customMappings.transformationBugDetected ? '🚨' : '🛡️'}
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Custom Mappings Endpoint
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {healthData.platforms.customMappings.transformationBugDetected ? 
                          'TRANSFORMATION BUG DETECTED!' : 'Bug-Free ✅'}
                      </dd>
                      <dd className="text-sm text-gray-500">
                        {healthData.platforms.customMappings.protected ? 
                          'Protected (401) - Auth Working' : `Status: ${healthData.platforms.customMappings.status}`}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Critical Alerts */}
        {healthData?.criticalIssues && healthData.criticalIssues.length > 0 && (
          <div className="mb-8">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="text-red-400 text-xl">🚨</div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Critical Issues Detected
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {healthData.criticalIssues.map((issue, index) => (
                        <li key={index}>
                          <strong>{issue.severity}:</strong> {issue.issue}
                          {issue.description && (
                            <p className="text-xs text-red-600 mt-1">{issue.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deployment Summary */}
        {deploymentData && (
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                📊 Deployment Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Health Percentage</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {deploymentData.summary?.healthPercentage || 0}%
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Healthy Platforms</dt>
                  <dd className="mt-1 text-2xl font-semibold text-green-600">
                    {deploymentData.summary?.healthyPlatforms || 0}/4
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Critical Issues</dt>
                  <dd className="mt-1 text-2xl font-semibold text-red-600">
                    {deploymentData.summary?.criticalIssues || 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Warnings</dt>
                  <dd className="mt-1 text-2xl font-semibold text-yellow-600">
                    {deploymentData.summary?.warnings || 0}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8">
          <p>🛡️ Protecting against the custom mappings transformation bug</p>
          <p>Monitoring Dashboard deployed on Vercel • Auto-refresh every 30 seconds</p>
        </div>
      </div>
    </div>
  );
}