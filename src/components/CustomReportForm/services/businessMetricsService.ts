import apiRequest from '../../../services/apiRequest';
import urls from '../../../urls.json';

export interface MetricConfig {
  name: string;
  description: string;
  icon: string;
  default_weight: number;
  min_weight?: number;
  max_weight?: number;
}

export interface BusinessTypeConfig {
  business_type: string;
  display_name: string;
  icon: string;
  description: string;
  metrics: Record<string, MetricConfig>;
}

export interface BusinessTypeResponse {
  success: boolean;
  data: BusinessTypeConfig;
  error?: string;
  message?: string;
}

class BusinessMetricsService {
  private cache = new Map<string, BusinessTypeConfig>();
  private loadingPromises = new Map<string, Promise<BusinessTypeConfig>>();

  /**
   * Fetch business type configuration from the API
   */
  async fetchBusinessTypeConfig(businessType: string): Promise<BusinessTypeConfig> {
    // Check cache first
    if (this.cache.has(businessType)) {
      return this.cache.get(businessType)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(businessType)) {
      return this.loadingPromises.get(businessType)!;
    }

    // Create loading promise
    const loadingPromise = this.loadBusinessTypeConfig(businessType);
    this.loadingPromises.set(businessType, loadingPromise);

    try {
      const config = await loadingPromise;
      this.cache.set(businessType, config);
      return config;
    } finally {
      this.loadingPromises.delete(businessType);
    }
  }

  private async loadBusinessTypeConfig(businessType: string): Promise<BusinessTypeConfig> {
    try {
      const response = await apiRequest({
        url: `${urls.business_category_metrics}/${businessType}`,
        method: 'GET',
      });

      // The apiRequest returns axios response, so we need to access response.data
      const apiResponse = response.data;

      if (apiResponse.success && apiResponse.data) {
        return apiResponse.data;
      } else {
        throw new Error(apiResponse.message || `Business type '${businessType}' is not supported`);
      }
    } catch (error: unknown) {
      // Check if it's a 404 error (business type not supported yet)
      if (error?.response?.status === 404 || error?.response?.status === 400) {
        throw new Error(
          `Business type '${businessType}' is not yet supported. Please check again in the future.`
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Clear cache (useful for testing or when configurations change)
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cached configuration without making API call
   */
  getCachedConfig(businessType: string): BusinessTypeConfig | null {
    return this.cache.get(businessType) || null;
  }
}

// Export singleton instance
export const businessMetricsService = new BusinessMetricsService();
