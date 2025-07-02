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
    
    // Get spend data from LinkedIn API using the dedicated method
    const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    
    const spendData = await linkedInAPI.fetchCampaignSpendData(campaignIds, accountId, defaultStartDate, defaultEndDate);

    console.log('[Spend API] Raw spend data from LinkedIn API:', spendData);

    // Return the spend data directly as numbers (dashboard expects spendData[campaignId] to be a number)
    return NextResponse.json({ spendData });
  } catch (error) {
    console.error('Error fetching campaign spend data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spend data' },
      { status: 500 }
    );
  }
} 