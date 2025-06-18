/**
 * LinkedIn Entity Database Module
 * 
 * Maintains a local SQLite database that caches ALL LinkedIn targeting entities
 * to avoid hitting LinkedIn API repeatedly for the same data.
 * 
 * This module downloads and stores:
 * - Job titles, seniorities, industries, companies, skills
 * - Schools, degrees, fields of study, locations
 * - Age ranges, genders, company sizes, experience levels
 * - Member behaviors, interests, groups, and more
 */

import sqlite3 from 'sqlite3';
import path from 'path';
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

class LinkedInEntityDB {
  private db: sqlite3.Database | null = null;
  private readonly dbPath: string;
  private readonly CACHE_TTL_DAYS = 30;
  private readonly MAX_RPS = 10;
  private readonly API_VERSION = '202506';
  
  // All LinkedIn targeting facets to cache
  private readonly ALL_FACETS = [
    'urn:li:adTargetingFacet:industries',
    'urn:li:adTargetingFacet:jobFunctions', 
    'urn:li:adTargetingFacet:seniorities',
    'urn:li:adTargetingFacet:titles',
    'urn:li:adTargetingFacet:titlesPast',
    'urn:li:adTargetingFacet:titlesAll',
    'urn:li:adTargetingFacet:employers',
    'urn:li:adTargetingFacet:employersPast',
    'urn:li:adTargetingFacet:employersAll',
    'urn:li:adTargetingFacet:skills',
    'urn:li:adTargetingFacet:schools',
    'urn:li:adTargetingFacet:degrees',
    'urn:li:adTargetingFacet:fieldsOfStudy',
    'urn:li:adTargetingFacet:ageRanges',
    'urn:li:adTargetingFacet:genders',
    'urn:li:adTargetingFacet:staffCountRanges',
    'urn:li:adTargetingFacet:yearsOfExperienceRanges',
    'urn:li:adTargetingFacet:interfaceLocales',
    'urn:li:adTargetingFacet:interests',
    'urn:li:adTargetingFacet:memberBehaviors',
    'urn:li:adTargetingFacet:companyCategory',
    'urn:li:adTargetingFacet:growthRate',
    'urn:li:adTargetingFacet:followedCompanies',
    'urn:li:adTargetingFacet:firstDegreeConnectionCompanies'
  ];

  // Rate limiting
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000 / this.MAX_RPS;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'linkedin-entities.db');
    this.initializeDatabase();
  }

  /**
   * Initialize SQLite database and create tables
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('[EntityDB] Error opening database:', err);
          reject(err);
          return;
        }

        console.log(`[EntityDB] Connected to SQLite database at ${this.dbPath}`);

        // Create tables
        this.db!.serialize(() => {
          // Targeting facets table
          this.db!.run(`
            CREATE TABLE IF NOT EXISTS targeting_facets (
              urn TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              entity_types TEXT NOT NULL,
              available_finders TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
          `);

          // Targeting entities table
          this.db!.run(`
            CREATE TABLE IF NOT EXISTS targeting_entities (
              urn TEXT PRIMARY KEY,
              facet_urn TEXT NOT NULL,
              name TEXT NOT NULL,
              entity_type TEXT,
              locale TEXT NOT NULL DEFAULT 'en_US',
              updated_at TEXT NOT NULL,
              FOREIGN KEY (facet_urn) REFERENCES targeting_facets (urn)
            )
          `);

          // Create indexes for better performance
          this.db!.run(`
            CREATE INDEX IF NOT EXISTS idx_entities_facet_urn ON targeting_entities (facet_urn)
          `);

          this.db!.run(`
            CREATE INDEX IF NOT EXISTS idx_entities_updated_at ON targeting_entities (updated_at)
          `);

          this.db!.run(`
            CREATE INDEX IF NOT EXISTS idx_entities_name ON targeting_entities (name)
          `);

          console.log('[EntityDB] Database initialized successfully');
          resolve();
        });
      });
    });
  }

  /**
   * Bootstrap the entire entity database from LinkedIn API
   */
  async bootstrapDatabase(accessToken: string): Promise<void> {
    console.log('[EntityDB] Starting database bootstrap...');
    
    try {
      // Step 1: Get all targeting facets
      const facets = await this.fetchAllTargetingFacets(accessToken);
      console.log(`[EntityDB] Found ${facets.length} targeting facets`);

      // Step 2: Save facets to database
      await this.saveFacetsToDatabase(facets);

      // Step 3: Download entities for each facet
      let totalEntities = 0;
      for (const facet of facets) {
        // Only download entities for facets that support AD_TARGETING_FACET finder
        if (facet.availableEntityFinders && facet.availableEntityFinders.includes('AD_TARGETING_FACET')) {
          console.log(`[EntityDB] Downloading entities for ${facet.name || facet.urn}...`);
          
          try {
            const entities = await this.fetchEntitiesForFacet(facet, accessToken);
            await this.saveEntitiesToDatabase(entities, facet.urn);
            totalEntities += entities.length;
            
            console.log(`[EntityDB] Saved ${entities.length} entities for ${facet.name || facet.urn}`);
          } catch (error) {
            console.error(`[EntityDB] Error downloading entities for ${facet.name || facet.urn}:`, error);
            // Continue with other facets even if one fails
            continue;
          }
        } else {
          console.log(`[EntityDB] Skipping ${facet.name || facet.urn} - no AD_TARGETING_FACET finder available`);
        }
      }

      console.log(`[EntityDB] Bootstrap complete! Total entities cached: ${totalEntities}`);
      
    } catch (error) {
      console.error('[EntityDB] Bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Fetch all targeting facets from LinkedIn API
   */
  private async fetchAllTargetingFacets(accessToken: string): Promise<TargetingFacet[]> {
    await this.rateLimitDelay();

    const response = await fetch('https://api.linkedin.com/rest/adTargetingFacets', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': this.API_VERSION
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch targeting facets: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    const linkedInFacets: LinkedInTargetingFacetResponse[] = data.elements || [];
    
    // Map LinkedIn API response to our internal interface
    const facets: TargetingFacet[] = linkedInFacets.map(facet => ({
      urn: facet.adTargetingFacetUrn,
      name: facet.facetName,
      entityTypes: facet.entityTypes || [],
      availableEntityFinders: facet.availableEntityFinders || []
    }));
    
    return facets;
  }

  /**
   * Fetch entities for a specific targeting facet
   */
  private async fetchEntitiesForFacet(facet: TargetingFacet, accessToken: string): Promise<CachedEntity[]> {
    const entities: CachedEntity[] = [];
    const now = new Date().toISOString();

    // Use adTargetingFacet finder if available, otherwise use typeahead with empty query
    const useAdTargetingFacet = facet.availableEntityFinders.includes('AD_TARGETING_FACET');
    
    if (useAdTargetingFacet) {
      // Get all entities for this facet
      await this.rateLimitDelay();
      
      const encodedFacetUrn = encodeURIComponent(facet.urn);
      const url = `https://api.linkedin.com/rest/adTargetingEntities?q=adTargetingFacet&facet=${encodedFacetUrn}&queryVersion=QUERY_USES_URNS&locale=(language:en,country:US)`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': this.API_VERSION
        }
      });

      if (response.ok) {
        const data = await response.json();
        const elements = data.elements || [];
        console.log(`[EntityDB] Found ${elements.length} entities for ${facet.name || facet.urn}`);
        
        for (const element of elements) {
          entities.push({
            urn: element.urn,
            facetUrn: facet.urn,
            name: element.name || 'Unknown',
            entityType: this.getEntityTypeFromUrn(element.urn),
            locale: 'en_US',
            updatedAt: now
          });
        }
      }
    } else if (facet.availableEntityFinders.includes('TYPEAHEAD')) {
      // For typeahead-only facets, we can't get all entities easily
      // We'll skip these for now and only cache them as they're searched
      console.log(`[EntityDB] Skipping ${facet.name} - typeahead only facet`);
    }

    return entities;
  }

  /**
   * Save targeting facets to database
   */
  private async saveFacetsToDatabase(facets: TargetingFacet[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO targeting_facets 
        (urn, name, entity_types, available_finders, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();

      for (const facet of facets) {
        stmt.run(
          facet.urn,
          facet.name || facet.urn || 'Unknown',
          JSON.stringify(facet.entityTypes || []),
          JSON.stringify(facet.availableEntityFinders || []),
          now
        );
      }

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Save targeting entities to database
   */
  private async saveEntitiesToDatabase(entities: CachedEntity[], facetUrn: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO targeting_entities 
        (urn, facet_urn, name, entity_type, locale, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const entity of entities) {
        stmt.run(
          entity.urn,
          entity.facetUrn,
          entity.name || entity.urn || 'Unknown',
          entity.entityType || 'unknown',
          entity.locale || 'en_US',
          entity.updatedAt
        );
      }

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Search entities by facet and query
   */
  async searchEntities(facetUrn: string, query: string, limit = 50): Promise<TargetingEntity[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT urn, name, entity_type as entityType
        FROM targeting_entities 
        WHERE facet_urn = ? 
        AND name LIKE ? 
        ORDER BY 
          CASE WHEN name LIKE ? THEN 1 ELSE 2 END,
          LENGTH(name),
          name 
        LIMIT ?
      `;

      const searchTerm = `%${query}%`;
      const exactMatch = `${query}%`;

      this.db.all(sql, [facetUrn, searchTerm, exactMatch, limit], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const entities: TargetingEntity[] = rows.map(row => ({
          urn: row.urn,
          name: row.name,
          id: row.urn.split(':').pop() || row.urn
        }));

        resolve(entities);
      });
    });
  }

  /**
   * Get entities by URNs
   */
  async getEntitiesByUrns(urns: string[]): Promise<Record<string, TargetingEntity>> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      if (urns.length === 0) {
        resolve({});
        return;
      }

      const placeholders = urns.map(() => '?').join(',');
      const sql = `
        SELECT urn, name
        FROM targeting_entities 
        WHERE urn IN (${placeholders})
      `;

      this.db.all(sql, urns, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const entities: Record<string, TargetingEntity> = {};
        for (const row of rows) {
          entities[row.urn] = {
            urn: row.urn,
            name: row.name,
            id: row.urn.split(':').pop() || row.urn
          };
        }

        resolve(entities);
      });
    });
  }

  /**
   * Get all entities for a specific facet
   */
  async getEntitiesForFacet(facetUrn: string): Promise<TargetingEntity[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT urn, name
        FROM targeting_entities 
        WHERE facet_urn = ?
        ORDER BY name
      `;

      this.db.all(sql, [facetUrn], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const entities: TargetingEntity[] = rows.map(row => ({
          urn: row.urn,
          name: row.name,
          id: row.urn.split(':').pop() || row.urn
        }));

        resolve(entities);
      });
    });
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<EntityCacheStats> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Get total count
      this.db.get('SELECT COUNT(*) as total FROM targeting_entities', (err, totalRow: any) => {
        if (err) {
          reject(err);
          return;
        }

        // Get counts by facet
        this.db!.all(`
          SELECT facet_urn, COUNT(*) as count
          FROM targeting_entities 
          GROUP BY facet_urn
        `, (err, facetRows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          // Get oldest and newest updates
          this.db!.get(`
            SELECT 
              MIN(updated_at) as oldest,
              MAX(updated_at) as newest
            FROM targeting_entities
          `, (err, dateRow: any) => {
            if (err) {
              reject(err);
              return;
            }

            const entitiesByFacet: Record<string, number> = {};
            for (const row of facetRows) {
              entitiesByFacet[row.facet_urn] = row.count;
            }

            resolve({
              totalEntities: totalRow.total,
              entitiesByFacet,
              oldestUpdate: dateRow.oldest,
              newestUpdate: dateRow.newest
            });
          });
        });
      });
    });
  }

  /**
   * Check if database needs refresh
   */
  async needsRefresh(): Promise<boolean> {
    const stats = await this.getDatabaseStats();
    
    if (stats.totalEntities === 0) {
      return true; // Empty database needs bootstrap
    }

    if (!stats.oldestUpdate) {
      return true;
    }

    const oldestDate = new Date(stats.oldestUpdate);
    const daysSinceUpdate = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceUpdate > this.CACHE_TTL_DAYS;
  }

  /**
   * Helper method to get entity type from URN
   */
  private getEntityTypeFromUrn(urn: string): string {
    if (urn.includes('urn:li:title:')) return 'TITLE';
    if (urn.includes('urn:li:organization:')) return 'COMPANY';
    if (urn.includes('urn:li:seniority:')) return 'SENIORITY';
    if (urn.includes('urn:li:skill:')) return 'SKILL';
    if (urn.includes('urn:li:industry:')) return 'INDUSTRY';
    if (urn.includes('urn:li:function:')) return 'FUNCTION';
    if (urn.includes('urn:li:degree:')) return 'DEGREE';
    if (urn.includes('urn:li:fieldOfStudy:')) return 'FIELD_OF_STUDY';
    if (urn.includes('urn:li:geo:')) return 'LOCATION';
    if (urn.includes('urn:li:ageRange:')) return 'AGE_RANGE';
    if (urn.includes('urn:li:gender:')) return 'GENDER';
    if (urn.includes('urn:li:staffCountRange:')) return 'COMPANY_SIZE';
    return 'UNKNOWN';
  }

  /**
   * Rate limiting delay
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('[EntityDB] Database connection closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
export const linkedInEntityDB = new LinkedInEntityDB();
export default linkedInEntityDB; 