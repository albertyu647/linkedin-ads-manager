'use client';

import { useState, useMemo } from 'react';
import { LinkedInCampaign } from '@/types/linkedin';

interface CampaignListProps {
  campaigns: LinkedInCampaign[];
  selectedCampaigns: string[];
  onCampaignSelection: (campaignId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  loading: boolean;
}

type SortField = 'name' | 'status' | 'dailyBudget' | 'unitCost' | 'spent';
type SortDirection = 'asc' | 'desc';

export default function CampaignList({
  campaigns,
  selectedCampaigns,
  onCampaignSelection,
  onSelectAll,
  loading
}: CampaignListProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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
    
    // Add these campaigns to the current selection (don't replace)
    const newSelection = [...new Set([...selectedCampaigns, ...noSpendCampaignIds])];
    newSelection.forEach(campaignId => onCampaignSelection(campaignId, true));
  };

  const getNoSpendCount = () => {
    return sortedCampaigns.filter(campaign => {
      if (!campaign.spent || !campaign.spent.amount) return true;
      const spentAmount = parseFloat(campaign.spent.amount);
      return spentAmount === 0;
    }).length;
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
                onChange={(e) => onSelectAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-600">
                Select All
              </label>
            </div>
            
            {getNoSpendCount() > 0 && (
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
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Select
              </th>
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCampaigns.map((campaign) => (
              <tr 
                key={campaign.id || 'unknown'}
                className={`hover:bg-gray-50 ${
                  campaign.id && selectedCampaigns.includes(campaign.id) ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={campaign.id ? selectedCampaigns.includes(campaign.id) : false}
                    onChange={(e) => campaign.id && onCampaignSelection(campaign.id, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
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
                  {formatBid(campaign.unitCost)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatSpent(campaign.spent)}
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
    </div>
  );
} 