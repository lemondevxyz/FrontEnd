import apiRequest from '../../../services/apiRequest';
import urls from '../../../urls.json';

// ===========================
// Type Definitions
// ===========================

export interface PricingRequest {
  user_id: string;
  country_name: string;
  city_name: string;
  datasets: string[];
  intelligences: string[];
  displayed_price: number;
  report?: string;
  report_potential_business_type?: string;
}

export interface ReportItem {
  user_id: string;
  city_name: string;
  country_name: string;
  cost: number;
  expiration: string | null;
  explanation: string;
  is_currently_owned: boolean;
  free_as_part_of_package: boolean | null;
  report_tier: string;
  report_potential_business_type?: string;
  description?: string;
  data_variables?: Record<string, string>;
  coming_soon?: boolean;
}

export interface DatasetItem {
  user_id: string;
  city_name: string;
  country_name: string;
  cost: number;
  expiration: string | null;
  explanation: string;
  is_currently_owned: boolean;
  free_as_part_of_package: boolean | null;
  dataset_name: string;
  api_calls?: number;
  description?: string;
  data_variables?: Record<string, string>;
}

export interface IntelligenceItem {
  user_id: string;
  city_name: string;
  country_name: string;
  cost: number;
  expiration: string | null;
  explanation: string;
  is_currently_owned: boolean;
  free_as_part_of_package: boolean | null;
  intelligence_name: string;
  description?: string;
  data_variables?: Record<string, string>;
}

export interface PriceData {
  total_cost: number;
  report_purchase_items?: ReportItem[];
  dataset_purchase_items?: DatasetItem[];
  intelligence_purchase_items?: IntelligenceItem[];
}

export interface TierPricingResponse {
  basic: number | null;
  standard: number | null;
  premium: number | null;
  availability: {
    basic: boolean;
    standard: boolean;
    premium: boolean;
  };
}

export interface TierPricingParams {
  user_id: string;
  country_name: string;
  city_name: string;
  datasets: string[];
  report_potential_business_type?: string;
}

export interface LocationPricingParams {
  user_id: string;
  country_name: string;
  city_name: string;
  datasets: string[];
  reportType: string; // 'single_location_premium'
  report_potential_business_type?: string;
}

export interface AdditionalCostParams {
  user_id: string;
  country_name: string;
  city_name: string;
  datasets: string[];
  reportTier: string;
  report_potential_business_type?: string;
}

export interface LocationPricingResponse {
  price: number | null;
  comingSoon: boolean;
}

// ===========================
// Report Pricing Service Class
// ===========================

class ReportPricingService {
  private cache = new Map<string, PriceData>();
  private loadingPromises = new Map<string, Promise<PriceData>>();

  /**
   * Generates a deterministic cache key for a pricing request
   * Format: "country|city|datasets|report|businessType"
   * Example: "USA|New York|pharmacy,supermarket|premium|pharmacy"
   */
  private generateCacheKey(request: PricingRequest): string {
    const location = `${request.country_name}|${request.city_name}`;
    const datasets = [...request.datasets].sort().join(',');
    const intelligences = [...request.intelligences].sort().join(',');
    const report = request.report || '';
    const businessType = request.report_potential_business_type || '';
    return `${location}|[${datasets}]|[${intelligences}]|${report}|${businessType}`;
  }

  /**
   * Fetch pricing data with caching and request deduplication
   */
  async fetchPrice(request: PricingRequest): Promise<PriceData> {
    const cacheKey = this.generateCacheKey(request);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check if already loading (request deduplication)
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Create new loading promise
    const loadingPromise = this.loadPriceData(request);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const data = await loadingPromise;
      this.cache.set(cacheKey, data);
      return data;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Makes the actual API call to fetch pricing data
   */
  private async loadPriceData(request: PricingRequest): Promise<PriceData> {
    try {
      const response = await apiRequest({
        url: urls.calculate_cart_cost,
        method: 'POST',
        body: request,
        isAuthRequest: true,
        useCache: false, // Don't use apiRequest's localStorage cache for pricing
      });

      return response.data.data as PriceData;
    } catch (error: unknown) {
      console.error('Error loading price data:', error);
      throw error;
    }
  }

  /**
   * Fetch pricing for all three report tiers (basic, standard, premium)
   * Makes 3 parallel API calls, but deduplicates if called multiple times
   */
  async fetchTierPricing(params: TierPricingParams): Promise<TierPricingResponse> {
    const tiers: Array<'basic' | 'standard' | 'premium'> = ['basic', 'standard', 'premium'];

    const pricePromises = tiers.map(async tier => {
      try {
        const request: PricingRequest = {
          user_id: params.user_id,
          country_name: params.country_name,
          city_name: params.city_name,
          datasets: params.datasets,
          intelligences: [],
          displayed_price: 0,
          report: tier,
        };

        // Include report_potential_business_type if provided
        if (params.report_potential_business_type) {
          request.report_potential_business_type = params.report_potential_business_type;
        }

        const data = await this.fetchPrice(request);
        const reportItem = data.report_purchase_items?.find(item => item.report_tier === tier);
        const comingSoon = reportItem?.coming_soon === true;

        return {
          tier,
          price: data.total_cost,
          comingSoon,
        };
      } catch (error) {
        console.error(`Error calculating price for ${tier} tier:`, error);
        return {
          tier,
          price: null,
          comingSoon: false,
        };
      }
    });

    const results = await Promise.all(pricePromises);

    // Build response
    const response: TierPricingResponse = {
      basic: null,
      standard: null,
      premium: null,
      availability: {
        basic: true,
        standard: true,
        premium: true,
      },
    };

    results.forEach(({ tier, price, comingSoon }) => {
      response[tier] = price;
      response.availability[tier] = !comingSoon;
    });

    return response;
  }

  /**
   * Fetch pricing for a location report
   */
  async fetchLocationPricing(params: LocationPricingParams): Promise<LocationPricingResponse> {
    try {
      const request: PricingRequest = {
        user_id: params.user_id,
        country_name: params.country_name,
        city_name: params.city_name,
        datasets: params.datasets,
        intelligences: [],
        displayed_price: 0,
        report: params.reportType,
      };

      // Include report_potential_business_type if provided
      if (params.report_potential_business_type) {
        request.report_potential_business_type = params.report_potential_business_type;
      }

      const data = await this.fetchPrice(request);
      const reportItem = data.report_purchase_items?.[0];
      const comingSoon = reportItem?.coming_soon === true;

      return {
        price: data.total_cost,
        comingSoon,
      };
    } catch (error) {
      console.error('Error calculating location report price:', error);
      return {
        price: null,
        comingSoon: false,
      };
    }
  }

  /**
   * Fetch additional cost for extra datasets
   */
  async fetchAdditionalCost(params: AdditionalCostParams): Promise<number | null> {
    try {
      const request: PricingRequest = {
        user_id: params.user_id,
        country_name: params.country_name,
        city_name: params.city_name,
        datasets: params.datasets,
        intelligences: [],
        displayed_price: 0,
        report: params.reportTier,
      };

      // Include report_potential_business_type if provided
      if (params.report_potential_business_type) {
        request.report_potential_business_type = params.report_potential_business_type;
      }

      const data = await this.fetchPrice(request);
      const additionalCost = data?.dataset_purchase_items?.reduce(
        (acc, item) => acc + item.cost,
        0
      );
      return additionalCost && additionalCost > 0 ? additionalCost : null;
    } catch (error) {
      console.error('Error calculating additional cost:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific location
   * Useful when user changes location
   */
  clearLocation(country: string, city: string): void {
    const locationPrefix = `${country}|${city}`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(locationPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   * Useful for testing or when user logs out
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cached price data without making an API call
   * Returns null if not in cache
   */
  getCachedPrice(request: PricingRequest): PriceData | null {
    const cacheKey = this.generateCacheKey(request);
    return this.cache.get(cacheKey) || null;
  }
}

// Export singleton instance
export const reportPricingService = new ReportPricingService();
