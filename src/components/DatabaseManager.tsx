'use client';

import { useState, useEffect } from 'react';

interface DatabaseStats {
  totalEntities: number;
  entitiesByFacet: Record<string, number>;
  oldestUpdate: string | null;
  newestUpdate: string | null;
}

interface DatabaseStatus {
  stats: DatabaseStats;
  needsRefresh: boolean;
  message: string;
}

export default function DatabaseManager() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapProgress, setBootstrapProgress] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/bootstrap-entities');
      const data = await response.json();
      setStatus(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching database status:', error);
      setLoading(false);
    }
  };

  const bootstrapDatabase = async () => {
    setIsBootstrapping(true);
    setBootstrapProgress('Starting database bootstrap...');
    
    try {
      const response = await fetch('/api/bootstrap-entities', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBootstrapProgress('Bootstrap completed successfully!');
        await fetchStatus(); // Refresh status
      } else {
        setBootstrapProgress(`Bootstrap failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error bootstrapping database:', error);
      setBootstrapProgress('Bootstrap failed due to network error');
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          LinkedIn Entities Database
        </h2>
        <button
          onClick={fetchStatus}
          className="text-sm text-blue-600 hover:text-blue-800"
          disabled={isBootstrapping}
        >
          Refresh Status
        </button>
      </div>

      {status && (
        <div className="space-y-4">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-800">Total Entities</div>
              <div className="text-2xl font-bold text-blue-900">
                {status.stats?.totalEntities?.toLocaleString() || '0'}
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-green-800">Facets Cached</div>
              <div className="text-2xl font-bold text-green-900">
                {Object.keys(status.stats?.entitiesByFacet || {}).length}
              </div>
            </div>

            <div className={`p-4 rounded-lg ${status.needsRefresh ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <div className={`text-sm font-medium ${status.needsRefresh ? 'text-yellow-800' : 'text-green-800'}`}>
                Status
              </div>
              <div className={`text-lg font-bold ${status.needsRefresh ? 'text-yellow-900' : 'text-green-900'}`}>
                {status.needsRefresh ? 'Needs Refresh' : 'Up to Date'}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700">{status.message || 'Loading database status...'}</p>
          </div>

          {/* Bootstrap Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Database Bootstrap</h3>
                <p className="text-sm text-gray-500">
                  Download and cache all LinkedIn targeting entities to avoid API rate limits
                </p>
              </div>
              
              <button
                onClick={bootstrapDatabase}
                disabled={isBootstrapping}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isBootstrapping
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : status.needsRefresh
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isBootstrapping ? 'Bootstrapping...' : status.needsRefresh ? 'Refresh Database' : 'Rebuild Database'}
              </button>
            </div>

            {isBootstrapping && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <svg className="animate-spin h-4 w-4 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-blue-800">{bootstrapProgress}</span>
                </div>
              </div>
            )}
          </div>

          {/* Facets Breakdown */}
          {Object.keys(status.stats?.entitiesByFacet || {}).length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Entities by Facet</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(status.stats?.entitiesByFacet || {}).map(([facet, count]) => (
                  <div key={facet} className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 truncate" title={facet}>
                      {facet.replace('urn:li:adTargetingFacet:', '')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {count.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last Updated */}
          {status.stats?.newestUpdate && (
            <div className="text-xs text-gray-500 border-t pt-2">
              Last updated: {new Date(status.stats.newestUpdate).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {!status && !loading && (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">Failed to load database status</div>
          <button
            onClick={fetchStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
} 