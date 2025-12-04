'use client';

import { BidAdjustmentHistory } from '@/lib/client-storage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface BidHistoryGraphProps {
  campaignId: string;
  campaignName: string;
  adjustments: BidAdjustmentHistory[];
  onClose: () => void;
}

export default function BidHistoryGraph({ campaignId, campaignName, adjustments, onClose }: BidHistoryGraphProps) {
  // Sort adjustments by timestamp (oldest first for the graph)
  const sortedAdjustments = [...adjustments].sort((a, b) =>
    new Date(a.adjustmentTimestamp).getTime() - new Date(b.adjustmentTimestamp).getTime()
  );

  // Prepare data for the chart
  const chartData = sortedAdjustments.map((adj, index) => ({
    timestamp: new Date(adj.adjustmentTimestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    bid: adj.newBid,
    change: adj.bidAdjustmentAmount,
    fullDate: new Date(adj.adjustmentTimestamp).toLocaleString()
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg text-sm">
          <p className="font-medium text-gray-900">{data.fullDate}</p>
          <p className="text-gray-700 mt-1">Bid: <span className="font-semibold">CAD {data.bid.toFixed(2)}</span></p>
          <p className={`mt-1 font-medium ${data.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            Change: {data.change > 0 ? '+' : ''}CAD {data.change.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Bid Adjustment History</h3>
            <p className="text-sm text-gray-500 mt-1">{campaignName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No bid adjustment history available
            </div>
          ) : (
            <>
              {/* Chart */}
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      label={{ value: 'Bid Amount (CAD)', angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                      domain={['dataMin - 1', 'dataMax + 1']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="bid"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Bid Amount"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Old Bid
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          New Bid
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Change
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Spend Since Previous
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedAdjustments.map((adj, index) => {
                        // Calculate spend delta between this adjustment and previous one
                        const previousAdj = index > 0 ? sortedAdjustments[index - 1] : null;
                        const spendDelta = previousAdj
                          ? adj.spendSinceOct1AtAdjustment - previousAdj.spendSinceOct1AtAdjustment
                          : adj.spendSinceOct1AtAdjustment; // First adjustment shows total spend since Oct 1

                        return (
                          <tr key={adj.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {new Date(adj.adjustmentTimestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              CAD {adj.oldBid.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                              CAD {adj.newBid.toFixed(2)}
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                              adj.bidAdjustmentAmount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {adj.bidAdjustmentAmount > 0 ? '+' : ''}CAD {adj.bidAdjustmentAmount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              CAD {spendDelta.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="mt-4 grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Total Adjustments</p>
                  <p className="text-lg font-semibold text-gray-900">{sortedAdjustments.length}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Current Bid</p>
                  <p className="text-lg font-semibold text-gray-900">
                    CAD {sortedAdjustments[sortedAdjustments.length - 1].newBid.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Net Change</p>
                  <p className={`text-lg font-semibold ${
                    sortedAdjustments[sortedAdjustments.length - 1].newBid - sortedAdjustments[0].oldBid > 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {sortedAdjustments[sortedAdjustments.length - 1].newBid - sortedAdjustments[0].oldBid > 0 ? '+' : ''}
                    CAD {(sortedAdjustments[sortedAdjustments.length - 1].newBid - sortedAdjustments[0].oldBid).toFixed(2)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
