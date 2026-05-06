import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiRequest from '../services/apiRequest';
import urls from '../urls.json';
import { CategoryData } from '../types/allTypesAndInterfaces';
import { t } from '../i18n';

interface DatasetPriceItem {
  dataset_name: string;
  cost: number;
}

interface PriceData {
  dataset_purchase_items?: DatasetPriceItem[];
}

interface UseDatasetPricesParams {
  selectedCountry: string | null;
  selectedCity: string | null;
  categories: CategoryData;
  openedCategories: string[];
}

interface UseDatasetPricesReturn {
  priceData: PriceData | null;
  isCalculatingPrices: boolean;
  getPrice: (type: string) => string;
  getRawPrice: (type: string) => number;
  formatPrice: (value: number) => string;
}

export const useDatasetPrices = ({
  selectedCountry,
  selectedCity,
  categories,
  openedCategories,
}: UseDatasetPricesParams): UseDatasetPricesReturn => {
  const { authResponse } = useAuth();
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isCalculatingPrices, setIsCalculatingPrices] = useState(false);
  const [lastPriceLocation, setLastPriceLocation] = useState<{
    country_name: string;
    city_name: string;
  } | null>(null);

  const formatPrice = useCallback(
    (value: number) =>
      `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    []
  );

  /**
   * Fetch dataset prices - sends ALL datasets for price display
   */
  const fetchDatasetPrices = useCallback(async () => {
    if (!authResponse?.localId || !selectedCountry || !selectedCity) {
      return;
    }

    const currentCountry = selectedCountry;
    const currentCity = selectedCity;

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

      // Update last location used
      setLastPriceLocation({
        country_name: currentCountry,
        city_name: currentCity,
      });

      // Set price data
      setPriceData({
        dataset_purchase_items: response.data.data.dataset_purchase_items,
      });
    } catch {
      // Don't clear existing data on error
    } finally {
      setIsCalculatingPrices(false);
    }
  }, [
    authResponse?.localId,
    selectedCountry,
    selectedCity,
    categories,
    priceData,
    lastPriceLocation,
  ]);

  // Fetch prices for display when location and categories are available
  useEffect(() => {
    if (
      selectedCountry &&
      selectedCity &&
      Object.keys(categories).length > 0 &&
      openedCategories.length > 0
    ) {
      // Only fetch if at least one category is opened
      const timeoutId = setTimeout(() => {
        fetchDatasetPrices();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedCountry, selectedCity, categories, openedCategories.length, fetchDatasetPrices]);

  const getPrice: (type: string) => string = useCallback(
    (type: string) => {
      if (isCalculatingPrices) {
        return t("loading");
      }
      const priceItem = priceData?.dataset_purchase_items?.find(d => d.dataset_name === type);
      return priceItem ? formatPrice(priceItem.cost) : '$0';
    },
    [isCalculatingPrices, priceData, formatPrice]
  );

  const getRawPrice: (type: string) => number = useCallback(
    (type: string) => {
      const priceItem = priceData?.dataset_purchase_items?.find(d => d.dataset_name === type);
      return priceItem?.cost ?? 0;
    },
    [priceData]
  );

  return {
    priceData,
    isCalculatingPrices,
    getPrice,
    getRawPrice,
    formatPrice,
  };
};
