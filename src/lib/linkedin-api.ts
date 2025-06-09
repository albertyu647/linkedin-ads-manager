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
        'LinkedIn-Version': '202505', // Latest API version as of May 2025
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
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
        filteredCampaigns = filteredCampaigns.filter(campaign => 
          campaign.status?.toUpperCase() === 'ACTIVE'
        );
        console.log(`[LinkedIn API] Filtered to ${filteredCampaigns.length} active campaigns`);
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
      const campaigns = campaignIds.map(id => `urn:li:sponsoredCampaign:${id}`).join(',');
      const startDate = dateRange?.start || this.getDateString(30); // Last 30 days by default
      const endDate = dateRange?.end || this.getDateString(0);

      const response = await this.client.get(
        `/adAnalytics?campaigns=List(${campaigns})&dateRange.start.day=${startDate.split('-')[2]}&dateRange.start.month=${startDate.split('-')[1]}&dateRange.start.year=${startDate.split('-')[0]}&dateRange.end.day=${endDate.split('-')[2]}&dateRange.end.month=${endDate.split('-')[1]}&dateRange.end.year=${endDate.split('-')[0]}&fields=impressions,clicks,costInUsd`
      );
      return response.data.elements || [];
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      throw error;
    }
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
      const encodedFacetUrn = encodeURIComponent(facetUrn);
      let url = `/adTargetingEntities?q=adTargetingFacet&facet=${encodedFacetUrn}&locale=(language:en,country:US)`;
      
      if (query) {
        url = `/adTargetingEntities?q=typeahead&facet=${encodedFacetUrn}&query=${encodeURIComponent(query)}&locale=(language:en,country:US)`;
      }

      const response = await this.client.get(url);
      return response.data.elements || [];
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

  // Batch update campaigns - fixed to preserve existing include targeting while updating exclude
  async batchUpdateCampaigns(
    campaignIds: string[],
    excludedTargeting: Record<string, string[]>,
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
    console.log('[Excluded Targeting]', excludedTargeting);

    for (const campaignId of campaignIds) {
      try {
        // Extract just the campaign ID from the URN if it's a full URN
        const campaignIdStr = String(campaignId);
        const cleanCampaignId = campaignIdStr.includes('urn:li:sponsoredCampaign:') 
          ? campaignIdStr.split(':').pop() 
          : campaignIdStr;

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

        // Use POST method with patch structure as per LinkedIn API documentation
        const response = await this.client.post(
          `/adAccounts/${accountId}/adCampaigns/${cleanCampaignId}`,
          patchData,
          {
            headers: {
              'X-RestLi-Method': 'PARTIAL_UPDATE'
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
} 