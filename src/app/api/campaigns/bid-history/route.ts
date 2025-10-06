import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import linkedInEntityDB, { BidAdjustmentHistory } from '@/lib/linkedin-entity-db';

/**
 * GET - Get latest bid adjustment for a campaign or all adjustments
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('linkedin_access_token');

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get('campaignId');
    const getAll = searchParams.get('all') === 'true';

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    if (getAll) {
      const history = await linkedInEntityDB.getBidAdjustmentHistory(campaignId);
      return NextResponse.json({ history });
    } else {
      const latest = await linkedInEntityDB.getLatestBidAdjustment(campaignId);
      return NextResponse.json({ adjustment: latest });
    }
  } catch (error: any) {
    console.error('[BidHistory API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bid history' },
      { status: 500 }
    );
  }
}

/**
 * POST - Record a new bid adjustment
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('linkedin_access_token');

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { campaignId, bidAdjustmentAmount, oldBid, newBid, spentAtAdjustment, spendSinceOct1AtAdjustment, accountId } = body;

    if (!campaignId || bidAdjustmentAmount === undefined || !oldBid || !newBid || spentAtAdjustment === undefined || spendSinceOct1AtAdjustment === undefined || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: campaignId, bidAdjustmentAmount, oldBid, newBid, spentAtAdjustment, spendSinceOct1AtAdjustment, accountId' },
        { status: 400 }
      );
    }

    const adjustment: Omit<BidAdjustmentHistory, 'id' | 'createdAt'> = {
      campaignId,
      adjustmentTimestamp: new Date().toISOString(),
      bidAdjustmentAmount,
      oldBid,
      newBid,
      spentAtAdjustment,
      spendSinceOct1AtAdjustment,
      accountId
    };

    await linkedInEntityDB.recordBidAdjustment(adjustment);

    return NextResponse.json({ 
      success: true,
      message: 'Bid adjustment recorded successfully'
    });
  } catch (error: any) {
    console.error('[BidHistory API] Error recording adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record bid adjustment' },
      { status: 500 }
    );
  }
}
