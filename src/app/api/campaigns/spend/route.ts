import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    const campaignIds = searchParams.get('campaignIds')?.split(',') || [];
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    if (campaignIds.length === 0) {
      return NextResponse.json({ error: 'At least one campaign ID is required' }, { status: 400 });
    }

    const accessToken = req.cookies.get('linkedin_access_token')?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const linkedInAPI = new LinkedInAPI(accessToken);
    
    // Get analytics data from LinkedIn API (spend, impressions, clicks, leads)
    const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    
    const analyticsData = await linkedInAPI.fetchCampaignAnalyticsData(campaignIds, accountId, defaultStartDate, defaultEndDate);

    console.log('[Spend API] Analytics data from LinkedIn API:', analyticsData);

    // Return all analytics data
    return NextResponse.json({
      spendData: analyticsData.spend,
      impressionsData: analyticsData.impressions,
      clicksData: analyticsData.clicks,
      leadsData: analyticsData.leads
    });
  } catch (error) {
    console.error('Error fetching campaign analytics data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
