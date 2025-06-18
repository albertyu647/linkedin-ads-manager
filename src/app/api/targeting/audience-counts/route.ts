import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('linkedin_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { targetingCriteria, accountId } = body;
    
    if (!targetingCriteria || !accountId) {
      return NextResponse.json({ error: 'Targeting criteria and account ID are required' }, { status: 400 });
    }
    
    console.log(`[Audience Counts API] Processing targeting criteria for account ${accountId}`);
    
    const api = new LinkedInAPI(accessToken);
    
    // Get audience counts for the targeting criteria
    const audienceCount = await api.getAudienceCounts(targetingCriteria, accountId);
    
    return NextResponse.json({
      success: true,
      audienceCount,
      isValid: audienceCount >= 300 // LinkedIn's minimum audience threshold
    });
  } catch (error) {
    console.error('Error in audience counts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 