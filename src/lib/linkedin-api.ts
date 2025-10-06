import axios, { AxiosInstance } from 'axios';
import { 
  LinkedInCampaign, 
  LinkedInAccount, 
  TargetingFacet, 
  TargetingEntity, 
  CampaignStats,
  BatchUpdateRequest,
  CampaignTargeting 
} from '@/types/linkedin';


export class LinkedInAPI {
  private client: AxiosInstance;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: 'https://api.linkedin.com/rest',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202506', // Latest API version as per briefing
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
        'User-Agent': 'LinkedIn-Ads-Manager/1.0' // Add custom User-Agent to avoid potential blocks
      }
    });

    // Add request interceptor for detailed logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[LinkedIn API Request] ${config.method?.toUpperCase()} ${config.url}`);
        console.log('[Request Headers]', config.headers);
        if (config.data) {
          console.log('[Request Body]', JSON.stringify(config.data, null, 2));
        }
        return config;
      },
      (error) => {
        console.error('[LinkedIn API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for detailed logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[LinkedIn API Response] ${response.status} ${response.statusText}`);
        console.log('[Response Headers]', response.headers);
        console.log('[Response Data]', JSON.stringify(response.data, null, 2));
        return response;
      },
      (error) => {
        console.error('[LinkedIn API Response Error]', {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          headers: error?.response?.headers,
          data: error?.response?.data,
          message: error.message,
          config: {
            method: error?.config?.method,
            url: error?.config?.url,
            headers: error?.config?.headers
          }
        });
        return Promise.reject(error);
      }
    );
  }

  // Get ad accounts - try multiple endpoints based on latest API documentation
  async getAdAccounts(): Promise<LinkedInAccount[]> {
    try {
      // First try the adAccountUsers endpoint with q=accounts
      console.log('[getAdAccounts] Attempting adAccountUsers endpoint...');
      let response;
      
      try {
        response = await this.client.get('/adAccountUsers?q=accounts');
        console.log('[getAdAccounts] adAccountUsers success');
        return response.data.elements || [];
      } catch (adAccountUsersError: any) {
        console.log('[getAdAccounts] adAccountUsers failed, trying adAccounts endpoint...');
        console.error('[adAccountUsers Error]', {
          status: adAccountUsersError?.response?.status,
          data: adAccountUsersError?.response?.data
        });
        
        // Try the direct adAccounts endpoint as fallback
        try {
          response = await this.client.get('/adAccounts?q=search');
          console.log('[getAdAccounts] adAccounts search success');
          return response.data.elements || [];
        } catch (adAccountsError: any) {
          console.log('[getAdAccounts] adAccounts search failed, trying simple adAccounts...');
          console.error('[adAccounts Error]', {
            status: adAccountsError?.response?.status,
            data: adAccountsError?.response?.data
          });
          
          // Try simple adAccounts endpoint
          response = await this.client.get('/adAccounts');
          console.log('[getAdAccounts] simple adAccounts success');
          return response.data.elements || [];
        }
      }
    } catch (error: any) {
      console.error('[getAdAccounts] All endpoints failed:', error);
      console.error('Final error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        headers: error?.response?.headers,
        data: error?.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  // Get campaigns for an account - fixed based on LinkedIn API documentation research
  async getCampaigns(
    accountId: string, 
    options: {
      activeOnly?: boolean;
      searchQuery?: string;
      getAllPages?: boolean;
    } = {}
  ): Promise<LinkedInCampaign[]> {
    try {
      const { activeOnly = false, searchQuery = '', getAllPages = true } = options;
      let allCampaigns: LinkedInCampaign[] = [];
      let pageToken: string | undefined = undefined;
      let hasMorePages = true;

      console.log(`[LinkedIn API] Fetching campaigns for account ${accountId}`, {
        activeOnly,
        searchQuery,
        getAllPages
      });

      while (hasMorePages) {
        // Build URL parameters - LinkedIn campaigns API does NOT support search parameter filtering
        // Only q=search and pagination parameters are supported
        const params = new URLSearchParams();
        params.append('q', 'search');
        params.append('pageSize', '1000'); // Use maximum page size
        // Based on LinkedIn API documentation, try the REST API endpoint format
        // Remove fields parameter completely to get all available fields
        // params.append('fields', 'id,name,unitCost');
        
        if (pageToken) {
          params.append('pageToken', pageToken);
        }

        const url = `/adAccounts/${accountId}/adCampaigns?${params.toString()}`;
        
        console.log(`[LinkedIn API Request] GET ${url}`);
        console.log('[Request Headers]', this.client.defaults.headers);

        const response = await this.client.get(url);
        
        console.log('[LinkedIn API Response] 200 OK');
        console.log('[Response Headers]', response.headers);
        console.log('[Response Elements Count]', response.data.elements?.length || 0);

        if (response.data.elements && Array.isArray(response.data.elements)) {
          allCampaigns.push(...response.data.elements);
          console.log(`[LinkedIn API] Retrieved ${response.data.elements.length} campaigns in this page`);
        }

        // Check for next page using LinkedIn's pagination format
        if (getAllPages && response.data.paging?.links?.length > 0) {
          // Look for next page link
          const nextLink = response.data.paging.links.find((link: any) => 
            link.rel === 'next' || link.type === 'application/json'
          );
          
          if (nextLink && nextLink.href) {
            // Extract pageToken from the next link URL
            const nextUrl = new URL(nextLink.href, 'https://api.linkedin.com');
            pageToken = nextUrl.searchParams.get('pageToken') || undefined;
            hasMorePages = !!pageToken;
          } else {
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }

        if (!getAllPages) {
          hasMorePages = false;
        }
      }

      console.log(`[LinkedIn API] Total campaigns retrieved: ${allCampaigns.length}`);
      
      // Apply client-side filtering since LinkedIn campaigns API doesn't support server-side filtering
      let filteredCampaigns = allCampaigns;
      
      // Filter by status if activeOnly is requested
      if (activeOnly) {
        filteredCampaigns = filteredCampaigns.filter(campaign => {
          // Check if campaign status is ACTIVE
          const hasActiveStatus = campaign.status?.toUpperCase() === 'ACTIVE';
          
          // Check if campaign is actually servable (not on hold, not stopped, etc.)
          // servingStatuses is an array of strings - we want campaigns that are RUNNABLE
          const isServable = campaign.servingStatuses && 
                            Array.isArray(campaign.servingStatuses) && 
                            campaign.servingStatuses.includes('RUNNABLE');
          
          // Campaign is truly "active/running" only if both conditions are met
          return hasActiveStatus && isServable;
        });
        console.log(`[LinkedIn API] Filtered to ${filteredCampaigns.length} truly active campaigns (status=ACTIVE and servingStatuses includes RUNNABLE)`);
      }
      
      // Filter by search query if provided
      if (searchQuery) {
        const lowercaseQuery = searchQuery.toLowerCase();
        filteredCampaigns = filteredCampaigns.filter(campaign => 
          campaign.name?.toLowerCase().includes(lowercaseQuery)
        );
        console.log(`[LinkedIn API] Filtered to ${filteredCampaigns.length} campaigns matching search query "${searchQuery}"`);
      }

      return filteredCampaigns;
    } catch (error: any) {
      console.error('[LinkedIn API Error] Failed to fetch campaigns:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        accountId,
        options
      });
      
      throw new Error(`Failed to fetch campaigns: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get campaign statistics
  async getCampaignStats(campaignIds: string[], dateRange?: { start: string; end: string }): Promise<CampaignStats[]> {
    try {
      // If too many campaigns, split into smaller batches to avoid 500 errors
      if (campaignIds.length > 10) {
        console.log(`[LinkedIn API] Splitting ${campaignIds.length} campaigns into batches of 10`);
        const allStats: CampaignStats[] = [];
        
        for (let i = 0; i < campaignIds.length; i += 10) {
          const batch = campaignIds.slice(i, i + 10);
          const batchStats = await this.getCampaignStats(batch, dateRange);
          allStats.push(...batchStats);
        }
        
        return allStats;
      }
      
      // Format dates correctly using LinkedIn's nested tuple format from guidance
      const startDate = dateRange?.start || this.getDateString(30);
      const endDate = dateRange?.end || this.getDateString(0);

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Build the dateRange parameter using LinkedIn's exact format from guidance
      const dateRangeParam = `(start:(year:${startDateObj.getFullYear()},month:${startDateObj.getMonth() + 1},day:${startDateObj.getDate()}),end:(year:${endDateObj.getFullYear()},month:${endDateObj.getMonth() + 1},day:${endDateObj.getDate()}))`;
      
      // Format campaign URNs correctly
      const campaignUrns = campaignIds.map(id => `urn:li:sponsoredCampaign:${id}`);
      
      const params = new URLSearchParams();
      params.append('q', 'analytics'); // Try q=analytics first, then statistics if needed
      params.append('timeGranularity', 'ALL'); // Use ALL for aggregated data
      params.append('dateRange', dateRangeParam);
      params.append('pivot', 'CAMPAIGN'); // Use singular pivot instead of pivots
      params.append('campaigns', `List(${campaignUrns.join(',')})`);
      // Don't specify fields - let LinkedIn return all available fields to see what's actually available
      // params.append('fields', 'costInLocalCurrency,costInUsd');

      const url = `/adAnalytics?${params.toString()}`;
      console.log('[LinkedIn API Analytics Request] GET', url);
      
      const response = await this.client.get(url);
      
      console.log('[LinkedIn API Analytics Response]', response.status, response.data?.elements?.length || 0, 'elements');
      return response.data.elements || [];
    } catch (error: any) {
      console.error('[LinkedIn API Analytics Error]:', error.response?.data || error.message);
      // Return empty array instead of throwing to avoid breaking the UI
      return [];
    }
  }

  // Get campaign analytics data (spend, impressions, clicks, leads)
  async fetchCampaignAnalyticsData(
    campaignIds: string[], 
    accountId: string, 
    startDate: string, 
    endDate: string
  ): Promise<{ 
    spend: { [campaignId: string]: number };
    impressions: { [campaignId: string]: number };
    clicks: { [campaignId: string]: number };
    leads: { [campaignId: string]: number };
  }> {
    try {
      console.log('[LinkedIn API] Fetching analytics data for account:', accountId);
      console.log('[LinkedIn API] Date range:', startDate, 'to', endDate);
      
      // Format dates correctly using LinkedIn's nested tuple format
      // IMPORTANT: Use UTC to avoid timezone shifts that can change the day
      const startDateObj = new Date(startDate + 'T00:00:00.000Z');
      const endDateObj = new Date(endDate + 'T00:00:00.000Z');
      
      console.log('[LinkedIn API] Date parsing debug:', {
        inputStart: startDate,
        inputEnd: endDate,
        parsedStartDay: startDateObj.getUTCDate(),
        parsedEndDay: endDateObj.getUTCDate(),
        startDateObj: startDateObj.toISOString(),
        endDateObj: endDateObj.toISOString()
      });
      
      // Build the dateRange parameter using LinkedIn's exact format that works in Postman
      const dateRangeParam = `(start:(day:${startDateObj.getUTCDate()},month:${startDateObj.getUTCMonth() + 1},year:${startDateObj.getUTCFullYear()}),end:(day:${endDateObj.getUTCDate()},month:${endDateObj.getUTCMonth() + 1},year:${endDateObj.getUTCFullYear()}))`;
      
      // Build URL manually - only encode the URN part, not the dateRange structure
      // LinkedIn expects the dateRange parentheses and colons to be literal, not encoded
      const encodedAccounts = `List(urn%3Ali%3AsponsoredAccount%3A${accountId})`;
      
      const url = `/adAnalytics?q=statistics&dateRange=${dateRangeParam}&timeGranularity=ALL&accounts=${encodedAccounts}&pivots=List(CREATIVE,CAMPAIGN)&fields=impressions,clicks,costInLocalCurrency,oneClickLeads,pivotValues`;
      console.log('[LinkedIn API Analytics Request] GET', url);
      console.log('[LinkedIn API] Decoded URL for comparison:', decodeURIComponent(url));
      
      const response = await this.client.get(url);
      console.log('[LinkedIn API Analytics Response]', response.status, response.data?.elements?.length || 0, 'elements');
      
      const spendData: { [campaignId: string]: number } = {};
      const impressionsData: { [campaignId: string]: number } = {};
      const clicksData: { [campaignId: string]: number } = {};
      const leadsData: { [campaignId: string]: number } = {};
      
      // Process the response using the correct LinkedIn API format from documentation
      if (response.data.elements && Array.isArray(response.data.elements)) {
        response.data.elements.forEach((element: any) => {
          console.log('[LinkedIn API] Processing element:', JSON.stringify(element, null, 2));
          
          const costInLocalCurrency = element.costInLocalCurrency;
          const impressions = element.impressions;
          const clicks = element.clicks;
          const oneClickLeads = element.oneClickLeads;
          const pivotValues = element.pivotValues;
          
          if (pivotValues && Array.isArray(pivotValues)) {
            // With CREATIVE+CAMPAIGN pivots, pivotValues contains [creative_urn, campaign_urn]
            // Find the campaign URN (should be second element based on your Postman response)
            const campaignUrn = pivotValues.find((pv: string) => 
              typeof pv === 'string' && pv.includes('urn:li:sponsoredCampaign:')
            );
            
            if (campaignUrn) {
              // Extract campaign ID from URN (e.g., "urn:li:sponsoredCampaign:100000000" -> "100000000")
              const campaignId = campaignUrn.split(':').pop();
              if (campaignId) {
                // Aggregate spend
                if (costInLocalCurrency !== undefined && costInLocalCurrency !== null) {
                  const spendAmount = typeof costInLocalCurrency === 'number' ? costInLocalCurrency : parseFloat(String(costInLocalCurrency));
                  if (!isNaN(spendAmount)) {
                    spendData[campaignId] = (spendData[campaignId] || 0) + spendAmount;
                  }
                }
                
                // Aggregate impressions
                if (impressions !== undefined && impressions !== null) {
                  const impressionCount = typeof impressions === 'number' ? impressions : parseInt(String(impressions));
                  if (!isNaN(impressionCount)) {
                    impressionsData[campaignId] = (impressionsData[campaignId] || 0) + impressionCount;
                  }
                }
                
                // Aggregate clicks
                if (clicks !== undefined && clicks !== null) {
                  const clickCount = typeof clicks === 'number' ? clicks : parseInt(String(clicks));
                  if (!isNaN(clickCount)) {
                    clicksData[campaignId] = (clicksData[campaignId] || 0) + clickCount;
                  }
                }
                
                // Aggregate leads
                if (oneClickLeads !== undefined && oneClickLeads !== null) {
                  const leadCount = typeof oneClickLeads === 'number' ? oneClickLeads : parseInt(String(oneClickLeads));
                  if (!isNaN(leadCount)) {
                    leadsData[campaignId] = (leadsData[campaignId] || 0) + leadCount;
                  }
                }
              }
            }
          }
        });
      }
      
      console.log('[LinkedIn API] Final processed analytics data:', {
        spend: spendData,
        impressions: impressionsData,
        clicks: clicksData,
        leads: leadsData
      });
      
      return {
        spend: spendData,
        impressions: impressionsData,
        clicks: clicksData,
        leads: leadsData
      };
    } catch (error: any) {
      console.error('[LinkedIn API] Error fetching spend data:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
        headers: error.config?.headers
      });
      
      // If it's a 400 or 500 error, try with a simpler date range
      if (error.response?.status === 400 || error.response?.status === 500) {
        console.log('[LinkedIn API] Retrying with a different date range...');
        try {
          // Try with just the last few days using UTC to avoid timezone issues
          const today = new Date();
          const threeDaysAgo = new Date(today);
          threeDaysAgo.setUTCDate(today.getUTCDate() - 3);
          
          const simpleDateRange = `(start:(day:${threeDaysAgo.getUTCDate()},month:${threeDaysAgo.getUTCMonth() + 1},year:${threeDaysAgo.getUTCFullYear()}),end:(day:${today.getUTCDate()},month:${today.getUTCMonth() + 1},year:${today.getUTCFullYear()}))`;
          console.log('[LinkedIn API] Retry date range:', simpleDateRange);
          const encodedAccounts = `List(urn%3Ali%3AsponsoredAccount%3A${accountId})`;
          
          const retryUrl = `/adAnalytics?q=statistics&dateRange=${simpleDateRange}&timeGranularity=ALL&accounts=${encodedAccounts}&pivots=List(CREATIVE,CAMPAIGN)&fields=impressions,clicks,costInLocalCurrency,oneClickLeads,pivotValues`;
          console.log('[LinkedIn API] Retry URL:', retryUrl);
          
          const retryResponse = await this.client.get(retryUrl);
          console.log('[LinkedIn API] Retry successful!', retryResponse.status);
          
          // Process the retry response the same way
          const spendData: { [campaignId: string]: number } = {};
          const impressionsData: { [campaignId: string]: number } = {};
          const clicksData: { [campaignId: string]: number } = {};
          const leadsData: { [campaignId: string]: number } = {};
          
          if (retryResponse.data.elements && Array.isArray(retryResponse.data.elements)) {
            retryResponse.data.elements.forEach((element: any) => {
              const costInLocalCurrency = element.costInLocalCurrency;
              const impressions = element.impressions;
              const clicks = element.clicks;
              const oneClickLeads = element.oneClickLeads;
              const pivotValues = element.pivotValues;
              
              if (pivotValues && Array.isArray(pivotValues)) {
                const campaignUrn = pivotValues.find((pv: string) => 
                  typeof pv === 'string' && pv.includes('urn:li:sponsoredCampaign:')
                );
                
                if (campaignUrn) {
                  const campaignId = campaignUrn.split(':').pop();
                  if (campaignId) {
                    if (costInLocalCurrency !== undefined && costInLocalCurrency !== null) {
                      const spendAmount = typeof costInLocalCurrency === 'number' ? costInLocalCurrency : parseFloat(String(costInLocalCurrency));
                      if (!isNaN(spendAmount)) {
                        spendData[campaignId] = (spendData[campaignId] || 0) + spendAmount;
                      }
                    }
                    if (impressions !== undefined && impressions !== null) {
                      const impressionCount = typeof impressions === 'number' ? impressions : parseInt(String(impressions));
                      if (!isNaN(impressionCount)) {
                        impressionsData[campaignId] = (impressionsData[campaignId] || 0) + impressionCount;
                      }
                    }
                    if (clicks !== undefined && clicks !== null) {
                      const clickCount = typeof clicks === 'number' ? clicks : parseInt(String(clicks));
                      if (!isNaN(clickCount)) {
                        clicksData[campaignId] = (clicksData[campaignId] || 0) + clickCount;
                      }
                    }
                    if (oneClickLeads !== undefined && oneClickLeads !== null) {
                      const leadCount = typeof oneClickLeads === 'number' ? oneClickLeads : parseInt(String(oneClickLeads));
                      if (!isNaN(leadCount)) {
                        leadsData[campaignId] = (leadsData[campaignId] || 0) + leadCount;
                      }
                    }
                  }
                }
              }
            });
          }
          return {
            spend: spendData,
            impressions: impressionsData,
            clicks: clicksData,
            leads: leadsData
          };
        } catch (retryError) {
          console.error('[LinkedIn API] Retry also failed:', retryError);
        }
      }
      
      // Return empty data to avoid breaking the UI
      return {
        spend: {},
        impressions: {},
        clicks: {},
        leads: {}
      };
    }
  }

  // Legacy method for backwards compatibility
  async fetchCampaignSpendData(campaignIds: string[], accountId: string, startDate: string, endDate: string): Promise<{ [campaignId: string]: number }> {
    const data = await this.fetchCampaignAnalyticsData(campaignIds, accountId, startDate, endDate);
    return data.spend;
  }

  // Get targeting facets
  async getTargetingFacets(): Promise<TargetingFacet[]> {
    try {
      const response = await this.client.get('/adTargetingFacets');
      return response.data.elements || [];
    } catch (error) {
      console.error('Error fetching targeting facets:', error);
      throw error;
    }
  }

  // Get targeting entities for a facet
  async getTargetingEntities(facetUrn: string, query?: string): Promise<TargetingEntity[]> {
    try {
      // First try to get from local database
      const linkedInEntityDB = (await import('@/lib/linkedin-entity-db')).default;
      
      if (query && query.length >= 2) {
        // Search local database first
        const localResults = await linkedInEntityDB.searchEntities(facetUrn, query, 50);
        if (localResults.length > 0) {
          console.log(`[LinkedIn API] Retrieved ${localResults.length} targeting entities from local database`);
          return localResults;
        }
      } else {
        // Get all entities for facet from local database
        const localResults = await linkedInEntityDB.getEntitiesForFacet(facetUrn);
        if (localResults.length > 0) {
          console.log(`[LinkedIn API] Retrieved ${localResults.length} targeting entities from local database`);
          return localResults;
        }
      }

      // Fallback to LinkedIn API if not in local database
      const encodedFacetUrn = encodeURIComponent(facetUrn);
      let url: string;
      
      if (query && query.length >= 2) {
        // Use typeahead search for specific queries
        url = `/adTargetingEntities?q=typeahead&facet=${encodedFacetUrn}&query=${encodeURIComponent(query)}&queryVersion=QUERY_USES_URNS&locale=(language:en,country:US)`;
      } else {
        // Use general facet listing for empty/short queries
        url = `/adTargetingEntities?q=adTargetingFacet&facet=${encodedFacetUrn}&queryVersion=QUERY_USES_URNS&locale=(language:en,country:US)`;
      }

      console.log(`[LinkedIn API] Fetching targeting entities from LinkedIn API: ${url}`);
      const response = await this.client.get(url);
      
      const entities = (response.data.elements || []).map((element: any) => ({
        urn: element.urn || element.$URN,
        name: element.name || `Unknown Entity`,
        id: (element.urn || element.$URN || '').split(':').pop() || element.urn
      }));
      
      console.log(`[LinkedIn API] Retrieved ${entities.length} targeting entities from LinkedIn API`);
      return entities;
    } catch (error) {
      console.error('Error fetching targeting entities:', error);
      throw error;
    }
  }

  // Search targeting entities with typeahead
  async searchTargetingEntities(facetUrn: string, query: string): Promise<TargetingEntity[]> {
    return this.getTargetingEntities(facetUrn, query);
  }

  // Get a single campaign by ID - LinkedIn API doesn't support direct individual campaign fetch
  // We need to use the campaigns list endpoint with filtering instead
  async getCampaignById(campaignId: string, accountId?: string): Promise<LinkedInCampaign | null> {
    try {
      console.log(`[LinkedIn API] Fetching single campaign ${campaignId} from account ${accountId}`);
      
      if (!accountId) {
        console.error('Account ID is required to fetch campaign');
        return null;
      }

      // Use the campaigns list endpoint and filter for the specific campaign
      const campaigns = await this.getCampaigns(accountId, { getAllPages: false });
      const campaign = campaigns.find(c => c.id === campaignId || c.id === `urn:li:sponsoredCampaign:${campaignId}`);
      
      if (campaign) {
        console.log(`[LinkedIn API] Found campaign ${campaignId}`);
        return campaign;
      } else {
        console.log(`[LinkedIn API] Campaign ${campaignId} not found`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching campaign ${campaignId}:`, error);
      return null;
    }
  }

  // Get common targeting across multiple campaigns according to briefing specifications
  async getCommonTargeting(campaignIds: string[], accountId: string): Promise<{
    commonIncludes: Record<string, TargetingEntity[]>;
    commonExcludes: Record<string, TargetingEntity[]>;
  }> {
    console.log(`[LinkedIn API] Fetching common targeting for ${campaignIds.length} campaigns`);

    // Step 1: Fetch targeting criteria for each campaign individually
    // Note: LinkedIn batch GET for campaigns requires specific parameter format
    console.log('[LinkedIn API] Fetching targeting criteria for campaigns individually');
    
    const campaigns: Record<string, any> = {};
    
    for (const campaignId of campaignIds) {
      const idStr = String(campaignId);
      const cleanId = idStr.includes('urn:li:sponsoredCampaign:') 
        ? idStr.split(':').pop() 
        : idStr;
      
      if (!cleanId) continue;
      
      try {
        console.log(`[LinkedIn API] Fetching targeting for campaign ${cleanId}`);
        const singleCampaignUrl = `/adAccounts/${accountId}/adCampaigns/${cleanId}?fields=targetingCriteria`;
        const campaignResponse = await this.client.get(singleCampaignUrl);
        campaigns[`urn:li:sponsoredCampaign:${cleanId}`] = campaignResponse.data;
      } catch (error) {
        console.error(`[LinkedIn API] Failed to fetch campaign ${cleanId}:`, error);
        // Continue with other campaigns
             }
     }
     
     console.log(`[LinkedIn API] Retrieved targeting data for ${Object.keys(campaigns).length} campaigns`);

    // Step 2: Compute common audience as per briefing algorithm
    const allCampaignTargeting: Array<{ includes: Record<string, Set<string>>, excludes: Record<string, Set<string>> }> = [];
    
    // Parse each campaign's targeting criteria
    for (const [campaignUrn, campaignData] of Object.entries(campaigns)) {
      const targetingCriteria = (campaignData as any).targetingCriteria;
      const campaignTargeting = {
        includes: {} as Record<string, Set<string>>,
        excludes: {} as Record<string, Set<string>>
      };
      
      // Parse includes (include.and structure)
      if (targetingCriteria?.include?.and) {
        for (const andGroup of targetingCriteria.include.and) {
          if (andGroup.or) {
            for (const [facetUrn, values] of Object.entries(andGroup.or)) {
              if (Array.isArray(values)) {
                if (!campaignTargeting.includes[facetUrn]) {
                  campaignTargeting.includes[facetUrn] = new Set();
                }
                values.forEach(value => campaignTargeting.includes[facetUrn].add(value));
              }
            }
          }
        }
      }
      
      // Parse excludes (exclude.or structure)
      if (targetingCriteria?.exclude?.or) {
        for (const [facetUrn, values] of Object.entries(targetingCriteria.exclude.or)) {
          if (Array.isArray(values)) {
            if (!campaignTargeting.excludes[facetUrn]) {
              campaignTargeting.excludes[facetUrn] = new Set();
            }
            values.forEach(value => campaignTargeting.excludes[facetUrn].add(value));
          }
        }
      }
      
      allCampaignTargeting.push(campaignTargeting);
    }
    
    // Step 3: Find intersection (common criteria across all campaigns)
    const commonIncludes: Record<string, Set<string>> = {};
    const commonExcludes: Record<string, Set<string>> = {};
    
    if (allCampaignTargeting.length > 0) {
      // Get all facets used across campaigns
      const allIncludeFacets = new Set<string>();
      const allExcludeFacets = new Set<string>();
      
      for (const targeting of allCampaignTargeting) {
        Object.keys(targeting.includes).forEach(facet => allIncludeFacets.add(facet));
        Object.keys(targeting.excludes).forEach(facet => allExcludeFacets.add(facet));
      }
      
      // Find common includes (intersection)
      for (const facetUrn of allIncludeFacets) {
        // Only include if ALL campaigns have this facet
        const allCampaignsHaveFacet = allCampaignTargeting.every(targeting => 
          targeting.includes[facetUrn] && targeting.includes[facetUrn].size > 0
        );
        
        if (allCampaignsHaveFacet) {
          // Find intersection of values
          let commonValues = allCampaignTargeting[0].includes[facetUrn];
          for (let i = 1; i < allCampaignTargeting.length; i++) {
            const intersection = new Set<string>();
            for (const value of commonValues) {
              if (allCampaignTargeting[i].includes[facetUrn].has(value)) {
                intersection.add(value);
              }
            }
            commonValues = intersection;
          }
          
          if (commonValues.size > 0) {
            commonIncludes[facetUrn] = commonValues;
          }
        }
      }
      
      // Find common excludes (intersection)
      for (const facetUrn of allExcludeFacets) {
        // Only include if ALL campaigns have this facet
        const allCampaignsHaveFacet = allCampaignTargeting.every(targeting => 
          targeting.excludes[facetUrn] && targeting.excludes[facetUrn].size > 0
        );
        
        if (allCampaignsHaveFacet) {
          // Find intersection of values
          let commonValues = allCampaignTargeting[0].excludes[facetUrn];
          for (let i = 1; i < allCampaignTargeting.length; i++) {
            const intersection = new Set<string>();
            for (const value of commonValues) {
              if (allCampaignTargeting[i].excludes[facetUrn].has(value)) {
                intersection.add(value);
              }
            }
            commonValues = intersection;
          }
          
          if (commonValues.size > 0) {
            commonExcludes[facetUrn] = commonValues;
          }
        }
      }
    }
    
    // Step 4: Resolve URNs to human-readable names using LinkedIn API
    const resolvedCommonIncludes: Record<string, TargetingEntity[]> = {};
    const resolvedCommonExcludes: Record<string, TargetingEntity[]> = {};
    
    // Collect all URNs for batch resolution
    const allUrns: string[] = [];
    for (const values of Object.values(commonIncludes)) {
      allUrns.push(...Array.from(values));
    }
    for (const values of Object.values(commonExcludes)) {
      allUrns.push(...Array.from(values));
    }
    
    console.log(`[LinkedIn API] Resolving ${allUrns.length} URNs to display names`);
    
    // Actually resolve URNs to real display names using LinkedIn API
    const resolvedEntityMap = await this.resolveEntityNames(allUrns);
    
    // Convert sets to arrays and use resolved names
    for (const [facetUrn, values] of Object.entries(commonIncludes)) {
      const entities: TargetingEntity[] = [];
      for (const urn of values) {
        const resolvedEntity = resolvedEntityMap[urn];
        if (resolvedEntity) {
          entities.push(resolvedEntity);
        } else {
          // Fallback if resolution failed
          const id = urn.split(':').pop() || urn;
          const entityType = this.getEntityTypeFromUrn(urn);
          entities.push({
            urn,
            name: `${entityType} ${id}`,
            id
          });
        }
      }
      resolvedCommonIncludes[this.normalizeFacetKey(facetUrn)] = entities;
    }
    
    for (const [facetUrn, values] of Object.entries(commonExcludes)) {
      const entities: TargetingEntity[] = [];
      for (const urn of values) {
        const resolvedEntity = resolvedEntityMap[urn];
        if (resolvedEntity) {
          entities.push(resolvedEntity);
        } else {
          // Fallback if resolution failed
          const id = urn.split(':').pop() || urn;
          const entityType = this.getEntityTypeFromUrn(urn);
          entities.push({
            urn,
            name: `${entityType} ${id}`,
            id
          });
        }
      }
      resolvedCommonExcludes[this.normalizeFacetKey(facetUrn)] = entities;
    }
    
    console.log(`[LinkedIn API] Common targeting computed:`, {
      includes: Object.keys(resolvedCommonIncludes).length,
      excludes: Object.keys(resolvedCommonExcludes).length
    });
    
    return {
      commonIncludes: resolvedCommonIncludes,
      commonExcludes: resolvedCommonExcludes
    };
  }

  // Resolve entity URNs to human-readable names using local database first, then LinkedIn API
  private async resolveEntityNames(urns: string[]): Promise<Record<string, TargetingEntity>> {
    if (urns.length === 0) return {};
    
    console.log(`[LinkedIn API] Resolving ${urns.length} entity names`);
    
    const entities: Record<string, TargetingEntity> = {};
    
    try {
      // First try to resolve all URNs from local database
      const linkedInEntityDB = (await import('@/lib/linkedin-entity-db')).default;
      const localEntities = await linkedInEntityDB.getEntitiesByUrns(urns);
      
      // Use local database results
      Object.assign(entities, localEntities);
      
      console.log(`[LinkedIn API] Resolved ${Object.keys(localEntities).length}/${urns.length} entities from local database`);
      
      // Find URNs that weren't resolved locally
      const unresolvedUrns = urns.filter(urn => !entities[urn]);
      
      if (unresolvedUrns.length === 0) {
        console.log(`[LinkedIn API] All entities resolved from local database`);
        return entities;
      }
      
      console.log(`[LinkedIn API] Attempting to resolve ${unresolvedUrns.length} URNs via fallback methods`);
      
      // Separate title URNs from other URNs for different resolution strategies
      const titleUrns: string[] = [];
      const otherUrns: string[] = [];
      
      for (const urn of unresolvedUrns) {
        if (urn.includes('urn:li:title:')) {
          titleUrns.push(urn);
        } else {
          otherUrns.push(urn);
        }
      }
    } catch (error) {
      console.error('[LinkedIn API] Error accessing local database, falling back to LinkedIn API:', error);
      // If database access fails, treat all URNs as unresolved
    }
    
    // Determine which URNs still need resolution
    const unresolvedUrns = urns.filter(urn => !entities[urn]);
    const titleUrns: string[] = [];
    const otherUrns: string[] = [];
    
    for (const urn of unresolvedUrns) {
      if (urn.includes('urn:li:title:')) {
        titleUrns.push(urn);
      } else {
        otherUrns.push(urn);
      }
    }
    
    // Handle title URNs with fallback names
    if (titleUrns.length > 0) {
      console.log(`[LinkedIn API] Creating fallback names for ${titleUrns.length} title URNs`);
      
      // Create fallback names for titles
      for (const urn of titleUrns) {
        const id = urn.split(':').pop() || urn;
        entities[urn] = {
          urn,
          name: `Job Title ${id}`,
          id
        };
      }
    }
    
    // Handle other URNs with direct API call
    if (otherUrns.length > 0) {
      console.log(`[LinkedIn API] Resolving ${otherUrns.length} non-title URNs using direct API`);
      
      // Filter out URN types that cannot be resolved via adTargetingEntities API
      const resolvableUrns = otherUrns.filter(urn => {
        // Skip staff count ranges (they have complex format with parentheses)
        if (urn.includes('urn:li:staffCountRange:')) return false;
        // Skip ad segments (they're not resolvable via adTargetingEntities)
        if (urn.includes('urn:li:adSegment:')) return false;
        // Skip locale URNs (they're not standard targeting entities)
        if (urn.includes('urn:li:locale:')) return false;
        return true;
      });
      
      console.log(`[LinkedIn API] Filtered to ${resolvableUrns.length} resolvable URNs (filtered out ${otherUrns.length - resolvableUrns.length} problematic URNs)`);
      
      if (resolvableUrns.length > 0) {
        try {
          // Use the correct /rest/ API format as per LinkedIn documentation
          // Format: GET https://api.linkedin.com/rest/adTargetingEntities?q=urns&urns=List(...)
          const encodedUrns = resolvableUrns.map(urn => encodeURIComponent(urn));
          const urnsParam = `List(${encodedUrns.join(',')})`;
          
          const url = `/adTargetingEntities?q=urns&urns=${urnsParam}&queryVersion=QUERY_USES_URNS&locale=(language:en,country:US)`;
          const response = await this.client.get(url);
        
        if (response.data.elements) {
          for (const element of response.data.elements) {
            entities[element.urn] = {
              urn: element.urn,
              name: element.name || element.title || `Entity ${element.urn.split(':').pop()}`,
              id: element.urn.split(':').pop() || element.urn
            };
          }
        }
        
          console.log(`[LinkedIn API] Successfully resolved ${Object.keys(entities).length - titleUrns.length} non-title entity names`);
        } catch (error) {
          console.error('[LinkedIn API] Error resolving non-title entity names:', error);
          
          // Fallback for resolvable entities only
          for (const urn of resolvableUrns) {
            const id = urn.split(':').pop() || urn;
            const entityType = this.getEntityTypeFromUrn(urn);
            entities[urn] = {
              urn,
              name: `${entityType} ${id}`,
              id
            };
          }
        }
      }
      
      // Create fallback names for filtered out URNs
      const filteredUrns = otherUrns.filter(urn => {
        // Include staff count ranges, ad segments, and locale URNs that we filtered out
        if (urn.includes('urn:li:staffCountRange:')) return true;
        if (urn.includes('urn:li:adSegment:')) return true;
        if (urn.includes('urn:li:locale:')) return true;
        return false;
      });
      
      for (const urn of filteredUrns) {
        const id = urn.split(':').pop() || urn;
        let entityType = this.getEntityTypeFromUrn(urn);
        let name = `${entityType} ${id}`;
        
        // Better fallback names for special URN types
        if (urn.includes('urn:li:staffCountRange:')) {
          const range = id.replace(/[()]/g, ''); // Remove parentheses
          entityType = 'Company Size';
          name = `${range} employees`;
        } else if (urn.includes('urn:li:adSegment:')) {
          entityType = 'Audience Segment';
          name = `Segment ${id}`;
        } else if (urn.includes('urn:li:locale:')) {
          entityType = 'Locale';
          name = id.toUpperCase();
        }
        
        entities[urn] = {
          urn,
          name,
          id
        };
      }
    }
    
    console.log(`[LinkedIn API] Total resolved entities: ${Object.keys(entities).length}/${urns.length}`);
    return entities;
  }

  // Helper method to get entity type from URN for better fallback naming
  private getEntityTypeFromUrn(urn: string): string {
    if (urn.includes('urn:li:title:')) return 'Job Title';
    if (urn.includes('urn:li:organization:')) return 'Company';
    if (urn.includes('urn:li:seniority:')) return 'Seniority';
    if (urn.includes('urn:li:skill:')) return 'Skill';
    if (urn.includes('urn:li:industry:')) return 'Industry';
    if (urn.includes('urn:li:function:')) return 'Job Function';
    return 'Entity';
  }

  // Helper method to get facet label
  private getFacetLabel(facetUrn: string): string {
    const facetMap: Record<string, string> = {
      'urn:li:adTargetingFacet:industries': 'Industry',
      'urn:li:adTargetingFacet:jobFunctions': 'Job Function',
      'urn:li:adTargetingFacet:titles': 'Job Title',
      'urn:li:adTargetingFacet:employers': 'Company',
      'urn:li:adTargetingFacet:seniorities': 'Seniority',
      'urn:li:adTargetingFacet:skills': 'Skill'
    };
    return facetMap[facetUrn] || 'Unknown';
  }

  // Helper method to normalize facet URN to key
  private normalizeFacetKey(facetUrn: string): string {
    const keyMap: Record<string, string> = {
      'urn:li:adTargetingFacet:industries': 'industries',
      'urn:li:adTargetingFacet:jobFunctions': 'jobFunctions',
      'urn:li:adTargetingFacet:titles': 'titles',
      'urn:li:adTargetingFacet:employers': 'employers',
      'urn:li:adTargetingFacet:seniorities': 'seniorities',
      'urn:li:adTargetingFacet:skills': 'skills'
    };
    return keyMap[facetUrn] || facetUrn;
  }

  // Get audience counts for targeting criteria
  async getAudienceCounts(targetingCriteria: any, accountId: string): Promise<number> {
    console.log('[LinkedIn API] Getting audience counts for targeting criteria');
    
    try {
      const response = await this.client.get('/audienceCounts', {
        params: {
          q: 'targetingCriteria',
          account: `urn:li:sponsoredAccount:${accountId}`,
          targetingCriteria: JSON.stringify(targetingCriteria)
        }
      });
      
      // Extract audience count from response
      const audienceCount = response.data.elements?.[0]?.count || 0;
      
      console.log(`[LinkedIn API] Audience count: ${audienceCount}`);
      return audienceCount;
    } catch (error) {
      console.error('[LinkedIn API] Error getting audience counts:', error);
      // Return 0 if audience counts API fails - this is not a critical failure
      return 0;
    }
  }

  // Enhanced batch update campaigns with full targeting criteria support
  async batchUpdateCampaigns(
    campaignIds: string[],
    targetingUpdate: {
      includes?: Record<string, string[]>;
      excludes?: Record<string, string[]>;
      excludedTargeting?: Record<string, string[]>; // Legacy support
    },
    accountId: string
  ): Promise<{ 
    successful: string[]; 
    failed: Array<{ campaignId: string; error: string }> 
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ campaignId: string; error: string }>
    };

    console.log(`[LinkedIn API] Starting batch update for ${campaignIds.length} campaigns`);
    console.log('[Targeting Update]', targetingUpdate);
    
    // Support legacy excludedTargeting parameter for backwards compatibility
    const excludedTargeting = targetingUpdate.excludedTargeting || targetingUpdate.excludes || {};

    for (const campaignId of campaignIds) {
      try {
        // Extract just the campaign ID from the URN if it's a full URN
        const campaignIdStr = String(campaignId);
        const cleanCampaignId = campaignIdStr.includes('urn:li:sponsoredCampaign:') 
          ? campaignIdStr.split(':').pop() 
          : campaignIdStr;

        if (!cleanCampaignId) {
          throw new Error(`Invalid campaign ID: ${campaignId}`);
        }

        console.log(`[LinkedIn API] Fetching current targeting for campaign ${cleanCampaignId}`);

        // First, fetch the current campaign to get existing targeting criteria
        const currentCampaign = await this.client.get(
          `/adAccounts/${accountId}/adCampaigns/${cleanCampaignId}`
        );

        const existingTargetingCriteria = currentCampaign.data.targetingCriteria || {
          include: { and: [] },
          exclude: { or: {} }
        };

        console.log('[Existing Targeting Criteria]', JSON.stringify(existingTargetingCriteria, null, 2));

        // Build new targeting criteria by preserving existing include and merging exclude
        const newTargetingCriteria = {
          include: existingTargetingCriteria.include || { and: [] },
          exclude: {
            or: { ...existingTargetingCriteria.exclude?.or || {} }
          }
        };

        // Add excluded targeting criteria to the exclude section, MERGING with existing
        if (excludedTargeting.industries && excludedTargeting.industries.length > 0) {
          const existingIndustryExcludes = (existingTargetingCriteria.exclude?.or as any)?.[`urn:li:adTargetingFacet:industries`] || [];
          const newIndustryExcludes = excludedTargeting.industries.map(industry => 
            industry.startsWith('urn:li:industry:') ? industry : `urn:li:industry:${industry}`
          );
          // Merge existing and new exclusions, removing duplicates
          const mergedIndustryExcludes = [...new Set([...existingIndustryExcludes, ...newIndustryExcludes])];
          console.log(`[Merging Industry Exclusions] Campaign ${campaignId}:`);
          console.log(`  Existing:`, existingIndustryExcludes);
          console.log(`  New:`, newIndustryExcludes);
          console.log(`  Merged:`, mergedIndustryExcludes);
          (newTargetingCriteria.exclude.or as any)['urn:li:adTargetingFacet:industries'] = mergedIndustryExcludes;
        }

        if (excludedTargeting.jobFunctions && excludedTargeting.jobFunctions.length > 0) {
          const existingJobFunctionExcludes = (existingTargetingCriteria.exclude?.or as any)?.[`urn:li:adTargetingFacet:jobFunctions`] || [];
          const newJobFunctionExcludes = excludedTargeting.jobFunctions.map(func => 
            func.startsWith('urn:li:function:') ? func : `urn:li:function:${func}`
          );
          const mergedJobFunctionExcludes = [...new Set([...existingJobFunctionExcludes, ...newJobFunctionExcludes])];
          console.log(`[Merging Job Function Exclusions] Campaign ${campaignId}:`);
          console.log(`  Existing:`, existingJobFunctionExcludes);
          console.log(`  New:`, newJobFunctionExcludes);
          console.log(`  Merged:`, mergedJobFunctionExcludes);
          (newTargetingCriteria.exclude.or as any)['urn:li:adTargetingFacet:jobFunctions'] = mergedJobFunctionExcludes;
        }

        if (excludedTargeting.seniorities && excludedTargeting.seniorities.length > 0) {
          const existingSeniorityExcludes = (existingTargetingCriteria.exclude?.or as any)?.[`urn:li:adTargetingFacet:seniorities`] || [];
          const newSeniorityExcludes = excludedTargeting.seniorities.map(seniority => 
            seniority.startsWith('urn:li:seniority:') ? seniority : `urn:li:seniority:${seniority}`
          );
          const mergedSeniorityExcludes = [...new Set([...existingSeniorityExcludes, ...newSeniorityExcludes])];
          console.log(`[Merging Seniority Exclusions] Campaign ${campaignId}:`);
          console.log(`  Existing:`, existingSeniorityExcludes);
          console.log(`  New:`, newSeniorityExcludes);
          console.log(`  Merged:`, mergedSeniorityExcludes);
          (newTargetingCriteria.exclude.or as any)['urn:li:adTargetingFacet:seniorities'] = mergedSeniorityExcludes;
        }

        if (excludedTargeting.titles && excludedTargeting.titles.length > 0) {
          const existingTitleExcludes = (existingTargetingCriteria.exclude?.or as any)?.[`urn:li:adTargetingFacet:titles`] || [];
          const newTitleExcludes = excludedTargeting.titles.map(title => 
            title.startsWith('urn:li:title:') ? title : `urn:li:title:${title}`
          );
          const mergedTitleExcludes = [...new Set([...existingTitleExcludes, ...newTitleExcludes])];
          console.log(`[Merging Job Title Exclusions] Campaign ${campaignId}:`);
          console.log(`  Existing:`, existingTitleExcludes);
          console.log(`  New:`, newTitleExcludes);
          console.log(`  Merged:`, mergedTitleExcludes);
          (newTargetingCriteria.exclude.or as any)['urn:li:adTargetingFacet:titles'] = mergedTitleExcludes;
        }

        if (excludedTargeting.employers && excludedTargeting.employers.length > 0) {
          const existingEmployerExcludes = (existingTargetingCriteria.exclude?.or as any)?.[`urn:li:adTargetingFacet:employers`] || [];
          const newEmployerExcludes = excludedTargeting.employers.map(employer => 
            employer.startsWith('urn:li:organization:') ? employer : `urn:li:organization:${employer}`
          );
          const mergedEmployerExcludes = [...new Set([...existingEmployerExcludes, ...newEmployerExcludes])];
          console.log(`[Merging Company Exclusions] Campaign ${campaignId}:`);
          console.log(`  Existing:`, existingEmployerExcludes);
          console.log(`  New:`, newEmployerExcludes);
          console.log(`  Merged:`, mergedEmployerExcludes);
          (newTargetingCriteria.exclude.or as any)['urn:li:adTargetingFacet:employers'] = mergedEmployerExcludes;
        }

        if (excludedTargeting.skills && excludedTargeting.skills.length > 0) {
          const existingSkillExcludes = (existingTargetingCriteria.exclude?.or as any)?.[`urn:li:adTargetingFacet:skills`] || [];
          const newSkillExcludes = excludedTargeting.skills.map(skill => 
            skill.startsWith('urn:li:skill:') ? skill : `urn:li:skill:${skill}`
          );
          const mergedSkillExcludes = [...new Set([...existingSkillExcludes, ...newSkillExcludes])];
          console.log(`[Merging Skill Exclusions] Campaign ${campaignId}:`);
          console.log(`  Existing:`, existingSkillExcludes);
          console.log(`  New:`, newSkillExcludes);
          console.log(`  Merged:`, mergedSkillExcludes);
          (newTargetingCriteria.exclude.or as any)['urn:li:adTargetingFacet:skills'] = mergedSkillExcludes;
        }

        // Build the patch structure as required by LinkedIn API
        const patchData = {
          patch: {
            $set: {
              targetingCriteria: newTargetingCriteria
            }
          }
        };

        console.log(`[LinkedIn API Request] POST /adAccounts/${accountId}/adCampaigns/${cleanCampaignId}`);
        console.log('[New Targeting Criteria]', JSON.stringify(newTargetingCriteria, null, 2));

        // Use BATCH_PARTIAL_UPDATE method as per briefing specifications
        const batchUpdateUrl = `/adAccounts/${accountId}/adCampaigns?ids=List(${cleanCampaignId})`;
        const entities: Record<string, any> = {};
        entities[cleanCampaignId] = {
          patch: {
            $set: {
              targetingCriteria: newTargetingCriteria
            }
          }
        };
        
        const batchUpdateData = {
          entities
        };

        const response = await this.client.post(
          batchUpdateUrl,
          batchUpdateData,
          {
            headers: {
              'X-RestLi-Method': 'BATCH_PARTIAL_UPDATE'
            }
          }
        );

        console.log(`[LinkedIn API Response] ${response.status} ${response.statusText}`);
        console.log(`[LinkedIn API] Successfully updated campaign ${cleanCampaignId}`);
        
        results.successful.push(campaignId);

      } catch (error: any) {
        console.error(`Error updating campaign ${campaignId}:`, error);
        
        let errorMessage = 'Unknown error';
        if (error.response?.data) {
          console.log('[LinkedIn API Response Error]', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          });
          errorMessage = error.response.data.message || error.response.statusText || errorMessage;
        }
        
        results.failed.push({
          campaignId: String(campaignId),
          error: errorMessage
        });
      }
    }

    console.log(`[LinkedIn API] Batch update completed. Success: ${results.successful.length}, Failed: ${results.failed.length}`);
    return results;
  }

  // Helper method to get date string for API calls
  private getDateString(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  // Get OAuth authorization URL
  static getAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const scope = 'r_ads_reporting,rw_ads';
    const baseUrl = 'https://www.linkedin.com/oauth/v2/authorization';
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state,
      scope: scope
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Exchange authorization code for access token
  static async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string; expires_in: number }> {
    try {
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        {
          grant_type: 'authorization_code',
          code: code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  // Bulk update campaign bids - increment all campaign bids by a specified amount
  async batchUpdateCampaignBids(
    campaignIds: string[],
    bidAdjustment: number, // Amount to increment bids by (can be negative to decrease)
    accountId: string
  ): Promise<{ 
    successful: string[]; 
    failed: Array<{ campaignId: string; error: string }> 
  }> {
    const successful: string[] = [];
    const failed: Array<{ campaignId: string; error: string }> = [];

    console.log(`[LinkedIn API] Updating bids for ${campaignIds.length} campaigns with adjustment: ${bidAdjustment}`);

    // Get all campaigns from the account first to verify which ones exist
    let allCampaigns: any[] = [];
    try {
      allCampaigns = await this.getCampaigns(accountId, { getAllPages: false });
      console.log(`[LinkedIn API] Retrieved ${allCampaigns.length} campaigns from account ${accountId}`);
    } catch (error: any) {
      console.error(`[LinkedIn API] Failed to get campaigns from account ${accountId}:`, error.message);
      return { successful: [], failed: campaignIds.map(id => ({ campaignId: id, error: 'Failed to retrieve campaigns from account' })) };
    }

    // Verify which campaigns exist and get their current data
    const validCampaignData: Array<{ id: string; campaign: any }> = [];
    for (const campaignId of campaignIds) {
      const cleanId = String(campaignId).includes('urn:li:sponsoredCampaign:') 
        ? String(campaignId).split(':').pop() 
        : String(campaignId);

      if (!cleanId) {
        failed.push({ campaignId, error: 'Invalid campaign ID format' });
        continue;
      }

      // Find the campaign in the retrieved campaigns
      const campaign = allCampaigns.find(c => 
        c.id === cleanId || 
        c.id === parseInt(cleanId) || 
        c.id === `urn:li:sponsoredCampaign:${cleanId}`
      );

      if (campaign) {
        validCampaignData.push({ id: cleanId, campaign });
        console.log(`[LinkedIn API] Found campaign ${cleanId} with current bid:`, campaign.unitCost);
      } else {
        failed.push({ campaignId: cleanId, error: `Campaign ${cleanId} not found in account ${accountId}` });
        console.log(`[LinkedIn API] Campaign ${cleanId} not found in account ${accountId}`);
      }
    }

    // Now update the valid campaigns using the reliable pattern from guidance
    for (const { id: cleanId, campaign: currentCampaign } of validCampaignData) {
      try {
        // Check if campaign has a bid that can be updated
        if (!currentCampaign.unitCost) {
          failed.push({ campaignId: cleanId, error: 'Campaign has no existing bid (unitCost)' });
          continue;
        }

        const currentBid = parseFloat(currentCampaign.unitCost.amount);
        const newBid = Math.max(0.01, currentBid + bidAdjustment); // Ensure minimum bid of $0.01
        
        // Use the reliable pattern from guidance - ensure account ID and campaign ID match
        const updateData = {
          patch: {
            $set: {
              unitCost: {
                amount: newBid.toFixed(2),
                currencyCode: currentCampaign.unitCost.currencyCode
              }
            }
          }
        };

        console.log(`[LinkedIn API] Updating campaign ${cleanId} bid from ${currentBid} to ${newBid}`);
        console.log(`[LinkedIn API] Using URL: POST /adAccounts/${accountId}/adCampaigns/${cleanId}`);
        console.log(`[LinkedIn API] Current campaign optimization:`, currentCampaign.optimizationTargetType);

        const response = await this.client.post(
          `/adAccounts/${accountId}/adCampaigns/${cleanId}`,
          updateData,
          {
            headers: {
              'X-RestLi-Method': 'PARTIAL_UPDATE',
              'LinkedIn-Version': '202506',
              'X-Restli-Protocol-Version': '2.0.0'
            }
          }
        );

        if (response.status === 204 || response.status === 200) {
          successful.push(cleanId);
          console.log(`[LinkedIn API] Successfully updated bid for campaign ${cleanId}: ${currentBid} -> ${newBid}`);
        } else {
          failed.push({ campaignId: cleanId, error: `Update failed with status ${response.status}` });
        }
      } catch (error: any) {
        console.error(`[LinkedIn API] Error updating bid for campaign ${cleanId}:`, error);
        console.error(`[LinkedIn API] Error details:`, error.response?.data || error.message);
        console.error(`[LinkedIn API] Error status:`, error.response?.status);
        console.error(`[LinkedIn API] Error headers:`, error.response?.headers);
        failed.push({ 
          campaignId: cleanId, 
          error: error.response?.data?.message || error.message || 'Unknown error' 
        });
      }
    }

    console.log(`[LinkedIn API] Bid update completed. Successful: ${successful.length}, Failed: ${failed.length}`);
    return { successful, failed };
  }
}
