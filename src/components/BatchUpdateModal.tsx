'use client';

import { useState, useEffect } from 'react';
import { TargetingEntity } from '@/types/linkedin';

interface BatchUpdateModalProps {
  campaignIds: string[];
  accountId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface CommonTargeting {
  commonIncludes: Record<string, TargetingEntity[]>;
  commonExcludes: Record<string, TargetingEntity[]>;
}

interface SelectedTargeting {
  industries: TargetingEntity[];
  jobFunctions: TargetingEntity[];
  titles: TargetingEntity[];
  employers: TargetingEntity[];
  seniorities: TargetingEntity[];
  skills: TargetingEntity[];
}

const TARGETING_FACETS = {
  industries: { urn: 'urn:li:adTargetingFacet:industries', label: 'Industries' },
  jobFunctions: { urn: 'urn:li:adTargetingFacet:jobFunctions', label: 'Job Functions' },
  titles: { urn: 'urn:li:adTargetingFacet:titles', label: 'Job Titles' },
  employers: { urn: 'urn:li:adTargetingFacet:employers', label: 'Companies' },
  seniorities: { urn: 'urn:li:adTargetingFacet:seniorities', label: 'Seniorities' },
  skills: { urn: 'urn:li:adTargetingFacet:skills', label: 'Skills' }
};

export default function BatchUpdateModal({ campaignIds, accountId, onClose, onComplete }: BatchUpdateModalProps) {
  const [commonTargeting, setCommonTargeting] = useState<CommonTargeting | null>(null);
  const [loadingCommon, setLoadingCommon] = useState(true);
  const [activeTab, setActiveTab] = useState<'includes' | 'excludes'>('includes');
  
  // Current targeting after user edits
  const defaultTargeting: SelectedTargeting = {
    industries: [],
    jobFunctions: [],
    titles: [],
    employers: [],
    seniorities: [],
    skills: []
  };

  const [includesTargeting, setIncludesTargeting] = useState<SelectedTargeting>(defaultTargeting);
  const [excludesTargeting, setExcludesTargeting] = useState<SelectedTargeting>(defaultTargeting);
  
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, TargetingEntity[]>>({});
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateResults, setUpdateResults] = useState<{ success: boolean; message: string } | null>(null);

  // Load common targeting on component mount
  useEffect(() => {
    fetchCommonTargeting();
  }, []);

  const fetchCommonTargeting = async () => {
    try {
      setLoadingCommon(true);
      setError(null);
      
      const response = await fetch('/api/campaigns/common-targeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignIds,
          accountId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch common targeting');
      }
      
      const data = await response.json();
      console.log('[Common Targeting Response]', data);
      
      if (data.success) {
        setCommonTargeting(data.commonTargeting);
        
        // Initialize the current targeting with common targeting
        if (data.commonTargeting.commonIncludes) {
          setIncludesTargeting({ ...defaultTargeting, ...data.commonTargeting.commonIncludes });
        }
        if (data.commonTargeting.commonExcludes) {
          setExcludesTargeting({ ...defaultTargeting, ...data.commonTargeting.commonExcludes });
        }
      }
    } catch (err) {
      console.error('Error fetching common targeting:', err);
      setError(err instanceof Error ? err.message : 'Failed to load common targeting');
    } finally {
      setLoadingCommon(false);
    }
  };

  const searchTargetingEntities = async (facetKey: string, query: string) => {
    if (!query || query.length < 2) {
      setSearchResults(prev => ({ ...prev, [facetKey]: [] }));
      return;
    }

    try {
      setLoading(true);
      const facetUrn = TARGETING_FACETS[facetKey as keyof typeof TARGETING_FACETS].urn;
      const response = await fetch(
        `/api/targeting/entities?facetUrn=${encodeURIComponent(facetUrn)}&query=${encodeURIComponent(query)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search targeting entities');
      }
      
      const data = await response.json();
      setSearchResults(prev => ({ ...prev, [facetKey]: data.entities || [] }));
    } catch (err) {
      console.error('Error searching targeting entities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (facetKey: string, query: string) => {
    setSearchQueries(prev => ({ ...prev, [facetKey]: query }));
    
    // Debounce the search
    setTimeout(() => {
      searchTargetingEntities(facetKey, query);
    }, 300);
  };

  const addTargetingEntity = (facetKey: string, entity: TargetingEntity) => {
    const currentTargeting = activeTab === 'includes' ? includesTargeting : excludesTargeting;
    const setTargeting = activeTab === 'includes' ? setIncludesTargeting : setExcludesTargeting;
    
    // Check if entity already exists
    const existing = currentTargeting[facetKey as keyof SelectedTargeting].find(e => e.urn === entity.urn);
    if (existing) return;
    
    setTargeting(prev => ({
      ...prev,
      [facetKey]: [...prev[facetKey as keyof SelectedTargeting], entity]
    }));
    
    // Clear search results for this facet
    setSearchResults(prev => ({ ...prev, [facetKey]: [] }));
    setSearchQueries(prev => ({ ...prev, [facetKey]: '' }));
  };

  const removeTargetingEntity = (facetKey: string, entityUrn: string) => {
    const setTargeting = activeTab === 'includes' ? setIncludesTargeting : setExcludesTargeting;
    
    setTargeting(prev => ({
      ...prev,
      [facetKey]: prev[facetKey as keyof SelectedTargeting].filter((entity: TargetingEntity) => entity.urn !== entityUrn)
    }));
  };

  const handleSubmit = async () => {
    try {
      setUpdating(true);
      setError(null);

      // Convert targeting to URN arrays
      const includesUrns: Record<string, string[]> = {};
      const excludesUrns: Record<string, string[]> = {};
      
      Object.entries(includesTargeting).forEach(([key, entities]) => {
        if (entities.length > 0) {
          includesUrns[key] = entities.map((entity: TargetingEntity) => entity.urn);
        }
      });
      
      Object.entries(excludesTargeting).forEach(([key, entities]) => {
        if (entities.length > 0) {
          excludesUrns[key] = entities.map((entity: TargetingEntity) => entity.urn);
        }
      });

      const response = await fetch('/api/campaigns/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignIds,
          accountId,
          targetingUpdate: {
            includes: includesUrns,
            excludes: excludesUrns
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update campaigns');
      }

      if (data.success) {
        setUpdateComplete(true);
        setUpdateResults({ 
          success: true, 
          message: `Successfully updated ${campaignIds.length} campaigns with new targeting.` 
        });
      } else {
        setUpdateComplete(true);
        setUpdateResults({ 
          success: false, 
          message: data.errors?.join(', ') || 'Some campaigns failed to update' 
        });
      }
    } catch (err) {
      setUpdateComplete(true);
      setUpdateResults({ 
        success: false, 
        message: err instanceof Error ? err.message : 'Failed to update campaigns' 
      });
    } finally {
      setUpdating(false);
    }
  };

  const getTotalSelectedCount = (targeting: SelectedTargeting) => {
    return Object.values(targeting).reduce((total, entities) => total + entities.length, 0);
  };

  const handleClose = () => {
    if (updateComplete && updateResults?.success) {
      onComplete(); // Refresh dashboard only on successful update
    }
    onClose();
  };

  if (loadingCommon) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">Loading common targeting across campaigns...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Batch Edit Campaign Targeting
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Edit common targeting criteria for <span className="font-semibold">{campaignIds.length}</span> selected campaigns.
            Changes will be applied to all selected campaigns in one batch operation.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {updateComplete ? (
          <div className={`mb-6 p-4 border rounded-md ${
            updateResults?.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm ${
              updateResults?.success ? 'text-green-600' : 'text-red-600'
            }`}>
              {updateResults?.message}
            </p>
            <div className="mt-4">
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  updateResults?.success
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('includes')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'includes'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Include Targeting ({getTotalSelectedCount(includesTargeting)})
                  </button>
                  <button
                    onClick={() => setActiveTab('excludes')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'excludes'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Exclude Targeting ({getTotalSelectedCount(excludesTargeting)})
                  </button>
                </nav>
              </div>
            </div>

            {/* Targeting Criteria Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {Object.entries(TARGETING_FACETS).map(([facetKey, facet]) => {
                const currentTargeting = activeTab === 'includes' ? includesTargeting : excludesTargeting;
                const entities = currentTargeting[facetKey as keyof SelectedTargeting];
                const searchQuery = searchQueries[facetKey] || '';
                const results = searchResults[facetKey] || [];

                return (
                  <div key={facetKey} className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">{facet.label}</h4>
                    
                    {/* Current chips */}
                    {entities && entities.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-2">
                          {entities.map((entity: TargetingEntity) => (
                            <span
                              key={entity.urn}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {entity.name}
                              <button
                                type="button"
                                onClick={() => removeTargetingEntity(facetKey, entity.urn)}
                                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Search input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={`Add ${facet.label.toLowerCase()}...`}
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(facetKey, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      
                      {/* Search results dropdown */}
                      {results.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {results.map((entity) => (
                            <button
                              key={entity.urn}
                              onClick={() => addTargetingEntity(facetKey, entity)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                            >
                              {entity.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleClose}
                disabled={updating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={updating}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
              >
                {updating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Update Campaigns'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 