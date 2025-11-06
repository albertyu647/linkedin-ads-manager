'use client';

import { useState, useEffect, useMemo } from 'react';
import { TargetingEntity } from '@/types/linkedin';
import { entityCache } from '@/lib/entity-cache';

interface BatchUpdateModalProps {
  campaignIds: string[];
  accountId: string;
  onClose: () => void;
  onComplete: () => void;
}

interface CommonTargeting {
  commonIncludes: Record<string, TargetingEntity[]>;
  commonExcludes: Record<string, TargetingEntity[]>;
  perCampaignIncludes: Record<string, string[]>; // URN -> campaign IDs that have it
  perCampaignExcludes: Record<string, string[]>; // URN -> campaign IDs that have it
  allCampaignIds: string[];
}

interface SelectedTargeting {
  industries: TargetingEntity[];
  jobFunctions: TargetingEntity[];
  titles: TargetingEntity[];
  employers: TargetingEntity[];
  seniorities: TargetingEntity[];
  skills: TargetingEntity[];
  memberBehaviors: TargetingEntity[];
  staffCountRanges: TargetingEntity[];
  locations: TargetingEntity[];
  revenue: TargetingEntity[];
}

interface UpdateResult {
  success: boolean;
  message: string;
}

interface CampaignProgress {
  id: string;
  name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

const TARGETING_FACETS = {
  industries: { urn: 'urn:li:adTargetingFacet:industries', label: 'Industries' },
  jobFunctions: { urn: 'urn:li:adTargetingFacet:jobFunctions', label: 'Job Functions' },
  titles: { urn: 'urn:li:adTargetingFacet:titles', label: 'Job Titles' },
  employers: { urn: 'urn:li:adTargetingFacet:employers', label: 'Companies' },
  seniorities: { urn: 'urn:li:adTargetingFacet:seniorities', label: 'Seniorities' },
  skills: { urn: 'urn:li:adTargetingFacet:skills', label: 'Skills' },
  memberBehaviors: { urn: 'urn:li:adTargetingFacet:memberBehaviors', label: 'Member Behaviors' },
  staffCountRanges: { urn: 'urn:li:adTargetingFacet:staffCountRanges', label: 'Company Size' },
  locations: { urn: 'urn:li:adTargetingFacet:profileLocations', label: 'Locations' },
  revenue: { urn: 'urn:li:adTargetingFacet:revenue', label: 'Revenue' }
};

/**
 * Resolve entity names using cache first, then API if needed
 */
async function resolveEntityNames(entities: TargetingEntity[]): Promise<TargetingEntity[]> {
  if (entities.length === 0) return entities;
  
  // Check which entities need resolution (have placeholder names)
  const needsResolution = entities.filter(entity => 
    entity.name.includes('Job Title ') || 
    entity.name.includes('Company ') ||
    entity.name.includes('Industry ') ||
    entity.name.includes('Job Function ') ||
    entity.name.includes('Seniority ') ||
    entity.name.includes('Skill ') ||
    entity.name.includes('Entity ')
  );
  
  if (needsResolution.length === 0) return entities;
  
  console.log(`[BatchUpdateModal] Resolving ${needsResolution.length} entity names`);
  
  // Check cache for all entities that need resolution
  const cachedEntities = entityCache.getMany(needsResolution.map(e => e.urn));
  const uncachedUrns = needsResolution
    .filter(e => !cachedEntities[e.urn])
    .map(e => e.urn);
  
  console.log(`[BatchUpdateModal] Found ${Object.keys(cachedEntities).length} in cache, ${uncachedUrns.length} need API resolution`);
  
  // Resolve uncached entities via API
  let apiResolvedEntities: Record<string, TargetingEntity> = {};
  if (uncachedUrns.length > 0) {
    try {
      const response = await fetch('/api/targeting/resolve-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urns: uncachedUrns }),
      });
      
      if (response.ok) {
        const data = await response.json();
        apiResolvedEntities = data.entities || {};
        
        // Cache the resolved entities
        if (Object.keys(apiResolvedEntities).length > 0) {
          entityCache.setMany(apiResolvedEntities);
          console.log(`[BatchUpdateModal] Cached ${Object.keys(apiResolvedEntities).length} newly resolved entities`);
        }
      } else {
        console.error('[BatchUpdateModal] Failed to resolve entity names:', response.statusText);
      }
    } catch (error) {
      console.error('[BatchUpdateModal] Error resolving entity names:', error);
    }
  }
  
  // Merge cached and API resolved entities
  const resolvedEntities = { ...cachedEntities, ...apiResolvedEntities };
  
  // Return entities with resolved names
  return entities.map(entity => {
    const resolved = resolvedEntities[entity.urn];
    return resolved || entity; // Use resolved if available, otherwise keep original
  });
}

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
    skills: [],
    memberBehaviors: [],
    staffCountRanges: [],
    locations: [],
    revenue: []
  };

  const [includesTargeting, setIncludesTargeting] = useState<SelectedTargeting>(defaultTargeting);
  const [excludesTargeting, setExcludesTargeting] = useState<SelectedTargeting>(defaultTargeting);
  
  // Track the original common targeting to detect additions/removals
  const [originalIncludesTargeting, setOriginalIncludesTargeting] = useState<SelectedTargeting>(defaultTargeting);
  const [originalExcludesTargeting, setOriginalExcludesTargeting] = useState<SelectedTargeting>(defaultTargeting);
  
  // Track pending removals (entities that exist in some campaigns and user wants to remove)
  const [pendingIncludesRemovals, setPendingIncludesRemovals] = useState<SelectedTargeting>(defaultTargeting);
  const [pendingExcludesRemovals, setPendingExcludesRemovals] = useState<SelectedTargeting>(defaultTargeting);
  
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [rawSearchResults, setRawSearchResults] = useState<Record<string, TargetingEntity[]>>({});
  const [loading, setLoading] = useState(false);

  // Computed search results - shows ALL entities with smart action buttons
  const searchResults = useMemo(() => {
    const filtered: Record<string, TargetingEntity[]> = {};
    
    Object.entries(rawSearchResults).forEach(([facetKey, entities]) => {
      const currentTargeting = activeTab === 'includes' ? includesTargeting : excludesTargeting;
      
      // Get URNs that are currently selected in UI (chips) for current tab only
      const currentlySelectedUrns = currentTargeting[facetKey as keyof SelectedTargeting].map((entity: TargetingEntity) => entity.urn);
      
      // Show all entities except those fully added to current tab
      filtered[facetKey] = entities.filter((entity: TargetingEntity) => {
        // If we have per-campaign data, use smart filtering
        if (commonTargeting) {
          const perCampaignData = activeTab === 'includes' 
            ? commonTargeting.perCampaignIncludes 
            : commonTargeting.perCampaignExcludes;
          
          const campaignsWithEntity = perCampaignData[entity.urn] || [];
          const inAllCampaigns = campaignsWithEntity.length === campaignIds.length;
          
          // Only filter out if in all campaigns AND in UI selection (nothing to do)
          if (inAllCampaigns && currentlySelectedUrns.includes(entity.urn)) {
            return false;
          }
          
          // Show everything else - action buttons will handle add/remove logic
          return true;
        }
        
        // Fallback: filter out only if in current UI selection
        return !currentlySelectedUrns.includes(entity.urn);
      });
    });
    
    return filtered;
  }, [rawSearchResults, includesTargeting, excludesTargeting, activeTab, commonTargeting, campaignIds]);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateComplete, setUpdateComplete] = useState(false);
  const [updateResults, setUpdateResults] = useState<UpdateResult | null>(null);
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  // Load common targeting on component mount
  useEffect(() => {
    fetchCommonTargeting();
  }, []);

  // Initialize progress tracking when campaigns are selected
  useEffect(() => {
    if (campaignIds.length > 0) {
      setCampaignProgress(
        campaignIds.map(id => ({
          id,
          name: `Campaign ${id}`,
          status: 'pending'
        }))
      );
    }
  }, [campaignIds]);

  // Refresh search results when switching between Include/Exclude tabs
  useEffect(() => {
    // Refresh search results for all facets that have active queries
    Object.entries(searchQueries).forEach(([facetKey, query]) => {
      if (query && query.length >= 2) {
        searchTargetingEntities(facetKey, query);
      }
    });
  }, [activeTab]);

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
        
        // Resolve entity names for all includes and excludes
        let resolvedIncludes = { ...defaultTargeting };
        let resolvedExcludes = { ...defaultTargeting };
        
        if (data.commonTargeting.commonIncludes) {
          // Resolve names for each facet
          for (const [facetKey, entities] of Object.entries(data.commonTargeting.commonIncludes)) {
            if (Array.isArray(entities) && entities.length > 0) {
              resolvedIncludes[facetKey as keyof SelectedTargeting] = await resolveEntityNames(entities as TargetingEntity[]);
            }
          }
        }
        
        if (data.commonTargeting.commonExcludes) {
          // Resolve names for each facet
          for (const [facetKey, entities] of Object.entries(data.commonTargeting.commonExcludes)) {
            if (Array.isArray(entities) && entities.length > 0) {
              resolvedExcludes[facetKey as keyof SelectedTargeting] = await resolveEntityNames(entities as TargetingEntity[]);
            }
          }
        }
        
        // Initialize the current targeting with resolved entities
        setIncludesTargeting(resolvedIncludes);
        setOriginalIncludesTargeting(resolvedIncludes); // Save original state
        setExcludesTargeting(resolvedExcludes);
        setOriginalExcludesTargeting(resolvedExcludes); // Save original state
        
        console.log('[BatchUpdateModal] Entity names resolved');
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
      setRawSearchResults(prev => ({ ...prev, [facetKey]: [] }));
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
      const allResults = data.entities || [];
      
      // Store raw results - filtering happens in the computed searchResults
      setRawSearchResults(prev => ({ ...prev, [facetKey]: allResults }));
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
    const oppositeTargeting = activeTab === 'includes' ? excludesTargeting : includesTargeting;
    const setOppositeTargeting = activeTab === 'includes' ? setExcludesTargeting : setIncludesTargeting;
    
    // Check if entity already exists in current tab
    const existing = currentTargeting[facetKey as keyof SelectedTargeting].find(e => e.urn === entity.urn);
    if (existing) return;
    
    // IMPORTANT: If entity exists in opposite tab, remove it first to avoid conflicts
    const existingInOpposite = oppositeTargeting[facetKey as keyof SelectedTargeting].find(e => e.urn === entity.urn);
    if (existingInOpposite) {
      setOppositeTargeting(prev => ({
        ...prev,
        [facetKey]: prev[facetKey as keyof SelectedTargeting].filter((e: TargetingEntity) => e.urn !== entity.urn)
      }));
    }
    
    // Add to current tab
    setTargeting(prev => ({
      ...prev,
      [facetKey]: [...prev[facetKey as keyof SelectedTargeting], entity]
    }));
  };

  const addAllSearchResults = (facetKey: string) => {
    const currentResults = searchResults[facetKey] || [];
    const currentTargeting = activeTab === 'includes' ? includesTargeting : excludesTargeting;
    const setTargeting = activeTab === 'includes' ? setIncludesTargeting : setExcludesTargeting;
    
    if (currentResults.length === 0) return;
    
    // Filter out entities that are already selected
    const currentlySelectedUrns = new Set(
      currentTargeting[facetKey as keyof SelectedTargeting].map((entity: TargetingEntity) => entity.urn)
    );
    
    const newEntities = currentResults.filter((entity: TargetingEntity) => !currentlySelectedUrns.has(entity.urn));
    
    if (newEntities.length === 0) return;
    
    setTargeting(prev => ({
      ...prev,
      [facetKey]: [...prev[facetKey as keyof SelectedTargeting], ...newEntities]
    }));
    
    // No need to manipulate search results - computed searchResults will auto-update
  };

  const removeTargetingEntity = (facetKey: string, entityUrn: string, entity?: TargetingEntity) => {
    const currentTargeting = activeTab === 'includes' ? includesTargeting : excludesTargeting;
    const setTargeting = activeTab === 'includes' ? setIncludesTargeting : setExcludesTargeting;
    const setPendingRemovals = activeTab === 'includes' ? setPendingIncludesRemovals : setPendingExcludesRemovals;
    
    // Check if this entity is in the common chips (currently selected)
    const existingInCurrent = currentTargeting[facetKey as keyof SelectedTargeting].find(e => e.urn === entityUrn);
    
    if (existingInCurrent) {
      // Remove from current targeting (existing behavior for common chips)
      setTargeting(prev => ({
        ...prev,
        [facetKey]: prev[facetKey as keyof SelectedTargeting].filter((e: TargetingEntity) => e.urn !== entityUrn)
      }));
    } else if (entity) {
      // Add to pending removals for visual feedback
      setPendingRemovals(prev => {
        const existing = prev[facetKey as keyof SelectedTargeting].find(e => e.urn === entityUrn);
        if (existing) return prev; // Already pending removal
        
        return {
          ...prev,
          [facetKey]: [...prev[facetKey as keyof SelectedTargeting], entity]
        };
      });
    }
  };

  const cancelRemoval = (facetKey: string, entityUrn: string) => {
    const setPendingRemovals = activeTab === 'includes' ? setPendingIncludesRemovals : setPendingExcludesRemovals;
    
    setPendingRemovals(prev => ({
      ...prev,
      [facetKey]: prev[facetKey as keyof SelectedTargeting].filter((e: TargetingEntity) => e.urn !== entityUrn)
    }));
  };

  // Get campaign status for a specific entity
  const getEntityCampaignStatus = (entityUrn: string): { 
    inCurrentTab: string[];
    inOppositeTab: string[];
    total: number;
  } => {
    if (!commonTargeting) {
      return { inCurrentTab: [], inOppositeTab: [], total: campaignIds.length };
    }

    const perCampaignData = activeTab === 'includes' 
      ? commonTargeting.perCampaignIncludes 
      : commonTargeting.perCampaignExcludes;
    
    const oppositePerCampaignData = activeTab === 'includes'
      ? commonTargeting.perCampaignExcludes
      : commonTargeting.perCampaignIncludes;

    const inCurrentTab = perCampaignData[entityUrn] || [];
    const inOppositeTab = oppositePerCampaignData[entityUrn] || [];

    return {
      inCurrentTab,
      inOppositeTab,
      total: campaignIds.length
    };
  };

  const updateCampaignStatus = (campaignId: string, status: CampaignProgress['status'], error?: string) => {
    setCampaignProgress(prev => 
      prev.map(campaign => 
        campaign.id === campaignId 
          ? { ...campaign, status, error }
          : campaign
      )
    );
  };

  const handleSubmit = async () => {
    try {
      setUpdating(true);
      setShowProgress(true);
      setError(null);

      // Calculate additions and removals from original state
      const includesChanges: { add: Record<string, string[]>; remove: Record<string, string[]> } = { add: {}, remove: {} };
      const excludesChanges: { add: Record<string, string[]>; remove: Record<string, string[]> } = { add: {}, remove: {} };
      
      // Process includes changes
      Object.keys(TARGETING_FACETS).forEach((facetKey) => {
        const currentUrns = new Set(includesTargeting[facetKey as keyof SelectedTargeting].map((e: TargetingEntity) => e.urn));
        const originalUrns = new Set(originalIncludesTargeting[facetKey as keyof SelectedTargeting].map((e: TargetingEntity) => e.urn));
        const pendingRemovalUrns = new Set(pendingIncludesRemovals[facetKey as keyof SelectedTargeting].map((e: TargetingEntity) => e.urn));
        
        // Additions: in current but not in original
        const additions = [...currentUrns].filter(urn => !originalUrns.has(urn));
        if (additions.length > 0) {
          includesChanges.add[facetKey] = additions;
        }
        
        // Removals: (in original but not in current) OR in pending removals
        const removalsFromOriginal = [...originalUrns].filter(urn => !currentUrns.has(urn));
        const removalsFromPending = [...pendingRemovalUrns];
        const allRemovals = [...new Set([...removalsFromOriginal, ...removalsFromPending])];
        
        if (allRemovals.length > 0) {
          includesChanges.remove[facetKey] = allRemovals;
        }
      });
      
      // Process excludes changes
      Object.keys(TARGETING_FACETS).forEach((facetKey) => {
        const currentUrns = new Set(excludesTargeting[facetKey as keyof SelectedTargeting].map((e: TargetingEntity) => e.urn));
        const originalUrns = new Set(originalExcludesTargeting[facetKey as keyof SelectedTargeting].map((e: TargetingEntity) => e.urn));
        const pendingRemovalUrns = new Set(pendingExcludesRemovals[facetKey as keyof SelectedTargeting].map((e: TargetingEntity) => e.urn));
        
        // Additions: in current but not in original
        const additions = [...currentUrns].filter(urn => !originalUrns.has(urn));
        if (additions.length > 0) {
          excludesChanges.add[facetKey] = additions;
        }
        
        // Removals: (in original but not in current) OR in pending removals
        const removalsFromOriginal = [...originalUrns].filter(urn => !currentUrns.has(urn));
        const removalsFromPending = [...pendingRemovalUrns];
        const allRemovals = [...new Set([...removalsFromOriginal, ...removalsFromPending])];
        
        if (allRemovals.length > 0) {
          excludesChanges.remove[facetKey] = allRemovals;
        }
      });
      
      console.log('[Batch Update] Changes to apply:', { includesChanges, excludesChanges });

      // Process campaigns in parallel with progress tracking
      const results: { 
        successful: string[], 
        failed: Array<{ campaignId: string; error: string }> 
      } = { successful: [], failed: [] };

      // Set all campaigns to processing status
      campaignIds.forEach(campaignId => {
        updateCampaignStatus(campaignId, 'processing');
      });

      // Create promises for all campaigns
      const campaignPromises = campaignIds.map(async (campaignId) => {
        try {
          const response = await fetch('/api/campaigns/batch-update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignIds: [campaignId], // Process one at a time but in parallel
              accountId,
              targetingChanges: {
                includes: includesChanges,
                excludes: excludesChanges
              }
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to update campaign');
          }

          if (data.success) {
            updateCampaignStatus(campaignId, 'completed');
            return { campaignId, status: 'success' };
          } else {
            updateCampaignStatus(campaignId, 'failed', data.message || 'Update failed');
            return { campaignId, status: 'failed', error: data.message || 'Update failed' };
          }
        } catch (error: any) {
          updateCampaignStatus(campaignId, 'failed', error.message);
          return { campaignId, status: 'failed', error: error.message };
        }
      });

      // Wait for all campaigns to complete
      const campaignResults = await Promise.allSettled(campaignPromises);
      
      // Process results
      campaignResults.forEach((result, index) => {
        const campaignId = campaignIds[index];
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.status === 'success') {
            results.successful.push(campaignId);
          } else if (result.value.status === 'failed') {
            results.failed.push({ campaignId, error: result.value.error || 'Unknown error' });
          }
        } else {
          // Handle promise rejection
          results.failed.push({ campaignId, error: 'Request failed' });
          updateCampaignStatus(campaignId, 'failed', 'Request failed');
        }
      });

      setUpdateComplete(true);
      if (results.failed.length > 0) {
        setUpdateResults({ 
          success: false, 
          message: `Updated ${results.successful.length} campaigns successfully. ${results.failed.length} failed.` 
        });
      } else {
        setUpdateResults({ 
          success: true, 
          message: `Successfully updated ${results.successful.length} campaigns with new targeting.` 
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

  const resetModal = () => {
    setShowProgress(false);
    setUpdateComplete(false);
    setUpdateResults(null);
    setError(null);
    setCampaignProgress(prev => prev.map(campaign => ({ ...campaign, status: 'pending', error: undefined })));
  };

  const getStatusIcon = (status: CampaignProgress['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>;
      case 'processing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>;
      case 'completed':
        return (
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'failed':
        return (
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return null;
    }
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

        {showProgress && !updateComplete ? (
          <div className="mb-6">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Updating Campaign Targeting
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {campaignProgress.map((campaign) => (
                  <div key={campaign.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                    {getStatusIcon(campaign.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {campaign.name}
                      </p>
                      {campaign.status === 'failed' && campaign.error && (
                        <p className="text-xs text-red-500 truncate">{campaign.error}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {campaign.status === 'pending' && 'Waiting...'}
                      {campaign.status === 'processing' && 'Updating...'}
                      {campaign.status === 'completed' && 'Done'}
                      {campaign.status === 'failed' && 'Failed'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              {!updating && (
                <>
                  <button
                    type="button"
                    onClick={resetModal}
                    className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        ) : updateComplete ? (
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
            <div className="mt-4 flex space-x-3">
              {!updateResults?.success && (
                <button
                  onClick={resetModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Try Again
                </button>
              )}
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

                const currentCount = entities.length;
                const isNearLimit = currentCount >= 80;
                const isAtLimit = currentCount >= 100;
                
                return (
                  <div key={facetKey} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">{facet.label}</h4>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        isAtLimit ? 'bg-red-100 text-red-700' : 
                        isNearLimit ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {currentCount}/100
                      </span>
                    </div>
                    
                    {/* Current chips and pending removals */}
                    {(() => {
                      const pendingRemovals = activeTab === 'includes' ? pendingIncludesRemovals : pendingExcludesRemovals;
                      const removalEntities = pendingRemovals[facetKey as keyof SelectedTargeting];
                      const hasChips = (entities && entities.length > 0) || (removalEntities && removalEntities.length > 0);
                      
                      return hasChips && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-2">
                            {/* Common chips (in all campaigns) */}
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
                            
                            {/* Pending removal chips (will be removed from some campaigns) */}
                            {removalEntities && removalEntities.map((entity: TargetingEntity) => {
                              const status = getEntityCampaignStatus(entity.urn);
                              return (
                                <span
                                  key={entity.urn}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300"
                                  title={`Will remove from ${status.inCurrentTab.length} campaign${status.inCurrentTab.length !== 1 ? 's' : ''}`}
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  {entity.name}
                                  <button
                                    type="button"
                                    onClick={() => cancelRemoval(facetKey, entity.urn)}
                                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-400 hover:bg-red-200 hover:text-red-600"
                                    title="Cancel removal"
                                  >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    
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
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {/* Select All button */}
                          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2">
                            {(() => {
                              const wouldExceedLimit = currentCount + results.length > 100;
                              const availableSlots = 100 - currentCount;
                              
                              if (wouldExceedLimit) {
                                return (
                                  <div className="text-xs text-red-600">
                                    Cannot add all {results.length} items - would exceed 100-item limit (currently {currentCount}/100, {availableSlots} slots available)
                                  </div>
                                );
                              }
                              
                              return (
                                <button
                                  onClick={() => addAllSearchResults(facetKey)}
                                  className="w-full text-left text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none flex items-center"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  Select all {results.length} {facet.label.toLowerCase()}
                                </button>
                              );
                            })()}
                          </div>
                          
                          {/* Individual results with campaign status */}
                          {results.map((entity) => {
                            const status = getEntityCampaignStatus(entity.urn);
                            const inCurrentTabCount = status.inCurrentTab.length;
                            const inOppositeTabCount = status.inOppositeTab.length;
                            const notInCurrentTab = status.total - inCurrentTabCount;
                            
                            // Determine which actions are available
                            const canAddToMissing = notInCurrentTab > 0;
                            const canRemoveFromExisting = inCurrentTabCount > 0;
                            const isInOppositeTab = inOppositeTabCount > 0;

                            return (
                              <div key={entity.urn} className="px-3 py-2 border-b border-gray-100 last:border-b-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {entity.name}
                                    </div>
                                    {commonTargeting && (
                                      <div className="flex items-center gap-2 mt-1">
                                        {inCurrentTabCount > 0 && (
                                          <span className="text-xs text-gray-600">
                                            In {inCurrentTabCount}/{status.total} campaigns
                                          </span>
                                        )}
                                        {isInOppositeTab && (
                                          <span className="text-xs text-orange-600">
                                            ⚠ In {inOppositeTabCount} {activeTab === 'includes' ? 'excludes' : 'includes'}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    {canAddToMissing && (
                                      <button
                                        onClick={() => addTargetingEntity(facetKey, entity)}
                                        className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 focus:outline-none"
                                        title={`Add to ${notInCurrentTab} campaign${notInCurrentTab !== 1 ? 's' : ''}`}
                                      >
                                        + Add
                                      </button>
                                    )}
                                    {canRemoveFromExisting && (
                                      <button
                                        onClick={() => removeTargetingEntity(facetKey, entity.urn, entity)}
                                        className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 focus:outline-none"
                                        title={`Remove from ${inCurrentTabCount} campaign${inCurrentTabCount !== 1 ? 's' : ''}`}
                                      >
                                        - Remove
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
