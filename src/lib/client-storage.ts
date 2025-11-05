/**
 * Client-Side Storage Utilities
 * Uses localStorage for persistent storage across sessions
 */

export interface BidAdjustmentHistory {
  id: string;
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

export interface EntityCacheEntry {
  urn: string;
  name: string;
  facetUrn?: string;
  entityType?: string;
  locale?: string;
  updatedAt: string;
}

const BID_HISTORY_KEY = 'linkedin_bid_history';
const ENTITY_CACHE_KEY = 'linkedin_entity_cache';
const CACHE_TTL_DAYS = 30;

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Bid Adjustment History Functions
 */
export const BidHistory = {
  /**
   * Record a new bid adjustment
   */
  record(adjustment: Omit<BidAdjustmentHistory, 'id' | 'createdAt' | 'adjustmentTimestamp'>): void {
    if (!isBrowser()) return;

    const history = this.getAll();
    const now = new Date().toISOString();
    const newAdjustment: BidAdjustmentHistory = {
      ...adjustment,
      id: `${adjustment.campaignId}_${Date.now()}`,
      adjustmentTimestamp: now,
      createdAt: now
    };

    history.push(newAdjustment);
    localStorage.setItem(BID_HISTORY_KEY, JSON.stringify(history));
  },

  /**
   * Get all bid adjustments
   */
  getAll(): BidAdjustmentHistory[] {
    if (!isBrowser()) return [];

    try {
      const data = localStorage.getItem(BID_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading bid history from localStorage:', error);
      return [];
    }
  },

  /**
   * Get bid adjustments for a specific campaign
   */
  getByCampaign(campaignId: string): BidAdjustmentHistory[] {
    const history = this.getAll();
    return history
      .filter(adj => adj.campaignId === campaignId)
      .sort((a, b) => new Date(b.adjustmentTimestamp).getTime() - new Date(a.adjustmentTimestamp).getTime());
  },

  /**
   * Get the latest bid adjustment for a campaign
   */
  getLatest(campaignId: string): BidAdjustmentHistory | null {
    const history = this.getByCampaign(campaignId);
    return history.length > 0 ? history[0] : null;
  },

  /**
   * Clear all bid history
   */
  clear(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(BID_HISTORY_KEY);
  },

  /**
   * Export bid history as JSON
   */
  export(): string {
    return JSON.stringify(this.getAll(), null, 2);
  },

  /**
   * Import bid history from JSON
   */
  import(jsonData: string): void {
    if (!isBrowser()) return;

    try {
      const imported = JSON.parse(jsonData);
      if (Array.isArray(imported)) {
        localStorage.setItem(BID_HISTORY_KEY, JSON.stringify(imported));
      }
    } catch (error) {
      console.error('Error importing bid history:', error);
      throw new Error('Invalid JSON data');
    }
  }
};

/**
 * Entity Cache Functions
 */
export const EntityCache = {
  /**
   * Save entities to cache
   */
  saveEntities(entities: EntityCacheEntry[]): void {
    if (!isBrowser()) return;

    const cache = this.getAll();
    const now = new Date().toISOString();

    // Update or add entities
    entities.forEach(entity => {
      const existing = cache.find(e => e.urn === entity.urn);
      if (existing) {
        Object.assign(existing, { ...entity, updatedAt: now });
      } else {
        cache.push({ ...entity, updatedAt: now });
      }
    });

    localStorage.setItem(ENTITY_CACHE_KEY, JSON.stringify(cache));
  },

  /**
   * Get all cached entities
   */
  getAll(): EntityCacheEntry[] {
    if (!isBrowser()) return [];

    try {
      const data = localStorage.getItem(ENTITY_CACHE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading entity cache from localStorage:', error);
      return [];
    }
  },

  /**
   * Get entities by URNs
   */
  getByUrns(urns: string[]): Record<string, EntityCacheEntry> {
    const cache = this.getAll();
    const result: Record<string, EntityCacheEntry> = {};

    urns.forEach(urn => {
      const entity = cache.find(e => e.urn === urn);
      if (entity) {
        result[urn] = entity;
      }
    });

    return result;
  },

  /**
   * Search entities by facet and query
   */
  search(facetUrn: string, query: string, limit = 50): EntityCacheEntry[] {
    const cache = this.getAll();
    const lowerQuery = query.toLowerCase();

    return cache
      .filter(e => 
        (!facetUrn || e.facetUrn === facetUrn) &&
        e.name.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        // Prioritize exact matches at the start
        const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        // Then sort by length and name
        if (a.name.length !== b.name.length) {
          return a.name.length - b.name.length;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);
  },

  /**
   * Check if cache needs refresh
   */
  needsRefresh(): boolean {
    const cache = this.getAll();
    
    if (cache.length === 0) {
      return true;
    }

    // Find oldest entry
    const oldest = cache.reduce((oldest, entity) => {
      const entityDate = new Date(entity.updatedAt);
      return entityDate < oldest ? entityDate : oldest;
    }, new Date(cache[0].updatedAt));

    const daysSinceUpdate = (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > CACHE_TTL_DAYS;
  },

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntities: number;
    oldestUpdate: string | null;
    newestUpdate: string | null;
  } {
    const cache = this.getAll();
    
    if (cache.length === 0) {
      return {
        totalEntities: 0,
        oldestUpdate: null,
        newestUpdate: null
      };
    }

    const dates = cache.map(e => new Date(e.updatedAt));
    const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
    const newest = new Date(Math.max(...dates.map(d => d.getTime())));

    return {
      totalEntities: cache.length,
      oldestUpdate: oldest.toISOString(),
      newestUpdate: newest.toISOString()
    };
  },

  /**
   * Clear entity cache
   */
  clear(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ENTITY_CACHE_KEY);
  }
};
