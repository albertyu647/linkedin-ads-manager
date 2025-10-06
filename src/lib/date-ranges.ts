export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export function getPredefinedDateRanges(): DateRange[] {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return [
    {
      start: todayStr,
      end: todayStr,
      label: 'Today'
    },
    {
      start: yesterdayStr,
      end: yesterdayStr,
      label: 'Yesterday'
    },
    {
      start: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: todayStr,
      label: 'Last 7 days'
    },
    {
      start: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: todayStr,
      label: 'Last 30 days'
    },
    {
      start: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: todayStr,
      label: 'Last 90 days'
    },
    {
      start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
      end: todayStr,
      label: 'This month'
    },
    {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0],
      end: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0],
      label: 'Last month'
    }
  ];
}

export function getDefaultDateRange(): DateRange {
  const ranges = getPredefinedDateRanges();
  return ranges.find(range => range.label === 'Last 7 days') || ranges[1];
}
