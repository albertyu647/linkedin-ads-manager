import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('linkedin_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const api = new LinkedInAPI(accessToken);
    const accounts = await api.getAdAccounts();
    
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' }, 
      { status: 500 }
    );
  }
} 