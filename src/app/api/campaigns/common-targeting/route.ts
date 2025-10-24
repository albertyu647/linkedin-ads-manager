import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('linkedin_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { campaignIds, accountId } = body;
    
    if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
      return NextResponse.json({ error: 'Campaign IDs are required' }, { status: 400 });
    }
    
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }
    
    console.log(`[Common Targeting API] Processing ${campaignIds.length} campaigns`);
    
    const api = new LinkedInAPI(accessToken);
    
    // Fetch targeting criteria for all selected campaigns
    const result = await api.getCommonTargeting(campaignIds, accountId);
    
    return NextResponse.json({
      success: true,
      commonTargeting: {
        commonIncludes: result.commonIncludes,
        commonExcludes: result.commonExcludes,
        perCampaignIncludes: result.perCampaignIncludes,
        perCampaignExcludes: result.perCampaignExcludes,
        allCampaignIds: result.allCampaignIds
      }
    });
  } catch (error) {
    console.error('Error in common targeting:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
