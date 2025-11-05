import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import linkedInEntityDB from '@/lib/linkedin-entity-db';

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('linkedin_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'LinkedIn access token not found' },
        { status: 401 }
      );
    }

    console.log('[Bootstrap API] Starting LinkedIn entities database bootstrap...');

    // Bootstrap the database
    await linkedInEntityDB.bootstrapDatabase(accessToken);

    // Get final stats
    const stats = await linkedInEntityDB.getDatabaseStats();

    console.log('[Bootstrap API] Bootstrap completed successfully');

    return NextResponse.json({
      success: true,
      message: 'LinkedIn entities database bootstrapped successfully',
      stats
    });

  } catch (error) {
    console.error('[Bootstrap API] Error bootstrapping database:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to bootstrap LinkedIn entities database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Get database stats
    const stats = await linkedInEntityDB.getDatabaseStats();
    const needsRefresh = await linkedInEntityDB.needsRefresh();

    return NextResponse.json({
      success: true,
      stats,
      needsRefresh,
      message: `Database contains ${stats.totalEntities} entities across ${Object.keys(stats.entitiesByFacet).length} facets`
    });

  } catch (error) {
    console.error('[Bootstrap API] Error getting database stats:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get database stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
