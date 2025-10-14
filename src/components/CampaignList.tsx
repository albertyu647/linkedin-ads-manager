'use client';

import { useState, useMemo, useEffect } from 'react';
import { LinkedInCampaign } from '@/types/linkedin';
import { formatTimeSinceAdjustment } from '@/lib/bid-tracking';

interface BidAdjustmentData {
  campaignId: string;
  spentAtAdjustment: number;
  spendSinceOct1AtAdjustment: number;
  adjustmentTimestamp: string;
  bidAdjustmentAmount: number;
}

interface CampaignListProps {
  campaigns: LinkedInCampaign[];
  selectedCampaigns: string[];
  onCampaignSelection: (campaignId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  loading: boolean;
  accountId: string;
}

type SortField = 'name' | 'status' | 'dailyBudget' | 'unitCost' | 'spent' | 'impressions' | 'clicks' | 'leads' | 'spendSinceAdjustment';
type SortDirection = 'asc' | 'desc';

export default function CampaignList({
  campaigns,
  selectedCampaigns,
  onCampaignSelection,
  onSelectAll,
  loading,
  accountId
}: CampaignListProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [bidAdjustments, setBidAdjustments] = useState<Map<string, BidAdjustmentData>>(new Map());
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bidChanges, setBidChanges] = useState<Map<string, number>>(new Map());
  const [savingBids, setSavingBids] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState<Map<string, 'pending' | 'processing' | 'completed' | 'failed'>>(new Map());

  // Fetch bid adjustments for all campaigns
  useEffect(() => {
    const fetchBidAdjustments = async () => {
      if (campaigns.length === 0) return;
      
      setLoadingAdjustments(true);
      const adjustmentsMap = new Map<string, BidAdjustmentData>();
      
      try {
        // Fetch adjustments for each campaign
        const promises = campaigns.map(async (campaign) => {
          if (!campaign.id) return;
          
          try {
            const response = await fetch(`/api/campaigns/bid-history?campaignId=${campaign.id}`);
            if (response.ok) {
              const data = await response.json();
              if (data.adjustment) {
                adjustmentsMap.set(campaign.id, {
                  campaignId: data.adjustment.campaignId,
                  spentAtAdjustment: data.adjustment.spentAtAdjustment,
                  spendSinceOct1AtAdjustment: data.adjustment.spendSinceOct1AtAdjustment || 0,
                  adjustmentTimestamp: data.adjustment.adjustmentTimestamp,
                  bidAdjustmentAmount: data.adjustment.bidAdjustmentAmount
                });
              }
            }
          } catch (err) {
            console.error(`Failed to fetch bid adjustment for campaign ${campaign.id}:`, err);
          }
        });
        
        await Promise.all(promises);
        setBidAdjustments(adjustmentsMap);
      } catch (err) {
        console.error('Failed to fetch bid adjustments:', err);
      } finally {
        setLoadingAdjustments(false);
      }
    };
    
    fetchBidAdjustments();
  }, [campaigns]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCampaignClick = (campaignId: string, currentIndex: number, isShiftClick: boolean, isChecked: boolean) => {
    if (isShiftClick && lastClickedIndex !== null) {
      // Range selection with Shift+click
      const startIndex = Math.min(lastClickedIndex, currentIndex);
      const endIndex = Math.max(lastClickedIndex, currentIndex);
      
      // Get all campaigns in the range
      const campaignsInRange = sortedCampaigns.slice(startIndex, endIndex + 1);
      
      // Select/deselect all campaigns in the range based on the target state
      campaignsInRange.forEach(campaign => {
        if (campaign.id) {
          onCampaignSelection(campaign.id, isChecked);
        }
      });
    } else {
      // Single campaign selection
      onCampaignSelection(campaignId, isChecked);
    }
    
    // Update the last clicked index
    setLastClickedIndex(currentIndex);
  };

  const handleSelectNoSpend = () => {
    const noSpendCampaignIds = sortedCampaigns
      .filter(campaign => {
        // Check if spent is N/A (undefined/null) or 0
        if (!campaign.spent || !campaign.spent.amount) return true;
        const spentAmount = parseFloat(campaign.spent.amount);
        return spentAmount === 0;
      })
      .map(campaign => campaign.id)
      .filter((id): id is string => id !== undefined);
    
    // Only select campaigns that are NOT already selected
    const campaignsToSelect = noSpendCampaignIds.filter(campaignId => 
      !selectedCampaigns.includes(campaignId)
    );
    
    // Call onCampaignSelection only for campaigns that need to be selected
    campaignsToSelect.forEach(campaignId => onCampaignSelection(campaignId, true));
    
    // Reset last clicked index since we're doing bulk selection
    setLastClickedIndex(null);
  };

  const getNoSpendCount = () => {
    return sortedCampaigns.filter(campaign => {
      if (!campaign.spent || !campaign.spent.amount) return true;
      const spentAmount = parseFloat(campaign.spent.amount);
      return spentAmount === 0;
    }).length;
  };

  const handleBidChange = (campaignId: string, newBid: number) => {
    const newChanges = new Map(bidChanges);
    newChanges.set(campaignId, newBid);
    setBidChanges(newChanges);
  };

  const handleBidKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, campaignId: string, currentBid: number) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newBid = Math.round((currentBid + 1) * 100) / 100;
      handleBidChange(campaignId, newBid);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newBid = Math.max(0.01, Math.round((currentBid - 1) * 100) / 100);
      handleBidChange(campaignId, newBid);
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      // Cancel edit mode - clear changes
      setBidChanges(new Map());
    }
    setEditMode(!editMode);
  };

  const updateCampaignProgress = (campaignId: string, status: 'pending' | 'processing' | 'completed' | 'failed') => {
    setCampaignProgress(prev => {
      const newMap = new Map(prev);
      newMap.set(campaignId, status);
      return newMap;
    });
  };

  const confirmBidChanges = async () => {
    if (bidChanges.size === 0) {
      setEditMode(false);
      return;
    }

    setSavingBids(true);
    setShowProgress(true);
    
    // Initialize progress tracking
    const progressMap = new Map<string, 'pending' | 'processing' | 'completed' | 'failed'>();
    bidChanges.forEach((_, campaignId) => {
      progressMap.set(campaignId, 'pending');
    });
    setCampaignProgress(progressMap);

    const results = { successful: [] as string[], failed: [] as Array<{campaignId: string, error: string}> };

    // Create promises for all campaigns (PARALLEL PROCESSING)
    const campaignPromises = Array.from(bidChanges.entries()).map(async ([campaignId, newBid]) => {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign || !campaign.unitCost) {
        return { campaignId, status: 'skipped' };
      }

      const oldBid = parseFloat(campaign.unitCost.amount);
      const bidAdjustment = newBid - oldBid;

      if (bidAdjustment === 0) {
        return { campaignId, status: 'skipped' };
      }

      try {
        updateCampaignProgress(campaignId, 'processing');
        
        const response = await fetch('/api/campaigns/batch-bid-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignIds: [campaignId],
            bidAdjustment,
            accountId
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.successful?.length > 0) {
            // Record in bid history
            const currentSpent = parseFloat(campaign.spent?.amount || '0');
            let spendSinceOct1 = 0;
            try {
              const oct1Response = await fetch(`/api/campaigns/spend-since-oct1?accountId=${accountId}&campaignIds=${campaignId}`);
              if (oct1Response.ok) {
                const oct1Data = await oct1Response.json();
                spendSinceOct1 = oct1Data.spendData[campaignId] || 0;
              }
            } catch (err) {
              console.error('Failed to fetch Oct 1 spend:', err);
            }

            await fetch('/api/campaigns/bid-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId,
                bidAdjustmentAmount: bidAdjustment,
                oldBid,
                newBid,
                spentAtAdjustment: currentSpent,
                spendSinceOct1AtAdjustment: spendSinceOct1,
                accountId
              })
            });
            
            updateCampaignProgress(campaignId, 'completed');
            return { campaignId, status: 'success' };
          }
        } else {
          const errorData = await response.json();
          updateCampaignProgress(campaignId, 'failed');
          return { campaignId, status: 'failed', error: errorData.error || 'Failed to update' };
        }
      } catch (error: any) {
        updateCampaignProgress(campaignId, 'failed');
        return { campaignId, status: 'failed', error: error.message };
      }
    });

    // Wait for ALL campaigns to complete in PARALLEL
    const campaignResults = await Promise.allSettled(campaignPromises);
    
    // Process results
    campaignResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        if (result.value.status === 'success') {
          results.successful.push(result.value.campaignId);
        } else if (result.value.status === 'failed') {
          results.failed.push({ 
            campaignId: result.value.campaignId, 
            error: result.value.error || 'Unknown error' 
          });
        }
      }
    });

    setSavingBids(false);
    
    // Wait a moment to show completion, then reload
    setTimeout(() => {
      if (results.failed.length > 0) {
        alert(`Updated ${results.successful.length} bids successfully. ${results.failed.length} failed.`);
      } else {
        alert(`Successfully updated ${results.successful.length} bid${results.successful.length === 1 ? '' : 's'}!`);
      }
      
      // Reload page to show updated bids
      window.location.reload();
    }, 1000);
  };

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'dailyBudget':
          aValue = parseFloat(a.dailyBudget?.amount || '0');
          bValue = parseFloat(b.dailyBudget?.amount || '0');
          break;
        case 'unitCost':
          aValue = parseFloat(a.unitCost?.amount || '0');
          bValue = parseFloat(b.unitCost?.amount || '0');
          break;
        case 'spent':
          aValue = parseFloat(a.spent?.amount || '0');
          bValue = parseFloat(b.spent?.amount || '0');
          break;
        case 'impressions':
          aValue = (a as any).impressions || 0;
          bValue = (b as any).impressions || 0;
          break;
        case 'clicks':
          aValue = (a as any).clicks || 0;
          bValue = (b as any).clicks || 0;
          break;
        case 'leads':
          aValue = (a as any).leads || 0;
          bValue = (b as any).leads || 0;
          break;
        case 'spendSinceAdjustment':
          // Calculate spend since last adjustment for sorting
          const aAdjustment = a.id ? bidAdjustments.get(a.id) : undefined;
          const bAdjustment = b.id ? bidAdjustments.get(b.id) : undefined;
          
          aValue = aAdjustment ? ((a as any).spendSinceOct1 || 0) - aAdjustment.spendSinceOct1AtAdjustment : 0;
          bValue = bAdjustment ? ((b as any).spendSinceOct1 || 0) - bAdjustment.spendSinceOct1AtAdjustment : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [campaigns, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'ARCHIVED':
        return 'bg-gray-100 text-gray-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELED':
        return 'bg-red-100 text-red-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBudget = (budget?: { amount: string; currencyCode: string }) => {
    if (!budget || !budget.amount) return 'N/A';
    return `${budget.currencyCode} ${parseFloat(budget.amount).toLocaleString()}`;
  };

  const formatBid = (bid?: { amount: string; currencyCode: string }) => {
    if (!bid || !bid.amount) return 'N/A';
    return `${bid.currencyCode} ${parseFloat(bid.amount).toFixed(2)}`;
  };

  const formatSpent = (spent?: { amount: string; currencyCode: string }) => {
    if (!spent || !spent.amount) return 'N/A';
    return `${spent.currencyCode} ${parseFloat(spent.amount).toFixed(2)}`;
  };

  const isAllSelected = sortedCampaigns.length > 0 && selectedCampaigns.length === sortedCampaigns.length;
  const isIndeterminate = selectedCampaigns.length > 0 && selectedCampaigns.length < sortedCampaigns.length;

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="text-center">
            <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-600">Loading campaigns...</p>
          </div>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No campaigns found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No campaigns found for the selected account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Campaigns ({sortedCampaigns.length})
          </h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isIndeterminate;
                }}
                onChange={(e) => {
                  onSelectAll(e.target.checked);
                  // Reset last clicked index since we're doing bulk selection
                  setLastClickedIndex(null);
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-600">
                Select All
              </label>
            </div>
            
            {getNoSpendCount() > 0 && !editMode && (
              <button
                onClick={handleSelectNoSpend}
                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                Select No Spend ({getNoSpendCount()})
              </button>
            )}
            
            {!editMode ? (
              <button
                onClick={toggleEditMode}
                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Bids
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleEditMode}
                  disabled={savingBids}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBidChanges}
                  disabled={savingBids || bidChanges.size === 0}
                  className="inline-flex items-center px-3 py-1 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingBids ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm Changes ({bidChanges.size})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Campaign</span>
                  {getSortIcon('name')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  {getSortIcon('status')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('dailyBudget')}
              >
                <div className="flex items-center space-x-1">
                  <span>Daily Budget</span>
                  {getSortIcon('dailyBudget')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('unitCost')}
              >
                <div className="flex items-center space-x-1">
                  <span>Bid Amount</span>
                  {getSortIcon('unitCost')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('spent')}
              >
                <div className="flex items-center space-x-1">
                  <span>Spent</span>
                  {getSortIcon('spent')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('impressions')}
              >
                <div className="flex items-center space-x-1">
                  <span>Impressions</span>
                  {getSortIcon('impressions')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('clicks')}
              >
                <div className="flex items-center space-x-1">
                  <span>Clicks</span>
                  {getSortIcon('clicks')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('leads')}
              >
                <div className="flex items-center space-x-1">
                  <span>Leads</span>
                  {getSortIcon('leads')}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('spendSinceAdjustment')}
              >
                <div className="flex items-center space-x-1">
                  <span>Since Last Bid Adj.</span>
                  {getSortIcon('spendSinceAdjustment')}
                  <div className="group relative">
                    <svg className="h-4 w-4 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="hidden group-hover:block absolute z-10 w-64 p-2 mt-1 text-xs bg-gray-800 text-white rounded shadow-lg">
                      Shows spending since the last bid adjustment. Helps track if bid changes are affecting spend.
                    </div>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Totals Row - First */}
            <tr className="font-semibold bg-gray-50 border-b-2 border-gray-300">
              <td className="px-6 py-4 text-sm text-gray-900">
                Total ({sortedCampaigns.length} campaigns)
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                -
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {(() => {
                  const total = sortedCampaigns.reduce((sum, c) => {
                    return sum + parseFloat(c.dailyBudget?.amount || '0');
                  }, 0);
                  const campaignWithBudget = sortedCampaigns.find(c => c.dailyBudget?.currencyCode);
                  const currency = campaignWithBudget?.dailyBudget?.currencyCode || 'CAD';
                  return `${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {(() => {
                  const bids = sortedCampaigns.filter(c => c.unitCost?.amount).map(c => parseFloat(c.unitCost!.amount));
                  if (bids.length === 0) return '-';
                  const avg = bids.reduce((sum, b) => sum + b, 0) / bids.length;
                  const campaignWithBid = sortedCampaigns.find(c => c.unitCost?.currencyCode);
                  const currency = campaignWithBid?.unitCost?.currencyCode || 'CAD';
                  return `Avg: ${currency} ${avg.toFixed(2)}`;
                })()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {(() => {
                  const total = sortedCampaigns.reduce((sum, c) => {
                    return sum + parseFloat(c.spent?.amount || '0');
                  }, 0);
                  const campaignWithSpend = sortedCampaigns.find(c => c.spent?.currencyCode);
                  const currency = campaignWithSpend?.spent?.currencyCode || 'CAD';
                  return `${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {sortedCampaigns.reduce((sum, c) => sum + ((c as any).impressions || 0), 0).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {sortedCampaigns.reduce((sum, c) => sum + ((c as any).clicks || 0), 0).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {sortedCampaigns.reduce((sum, c) => sum + ((c as any).leads || 0), 0).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {(() => {
                  const total = sortedCampaigns.reduce((sum, c) => {
                    if (!c.id) return sum;
                    const adjustment = bidAdjustments.get(c.id);
                    if (!adjustment) return sum;
                    const currentSpendSinceOct1 = (c as any).spendSinceOct1 || 0;
                    const spendSince = currentSpendSinceOct1 - adjustment.spendSinceOct1AtAdjustment;
                    return sum + spendSince;
                  }, 0);
                  const campaignWithSpend = sortedCampaigns.find(c => c.spent?.currencyCode);
                  const currency = campaignWithSpend?.spent?.currencyCode || 'CAD';
                  return `${currency} ${total.toFixed(2)}`;
                })()}
              </td>
            </tr>
            
            {/* Campaign Rows */}
            {sortedCampaigns.map((campaign, index) => (
              <tr 
                key={campaign.id || 'unknown'}
                onClick={(e) => {
                  if (campaign.id) {
                    const isCurrentlySelected = selectedCampaigns.includes(campaign.id);
                    handleCampaignClick(campaign.id, index, e.shiftKey, !isCurrentlySelected);
                  }
                }}
                className={`cursor-pointer transition-colors ${
                  campaign.id && selectedCampaigns.includes(campaign.id) 
                    ? 'bg-blue-50 hover:bg-blue-100' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {campaign.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    ID: {campaign.id}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatBudget(campaign.dailyBudget)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editMode && campaign.id && campaign.unitCost ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="1"
                        value={bidChanges.has(campaign.id) ? bidChanges.get(campaign.id) : parseFloat(campaign.unitCost.amount)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            handleBidChange(campaign.id!, value);
                          }
                        }}
                        onKeyDown={(e) => {
                          const currentBid = bidChanges.has(campaign.id!) ? bidChanges.get(campaign.id!)! : parseFloat(campaign.unitCost!.amount);
                          handleBidKeyDown(e, campaign.id!, currentBid);
                        }}
                        className={`w-24 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          bidChanges.has(campaign.id) && bidChanges.get(campaign.id) !== parseFloat(campaign.unitCost.amount)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300'
                        }`}
                      />
                      {bidChanges.has(campaign.id) && bidChanges.get(campaign.id) !== parseFloat(campaign.unitCost.amount) && (
                        <span className="text-xs text-blue-600 font-medium">
                          {bidChanges.get(campaign.id)! > parseFloat(campaign.unitCost.amount) ? '↑' : '↓'}
                          {Math.abs(bidChanges.get(campaign.id)! - parseFloat(campaign.unitCost.amount)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ) : (
                    formatBid(campaign.unitCost)
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatSpent(campaign.spent)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {(campaign as any).impressions?.toLocaleString() || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {(campaign as any).clicks?.toLocaleString() || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {(campaign as any).leads?.toLocaleString() || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {campaign.id && (() => {
                    const adjustment = bidAdjustments.get(campaign.id);
                    
                    if (loadingAdjustments) {
                      return <span className="text-xs text-gray-400">Loading...</span>;
                    }
                    
                    if (!adjustment) {
                      return <span className="text-xs text-gray-400">No adjustments</span>;
                    }
                    
                    // Use Oct 1 baseline for consistent tracking regardless of date filter
                    const currentSpendSinceOct1 = (campaign as any).spendSinceOct1 || 0;
                    const spendSince = currentSpendSinceOct1 - adjustment.spendSinceOct1AtAdjustment;
                    const timeSince = formatTimeSinceAdjustment(adjustment.adjustmentTimestamp);
                    const wasIncrease = adjustment.bidAdjustmentAmount > 0;
                    
                    // Debug logging
                    console.log(`[CampaignList] Campaign ${campaign.id}:`, {
                      currentSpendSinceOct1,
                      spendSinceOct1AtAdjustment: adjustment.spendSinceOct1AtAdjustment,
                      spendSince,
                      calculation: `${currentSpendSinceOct1} - ${adjustment.spendSinceOct1AtAdjustment} = ${spendSince}`
                    });
                    
                    return (
                      <div className="flex flex-col group relative">
                        <div className="flex items-center space-x-1">
                          <span className={`text-sm font-medium ${
                            spendSince > 0 ? 'text-blue-600' : 'text-gray-900'
                          }`}>
                            {campaign.spent?.currencyCode || 'CAD'} {spendSince.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">{timeSince}</span>
                          <span className={`text-xs font-medium ${wasIncrease ? 'text-green-600' : 'text-red-600'}`}>
                            ({wasIncrease ? '+' : ''}{campaign.spent?.currencyCode || 'CAD'} {Math.abs(adjustment.bidAdjustmentAmount).toFixed(2)})
                          </span>
                        </div>
                        
                        {/* Tooltip explaining the calculation */}
                        <div className="hidden group-hover:block absolute z-10 w-64 p-2 mt-1 left-0 top-full text-xs bg-gray-800 text-white rounded shadow-lg">
                          Spend since Oct 1, 2025 baseline. Bid was adjusted by {wasIncrease ? '+' : ''}{campaign.spent?.currencyCode || 'CAD'} {Math.abs(adjustment.bidAdjustmentAmount).toFixed(2)}.
                        </div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCampaigns.length > 0 && (
        <div className="bg-blue-50 px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-blue-800">
            {selectedCampaigns.length} campaign{selectedCampaigns.length === 1 ? '' : 's'} selected
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Updating Campaign Bids
              </h3>
              <div className="space-y-2">
                {Array.from(bidChanges.entries()).map(([campaignId, newBid]) => {
                  const campaign = campaigns.find(c => c.id === campaignId);
                  const status = campaignProgress.get(campaignId) || 'pending';
                  const oldBid = campaign?.unitCost ? parseFloat(campaign.unitCost.amount) : 0;
                  const adjustment = newBid - oldBid;
                  
                  return (
                    <div key={campaignId} className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {status === 'pending' && (
                          <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                        )}
                        {status === 'processing' && (
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                        {status === 'completed' && (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {status === 'failed' && (
                          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Campaign Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {campaign?.name || `Campaign ${campaignId}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {oldBid.toFixed(2)} → {newBid.toFixed(2)} 
                          <span className={adjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                            {' '}({adjustment > 0 ? '+' : ''}{adjustment.toFixed(2)})
                          </span>
                        </p>
                      </div>
                      
                      {/* Status Text */}
                      <div className="text-xs text-gray-500 flex-shrink-0">
                        {status === 'pending' && 'Waiting...'}
                        {status === 'processing' && 'Updating...'}
                        {status === 'completed' && 'Done'}
                        {status === 'failed' && 'Failed'}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {!savingBids && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowProgress(false);
                      setBidChanges(new Map());
                      setEditMode(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
