'use client';

import { useState, useEffect, useMemo } from 'react';
import { LinkedInCampaign, LinkedInAccount } from '@/types/linkedin';
import CampaignList from '@/components/CampaignList';
import BatchUpdateModal from '@/components/BatchUpdateModal';
import BulkBidAdjustmentModal from '@/components/BulkBidAdjustmentModal';
import DateRangeFilter from '@/components/DateRangeFilter';
import { DateRange, getDefaultDateRange } from '@/lib/date-ranges';
import DatabaseManager from '@/components/DatabaseManager';

export default function Dashboard() {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [campaigns, setCampaigns] = useState<LinkedInCampaign[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBatchUpdate, setShowBatchUpdate] = useState(false);
  const [showBulkBidAdjustment, setShowBulkBidAdjustment] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState<boolean>(true); // Default to active campaigns only
  const [activeTab, setActiveTab] = useState<'campaigns' | 'database'>('campaigns');
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [allCampaigns, setAllCampaigns] = useState<LinkedInCampaign[]>([]); // Store all campaigns
  const [campaignsPerPage, setCampaignsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fetch accounts on component mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Fetch campaigns when account is selected or active filter changes
  useEffect(() => {
    if (selectedAccount) {
      fetchCampaigns(selectedAccount);
    }
  }, [selectedAccount, activeOnly, dateRange]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/accounts');
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/';
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      
      const data = await response.json();
      setAccounts(data.accounts);
      
      // Auto-select first account if available
      if (data.accounts.length > 0) {
        setSelectedAccount(data.accounts[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async (accountId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns?accountId=${accountId}&activeOnly=${activeOnly}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      
      const data = await response.json();
      const campaigns = data.campaigns;
      
      // Fetch spend data for all campaigns if we have campaigns
      if (campaigns.length > 0) {
        try {
          const campaignIds = campaigns.map((c: any) => c.id).filter(Boolean);
          if (campaignIds.length > 0) {
            const spendResponse = await fetch(
              `/api/campaigns/spend?accountId=${accountId}&campaignIds=${campaignIds.join(',')}&startDate=${dateRange.start}&endDate=${dateRange.end}`
            );
            
            if (spendResponse.ok) {
              const spendData = await spendResponse.json();
              console.log('[Dashboard] Received spend data:', spendData);
              
              // Merge spend data with campaigns
              campaigns.forEach((campaign: any) => {
                if (campaign.id && spendData.spendData && spendData.spendData[campaign.id] !== undefined) {
                  // spendData.spendData[campaign.id] is now a number
                  const spendAmount = spendData.spendData[campaign.id];
                  if (typeof spendAmount === 'number' && spendAmount > 0) {
                    campaign.spent = {
                      amount: spendAmount.toString(),
                      currencyCode: campaign.dailyBudget?.currencyCode || 'USD' // Use campaign currency or default to USD
                    };
                    console.log('[Dashboard] Set spend for campaign', campaign.id, ':', campaign.spent);
                  }
                }
              });
            }
          }
        } catch (spendError) {
          console.error('Failed to fetch spend data:', spendError);
          // Continue without spend data rather than failing completely
        }
      }
      
      setAllCampaigns(campaigns);
      setSelectedCampaigns([]); // Clear selection when switching accounts
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignSelection = (campaignId: string, selected: boolean) => {
    if (selected) {
      setSelectedCampaigns(prev => {
        // Only add if not already selected to prevent duplicates
        if (!prev.includes(campaignId)) {
          return [...prev, campaignId];
        }
        return prev;
      });
    } else {
      setSelectedCampaigns(prev => prev.filter(id => id !== campaignId));
    }
  };

  // Filter and paginate campaigns locally
  const filteredCampaigns = useMemo(() => {
    let filtered = allCampaigns;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(campaign => 
        campaign.name?.toLowerCase().includes(query) || 
        campaign.id?.toString().includes(query)
      );
    }
    
    return filtered;
  }, [allCampaigns, searchQuery]);

  // Paginated campaigns
  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * campaignsPerPage;
    const endIndex = startIndex + campaignsPerPage;
    return filteredCampaigns.slice(startIndex, endIndex);
  }, [filteredCampaigns, currentPage, campaignsPerPage]);

  // Total pages
  const totalPages = Math.ceil(filteredCampaigns.length / campaignsPerPage);

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedCampaigns(paginatedCampaigns.map((c: LinkedInCampaign) => c.id).filter((id): id is string => id !== undefined));
    } else {
      setSelectedCampaigns([]);
    }
  };

  const handleBatchUpdate = () => {
    if (selectedCampaigns.length === 0) {
      alert('Please select at least one campaign to update.');
      return;
    }
    setShowBatchUpdate(true);
  };

  const handleBulkBidAdjustment = () => {
    if (selectedCampaigns.length === 0) {
      alert('Please select at least one campaign to adjust bids.');
      return;
    }
    setShowBulkBidAdjustment(true);
  };

  const handleBatchUpdateComplete = () => {
    setShowBatchUpdate(false);
    setSelectedCampaigns([]);
    // Refresh campaigns to show updated data
    if (selectedAccount) {
      fetchCampaigns(selectedAccount);
    }
  };

  const handleBulkBidAdjustmentComplete = () => {
    setShowBulkBidAdjustment(false);
    setSelectedCampaigns([]);
    // Refresh campaigns to show updated data
    if (selectedAccount) {
      fetchCampaigns(selectedAccount);
    }
  };

  const getRunningCampaignsCount = () => {
    return allCampaigns.filter(c => {
      // Check if campaign status is ACTIVE
      const hasActiveStatus = c.status?.toUpperCase() === 'ACTIVE';
      
      // Check if campaign is actually servable (not on hold, not stopped, etc.)
      // servingStatuses is an array of strings - we want campaigns that are RUNNABLE
      const isServable = c.servingStatuses && 
                        Array.isArray(c.servingStatuses) && 
                        c.servingStatuses.includes('RUNNABLE');
      
      // Campaign is truly "active/running" only if both conditions are met
      return hasActiveStatus && isServable;
    }).length;
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-12 w-12 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-600">Loading your LinkedIn ad accounts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Error Loading Data</h3>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center">
              <div className="h-6 w-6 bg-blue-600 rounded-md flex items-center justify-center mr-2">
                <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">LinkedIn Ads Manager</h1>
            </div>
            
            <button
              onClick={() => {
                document.cookie = 'linkedin_access_token=; Max-Age=0; path=/';
                window.location.href = '/';
              }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded-md hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Account Selection */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <label htmlFor="account-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Ad Account
          </label>
          <select
            id="account-select"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="block w-full max-w-xs border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'campaigns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'database'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Database Manager
            </button>
          </nav>
        </div>

        {/* Database Manager Tab */}
        {activeTab === 'database' && (
          <DatabaseManager />
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && selectedAccount && (
          <>
            {/* Date Range Filter */}
            <DateRangeFilter
              selectedRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {/* Search and Filter Controls */}
            <div className="bg-white shadow rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                      Search Campaigns
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by campaign name or ID..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="active-only"
                        checked={activeOnly}
                        onChange={(e) => setActiveOnly(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="active-only" className="ml-2 text-sm text-gray-700">
                        Active campaigns only
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Campaigns</dt>
                        <dd className="text-lg font-medium text-gray-900">{allCampaigns.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Running Campaigns</dt>
                        <dd className="text-lg font-medium text-gray-900">{getRunningCampaignsCount()}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Selected</dt>
                        <dd className="text-lg font-medium text-gray-900">{selectedCampaigns.length}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex space-x-3">
                <button
                  onClick={handleBatchUpdate}
                  disabled={selectedCampaigns.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Batch Update ({selectedCampaigns.length})
                </button>
                <button
                  onClick={handleBulkBidAdjustment}
                  disabled={selectedCampaigns.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Bulk Bid Adjustment ({selectedCampaigns.length})
                </button>
              </div>

              <button
                onClick={() => selectedAccount && fetchCampaigns(selectedAccount)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {/* Campaigns Per Page and Results Info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label htmlFor="per-page" className="text-sm font-medium text-gray-700">
                    Show:
                  </label>
                  <select
                    id="per-page"
                    value={campaignsPerPage}
                    onChange={(e) => {
                      setCampaignsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-sm text-gray-700">campaigns per page</span>
                </div>
                
                {searchQuery && (
                  <div className="text-sm text-gray-600">
                    Showing {filteredCampaigns.length} of {allCampaigns.length} campaigns matching "{searchQuery}"
                  </div>
                )}
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Campaign List */}
            <CampaignList
              campaigns={paginatedCampaigns}
              selectedCampaigns={selectedCampaigns}
              onCampaignSelection={handleCampaignSelection}
              onSelectAll={handleSelectAll}
              loading={loading}
            />

            {/* Bottom Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * campaignsPerPage) + 1} to {Math.min(currentPage * campaignsPerPage, filteredCampaigns.length)} of {filteredCampaigns.length} campaigns
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 border rounded text-sm ${
                          currentPage === pageNum
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Show account selection message when no account is selected */}
        {activeTab === 'campaigns' && !selectedAccount && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h1a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Select an Ad Account</h3>
            <p className="mt-2 text-sm text-gray-500">
              Choose an ad account from the dropdown above to view and manage your campaigns.
            </p>
          </div>
        )}
      </div>

      {/* Batch Update Modal */}
      {showBatchUpdate && (
        <BatchUpdateModal
          campaignIds={selectedCampaigns}
          accountId={selectedAccount}
          onClose={() => setShowBatchUpdate(false)}
          onComplete={handleBatchUpdateComplete}
        />
      )}

             {/* Bulk Bid Adjustment Modal */}
       {showBulkBidAdjustment && (
         <BulkBidAdjustmentModal
           isOpen={showBulkBidAdjustment}
           selectedCampaigns={selectedCampaigns}
           accountId={selectedAccount}
           onClose={() => setShowBulkBidAdjustment(false)}
           onSuccess={handleBulkBidAdjustmentComplete}
         />
       )}
    </div>
  );
} 