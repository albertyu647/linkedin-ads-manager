'use client';

import { LinkedInCampaign } from '@/types/linkedin';

interface CampaignListProps {
  campaigns: LinkedInCampaign[];
  selectedCampaigns: string[];
  onCampaignSelection: (campaignId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  loading: boolean;
}

export default function CampaignList({
  campaigns,
  selectedCampaigns,
  onCampaignSelection,
  onSelectAll,
  loading
}: CampaignListProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
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
    if (!budget) return 'N/A';
    return `${budget.currencyCode} ${parseFloat(budget.amount).toLocaleString()}`;
  };

  const isAllSelected = campaigns.length > 0 && selectedCampaigns.length === campaigns.length;
  const isIndeterminate = selectedCampaigns.length > 0 && selectedCampaigns.length < campaigns.length;

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
            Campaigns ({campaigns.length})
          </h3>
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Select
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Campaign
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Daily Budget
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <tr 
                key={campaign.id}
                className={`hover:bg-gray-50 ${
                  selectedCampaigns.includes(campaign.id) ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedCampaigns.includes(campaign.id)}
                    onChange={(e) => onCampaignSelection(campaign.id, e.target.checked)}
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
                  {campaign.type?.replace('_', ' ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {campaign.costType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatBudget(campaign.dailyBudget)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(campaign.createdAt)}
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