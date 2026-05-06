import React, { useEffect, useMemo, useCallback } from 'react';
import { formatSubcategoryName, fuzzyMatchCategoryType } from '../../../../utils/helperFunctions';
import urls from '../../../../urls.json';
import { useAuth } from '../../../../context/AuthContext';
import apiRequest from '../../../../services/apiRequest';
import { MdAttachMoney, MdCheckCircle, MdClose, MdHome, MdSearch } from 'react-icons/md';
import { CategoryData } from '../../../../types/allTypesAndInterfaces';
import { useBillingContext, type ReportTier } from '../../../../context/BillingContext';
import ItemSelectionView from './ItemSelectionView';
import CheckoutModal from './CheckoutModal';
import CategoriesBrowserSubCategories from '../../../../components/CategoriesBrowserSubCategories/CategoriesBrowserSubCategories';
import { Skeleton } from '../../../../components/common/Skeleton';
import { toast } from 'sonner';
import { t } from '../../../../i18n';
import metaDataInformation from '../../../../data/metaDataInformation.json';


interface DataVariable {
  key: string;
  description: string;
}

interface SelectedItemData {
  name: string;
  type: 'dataset' | 'intelligence' | 'report';
  description: string;
  dataVariables: DataVariable[];
  price?: number;
  itemKey?: string;
  isCurrentlyOwned?: boolean;
  expiration?: string;
  explanation?: string;
}

interface PurchaseItem {
  cost: number;
  description?: string;
  data_variables?: Record<string, string>;
  is_currently_owned: boolean;
  expiration: string | null;
  explanation: string;
  [key: string]: unknown;
}

interface PriceData {
  total_cost?: number;
  intelligence_purchase_items?: Array<{
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
  }>;
  dataset_purchase_items?: Array<{
    user_id: string;
    city_name: string;
    country_name: string;
    cost: number;
    expiration: string | null;
    explanation: string;
    is_currently_owned: boolean;
    free_as_part_of_package: boolean | null;
    dataset_name: string;
    data_type?: string;
    api_calls?: number;
    description?: string;
    data_variables?: Record<string, string>;
  }>;
  report_purchase_items?: Array<{
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
  }>;
}

interface ReportPackage {
  report_tier: string;
  name: string;
  // Support both field naming conventions from API
  price?: number;
  price_usd?: number;
  perks?: string[];
  // New API format: array of intelligence names
  included_intelligences?: string[];
  // Old API format: object with boolean flags
  intelligences?: {
    ai?: boolean;
    income?: boolean;
    population?: boolean;
    realEstate?: boolean;
    competition?: boolean;
    poi?: boolean;
  };
  is_most_popular?: boolean;
  concierge_service?: string;
  dataset_limit?: number;
  included_datasets_count?: number;
  included_report_refreshes?: number;
  additional_dataset_cost?: number;
  tag?: string;
  description?: string;
  data_variables?: Record<string, string>;
}

interface ReportTierData {
  id: string;
  name: string;
  price: number;
  reportKey: ReportTier;
  perks: string[];
  intelligences: {
    ai: boolean;
    income: boolean;
    population: boolean;
    realEstate: boolean;
    competition: boolean;
    poi: boolean;
  };
  isMostPopular: boolean;
  conciergeService?: string;
  datasetLimit?: number;
  additionalDatasetCost?: number;
  tag?: string;
  /** Translated description – populated from frontend translation system */
  description?: string;
}

const itemConfig = {
  intelligence: {
    arrayKey: 'intelligence_purchase_items' as const,
    matchKey: 'intelligence_name' as const,
  },
  dataset: {
    arrayKey: 'dataset_purchase_items' as const,
    matchKey: 'dataset_name' as const,
  },
  report: {
    arrayKey: 'report_purchase_items' as const,
    matchKey: 'report_tier' as const,
  },
} as const;

function CheckoutBilling({ Name }: { Name: string }) {
  const [categories, setCategories] = React.useState<CategoryData>({});
  const [openedCategories, setOpenedCategories] = React.useState<string[]>([]);
  const [isCalculatingCost, setIsCalculatingCost] = React.useState(false);
  const [isCalculatingPrices, setIsCalculatingPrices] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedItem, setSelectedItem] = React.useState<SelectedItemData | null>(null);
  const [selectedItemKey, setSelectedItemKey] = React.useState<{
    key: string;
    type: 'dataset' | 'intelligence' | 'report';
    name: string;
  } | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = React.useState(false);

  // priceData: ONLY for displaying prices (fetches ALL items)
  const [priceData, setPriceData] = React.useState<PriceData | null>(null);

  // Track last location used for price fetching
  const [lastPriceLocation, setLastPriceLocation] = React.useState<{
    country_name: string;
    city_name: string;
  } | null>(null);

  // cartCostResponse: For cart management and checked items (fetches only checked items)
  const [cartCostResponse, setCartCostResponse] = React.useState<{
    data?: PriceData;
  } | null>(null);

  const [hasInitializedArea, setHasInitializedArea] = React.useState(false);
  const [hasInitializedDatasets, setHasInitializedDatasets] = React.useState(false);
  const [hasInitializedReports, setHasInitializedReports] = React.useState(false);
  const [activeView, setActiveView] = React.useState<'area' | 'datasets' | 'reports'>('area');
  const [reportTiers, setReportTiers] = React.useState<ReportTierData[]>([]);
  const [isLoadingReportTiers, setIsLoadingReportTiers] = React.useState(false);
  const [businessTypeSearchTerm, setBusinessTypeSearchTerm] = React.useState('');
  const [isBusinessTypeDropdownOpen, setIsBusinessTypeDropdownOpen] = React.useState(false);

  // Track last fetched report price params to prevent duplicate fetches
  const [lastFetchedReportParams, setLastFetchedReportParams] = React.useState<{
    country: string;
    city: string;
    businessType: string;
    report: string;
  } | null>(null);

  const { authResponse } = useAuth();
  const { checkout, dispatch } = useBillingContext();

  const hasCountryAndCity = !!(checkout.country_name?.trim() && checkout.city_name?.trim());
  const addToCartDisabled = !hasCountryAndCity;
  const addToCartMessage = !hasCountryAndCity
    ? 'Please select country and city to add items to cart.'
    : undefined;

  // Update active view when Name changes
  useEffect(() => {
    if (Name === 'area') {
      setActiveView('area');
    } else if (Name === 'reports') {
      setActiveView('reports');
    } else {
      setActiveView('datasets');
    }
  }, [Name]);

  // Fetch report packages from API
  const fetchReportPackages = useCallback(async () => {
    setIsLoadingReportTiers(true);
    try {
      const response = await apiRequest({
        url: urls.report_packages,
        method: 'GET',
      });
      
      const rawData = response?.data?.data || response?.data || {};
      
      // Convert object response to array if needed
      // API returns { basic: {...}, standard: {...}, premium: {...}, ... }
      let packages: ReportPackage[];
      if (Array.isArray(rawData)) {
        packages = rawData;
      } else if (typeof rawData === 'object' && rawData !== null) {
        // Convert object to array, using the key as report_tier
        packages = Object.entries(rawData).map(([key, value]) => ({
          report_tier: key,
          ...(value as Omit<ReportPackage, 'report_tier'>),
        }));
      } else {
        packages = [];
      }
      
      // Derive intelligences from included_intelligences array (API no longer sends description)
      const parseIntelligencesFromArray = (
        included: string[],
        reportTier: string
      ): ReportTierData['intelligences'] => {
        const arr = (included || []).map(s => s.toLowerCase());
        const isPremium = reportTier === 'premium' || reportTier === 'single_location_premium';
        return {
          ai: isPremium,
          income: arr.includes('income'),
          population: arr.includes('population'),
          realEstate: true,
          competition: true,
          poi: true,
        };
      };

      // Derive perks from tier key (no longer parsed from description)
      const getTierPerks = (reportTier: string, hasConcierge: boolean, pkg: ReportPackage): string[] => {
        if (pkg.perks && pkg.perks.length > 0) return pkg.perks;
        const perks: string[] = [];
        if (reportTier === 'basic') {
          perks.push('Preset Scoring', '1x Report', 'Full Data Access');
        } else {
          perks.push('Custom Scoring', 'Full Data Access');
        }
        if (pkg.included_report_refreshes) {
          perks.push(`${pkg.included_report_refreshes}x Report Refreshes`);
        }
        if (hasConcierge) perks.push('Personal Concierge Service');
        return perks;
      };

      // Transform API data to match our component structure
      const transformedTiers: ReportTierData[] = packages.map((pkg) => {
        const hasConcierge = pkg.report_tier === 'premium' || pkg.report_tier === 'single_location_premium';
        const intelligences = pkg.intelligences
          ? {
              ai: pkg.intelligences.ai ?? false,
              income: pkg.intelligences.income ?? false,
              population: pkg.intelligences.population ?? false,
              realEstate: pkg.intelligences.realEstate ?? true,
              competition: pkg.intelligences.competition ?? true,
              poi: pkg.intelligences.poi ?? true,
            }
          : parseIntelligencesFromArray(pkg.included_intelligences || [], pkg.report_tier);

        // Name and description come from frontend translation system
        const tierName = t(`report-package-${pkg.report_tier}`);
        const tierDescription = t(`report-package-${pkg.report_tier}-description`, {
          included_datasets_count: pkg.included_datasets_count ?? 0,
        });

        return {
          id: `report-${pkg.report_tier}-tier`,
          name: tierName || pkg.name || `${pkg.report_tier.charAt(0).toUpperCase() + pkg.report_tier.slice(1)} Tier`,
          price: pkg.price_usd || pkg.price || 0,
          reportKey: pkg.report_tier as ReportTier,
          perks: getTierPerks(pkg.report_tier, hasConcierge, pkg),
          intelligences,
          isMostPopular: pkg.is_most_popular ?? (pkg.report_tier === 'premium'),
          conciergeService: pkg.concierge_service || (hasConcierge ? 'Personal consultant to guide your business expansion' : undefined),
          datasetLimit: pkg.dataset_limit || pkg.included_datasets_count,
          additionalDatasetCost: pkg.additional_dataset_cost ?? 300,
          tag: pkg.tag,
          description: tierDescription,
        };
      });

// Tier with the smallest order is shown first
      const tierOrder: Record<string, number> = { 
        basic: 2,
        standard: 1, 
        single_location_premium: 3, 
        premium: 0
      };
      transformedTiers.sort((a, b) => {
        const orderA = tierOrder[a.reportKey] ?? 999;
        const orderB = tierOrder[b.reportKey] ?? 999;
        return orderA - orderB;
      });

      setReportTiers(transformedTiers);
    } catch (error) {
      console.error('Error fetching report packages:', error);
      // Fallback to empty array or default tiers if needed
      setReportTiers([]);
    } finally {
      setIsLoadingReportTiers(false);
    }
  }, []);

  // Fetch categories and report packages on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const res = await apiRequest({
          url: urls.nearby_categories,
          method: 'get',
        });
        const categoriesData = res.data.data;
        setCategories(categoriesData);
      } catch {
        // Silently handle error
      }
    };
    fetchInitialData();
    fetchReportPackages();
  }, [fetchReportPackages]);

  // Mark views as initialized when they're opened
  useEffect(() => {
    if (activeView === 'area' && !hasInitializedArea) {
      setHasInitializedArea(true);
    }
  }, [activeView, hasInitializedArea]);

  useEffect(() => {
    if (
      activeView === 'datasets' &&
      !hasInitializedDatasets &&
      Object.keys(categories).length > 0
    ) {
      setHasInitializedDatasets(true);
    }
  }, [activeView, hasInitializedDatasets, categories]);

  useEffect(() => {
    if (activeView === 'reports' && !hasInitializedReports) {
      setHasInitializedReports(true);
    }
  }, [activeView, hasInitializedReports]);

  const formatPrice = useCallback(
    (value: number) =>
      `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    []
  );

  const population_intelligence = useMemo(() => {
    return priceData?.intelligence_purchase_items?.find(i => i.intelligence_name === 'Population');
  }, [priceData]);

  const income_intelligence = useMemo(() => {
    return priceData?.intelligence_purchase_items?.find(i => i.intelligence_name === 'Income');
  }, [priceData]);

  const real_estate_intelligence = useMemo(() => {
    return priceData?.intelligence_purchase_items?.find(i => i.intelligence_name === 'Real Estate');
  }, [priceData]);

  const handleDatasetToggle = useCallback(
    (type: string) => {
      if (!checkout.country_name || !checkout.city_name) {
        toast.error(t("please-select-a-country-and-city-before-adding-datasets"));
        return;
      }
      dispatch({ type: 'toggleDataset', payload: type });
    },
    [dispatch, checkout.country_name, checkout.city_name]
  );

  const handleIntelligenceToggle = useCallback(
    (service: 'population' | 'income' | 'real_estate') => {
      const formatted =
        service === 'population' ? 'Population' : service === 'income' ? 'Income' : 'Real Estate';
      dispatch({ type: 'toggleIntelligence', payload: formatted });
    },
    [dispatch]
  );

  const handleReportToggle = useCallback(
    (reportKey: ReportTier) => {
      if (checkout.report === reportKey) {
        dispatch({ type: 'setReport', payload: '' });
      } else {
        dispatch({ type: 'setReport', payload: reportKey });
      }
    },
    [checkout.report, dispatch]
  );

  /**
   * Fetch area intelligence prices - sends only intelligences
   */
  const fetchAreaPrices = useCallback(async () => {
    if (!authResponse?.localId) {
      return;
    }

    const currentCountry = checkout.country_name || '';
    const currentCity = checkout.city_name || '';

    // Check if location has changed
    const locationChanged =
      !lastPriceLocation ||
      lastPriceLocation.country_name !== currentCountry ||
      lastPriceLocation.city_name !== currentCity;

    // Check if intelligences data already exists AND location hasn't changed
    if (
      !locationChanged &&
      priceData?.intelligence_purchase_items &&
      priceData.intelligence_purchase_items.length > 0
    ) {
      return; // Already have intelligence prices for this location, skip fetch
    }

    const allIntelligences = ['Income', 'Population', 'Real Estate'];

    setIsCalculatingPrices(true);

    try {
      const requestBody: {
        user_id: string;
        country_name: string;
        city_name: string;
        datasets: string[];
        intelligences: string[];
        displayed_price: number;
      } = {
        user_id: authResponse.localId,
        country_name: currentCountry,
        city_name: currentCity,
        datasets: [], // No datasets for area view
        intelligences: allIntelligences,
        displayed_price: 0,
      };

      const response = await apiRequest({
        url: urls.calculate_cart_cost,
        method: 'POST',
        body: requestBody,
        isAuthRequest: true,
      });
      console.log('Area price data:', response.data);

      // Update last location used
      setLastPriceLocation({
        country_name: currentCountry,
        city_name: currentCity,
      });

      // Merge with existing priceData, preserving other data
      setPriceData(prev => ({
        total_cost: response.data.data.total_cost ?? prev?.total_cost,
        intelligence_purchase_items: response.data.data.intelligence_purchase_items,
        dataset_purchase_items: prev?.dataset_purchase_items ?? undefined,
        report_purchase_items: prev?.report_purchase_items ?? undefined,
      }));
    } catch {
      // Don't clear existing data on error
    } finally {
      setIsCalculatingPrices(false);
    }
  }, [
    authResponse?.localId,
    checkout.country_name,
    checkout.city_name,
    priceData,
    lastPriceLocation,
  ]);

  /**
   * Fetch dataset prices - sends only datasets
   */
  const fetchDatasetPrices = useCallback(async () => {
    if (!authResponse?.localId) {
      return;
    }

    const currentCountry = checkout.country_name || '';
    const currentCity = checkout.city_name || '';

    // Check if location has changed
    const locationChanged =
      !lastPriceLocation ||
      lastPriceLocation.country_name !== currentCountry ||
      lastPriceLocation.city_name !== currentCity;

    // Check if datasets data already exists AND location hasn't changed
    if (
      !locationChanged &&
      priceData?.dataset_purchase_items &&
      priceData.dataset_purchase_items.length > 0
    ) {
      return; // Already have dataset prices for this location, skip fetch
    }

    // Extract all available datasets from categories
    const allDatasets: string[] = [];
    Object.values(categories).forEach(types => {
      if (Array.isArray(types)) {
        allDatasets.push(...types);
      }
    });

    if (allDatasets.length === 0) {
      return; // No datasets to fetch
    }

    setIsCalculatingPrices(true);

    try {
      const requestBody: {
        user_id: string;
        country_name: string;
        city_name: string;
        datasets: string[];
        intelligences: string[];
        displayed_price: number;
      } = {
        user_id: authResponse.localId,
        country_name: currentCountry,
        city_name: currentCity,
        datasets: allDatasets,
        intelligences: [], // No intelligences for datasets view
        displayed_price: 0,
      };

      const response = await apiRequest({
        url: urls.calculate_cart_cost,
        method: 'POST',
        body: requestBody,
        isAuthRequest: true,
      });
      console.log('Dataset price data:', response.data);

      // Update last location used
      setLastPriceLocation({
        country_name: currentCountry,
        city_name: currentCity,
      });

      // Merge with existing priceData, preserving other data
      setPriceData(prev => ({
        total_cost: response.data.data.total_cost ?? prev?.total_cost,
        intelligence_purchase_items: prev?.intelligence_purchase_items ?? undefined,
        dataset_purchase_items: response.data.data.dataset_purchase_items,
        report_purchase_items: prev?.report_purchase_items ?? undefined,
      }));
    } catch {
      // Don't clear existing data on error
    } finally {
      setIsCalculatingPrices(false);
    }
  }, [
    authResponse?.localId,
    checkout.country_name,
    checkout.city_name,
    categories,
    priceData,
    lastPriceLocation,
  ]);

  /**
   * Fetch price for a specific selected report
   * Only fetches when all required fields are present and a report is selected
   */
  const fetchSelectedReportPrice = useCallback(async () => {
    if (!authResponse?.localId) {
      return;
    }

    const currentCountry = checkout.country_name || '';
    const currentCity = checkout.city_name || '';
    const currentBusinessType = checkout.report_potential_business_type || '';
    const selectedReport = checkout.report;

    // Don't fetch if required fields are missing or no report is selected
    if (!currentCountry || !currentCity || !currentBusinessType || !selectedReport) {
      return;
    }

    // Check if we already fetched with these exact params
    if (
      lastFetchedReportParams &&
      lastFetchedReportParams.country === currentCountry &&
      lastFetchedReportParams.city === currentCity &&
      lastFetchedReportParams.businessType === currentBusinessType &&
      lastFetchedReportParams.report === selectedReport
    ) {
      return; // Already fetched with these params, skip
    }

    setIsCalculatingPrices(true);

    try {
      const requestBody: {
        user_id: string;
        country_name: string;
        city_name: string;
        datasets: string[];
        intelligences: string[];
        displayed_price: number;
        report?: ReportTier;
        report_potential_business_type?: string;
      } = {
        user_id: authResponse.localId,
        country_name: currentCountry,
        city_name: currentCity,
        datasets: [], // No datasets for reports view
        intelligences: [], // No intelligences for reports view
        displayed_price: 0,
        report: selectedReport as ReportTier,
      };

      // Include report_potential_business_type if provided
      if (currentBusinessType && currentBusinessType.trim()) {
        requestBody.report_potential_business_type = currentBusinessType.trim();
      }

      const response = await apiRequest({
        url: urls.calculate_cart_cost,
        method: 'POST',
        body: requestBody,
        isAuthRequest: true,
      });
      console.log('Selected report price data:', response.data);

      // Mark these params as fetched
      setLastFetchedReportParams({
        country: currentCountry,
        city: currentCity,
        businessType: currentBusinessType,
        report: selectedReport,
      });

      // Update priceData with the calculated price for the selected report
      // Merge with existing priceData, preserving other data
      setPriceData(prev => {
        const existingReportItems = prev?.report_purchase_items || [];
        const newReportItems = response.data.data.report_purchase_items || [];
        
        // Merge: keep existing items, update/add the selected report's price
        const mergedReportItems = [...existingReportItems];
        newReportItems.forEach(newItem => {
          const existingIndex = mergedReportItems.findIndex(
            item => item.report_tier === newItem.report_tier
          );
          if (existingIndex >= 0) {
            mergedReportItems[existingIndex] = newItem;
          } else {
            mergedReportItems.push(newItem);
          }
        });

        return {
        total_cost: response.data.data.total_cost ?? prev?.total_cost,
        intelligence_purchase_items: prev?.intelligence_purchase_items ?? undefined,
        dataset_purchase_items: prev?.dataset_purchase_items ?? undefined,
          report_purchase_items: mergedReportItems,
        };
      });
    } catch {
      // Don't clear existing data on error
    } finally {
      setIsCalculatingPrices(false);
    }
  }, [
    authResponse?.localId,
    checkout.country_name,
    checkout.city_name,
    checkout.report_potential_business_type,
    checkout.report,
    lastFetchedReportParams,
  ]);

  /**
   * Fetch a single report's details (description + data_variables) for "View Details" panel.
   * Does not add the report to cart; only loads display data into priceData.
   */
  const fetchReportDetailsForView = useCallback(
    async (reportKey: string) => {
      if (!authResponse?.localId) return;
      const country = checkout.country_name || '';
      const city = checkout.city_name || '';
      const businessType = (checkout.report_potential_business_type || '').trim();
      if (!country || !city || !businessType) return;

      setIsCalculatingPrices(true);
      try {
        const response = await apiRequest({
          url: urls.calculate_cart_cost,
          method: 'POST',
          body: {
            user_id: authResponse.localId,
            country_name: country,
            city_name: city,
            datasets: [],
            intelligences: [],
            displayed_price: 0,
            report: reportKey as ReportTier,
            report_potential_business_type: businessType,
          },
          isAuthRequest: true,
        });
        const newReportItems = response?.data?.data?.report_purchase_items || [];
        if (newReportItems.length === 0) return;
        setPriceData(prev => {
          const existing = prev?.report_purchase_items || [];
          const merged = [...existing];
          newReportItems.forEach((newItem: { report_tier: string }) => {
            const i = merged.findIndex(item => item.report_tier === newItem.report_tier);
            if (i >= 0) merged[i] = newItem as (typeof merged)[0];
            else merged.push(newItem as (typeof merged)[0]);
          });
          return {
            ...(prev ?? {}),
            report_purchase_items: merged,
          } as PriceData;
        });
      } catch {
        // Keep existing priceData on error
      } finally {
        setIsCalculatingPrices(false);
      }
    },
    [
      authResponse?.localId,
      checkout.country_name,
      checkout.city_name,
      checkout.report_potential_business_type,
    ]
  );

  /**
   * Calculate cart cost - sends only CHECKED items for cart management
   *
   * This function sends only the items that user has checked/selected.
   * The cartCostResponse is used for cart management and checkout.
   */
  const calculateCartCost = useCallback(async (promotionCode?: string) => {
    if (!authResponse?.localId) {
      return;
    }

    // Don't calculate if there are no items in cart
    if (
      checkout.datasets.length === 0 &&
      checkout.intelligences.length === 0 &&
      checkout.report === ''
    ) {
      setCartCostResponse(null);
      return;
    }

    // When a report is in the cart, the API requires report_potential_business_type
    if (checkout.report && !checkout.report_potential_business_type?.trim()) {
      toast.error(t("please-select-a-report-potential-business-type-to-see-pricing"));
      return;
    }

    setIsCalculatingCost(true);

    try {
      const requestBody: {
        user_id: string;
        country_name: string;
        city_name: string;
        datasets: string[];
        intelligences: string[];
        displayed_price: number;
        report?: ReportTier;
        report_potential_business_type?: string;
        promotion_code?: string;
      } = {
        user_id: authResponse.localId,
        country_name: checkout.country_name || '',
        city_name: checkout.city_name || '',
        datasets: checkout.datasets, // Only checked datasets
        intelligences: checkout.intelligences, // Only checked intelligences
        displayed_price: 0,
      };

      // Only include report if it's selected
      if (checkout.report) {
        requestBody.report = checkout.report;
      }

      // Include report_potential_business_type if provided
      if (checkout.report_potential_business_type && checkout.report_potential_business_type.trim()) {
        requestBody.report_potential_business_type = checkout.report_potential_business_type.trim();
      }

      // Include promotion code if provided (as 'code' for calculate_cart_cost)
      if (promotionCode && promotionCode.trim()) {
        requestBody.promotion_code = promotionCode.trim();
      }

      const response = await apiRequest({
        url: urls.calculate_cart_cost,
        method: 'POST',
        body: requestBody,
        isAuthRequest: true,
      });
      console.log('Cart cost:', response.data);

      setCartCostResponse(response.data);
    } catch (error) {
      console.error('Failed to calculate cart cost:', error);
      setCartCostResponse(null);
    } finally {
      setIsCalculatingCost(false);
    }
  }, [authResponse?.localId, checkout]);

  // Helper function to convert data_variables object to array (values may be plain text or t() keys)
  const convertDataVariables = useCallback(
    (dataVars: Record<string, string> | undefined): DataVariable[] => {
      if (!dataVars) return [];
      return Object.entries(dataVars).map(([key, description]) => ({
        key,
        description,
      }));
    },
    []
  );

  // Look up description and data variables from the local metaDataInformation.json
  const getLocalMetadata = useCallback(
    (
      type: 'dataset' | 'intelligence' | 'report',
      key: string,
      item?: PurchaseItem
    ): { description: string; dataVariables: DataVariable[] } => {
      if (type === 'intelligence') {
        const intelKey = key.replace(/ /g, '_').toLowerCase() as keyof typeof metaDataInformation.intelligence;
        const meta = metaDataInformation.intelligence[intelKey];
        if (meta) {
          return {
            description: t(meta.description_key),
            dataVariables: Object.entries(meta.data_variables_description_keys).map(([k, tk]) => ({
              key: k,
              description: t(tk),
            })),
          };
        }
      } else if (type === 'dataset') {
        const dataType = (item as (PurchaseItem & { data_type?: string }) | undefined)?.data_type as keyof typeof metaDataInformation.datasets | undefined;
        if (dataType && metaDataInformation.datasets[dataType]) {
          const meta = metaDataInformation.datasets[dataType];
          return {
            description: t(meta.description_key),
            dataVariables: Object.entries(meta.data_variables_description_keys).map(([k, tk]) => ({
              key: k,
              description: t(tk),
            })),
          };
        }
      }
      return { description: '', dataVariables: [] };
    },
    []
  );

  // Helper to create empty/no-data selected item
  const createEmptySelectedItem = useCallback(
    (
      name: string,
      type: 'dataset' | 'intelligence' | 'report',
      itemKey: string,
      description = t("no-data-available")
    ): SelectedItemData => ({
      name,
      type,
      description,
      dataVariables: [],
      itemKey,
    }),
    []
  );

  // Build selectedItem from report tier when not in priceData (e.g. View Details before Add to Cart)
  const getReportSelectedItemFromTier = useCallback(
    (name: string, key: string) => {
      const tier = reportTiers.find(t => t.reportKey === key);
      if (!tier) return null;
      return {
        name,
        type: 'report' as const,
        description: tier.description || 'No description available.',
        dataVariables: [],
        price: tier.price,
        itemKey: key,
      };
    },
    [reportTiers]
  );

  // Update selectedItem when price data changes (uses priceData for display)
  useEffect(() => {
    if (!selectedItemKey) {
      return;
    }

    const { key, type, name } = selectedItemKey;

    if (isCalculatingPrices) {
      setSelectedItem(createEmptySelectedItem(name, type, key, ''));
      return;
    }

    const config = itemConfig[type];
    if (config) {
      const items = priceData?.[config.arrayKey];
      const item = items?.find((i: PurchaseItem) => i[config.matchKey] === key) as PurchaseItem | undefined;

      if (item) {
        // For intelligence/dataset items, description and data_variables are no longer sent
        // by the backend – look them up from the frontend's local metaDataInformation.json
        const localMeta = type !== 'report' ? getLocalMetadata(type, key, item) : null;
        const resolvedDescription =
          item.description ||
          (type === 'report'
            ? t(`report-package-${key}-description`)
            : localMeta?.description || '');
        const resolvedDataVariables =
          item.data_variables
            ? convertDataVariables(item.data_variables)
            : type === 'report'
            ? []
            : localMeta?.dataVariables || [];

        setSelectedItem({
          name,
          type,
          description: resolvedDescription,
          dataVariables: resolvedDataVariables,
          price: item.cost,
          itemKey: key,
          isCurrentlyOwned: item.is_currently_owned,
          expiration: item.expiration || undefined,
          explanation: item.explanation,
        });
        return;
      }

      // Report not in priceData (e.g. user clicked View Details without adding to cart) – use tier info
      if (type === 'report') {
        const fromTier = getReportSelectedItemFromTier(name, key);
        if (fromTier) {
          setSelectedItem(fromTier);
          return;
        }
      }
    }

    setSelectedItem(createEmptySelectedItem(name, type, key));
  }, [
    priceData,
    selectedItemKey,
    isCalculatingPrices,
    convertDataVariables,
    createEmptySelectedItem,
    getReportSelectedItemFromTier,
    getLocalMetadata,
  ]);

  // Handler to select item for viewing details (NOT for adding to cart)
  const handleItemSelect = useCallback(
    (itemKey: string, type: 'dataset' | 'intelligence' | 'report', name: string) => {
      setSelectedItemKey({ key: itemKey, type, name });
      // For reports, fetch description + data_variables so the Data Variables tab is populated without adding to cart
      if (type === 'report') {
        fetchReportDetailsForView(itemKey);
      }
    },
    [fetchReportDetailsForView]
  );

  // Filter categories based on search query (fuzzy, supports spaces and multi-word)
  const filteredCategories = useMemo(() => {
    return Object.entries(categories).reduce((acc, [category, types]) => {
      const filteredTypes = (types as string[]).filter(type =>
        fuzzyMatchCategoryType(type, searchQuery)
      );
      if (filteredTypes.length > 0) {
        acc[category] = filteredTypes;
      }
      return acc;
    }, {} as CategoryData);
  }, [categories, searchQuery]);

  // Flatten all categories for business type dropdown
  const allBusinessTypes = useMemo(() => {
    const allSubcategories = Object.values(categories).flat();
    return Array.from(
      new Set(allSubcategories.filter((item): item is string => typeof item === 'string'))
    ).sort();
  }, [categories]);

  // Format category name for display
  const formatCategoryName = useCallback((category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);

  // Filter business types based on search term
  const filteredBusinessTypes = useMemo(() => {
    if (!businessTypeSearchTerm.trim()) {
      return allBusinessTypes;
    }
    return allBusinessTypes.filter(type =>
      formatCategoryName(type).toLowerCase().includes(businessTypeSearchTerm.toLowerCase())
    );
  }, [allBusinessTypes, businessTypeSearchTerm, formatCategoryName]);

  // Handle clear all datasets
  const handleClear = useCallback(() => {
    dispatch({ type: 'clearDatasets' });
    setSearchQuery('');
  }, [dispatch]);

  // Handlers for CategoriesBrowserSubCategories component
  const handleToggleCategory = useCallback(
    (category: string) => {
      if (openedCategories.includes(category)) {
        setOpenedCategories(openedCategories.filter(x => x !== category));
      } else {
        setOpenedCategories([...openedCategories, category]);
      }
    },
    [openedCategories]
  );

  const getTypeCounts = useCallback(
    (type: string) => {
      // For checkout, we only care about "included" (in cart)
      // Return [1] if in cart, [] if not
      const isInCart = checkout.datasets.includes(type);
      return {
        includedCount: isInCart ? [1] : [],
        excludedCount: [],
      };
    },
    [checkout.datasets]
  );

  const handleRemoveType = useCallback(
    (type: string) => {
      // Remove from cart
      if (checkout.datasets.includes(type)) {
        dispatch({ type: 'toggleDataset', payload: type });
      }
    },
    [checkout.datasets, dispatch]
  );

  const handleAddToIncluded = useCallback(
    (type: string) => {
      // Add to cart
      if (!checkout.country_name || !checkout.city_name) {
        toast.error(t("please-select-a-country-and-city-before-adding-datasets"));
        return;
      }
      if (!checkout.datasets.includes(type)) {
        dispatch({ type: 'toggleDataset', payload: type });
      }
      // Also select for viewing
      const formattedName = formatSubcategoryName(type);
      handleItemSelect(type, 'dataset', formattedName);
    },
    [checkout, dispatch, handleItemSelect]
  );

  // Fetch prices for display - fetch only relevant items based on active view
  useEffect(() => {
    if (!authResponse?.localId) {
      return;
    }

    // Determine which prices to fetch based on the active view
    if (activeView === 'area') {
      // For area intelligence, fetch prices as soon as user is on the view (even without country/city so list prices show)
      const timeoutId = setTimeout(() => {
        fetchAreaPrices();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (activeView === 'reports' && hasInitializedReports) {
      // For reports, only fetch price for selected report when all required fields are present
      const hasAllRequiredFields = 
        checkout.country_name && 
        checkout.city_name && 
        checkout.report_potential_business_type &&
        checkout.report;
      
      if (hasAllRequiredFields) {
      const timeoutId = setTimeout(() => {
          fetchSelectedReportPrice();
      }, 300);
      return () => clearTimeout(timeoutId);
      }
    } else if (activeView === 'datasets' && hasInitializedDatasets && openedCategories.length > 0) {
      // For datasets, only fetch if at least one category is opened
      const timeoutId = setTimeout(() => {
        fetchDatasetPrices();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [
    activeView,
    hasInitializedDatasets,
    hasInitializedReports,
    openedCategories.length,
    authResponse?.localId,
    checkout.country_name,
    checkout.city_name,
    checkout.report_potential_business_type,
    checkout.report,
    fetchAreaPrices,
    fetchDatasetPrices,
    fetchSelectedReportPrice,
  ]);

  // Calculate cart cost when checkout state changes (for cart management)
  useEffect(() => {
    if (!authResponse?.localId) {
      return;
    }

    // Only calculate if there are items in cart
    const hasCartItems =
      checkout.datasets.length > 0 || checkout.intelligences.length > 0 || checkout.report !== '';

    if (hasCartItems) {
      const timeoutId = setTimeout(() => {
        calculateCartCost();
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setCartCostResponse(null);
    }
  }, [
    checkout.datasets,
    checkout.intelligences,
    checkout.report,
    checkout.report_potential_business_type,
    checkout.country_name,
    checkout.city_name,
    authResponse?.localId,
    calculateCartCost,
  ]);

  const getAreaCardClasses = useCallback(
    (intelligenceName: string) => {
      const isInCart = checkout.intelligences.includes(intelligenceName);
      const isSelected =
        selectedItemKey?.key === intelligenceName && selectedItemKey?.type === 'intelligence';
      return `border rounded-lg transition-all flex items-center justify-between w-full px-3 py-2 sm:px-4 sm:py-3 cursor-pointer ${
        isSelected || isInCart
          ? 'border-[#115740] bg-green-50 text-green-800 shadow-lg '
          : 'border-gray-300 bg-white text-gray-700 shadow-md hover:shadow-lg hover:border-[#115740] hover:bg-gray-50'
      }`;
    },
    [checkout.intelligences, selectedItemKey]
  );

  return (
    <div className="h-full overflow-hidden relative flex flex-col lg:flex-row" >
      <div className="w-full lg:w-1/3 flex flex-col overflow-hidden">
        {Name ==="area" ? (
          <div className="w-full h-full flex flex-col px-4 sm:px-6 lg:px-8 overflow-y-auto">
            <div className="text-2xl pt-4 font-semibold mb-2 flex-shrink-0">{t("area-intelligence")}</div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4 flex-shrink-0">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">{t("note")}</span>{' '}{t("you-must-choose-country-city-and-area-intelligence-type-to-see-the-price")}</p>
            </div>
            <div className="flex flex-col items-stretch space-y-6 flex-1 pb-6">
              <div
                className={getAreaCardClasses('Population')}
                role="button"
                tabIndex={0}
                onClick={() => {
                  handleItemSelect('Population', 'intelligence', 'Population Intelligence');
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleItemSelect('Population', 'intelligence', 'Population Intelligence');
                  }
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {/* SVG Icon omitted here for brevity */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      className="min-w-5"
                    >
                      <g>
                        <path
                          d="M18 7.16C17.94 7.15 17.87 7.15 17.81 7.16C16.43 7.11 15.33 5.98 15.33 4.58C15.33 3.15 16.48 2 17.91 2C19.34 2 20.49 3.16 20.49 4.58C20.48 5.98 19.38 7.11 18 7.16Z"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                        <path
                          d="M16.9699 14.44C18.3399 14.67 19.8499 14.43 20.9099 13.72C22.3199 12.78 22.3199 11.24 20.9099 10.3C19.8399 9.59004 18.3099 9.35003 16.9399 9.59003"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                        <path
                          d="M5.96998 7.16C6.02998 7.15 6.09998 7.15 6.15998 7.16C7.53998 7.11 8.63998 5.98 8.63998 4.58C8.63998 3.15 7.48998 2 6.05998 2C4.62998 2 3.47998 3.16 3.47998 4.58C3.48998 5.98 4.58998 7.11 5.96998 7.16Z"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                        <path
                          d="M6.99994 14.44C5.62994 14.67 4.11994 14.43 3.05994 13.72C1.64994 12.78 1.64994 11.24 3.05994 10.3C4.12994 9.59004 5.65994 9.35003 7.02994 9.59003"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                        <path
                          d="M12 14.63C11.94 14.62 11.87 14.62 11.81 14.63C10.43 14.58 9.32996 13.45 9.32996 12.05C9.32996 10.62 10.48 9.46997 11.91 9.46997C13.34 9.46997 14.49 10.63 14.49 12.05C14.48 13.45 13.38 14.59 12 14.63Z"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                        <path
                          d="M9.08997 17.78C7.67997 18.72 7.67997 20.26 9.08997 21.2C10.69 22.27 13.31 22.27 14.91 21.2C16.32 20.26 16.32 18.72 14.91 17.78C13.32 16.72 10.69 16.72 9.08997 17.78Z"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          stroke="currentColor"
                        />
                      </g>
                    </svg>
                    <div className="flex-1">
                      <div className="font-semibold">{t("population-intelligence")}</div>
                      {isCalculatingPrices ? (
                        <Skeleton className="w-full h-4" />
                      ) : (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {population_intelligence?.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-blue-600 mt-1">{t("price")}{' '}
                    {isCalculatingPrices ? (
                      <Skeleton className="w-10 h-4" />
                    ) : population_intelligence ? (
                      formatPrice(population_intelligence?.cost || 0)
                    ) : (
                      '$0'
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {checkout.intelligences.includes("Population") ? (
                    <MdCheckCircle className="text-green-600" size={24} />
                  ) : (
                    <span className="text-xs text-gray-400">{t("tap-to-view")}</span>
                  )}
                </div>
              </div>
              <div
                className={getAreaCardClasses('Income')}
                role="button"
                tabIndex={0}
                onClick={() => {
                  handleItemSelect('Income', 'intelligence', 'Income Intelligence');
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleItemSelect('Income', 'intelligence', 'Income Intelligence');
                  }
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <MdAttachMoney size={24} />
                    <div className="flex-1">
                      <div className="font-semibold">{t("income-intelligence")}</div>
                      {isCalculatingPrices ? (
                        <Skeleton className="w-full h-4" />
                      ) : (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {income_intelligence?.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-blue-600 mt-1 flex">{t("price")}{' '}
                    {isCalculatingPrices ? (
                      <Skeleton className="w-10 h-4" />
                    ) : income_intelligence ? (
                      formatPrice(income_intelligence?.cost || 0)
                    ) : (
                      '$0'
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {checkout.intelligences.includes("Income") ? (
                    <MdCheckCircle className="text-green-600" size={24} />
                  ) : (
                    <span className="text-xs text-gray-400">{t("tap-to-view")}</span>
                  )}
                </div>
              </div>
              <div
                className={getAreaCardClasses('Real Estate')}
                role="button"
                tabIndex={0}
                onClick={() => {
                  handleItemSelect('Real Estate', 'intelligence', 'Real Estate Intelligence');
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleItemSelect('Real Estate', 'intelligence', 'Real Estate Intelligence');
                  }
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <MdHome size={24} />
                    <div className="flex-1">
                      <div className="font-semibold">{t("real-estate-intelligence")}</div>
                      {isCalculatingPrices ? (
                        <Skeleton className="w-full h-4" />
                      ) : (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {real_estate_intelligence?.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-blue-600 mt-1">{t("price")}{' '}
                    {isCalculatingPrices ? (
                      <Skeleton className="w-10 h-4" />
                    ) : real_estate_intelligence ? (
                      formatPrice(real_estate_intelligence?.cost || 0)
                    ) : (
                      '$0'
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {checkout.intelligences.includes("Real Estate") ? (
                    <MdCheckCircle className="text-green-600" size={24} />
                  ) : (
                    <span className="text-xs text-gray-400">{t("tap-to-view")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : Name ==="reports" ? (
          <div className="w-full h-full flex flex-col px-2 sm:px-3 lg:px-4 overflow-y-auto">
            <div className="text-2xl pt-2 font-semibold mb-2 flex-shrink-0">{t("report-2")}</div>
            
            {/* Note about required fields */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">{t("note")}</span>{' '}{t("you-must-choose-country-city-and-report-potential-business-type-to-see-the-price")}</p>
            </div>

            {/* Searchable dropdown for report_potential_business_type */}
            <div className="mb-2 flex-shrink-0">
              <label htmlFor="reportBusinessTypeSearch" className="block text-sm font-medium text-gray-700 mb-2">{t("report-potential-business-type")}</label>
              <div className="relative">
                {/* Search input */}
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                    <MdSearch className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="reportBusinessTypeSearch"
                    name="reportBusinessTypeSearch"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 pe-10 p-2.5"
                    placeholder={t("search-for-business-type")}
                    value={businessTypeSearchTerm}
                    onChange={e => {
                      setBusinessTypeSearchTerm(e.target.value);
                      setIsBusinessTypeDropdownOpen(true);
                    }}
                    onFocus={() => setIsBusinessTypeDropdownOpen(true)}
                    onBlur={() => {
                      // Delay closing to allow click on dropdown items
                      setTimeout(() => setIsBusinessTypeDropdownOpen(false), 200);
                    }}
                  />
                  {checkout.report_potential_business_type && (
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'setReportPotentialBusinessType', payload: '' });
                        setBusinessTypeSearchTerm('');
                      }}
                      className="absolute inset-y-0 end-0 pe-3 flex items-center"
                    >
                      <MdClose className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {isBusinessTypeDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredBusinessTypes.length > 0 ? (
                      filteredBusinessTypes.map(businessType => (
                        <button
                          key={businessType}
                          type="button"
                          onClick={() => {
                            dispatch({ type: 'setReportPotentialBusinessType', payload: businessType });
                            setBusinessTypeSearchTerm('');
                            setIsBusinessTypeDropdownOpen(false);
                          }}
                          className={`w-full text-start px-4 py-2 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-150 ${
                            checkout.report_potential_business_type === businessType
                              ? 'bg-[#115740]/10 border-s-4 border-[#115740] text-[#115740] font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          {formatCategoryName(businessType)}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-center text-sm">{t("no-business-types-found-matching")}{businessTypeSearchTerm}"
                      </div>
                    )}
                  </div>
                )}

                {/* Display selected value */}
                {checkout.report_potential_business_type && !isBusinessTypeDropdownOpen && (
                  <div className="mt-2 text-sm text-gray-600">{t("selected")}{' '}<span className="font-medium text-[#115740]">{formatCategoryName(checkout.report_potential_business_type)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 flex-1 pb-4">
              {isLoadingReportTiers ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="border rounded-xl p-6">
                      <Skeleton className="w-full h-8 mb-4" />
                      <Skeleton className="w-32 h-6" />
                    </div>
                  ))}
                </div>
              ) : reportTiers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">{t("no-report-packages-available")}</div>
              ) : (
                reportTiers.map(tier => {
                const isSelected =
                  selectedItemKey?.key === tier.reportKey && selectedItemKey?.type ==="report";
                const isInCart = checkout.report === tier.reportKey;
                const reportItem = priceData?.report_purchase_items?.find(
                  r => r.report_tier === tier.reportKey
                );
                const isComingSoon = reportItem?.coming_soon === true;
                const borderClass =
                  isSelected || isInCart ?"border-[#115740]" :"border-gray-300";
                
                // Check if all required fields are selected
                const hasAllRequiredFields = 
                  checkout.country_name && 
                  checkout.city_name && 
                  checkout.report_potential_business_type;

                // If coming soon, render a disabled card
                if (isComingSoon) {
                  return (
                    <div
                      key={tier.id}
                      className="relative border rounded-xl shadow-md w-full bg-gray-100/60 overflow-hidden border-gray-300 cursor-not-allowed"
                    >
                      <div className="absolute top-3 end-3 z-10">
                        <span className="text-xs bg-purple-500 text-white px-3 py-1.5 rounded-full font-semibold shadow-sm">{t("coming-soon")}</span>
                      </div>
                      <div className="p-3 opacity-50">
                        <div className="w-full flex justify-between items-start mb-2">
                          <span className="text-lg text-gray-900 font-bold">{tier.name}</span>
                          <span className="text-2xl font-bold text-gray-600">
                            {checkout.report_potential_business_type
                              ? formatPrice(tier.price)
                              : '—'}
                          </span>
                        </div>
                        <div className="mb-2">
                          <span className="bg-purple-100 text-purple-700 rounded-full px-3 py-1 font-medium text-sm inline-block">{t("top-10-locations-ranked")}</span>
                        </div>
                        <div className="text-sm text-gray-600">{t("this-report-tier-will-be-available-soon")}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <details
                    key={tier.id}
                    className={`relative border rounded-xl shadow-md hover:shadow-lg transition-all w-full bg-white overflow-hidden ${borderClass}`}
                  >
                    {tier.isMostPopular && (
                      <div className="absolute top-0 end-0 bg-purple-600 text-white px-4 py-1.5 text-xs font-semibold rounded-es-lg z-10">{t("most-popular-2")}<div className="absolute -end-2 top-0 w-0 h-0 border-s-[10px] border-s-transparent border-t-[10px] border-t-green-500"></div>
                      </div>
                    )}
                    <summary className="cursor-pointer p-3 flex flex-col items-start font-semibold list-none [&::-webkit-details-marker]:hidden">
                      <div className="w-full flex justify-between items-start mb-2">
                        <span className="text-lg text-gray-900 font-bold">{tier.name}</span>
                        <span className="text-2xl font-bold text-green-700">
                          {checkout.report_potential_business_type ? (
                            <>
                              {/* Show calculated price only if this report is selected and all required fields are present */}
                              {hasAllRequiredFields && checkout.report === tier.reportKey ? (
                                isCalculatingPrices ? (
                                  <span className="text-2xl animate-pulse">{t("loading")}</span>
                                ) : priceData?.report_purchase_items?.find(
                                    r => r.report_tier === tier.reportKey
                                  ) ? (
                                  formatPrice(
                                    priceData.report_purchase_items.find(
                                      r => r.report_tier === tier.reportKey
                                    )?.cost || 0
                                  )
                                ) : (
                                  formatPrice(tier.price)
                                )
                              ) : (
                                formatPrice(tier.price)
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 font-normal text-base">{t("select-business-type-to-see-price")}</span>
                          )}
                        </span>
                      </div>
                    </summary>
                    <div className="p-3 pt-0 space-y-2">
                      {tier.tag && (
                        <div className="mb-2">
                          <span className="bg-purple-100 text-purple-700 rounded-full px-3 py-1 font-medium text-sm inline-block">
                            {tier.tag}
                          </span>
                        </div>
                      )}
                      <ul className="mb-2 text-sm space-y-1">
                        {tier.perks.map(perk => (
                          <li key={perk} className="text-gray-700">
                            • {perk}
                          </li>
                        ))}
                      </ul>
                      <div className="mb-2">
                        <div className="text-sm font-semibold text-gray-900 mb-2">{t("intelligences-included")}</div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {tier.intelligences.ai ? (
                              <MdCheckCircle className="text-green-600" size={20} />
                            ) : (
                              <MdClose className="text-red-600" size={20} />
                            )}
                            <span className="text-sm text-gray-700">{t("ai")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tier.intelligences.income ? (
                              <MdCheckCircle className="text-green-600" size={20} />
                            ) : (
                              <MdClose className="text-red-600" size={20} />
                            )}
                            <span className="text-sm text-gray-700">{t("income")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tier.intelligences.population ? (
                              <MdCheckCircle className="text-green-600" size={20} />
                            ) : (
                              <MdClose className="text-red-600" size={20} />
                            )}
                            <span className="text-sm text-gray-700">{t("population")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tier.intelligences.realEstate ? (
                              <MdCheckCircle className="text-green-600" size={20} />
                            ) : (
                              <MdClose className="text-red-600" size={20} />
                            )}
                            <span className="text-sm text-gray-700">{t("real-estate")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tier.intelligences.competition ? (
                              <MdCheckCircle className="text-green-600" size={20} />
                            ) : (
                              <MdClose className="text-red-600" size={20} />
                            )}
                            <span className="text-sm text-gray-700">{t("competition")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {tier.intelligences.poi ? (
                              <MdCheckCircle className="text-green-600" size={20} />
                            ) : (
                              <MdClose className="text-red-600" size={20} />
                            )}
                            <span className="text-sm text-gray-700">{t("poi-point-of-interest")}</span>
                          </div>
                          {(tier.datasetLimit !== undefined || tier.additionalDatasetCost !== undefined) && (
                            <div className="text-xs text-gray-500 ms-7 mt-0.5">
                              {tier.datasetLimit !== undefined && (
                                <>{t("includes-up-to")}{' '}{tier.datasetLimit}{' '}{t("dataset-2")}{tier.datasetLimit !== 1 ?t("s") : ''}. </>
                              )}
                              {tier.additionalDatasetCost !== undefined && (
                                <>{t("additional-datasets-starting-from")}{' '}{formatPrice(tier.additionalDatasetCost)}.</>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {tier.conciergeService && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-2">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-600 text-lg">★</span>
                            <span className="text-sm text-purple-900">
                              <span className="font-semibold">{t("concierge-service-2")}</span>{' '}
                              {tier.conciergeService}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={e => {
                            e.preventDefault();
                            handleItemSelect(tier.reportKey, 'report', `${tier.name} Report`);
                          }}
                          className="flex-1 rounded-lg transition-all py-2 font-semibold bg-purple-600 text-white hover:bg-purple-700"
                        >{t("view-details")}</button>
                      </div>
                    </div>
                  </details>
                );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col overflow-hidden">
            <div className="w-full flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col my-5 w-full">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">{t("note")}</span>{' '}{t("you-must-choose-country-city-and-dataset-type-to-see-the-price")}</p>
                </div>

                <div className="flex justify-between mb-4">
                  <label className="font-bold">{t("what-are-you-looking-for")}</label>
                  <button
                    onClick={handleClear}
                    className="w-16 h-6 text-sm bg-[#115740] text-white flex justify-center items-center font-semibold rounded-lg hover:bg-[#123f30] transition-all cursor-pointer"
                  >{t("clear")}</button>
                </div>

                <div className="pb-3">
                  <input
                    type="text"
                    id="searchInput"
                    name="searchInput"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                    placeholder={t("search-for-a-type")}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <CategoriesBrowserSubCategories
                  categories={filteredCategories}
                  openedCategories={openedCategories}
                  onToggleCategory={handleToggleCategory}
                  getTypeCounts={getTypeCounts}
                  onRemoveType={handleRemoveType}
                  onAddToIncluded={handleAddToIncluded}
                  // onAddToExcluded={handleAddToExcluded}
                  getPrice={(type: string) => {
                    if (isCalculatingPrices) {
                      return <Skeleton className="w-10 h-4" />;
                    }
                    const priceItem = priceData?.dataset_purchase_items?.find(
                      d => d.dataset_name === type
                    );
                    return priceItem ? formatPrice(priceItem.cost) : '$0';
                  }}
                  onTypeClick={(type: string) => {
                    const formattedName = formatSubcategoryName(type);
                    handleItemSelect(type, 'dataset', formattedName);
                  }}
                  hideAddRemoveButtons={true}
                  selectedType={
                    selectedItemKey?.type === 'dataset' ? selectedItemKey.key : undefined
                  }
                />
              </div>
            </div>
            <div className="sticky bottom-0 w-full bg-white flex justify-center items-center gap-4 border-t pt-2 lg:h-[10%] flex-shrink-0">
              {/* <button
                type="button"
                className={`w-48 lg:h-16 h-12 border-2 border-[#115740] text-[#115740] flex justify-center items-center font-semibold rounded-lg transition-all cursor-pointer ${isCalculatingCost || !canCalculateCost
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                  : 'bg-slate-100 hover:bg-white'
                  }`}
                disabled={isCalculatingCost || !canCalculateCost}
                onClick={calculateCartCost}
              >
                {isCalculatingCost ? 'Calculating...' : cartCostResponse?.data?.total_cost ? `Total: ${formatPrice(cartCostResponse.data.total_cost)}` : 'Calculate Cost'}
              </button> */}
            </div>
          </div>
        )}
      </div>

      {/* Item Selection View panel */}
      <div className="w-full lg:w-2/3 flex flex-col justify-center items-center border-s-0 lg:border-s border-gray-200">
        <ItemSelectionView
          selectedItem={selectedItem}
          isLoading={isCalculatingPrices && !!selectedItemKey}
          isInCart={
            selectedItem?.type === 'intelligence'
              ? checkout.intelligences.includes(selectedItem.itemKey || '')
              : selectedItem?.type === 'dataset'
                ? checkout.datasets.includes(selectedItem.itemKey || '')
                : selectedItem?.type === 'report'
                  ? checkout.report === selectedItem.itemKey
                  : false
          }
          addToCartDisabled={addToCartDisabled}
          addToCartMessage={addToCartMessage}
          onAddToCart={() => {
            if (!selectedItem?.itemKey) return;
            if (selectedItem.type === 'intelligence') {
              handleIntelligenceToggle(
                selectedItem.itemKey === 'Population'
                  ? 'population'
                  : selectedItem.itemKey === 'Real Estate'
                    ? 'real_estate'
                    : 'income'
              );
            } else if (selectedItem.type === 'dataset') {
              handleDatasetToggle(selectedItem.itemKey);
            } else if (selectedItem.type === 'report') {
              handleReportToggle(selectedItem.itemKey as ReportTier);
            }
          }}
          onRemoveFromCart={() => {
            if (!selectedItem?.itemKey) return;
            if (selectedItem.type === 'intelligence') {
              handleIntelligenceToggle(
                selectedItem.itemKey === 'Population'
                  ? 'population'
                  : selectedItem.itemKey === 'Real Estate'
                    ? 'real_estate'
                    : 'income'
              );
            } else if (selectedItem.type === 'dataset') {
              handleDatasetToggle(selectedItem.itemKey);
            } else if (selectedItem.type === 'report') {
              handleReportToggle(selectedItem.itemKey as ReportTier);
            }
          }}
        />
      </div>

      {/* View Checkout Button - Fixed at bottom center - Show only if user has selected items */}
      {(checkout.datasets.length > 0 || checkout.intelligences.length > 0 || checkout.report) && (
        <div className="fixed bottom-6 start-1/2 transform -translate-x-1/2 rtl:translate-x-1/2 z-20">
          <button
            type="button"
            onClick={() => setShowCheckoutModal(true)}
            className="bg-[#115740] text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-2xl hover:bg-[#0d4632] transition-all flex items-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>{t("view-cart")}{(() => {
              const itemCount =
                checkout.datasets.length +
                checkout.intelligences.length +
                (checkout.report ? 1 : 0);
              return itemCount > 0 ? (
                <span className="bg-white text-[#115740] rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  {itemCount}
                </span>
              ) : null;
            })()}
          </button>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <CheckoutModal
          onClose={() => setShowCheckoutModal(false)}
          cartCostResponse={cartCostResponse}
          isCalculatingCost={isCalculatingCost}
          onPurchaseComplete={() => {
            dispatch({ type: 'reset' });
            setCartCostResponse(null);
          }}
          onRecalculateCart={calculateCartCost}
          reportTiers={reportTiers.map(tier => ({
            reportKey: tier.reportKey,
            name: tier.name,
          }))}
        />
      )}
    </div>
  );
}

export default CheckoutBilling;
