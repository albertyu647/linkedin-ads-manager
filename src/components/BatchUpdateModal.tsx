'use client';

import { useState } from 'react';
import { TargetingEntity } from '@/types/linkedin';

interface BatchUpdateModalProps {
  campaignIds: string[];
  accountId: string;
  onClose: () => void;
  onComplete: () => void;
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
  const [selectedTargeting, setSelectedTargeting] = useState<SelectedTargeting>({
    industries: [],
    jobFunctions: [],
    titles: [],
    employers: [],
    seniorities: [],
    skills: []
  });
  
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, TargetingEntity[]>>({});
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateResults, setUpdateResults] = useState<{ success: boolean; message: string } | null>(null);

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
    setSelectedTargeting(prev => ({
      ...prev,
      [facetKey]: [...prev[facetKey as keyof SelectedTargeting], entity]
    }));
    
    // Clear search results for this facet
    setSearchResults(prev => ({ ...prev, [facetKey]: [] }));
    setSearchQueries(prev => ({ ...prev, [facetKey]: '' }));
  };

  const removeTargetingEntity = (facetKey: string, entityUrn: string) => {
    setSelectedTargeting(prev => ({
      ...prev,
      [facetKey]: prev[facetKey as keyof SelectedTargeting].filter((entity: TargetingEntity) => entity.urn !== entityUrn)
    }));
  };

  const handleSubmit = async () => {
    // Check if any targeting criteria are selected
    const hasSelections = Object.values(selectedTargeting).some(arr => arr.length > 0);
    
    if (!hasSelections) {
      setError('Please select at least one targeting criteria to exclude.');
      return;
    }

    try {
      setUpdating(true);
      setError(null);

      // Convert selected targeting to URN arrays
      const excludedTargeting: Record<string, string[]> = {};
      
      Object.entries(selectedTargeting).forEach(([key, entities]) => {
        if (entities.length > 0) {
          excludedTargeting[key] = entities.map((entity: TargetingEntity) => entity.urn);
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
          excludedTargeting
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
          message: `Successfully updated ${campaignIds.length} campaigns with new targeting exclusions.` 
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

  const getTotalSelectedCount = () => {
    return Object.values(selectedTargeting).reduce((total, entities) => total + entities.length, 0);
  };

  const handleClose = () => {
    if (updateComplete && updateResults?.success) {
      onComplete(); // Refresh dashboard only on successful update
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Batch Update Targeting Exclusions
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
            Select targeting criteria to exclude from <span className="font-semibold">{campaignIds.length}</span> selected campaigns.
            These exclusions will be added to the campaigns&apos; existing targeting settings.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {updateResults && (
          <div className={`mb-6 ${updateResults.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-md p-4`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {updateResults.success ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm ${updateResults.success ? 'text-green-800' : 'text-red-800'}`}>
                  {updateResults.message}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 max-h-96 overflow-y-auto">
          {Object.entries(TARGETING_FACETS).map(([facetKey, facetData]) => (
            <div key={facetKey} className="border rounded-lg p-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">{facetData.label}</h4>
              
              {/* Search Input */}
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder={`Search ${facetData.label.toLowerCase()}...`}
                  value={searchQueries[facetKey] || ''}
                  onChange={(e) => handleSearchChange(facetKey, e.target.value)}
                  disabled={updateComplete}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {loading && (
                  <div className="absolute right-3 top-3">
                    <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults[facetKey] && searchResults[facetKey].length > 0 && (
                <div className="mb-3 max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                  {searchResults[facetKey].map((entity) => (
                    <button
                      key={entity.urn}
                      onClick={() => addTargetingEntity(facetKey, entity)}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                    >
                      {entity.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Items */}
              <div className="flex flex-wrap gap-2">
                {selectedTargeting[facetKey as keyof SelectedTargeting].map((entity) => (
                  <span
                    key={entity.urn}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                  >
                    {entity.name}
                    <button
                      onClick={() => removeTargetingEntity(facetKey, entity.urn)}
                      className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {getTotalSelectedCount()} targeting exclusion{getTotalSelectedCount() === 1 ? '' : 's'} selected
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={updating || getTotalSelectedCount() === 0 || updateComplete}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {updating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : updateComplete ? (
                updateResults?.success ? '✓ Updated Successfully' : '✗ Update Failed'
              ) : (
                `Update ${campaignIds.length} Campaigns`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 