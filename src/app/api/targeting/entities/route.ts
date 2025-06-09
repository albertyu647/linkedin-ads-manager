import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('linkedin_access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const facetUrn = searchParams.get('facetUrn');
  const query = searchParams.get('query');
  
  if (!facetUrn) {
    return NextResponse.json({ error: 'Facet URN is required' }, { status: 400 });
  }
  
  try {
    const api = new LinkedInAPI(accessToken);
    const entities = await api.getTargetingEntities(facetUrn, query || undefined);
    
    return NextResponse.json({ entities });
  } catch (error) {
    console.error('Error fetching targeting entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch targeting entities' }, 
      { status: 500 }
    );
  }
} 