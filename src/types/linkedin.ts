export interface LinkedInAccount {
  id: string;
  name: string;
  type: string;
  status: string;
  currency?: string;
}

export interface LinkedInCampaign {
  id?: string;
  name?: string;
  status?: string;
  type?: string;
  account?: string;
  campaignGroup?: string;
  dailyBudget?: {
    amount: string;
    currencyCode: string;
  };
  totalBudget?: {
    amount: string;
    currencyCode: string;
  };
  costType?: string;
  unitCost?: {
    amount: string;
    currencyCode: string;
  };
  runSchedule?: {
    start?: number;
    end?: number;
  };
  audienceExpansionEnabled?: boolean;
  offsiteDeliveryEnabled?: boolean;
  creativeSelection?: string;
  locale?: {
    country: string;
    language: string;
  };
  targetingCriteria?: any;
  servingStatuses?: string[];
  test?: boolean;
  associatedEntity?: string;
  optimizationTargetType?: string;
  format?: string;
  pacingStrategy?: string;
  spent?: {
    amount: string;
    currencyCode: string;
  };
}

export interface LinkedInTargetingEntity {
  id: string;
  name: string;
  type: string;
}

export interface LinkedInBatchUpdateRequest {
  campaignIds: string[];
  excludeTargeting: {
    industries?: string[];
    jobTitles?: string[];
    skills?: string[];
    locations?: string[];
  };
}

export interface TargetingEntity {
  urn: string;
  name: string;
  id?: string;
  type?: string;
}

export interface TargetingFacet {
  urn: string;
  name: string;
  type: string;
}

export interface CampaignStats {
  campaignId: string;
  impressions?: number;
  clicks?: number;
  costInUsd?: number;
}

export interface BatchUpdateRequest {
  campaignIds: string[];
  excludedTargeting: Record<string, string[]>;
  accountId: string;
}

export interface CampaignTargeting {
  include?: {
    and: Array<{
      or: Record<string, string[]>;
    }>;
  };
  exclude?: {
    or: Record<string, string[]>;
  };
} 