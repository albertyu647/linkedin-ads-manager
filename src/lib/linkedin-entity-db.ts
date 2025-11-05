/**
 * LinkedIn Entity Database Module (Serverless Stub)
 * 
 * This is a stub implementation that maintains the API interface but doesn't use SQLite.
 * All operations will fallback to using the LinkedIn API directly or client-side localStorage.
 */

import { TargetingEntity } from '@/types/linkedin';

export interface TargetingFacet {
  urn: string;
  name: string;
  entityTypes: string[];
  availableEntityFinders: string[];
}

export interface LinkedInTargetingFacetResponse {
  adTargetingFacetUrn: string;
  facetName: string;
  entityTypes: string[];
  availableEntityFinders: string[];
}

export interface CachedEntity {
  urn: string;
  facetUrn: string;
  name: string;
  entityType: string;
  locale: string;
  updatedAt: string;
}

export interface EntityCacheStats {
  totalEntities: number;
  entitiesByFacet: Record<string, number>;
  oldestUpdate: string | null;
  newestUpdate: string | null;
}

export interface BidAdjustmentHistory {
  id?: number;
  campaignId: string;
  adjustmentTimestamp: string;
  bidAdjustmentAmount: number;
  oldBid: number;
  newBid: number;
  spentAtAdjustment: number;
  spendSinceOct1AtAdjustment: number;
  accountId: string;
  createdAt: string;
}

class LinkedInEntityDB {
  private readonly CACHE_TTL_DAYS = 30;

  constructor(_dbPath?: string) {
    console.log('[EntityDB] Using serverless stub - no database will be used');
  }

  /**
   * Bootstrap the entire entity database - STUB (does nothing)
   */
  async bootstrapDatabase(_accessToken: string): Promise<void> {
    console.log('[EntityDB] Bootstrap skipped in serverless mode');
  }

  /**
   * Search entities by facet and query - STUB (returns empty array)
   */
  async searchEntities(_facetUrn: string, _query: string, _limit = 50): Promise<TargetingEntity[]> {
    console.log('[EntityDB] Search skipped - use LinkedIn API directly');
    return [];
  }

  /**
   * Get entities by URNs - STUB (returns empty object)
   */
  async getEntitiesByUrns(_urns: string[]): Promise<Record<string, TargetingEntity>> {
    console.log('[EntityDB] Entity lookup skipped - use LinkedIn API directly');
    return {};
  }

  /**
   * Get all entities for a specific facet - STUB (returns empty array)
   */
  async getEntitiesForFacet(_facetUrn: string): Promise<TargetingEntity[]> {
    console.log('[EntityDB] Facet lookup skipped - use LinkedIn API directly');
    return [];
  }

  /**
   * Get database statistics - STUB (returns empty stats)
   */
  async getDatabaseStats(): Promise<EntityCacheStats> {
    return {
      totalEntities: 0,
      entitiesByFacet: {},
      oldestUpdate: null,
      newestUpdate: null
    };
  }

  /**
   * Check if database needs refresh - STUB (always returns true)
   */
  async needsRefresh(): Promise<boolean> {
    return true;
  }

  /**
   * Record a bid adjustment - STUB (does nothing, use client-side storage instead)
   */
  async recordBidAdjustment(_adjustment: Omit<BidAdjustmentHistory, 'id' | 'createdAt'>): Promise<void> {
    console.log('[EntityDB] Bid adjustment recording skipped - use client-side localStorage');
  }

  /**
   * Get the latest bid adjustment for a campaign - STUB (returns null)
   */
  async getLatestBidAdjustment(_campaignId: string): Promise<BidAdjustmentHistory | null> {
    console.log('[EntityDB] Bid adjustment lookup skipped - use client-side localStorage');
    return null;
  }

  /**
   * Get all bid adjustments for a campaign - STUB (returns empty array)
   */
  async getBidAdjustmentHistory(_campaignId: string): Promise<BidAdjustmentHistory[]> {
    console.log('[EntityDB] Bid adjustment history skipped - use client-side localStorage');
    return [];
  }

  /**
   * Batch insert bid adjustments - STUB (does nothing)
   */
  async batchInsertBidAdjustments(_adjustments: Omit<BidAdjustmentHistory, 'id' | 'createdAt'>[]): Promise<void> {
    console.log('[EntityDB] Batch insert skipped - use client-side localStorage');
  }

  /**
   * Close database connection - STUB (does nothing)
   */
  async close(): Promise<void> {
    console.log('[EntityDB] No database to close');
  }
}

// Export singleton instance
export const linkedInEntityDB = new LinkedInEntityDB();
export default linkedInEntityDB;
