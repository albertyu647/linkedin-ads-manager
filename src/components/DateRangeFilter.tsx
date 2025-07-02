'use client';

import { useState } from 'react';
import { DateRange, getPredefinedDateRanges } from '@/lib/date-ranges';

interface DateRangeFilterProps {
  onDateRangeChange: (range: DateRange) => void;
  selectedRange: DateRange;
}

export default function DateRangeFilter({ onDateRangeChange, selectedRange }: DateRangeFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(selectedRange.start);
  const [customEnd, setCustomEnd] = useState(selectedRange.end);

  // Get predefined date ranges from shared utility
  const predefinedRanges = getPredefinedDateRanges();

  const handleRangeSelect = (range: DateRange) => {
    setShowCustom(false);
    onDateRangeChange(range);
  };

  const handleCustomRangeApply = () => {
    if (customStart && customEnd) {
      const customRange: DateRange = {
        start: customStart,
        end: customEnd,
        label: 'Custom range'
      };
      setShowCustom(false);
      onDateRangeChange(customRange);
    }
  };

  const isRangeSelected = (range: DateRange) => {
    return selectedRange.start === range.start && selectedRange.end === range.end;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Date Range Filter</h3>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {predefinedRanges.map((range, index) => (
          <button
            key={index}
            onClick={() => handleRangeSelect(range)}
            className={`px-3 py-2 text-sm rounded-md border transition-colors ${
              isRangeSelected(range)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {range.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 py-2 text-sm rounded-md border transition-colors ${
            showCustom
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Custom range
        </button>
      </div>

      {showCustom && (
        <div className="border-t border-gray-200 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="start-date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="end-date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <button
                onClick={handleCustomRangeApply}
                disabled={!customStart || !customEnd}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <span className="font-medium">Selected range:</span> {selectedRange.label} 
        <span className="ml-2">({selectedRange.start} to {selectedRange.end})</span>
      </div>
    </div>
  );
} 