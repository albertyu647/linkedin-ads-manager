import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('linkedin_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { urns } = body;
    
    if (!urns || !Array.isArray(urns) || urns.length === 0) {
      return NextResponse.json({ error: 'URNs array is required' }, { status: 400 });
    }
    
    console.log(`[Resolve Names API] Resolving ${urns.length} entity names`);
    
    const api = new LinkedInAPI(accessToken);
    
    // Use the public resolveEntityNamesAPI method (we'll create this)
    const resolvedEntities = await api.resolveEntityNamesAPI(urns);
    
    return NextResponse.json({
      success: true,
      entities: resolvedEntities
    });
  } catch (error) {
    console.error('Error resolving entity names:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
