import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function GET(request: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = `${request.nextUrl.origin}/api/auth/linkedin/callback`;
  
  if (!clientId) {
    return NextResponse.json({ error: 'LinkedIn client ID not configured' }, { status: 500 });
  }

  // Generate a random state parameter for security
  const state = Math.random().toString(36).substring(2, 15);
  
  // Store state in a secure way (in production, use a more secure method)
  const response = NextResponse.redirect(
    LinkedInAPI.getAuthUrl(clientId, redirectUri, state)
  );
  
  // Set state cookie for verification
  response.cookies.set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600 // 10 minutes
  });
  
  return response;
} 