'use client';

import { useState, useEffect } from 'react';
import { LinkedInCampaign } from '@/types/linkedin';
import { BidHistory } from '@/lib/client-storage';

interface BulkBidAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCampaigns: string[];
  campaigns: LinkedInCampaign[]; // Full campaign data to get current bids and spending
  accountId: string;
  onSuccess: () => void;
}

interface CampaignProgress {
  id: string;
  name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export default function BulkBidAdjustmentModal({
  isOpen,
  onClose,
  selectedCampaigns,
  campaigns,
  accountId,
  onSuccess
}: BulkBidAdjustmentModalProps) {
  const [bidAdjustment, setBidAdjustment] = useState<number>(0);
  const [bidInputValue, setBidInputValue] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  // Initialize progress tracking when campaigns are selected
  useEffect(() => {
    if (selectedCampaigns.length > 0) {
      setCampaignProgress(
        selectedCampaigns.map(id => ({
          id,
          name: `Campaign ${id}`,
          status: 'pending'
        }))
      );
    }
  }, [selectedCampaigns]);

  const handleBidInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBidInputValue(value);
    
    // Only update bidAdjustment if it's a valid number or empty
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setBidAdjustment(numValue);
    } else if (value === '' || value === '-') {
      // Allow empty string or just minus sign without updating bidAdjustment yet
      if (value === '') {
        setBidAdjustment(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newValue = Math.round((bidAdjustment + 0.5) * 100) / 100;
      setBidAdjustment(newValue);
      setBidInputValue(newValue.toString());
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newValue = Math.round((bidAdjustment - 0.5) * 100) / 100;
      setBidAdjustment(newValue);
      setBidInputValue(newValue.toString());
    }
  };

  const handleBlur = () => {
    // On blur, ensure the input shows a valid number
    setBidInputValue(bidAdjustment.toString());
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedCampaigns.length === 0) {
      setError('No campaigns selected');
      return;
    }

    setIsLoading(true);
    setShowProgress(true);
    setError(null);

    try {
      // Process campaigns in parallel with progress tracking
      const results: { 
        successful: string[], 
        failed: Array<{ campaignId: string; error: string }> 
      } = { successful: [], failed: [] };
      
      // Set all campaigns to processing status
      selectedCampaigns.forEach(campaignId => {
        updateCampaignStatus(campaignId, 'processing');
      });
      
      // Create promises for all campaigns
      const campaignPromises = selectedCampaigns.map(async (campaignId) => {
        try {
          const response = await fetch('/api/campaigns/batch-bid-update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignIds: [campaignId], // Process one at a time but in parallel
              bidAdjustment,
              accountId
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update bid');
          }

          const result = await response.json();
          
          if (result.successful && result.successful.length > 0) {
            updateCampaignStatus(campaignId, 'completed');
            
            // Record the bid adjustment in database for tracking
            const campaign = campaigns.find(c => c.id === campaignId);
            if (campaign) {
              const currentSpent = parseFloat(campaign.spent?.amount || '0');
              const oldBid = parseFloat(campaign.unitCost?.amount || '0');
              const newBid = oldBid + bidAdjustment;
              
              // Fetch spend since Oct 1 for this campaign
              let spendSinceOct1 = 0;
              try {
                const oct1Response = await fetch(
                  `/api/campaigns/spend-since-oct1?accountId=${accountId}&campaignIds=${campaignId}`
                );
                if (oct1Response.ok) {
                  const oct1Data = await oct1Response.json();
                  spendSinceOct1 = oct1Data.spendData[campaignId] || 0;
                }
              } catch (err) {
                console.error('Failed to fetch Oct 1 spend:', err);
              }
              
              // Save to client-side storage
              try {
                BidHistory.record({
                  campaignId,
                  bidAdjustmentAmount: bidAdjustment,
                  oldBid,
                  newBid,
                  spentAtAdjustment: currentSpent,
                  spendSinceOct1AtAdjustment: spendSinceOct1,
                  accountId
                });
              } catch (err) {
                console.error('Failed to record bid adjustment:', err);
                // Don't fail the whole operation if tracking fails
              }
            }
            
            return { campaignId, status: 'success' };
          } else if (result.failed && result.failed.length > 0) {
            updateCampaignStatus(campaignId, 'failed', result.failed[0].error);
            return { campaignId, status: 'failed', error: result.failed[0].error };
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
        const campaignId = selectedCampaigns[index];
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

      if (results.failed.length > 0) {
        setError(`Updated ${results.successful.length} campaigns successfully. ${results.failed.length} failed.`);
      } else {
        // Success - wait a moment to show completion, then close
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setShowProgress(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Bulk Bid Adjustment
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!showProgress ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="bidAdjustment" className="block text-sm font-medium text-gray-700 mb-2">
                  Bid Adjustment Amount (CAD)
                </label>
                <input
                  type="number"
                  id="bidAdjustment"
                  step="0.50"
                  value={bidInputValue}
                  onChange={handleBidInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount (e.g., 0.50 or -0.25)"
                  disabled={isLoading}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Positive values increase bids, negative values decrease bids. Use arrow keys for ±0.50 increments.
                </p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  This will adjust bids for {selectedCampaigns.length} selected campaign{selectedCampaigns.length === 1 ? '' : 's'}.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={isLoading || bidAdjustment === 0}
                >
                  {isLoading ? 'Starting...' : 'Update Bids'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Updating Campaign Bids {bidAdjustment > 0 ? `(+$${bidAdjustment.toFixed(2)})` : `(-$${Math.abs(bidAdjustment).toFixed(2)})`}
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

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                {!isLoading && (
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
                      onClick={onClose}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
