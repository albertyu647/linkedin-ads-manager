import { NextRequest, NextResponse } from 'next/server';
import { LinkedInAPI } from '@/lib/linkedin-api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  const storedState = request.cookies.get('linkedin_oauth_state')?.value;
  
  if (error) {
    return NextResponse.redirect(`${request.nextUrl.origin}?error=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${request.nextUrl.origin}?error=invalid_request`);
  }
  
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = `${request.nextUrl.origin}/api/auth/linkedin/callback`;
  
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${request.nextUrl.origin}?error=server_configuration`);
  }
  
  try {
    const tokenData = await LinkedInAPI.exchangeCodeForToken(
      code,
      clientId,
      clientSecret,
      redirectUri
    );
    
    // Create response and set access token cookie
    const response = NextResponse.redirect(`${request.nextUrl.origin}/dashboard`);
    
    response.cookies.set('linkedin_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in
    });
    
    // Clear the state cookie
    response.cookies.delete('linkedin_oauth_state');
    
    return response;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return NextResponse.redirect(`${request.nextUrl.origin}?error=token_exchange_failed`);
  }
} 