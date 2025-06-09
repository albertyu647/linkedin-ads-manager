import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('linkedin_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get('accountId');
  const activeOnly = searchParams.get('activeOnly') === 'true';
  const searchQuery = searchParams.get('search') || '';
  
  if (!accountId) {
    return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
  }
  
  try {
    const api = new LinkedInAPI(accessToken);
    const campaigns = await api.getCampaigns(accountId, {
      activeOnly,
      searchQuery,
      getAllPages: true
    });
    
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' }, 
      { status: 500 }
    );
  }
} 