'use client';

import { useState } from 'react';

interface BulkBidAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCampaigns: string[];
  accountId: string;
  onSuccess: () => void;
}

export default function BulkBidAdjustmentModal({
  isOpen,
  onClose,
  selectedCampaigns,
  accountId,
  onSuccess
}: BulkBidAdjustmentModalProps) {
  const [bidAdjustment, setBidAdjustment] = useState<number>(0);
  const [bidInputValue, setBidInputValue] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedCampaigns.length === 0) {
      setError('No campaigns selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns/batch-bid-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignIds: selectedCampaigns,
          bidAdjustment,
          accountId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update bids');
      }

      const result = await response.json();
      
      if (result.failed && result.failed.length > 0) {
        setError(`Updated ${result.successful.length} campaigns successfully. ${result.failed.length} failed.`);
      } else {
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
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

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

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
                {isLoading ? 'Updating...' : 'Update Bids'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 