import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('linkedin_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { campaignIds, excludedTargeting, targetingUpdate, accountId } = body;
    
    if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
      return NextResponse.json({ error: 'Campaign IDs are required' }, { status: 400 });
    }
    
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }
    
    console.log(`[Batch Update API] Processing ${campaignIds.length} campaigns`);
    console.log('[Targeting Update]', targetingUpdate || excludedTargeting);
    
    const api = new LinkedInAPI(accessToken);
    
    // Support both new and legacy API formats
    const updatePayload = targetingUpdate || { excludedTargeting };
    const result = await api.batchUpdateCampaigns(campaignIds, updatePayload, accountId);
    
    return NextResponse.json({
      success: result.failed.length === 0,
      successful: result.successful,
      failed: result.failed,
      message: `Successfully updated ${result.successful.length} campaigns. ${result.failed.length} failed.`
    });
  } catch (error) {
    console.error('Error in batch update:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 