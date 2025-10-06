import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

const BASELINE_DATE = '2025-10-01';

/**
 * GET - Fetch spend since Oct 1, 2025 for specified campaigns
 * This provides a consistent baseline for tracking bid effectiveness
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    const campaignIds = searchParams.get('campaignIds')?.split(',') || [];

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
    
    // Use the same method as the working spend API, but with Oct 1 as start date
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`[SpendSinceOct1 API] Fetching spend from ${BASELINE_DATE} to ${today} for ${campaignIds.length} campaigns`);
    
    // Only fetch spend for Oct 1 baseline (impressions/clicks/leads come from regular date range)
    const spendData = await linkedInAPI.fetchCampaignSpendData(campaignIds, accountId, BASELINE_DATE, today);

    console.log('[SpendSinceOct1 API] Spend data fetched successfully:', spendData);

    // Return only spend data for Oct 1 baseline
    return NextResponse.json({
      spendData,
      baselineDate: BASELINE_DATE,
      endDate: today
    });
  } catch (error) {
    console.error('Error fetching Oct 1 spend data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Oct 1 spend data' },
      { status: 500 }
    );
  }
}
