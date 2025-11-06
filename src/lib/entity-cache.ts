/**
 * Client-side Entity Name Cache
 * 
 * Caches resolved LinkedIn entity names in localStorage to avoid repeated API calls
 */

import { TargetingEntity } from '@/types/linkedin';

const CACHE_KEY = 'linkedin_entity_cache';
const CACHE_VERSION = 'v1';
const CACHE_TTL_DAYS = 7;

interface CacheEntry {
  entity: TargetingEntity;
  timestamp: number;
}

interface EntityCache {
  version: string;
  entries: Record<string, CacheEntry>;
}

export class EntityNameCache {
  private cache: EntityCache;

  constructor() {
    this.cache = this.loadCache();
  }

  private loadCache(): EntityCache {
    if (typeof window === 'undefined') {
      // Server-side, return empty cache
      return { version: CACHE_VERSION, entries: {} };
    }

    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) {
        return { version: CACHE_VERSION, entries: {} };
      }

      const parsed = JSON.parse(stored) as EntityCache;
      
      // Check version match
      if (parsed.version !== CACHE_VERSION) {
        console.log('[EntityCache] Version mismatch, clearing cache');
        return { version: CACHE_VERSION, entries: {} };
      }

      // Remove expired entries
      const now = Date.now();
      const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
      const validEntries: Record<string, CacheEntry> = {};
      
      let removedCount = 0;
      for (const [urn, entry] of Object.entries(parsed.entries)) {
        if (now - entry.timestamp < ttlMs) {
          validEntries[urn] = entry;
        } else {
          removedCount++;
        }
      }

      if (removedCount > 0) {
        console.log(`[EntityCache] Removed ${removedCount} expired entries`);
      }

      return { version: CACHE_VERSION, entries: validEntries };
    } catch (error) {
      console.error('[EntityCache] Error loading cache:', error);
      return { version: CACHE_VERSION, entries: {} };
    }
  }

  private saveCache(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('[EntityCache] Error saving cache:', error);
    }
  }

  /**
   * Get cached entity by URN
   */
  get(urn: string): TargetingEntity | null {
    const entry = this.cache.entries[urn];
    if (!entry) return null;

    // Check if expired
    const now = Date.now();
    const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    if (now - entry.timestamp >= ttlMs) {
      delete this.cache.entries[urn];
      this.saveCache();
      return null;
    }

    return entry.entity;
  }

  /**
   * Get multiple cached entities by URNs
   */
  getMany(urns: string[]): Record<string, TargetingEntity> {
    const result: Record<string, TargetingEntity> = {};
    
    for (const urn of urns) {
      const entity = this.get(urn);
      if (entity) {
        result[urn] = entity;
      }
    }

    return result;
  }

  /**
   * Set cached entity
   */
  set(urn: string, entity: TargetingEntity): void {
    this.cache.entries[urn] = {
      entity,
      timestamp: Date.now()
    };
    this.saveCache();
  }

  /**
   * Set multiple cached entities
   */
  setMany(entities: Record<string, TargetingEntity>): void {
    const timestamp = Date.now();
    
    for (const [urn, entity] of Object.entries(entities)) {
      this.cache.entries[urn] = { entity, timestamp };
    }

    this.saveCache();
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache = { version: CACHE_VERSION, entries: {} };
    this.saveCache();
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; oldestEntry: number | null } {
    const entries = Object.values(this.cache.entries);
    
    if (entries.length === 0) {
      return { totalEntries: 0, oldestEntry: null };
    }

    const oldestEntry = Math.min(...entries.map(e => e.timestamp));
    
    return {
      totalEntries: entries.length,
      oldestEntry
    };
  }
}

// Export singleton instance
export const entityCache = new EntityNameCache();
export default entityCache;
