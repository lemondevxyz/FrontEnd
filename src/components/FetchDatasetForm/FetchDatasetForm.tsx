import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  processCityData,
  getDefaultLayerColor,
  getYesterdayDate,
  fuzzyMatchCategoryType,
} from '../../utils/helperFunctions';
import { PiX } from 'react-icons/pi';
import urls from '../../urls.json';
import { CategoryData, Layer, LayerAction } from '../../types/allTypesAndInterfaces';
import { useLayerContext } from '../../context/LayerContext';
import { useCatalogContext } from '../../context/CatalogContext';
import { useAuth, isGuestUser } from '../../context/AuthContext';
import { useNavigate } from 'react-router';
import apiRequest from '../../services/apiRequest';
import LayerDisplaySubCategories from '../LayerDisplaySubCategories/LayerDisplaySubCategories';
import CategoriesBrowserSubCategories from '../CategoriesBrowserSubCategories/CategoriesBrowserSubCategories';
import {
  IntelligencePaywallModal,
  type DatasetPurchaseItem,
  type IntelligencePurchaseItem,
} from '../Map/IntelligencePaywallModal';
import { useMapContext } from '../../context/MapContext';
import ChatTrigger from '../Chat/ChatTrigger';
import Chat from '../Chat/Chat';
import { topics } from '../../types';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import { useDatasetPrices } from '../../hooks/useDatasetPrices';
import { toast } from 'sonner';

import { t } from '../../i18n';

const DRAFT_KEY_PREFIX = 'fetchDatasetForm.draft.v1.';

interface FetchDatasetDraft {
  selectedCountry: string;
  selectedCity: string;
  searchType: string;
  textSearchInput: string;
  layers: Layer[];
}

type LayerSaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

const draftKeyFor = (userId: string | null | undefined) =>
  `${DRAFT_KEY_PREFIX}${userId || 'guest'}`;

const readDraft = (userId: string | null | undefined): FetchDatasetDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(draftKeyFor(userId));
    if (!raw) return null;
    return JSON.parse(raw) as FetchDatasetDraft;
  } catch {
    return null;
  }
};

const writeDraft = (userId: string | null | undefined, draft: FetchDatasetDraft) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(draftKeyFor(userId), JSON.stringify(draft));
  } catch {
    // sessionStorage may be unavailable (private mode, quota) — skip silently.
  }
};

const clearDraft = (userId: string | null | undefined) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(draftKeyFor(userId));
  } catch {
    // ignore
  }
};

const pruneLayerSignatureMap = (
  signatures: Record<number, string>,
  liveIds: Set<number>
) => {
  let changed = false;
  const next: Record<number, string> = {};

  Object.entries(signatures).forEach(([id, signature]) => {
    const layerId = Number(id);
    if (liveIds.has(layerId)) {
      next[layerId] = signature;
    } else {
      changed = true;
    }
  });

  return changed ? next : signatures;
};


const FetchDatasetForm = () => {
  const nav = useNavigate();

  // LAYER CONTEXT
  const {
    setReqFetchDataset,
    showErrorMessage,
    setShowErrorMessage,
    resetFetchDatasetForm,
    categories,
    setCategories,
    countries,
    setCountries,
    cities,
    handleCountryCitySelection,
    selectedCity,
    setSelectedCity,
    searchType,
    setSearchType,
    textSearchInput,
    setTextSearchInput,
    selectedCountry,
    setSelectedCountry,
    isError,
    setIsError,
    isLoadingDataset,
    setCitiesData,
    setCities,
    handleSaveLayer,
    layerDataMap,
    setLayerDataMap,
    handleFetchDataset,
  } = useLayerContext();

  const { setSelectedHomeTab, fetchGeoPoints } = useCatalogContext();
  // AUTH CONTEXT
  const { authResponse, authLoading } = useAuth();
  const [isPriceVisible, setIsPriceVisible] = useState<boolean>(false);
  // FETCHED DATA
  const [layers, setLayers] = useState<Layer[]>([]);
  const [savingLayerIds, setSavingLayerIds] = useState<Set<number>>(new Set());
  const [savedLayerSignatures, setSavedLayerSignatures] = useState<Record<number, string>>({});
  const [failedLayerSignatures, setFailedLayerSignatures] = useState<Record<number, string>>({});
  const [, setCostEstimate] = useState<number>(0.0);
  // COLBASE CATEGORY
  const [openedCategories, setOpenedCategories] = useState<string[]>([]);

  // USER INPUT
  const [searchQuery, setSearchQuery] = useState('');

  const categoriesRef = useRef<HTMLDivElement>(null);
  const chatAnchorRef = useRef<HTMLDivElement>(null);

  const { backendZoom, mapRef } = useMapContext();

  // Track auth user for draft scoping. Effect below uses authResponse?.localId.
  const draftUserId = authResponse?.localId ?? null;
  const didHydrateRef = useRef(false);

  useEffect(() => {
    resetFetchDatasetForm();
    handleGetCountryCityCategory();

    // Hydrate any in-progress draft after the reset above. If none, mount stays in
    // its default reset state. Hydration runs at most once per component mount.
    if (!didHydrateRef.current) {
      const draft = readDraft(draftUserId);
      if (draft) {
        if (draft.selectedCountry) setSelectedCountry(draft.selectedCountry);
        if (draft.selectedCity) setSelectedCity(draft.selectedCity);
        if (draft.searchType) setSearchType(draft.searchType);
        if (draft.textSearchInput) setTextSearchInput(draft.textSearchInput);
        if (draft.layers?.length) setLayers(draft.layers);
      }
      didHydrateRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft on any meaningful change, debounced to avoid sessionStorage thrash.
  useEffect(() => {
    if (!didHydrateRef.current) return;
    // Don't persist a fully-empty draft.
    if (
      layers.length === 0 &&
      !textSearchInput &&
      (!selectedCountry || !selectedCity)
    ) {
      return;
    }
    const timeoutId = setTimeout(() => {
      writeDraft(draftUserId, {
        selectedCountry: selectedCountry || '',
        selectedCity: selectedCity || '',
        searchType: searchType || '',
        textSearchInput: textSearchInput || '',
        layers,
      });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [draftUserId, selectedCountry, selectedCity, searchType, textSearchInput, layers]);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const fetchProfile = async () => {
    if (!authResponse || !('idToken' in authResponse)) {
      return;
    }

    try {
      const res = await apiRequest({
        url: urls.user_profile,
        method: 'POST',
        isAuthRequest: true,
        body: { user_id: authResponse.localId },
      });
      await setIsPriceVisible(res.data.data.show_price_on_purchase);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };
  // Datasets the user wants AS FULL DATA (paid). Sample-only datasets cost nothing.
  const fullDataDatasets = useMemo(() => {
    const datasetsSet = new Set<string>();
    layers
      .filter(layer => layer.action === 'full data')
      .forEach(layer => layer.includedTypes.forEach(type => datasetsSet.add(type)));
    return Array.from(datasetsSet).sort();
  }, [layers]);


  // Key tracks ONLY full-data datasets — sample-only changes shouldn't trigger cost calls.
  const fullDataKey = useMemo(() => fullDataDatasets.join(','), [fullDataDatasets]);

  // Calculate cart cost via backend (already deducts owned items).
  const calculateCartCost = useCallback(async () => {
    if (!authResponse?.localId) {
      setCostEstimate(0.0);
      return;
    }

    // No full-data layers → nothing to pay for. Sample is free.
    if (fullDataDatasets.length === 0 || !selectedCity || !selectedCountry) {
      setCostEstimate(0.0);
      return;
    }

    try {
      const requestBody = {
        user_id: authResponse.localId,
        country_name: selectedCountry,
        city_name: selectedCity,
        datasets: fullDataDatasets,
        intelligences: [] as string[],
        displayed_price: 0,
      };

      const response = await apiRequest({
        url: urls.calculate_cart_cost,
        method: 'POST',
        body: requestBody,
        isAuthRequest: true,
      });

      const totalCost = response.data?.data?.total_cost || 0;
      setCostEstimate(totalCost);
    } catch (error) {
      console.error('Error calculating cart cost:', error);
      toast.error(t("error-calculating-cart-cost"));
      setCostEstimate(0.0);
    }
  }, [authResponse?.localId, fullDataDatasets, selectedCity, selectedCountry]);

  // Recompute cost when the full-data set changes or location changes.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateCartCost();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fullDataKey, selectedCity, selectedCountry, calculateCartCost]);

  // Use dataset prices hook
  const { getPrice, getRawPrice, formatPrice } = useDatasetPrices({
    selectedCountry,
    selectedCity,
    categories,
    openedCategories,
  });

  const getLayerListPrice = useCallback(
    (layer: Layer) =>
      layer.includedTypes.reduce((sum, type) => sum + getRawPrice(type), 0),
    [getRawPrice]
  );

  // Tracks which layers have an in-flight fetch — used by the per-layer refresh icon
  // (spinner) and to avoid stacking refetches for the same layer.
  const [fetchingLayers, setFetchingLayers] = useState<Set<number>>(new Set());

  // Per-layer "fetched signature": action + sorted-included-types. Compared against
  // current state to decide whether a layer's content actually changed and needs a
  // re-fetch. Mirrors intelligence's pattern of toggle-driven refetch.
  const layerSignaturesRef = useRef<Record<number, string>>({});

  const layerSignature = (layer: Layer) =>
    `${layer.action || 'sample'}|${[...layer.includedTypes].sort().join(',')}`;

  // Internal worker: clears the layer's entry in layerDataMap and refetches. Used by
  // both the manual refresh button and the auto-fetch effect. Bypasses the dedup
  // signature so the caller is responsible for tracking what changed.
  const fetchLayerNow = useCallback(
    async (layer: Layer) => {
      if (!selectedCountry || !selectedCity) return;
      if (layer.includedTypes.length === 0) return;
      if (fetchingLayers.has(layer.id)) return;

      setFetchingLayers(prev => {
        const next = new Set(prev);
        next.add(layer.id);
        return next;
      });
      setLayerDataMap(prev => {
        const next = { ...prev };
        delete next[layer.id];
        return next;
      });

      try {
        await handleFetchDataset(layer.action || 'sample', undefined, layer.id);
      } finally {
        setFetchingLayers(prev => {
          const next = new Set(prev);
          next.delete(layer.id);
          return next;
        });
      }
    },
    [selectedCountry, selectedCity, fetchingLayers, setLayerDataMap, handleFetchDataset]
  );

  // Manual refresh from the layer card icon. Forces a refetch even if the dedup
  // signature is unchanged.
  const refreshLayer = useCallback(
    (layerId: number) => {
      const layer = layers.find(l => l.id === layerId);
      if (!layer) return;
      // Bump the signature so the auto-fetch effect doesn't immediately race us.
      layerSignaturesRef.current[layerId] = layerSignature(layer);
      fetchLayerNow(layer);
    },
    [layers, fetchLayerNow]
  );

  // Keep the latest layers in a ref so the map listener (which is registered once)
  // can read the current value without re-subscribing on every render.
  const layersRef = useRef<Layer[]>(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    const liveIds = new Set(layers.map(layer => layer.id));
    setSavedLayerSignatures(prev => pruneLayerSignatureMap(prev, liveIds));
    setFailedLayerSignatures(prev => pruneLayerSignatureMap(prev, liveIds));
    setSavingLayerIds(prev => {
      const next = new Set([...prev].filter(id => liveIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [layers]);

  // Auto-refetch sample layers when the viewport changes (mirrors intelligence
  // sample fetch, which sends bottom_lng/lat + top_lng/lat from the current bounds).
  // Full-data layers do NOT viewport-refetch — backend returns the full city slice
  // for paid layers, identical to the intelligence pattern.
  useEffect(() => {
    if (!didHydrateRef.current) return;
    const map = mapRef.current;
    if (!map) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const onViewportChange = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const sampleLayers = layersRef.current.filter(
          l => (l.action || 'sample') === 'sample' && l.includedTypes.length > 0
        );
        sampleLayers.forEach(layer => {
          // Bump the signature so the change-driven effect doesn't double-fire.
          layerSignaturesRef.current[layer.id] = layerSignature(layer);
          fetchLayerNow(layer);
        });
      }, 300);
    };

    map.on('moveend', onViewportChange);
    map.on('zoomend', onViewportChange);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      map.off('moveend', onViewportChange);
      map.off('zoomend', onViewportChange);
    };
  }, [mapRef, fetchLayerNow]);

  // Auto-fetch on layer content change. Mirrors intelligence's debounced auto-fetch:
  // when a layer's includedTypes or action changes, refetch *just* that layer after
  // a 300ms quiet period. Sample is always allowed (free); full-data only auto-fetches
  // when the toggle paywall has already committed (toggle gate ensures cost === 0
  // before action flips to 'full data', so by the time we see it here, we're entitled).
  useEffect(() => {
    if (!didHydrateRef.current) return;
    if (!selectedCountry || !selectedCity) return;

    const timeoutId = setTimeout(() => {
      // Drop signature entries for layers that no longer exist.
      const liveIds = new Set(layers.map(l => l.id));
      Object.keys(layerSignaturesRef.current).forEach(idStr => {
        if (!liveIds.has(Number(idStr))) {
          delete layerSignaturesRef.current[Number(idStr)];
        }
      });

      layers.forEach(layer => {
        if (layer.includedTypes.length === 0) return;
        const sig = layerSignature(layer);
        if (layerSignaturesRef.current[layer.id] === sig) return;
        layerSignaturesRef.current[layer.id] = sig;
        fetchLayerNow(layer);
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [layers, selectedCountry, selectedCity, fetchLayerNow]);

  const filteredCategories = Object.entries(categories).reduce((acc, [category, types]) => {
    const filteredTypes = (types as string[]).filter(type =>
      fuzzyMatchCategoryType(type, searchQuery)
    );
    if (filteredTypes.length > 0) {
      acc[category] = filteredTypes;
    }
    return acc;
  }, {} as CategoryData);

  async function handleGetCountryCityCategory() {
    try {
      const res = await apiRequest({
        url: urls.country_city,
        method: 'get',
      });
      const cityData = res.data.data;
      setCountries(processCityData(cityData, setCitiesData));

      // Restore cities list for persisted country selection
      if (selectedCountry && cityData[selectedCountry]) {
        setCities(cityData[selectedCountry]);
      }
    } catch (error) {
      if (error instanceof Error) {
        setIsError(error);
      } else {
        setIsError(new Error(String(error)));
      }
    }

    try {
      const res = await apiRequest({
        url: urls.nearby_categories,
        method: 'get',
      });
      setCategories(res.data.data);
    } catch (error) {
      if (error instanceof Error) {
        setIsError(error);
      } else {
        setIsError(new Error(String(error)));
      }
    }
  }
  // Paywall state. Driven by per-layer "Full Data" toggles (intelligence-style):
  // when a user flips a layer to full, we precompute cost and gate the flip behind
  // this modal. paywallDatasets is the prospective union shown in the modal — may
  // differ from committed fullDataDatasets while the toggle is pending.
  const [paywallData, setPaywallData] = useState<{
    total_cost: number;
    intelligence_purchase_items: IntelligencePurchaseItem[];
    dataset_purchase_items: DatasetPurchaseItem[];
    report_purchase_items: unknown[];
  } | null>(null);
  const [paywallDatasets, setPaywallDatasets] = useState<string[]>([]);
  const [pendingFullToggleLayerIndex, setPendingFullToggleLayerIndex] = useState<number | null>(
    null
  );

  const handleLayerActionChange = useCallback(
    async (index: number, nextAction: LayerAction) => {
      // Switching to sample is free for everyone — flip immediately.
      if (nextAction === 'sample') {
        setLayers(prev =>
          prev.map((layer, i) => (i === index ? { ...layer, action: 'sample' } : layer))
        );
        return;
      }

      const targetLayer = layers[index];
      if (!targetLayer || !selectedCountry || !selectedCity) return;

      // No datasets in this layer yet — no cost to gate. Flip silently.
      if (targetLayer.includedTypes.length === 0) {
        setLayers(prev =>
          prev.map((layer, i) => (i === index ? { ...layer, action: 'full data' } : layer))
        );
        return;
      }

      // Guest must register before paying.
      if (authResponse && isGuestUser(authResponse)) {
        navigate('/auth?mode=register');
        return;
      }

      if (!authResponse?.localId) {
        navigate('/auth');
        return;
      }

      // Prospective union: every other full layer + this layer (which is going full).
      const prospectiveSet = new Set<string>();
      layers.forEach((layer, i) => {
        const layerAction = i === index ? 'full data' : layer.action || 'sample';
        if (layerAction === 'full data') {
          layer.includedTypes.forEach(type => prospectiveSet.add(type));
        }
      });
      const prospectiveDatasets = Array.from(prospectiveSet).sort();

      try {
        const response = await apiRequest({
          url: urls.calculate_cart_cost,
          method: 'POST',
          isAuthRequest: true,
          body: {
            user_id: authResponse.localId,
            country_name: selectedCountry,
            city_name: selectedCity,
            datasets: prospectiveDatasets,
            intelligences: [] as string[],
            displayed_price: 0,
          },
        });

        const data = response.data?.data;
        const totalCost: number = data?.total_cost ?? 0;

        // Already entitled — flip immediately, skip the modal.
        if (totalCost === 0) {
          setLayers(prev =>
            prev.map((layer, i) => (i === index ? { ...layer, action: 'full data' } : layer))
          );
          return;
        }

        // Defer the flip until purchase succeeds.
        setPendingFullToggleLayerIndex(index);
        setPaywallDatasets(prospectiveDatasets);
        setPaywallData({
          total_cost: totalCost,
          intelligence_purchase_items: data?.intelligence_purchase_items ?? [],
          dataset_purchase_items: data?.dataset_purchase_items ?? [],
          report_purchase_items: data?.report_purchase_items ?? [],
        });
      } catch (err) {
        console.error('Error calculating cost for layer toggle:', err);
        toast.error(t('error-calculating-cart-cost'));
      }
    },
    [layers, selectedCountry, selectedCity, authResponse]
  );

  const handlePaywallSuccess = useCallback(() => {
    if (pendingFullToggleLayerIndex !== null) {
      const idx = pendingFullToggleLayerIndex;
      setLayers(prev =>
        prev.map((layer, i) => (i === idx ? { ...layer, action: 'full data' } : layer))
      );
    }
    setPendingFullToggleLayerIndex(null);
    setPaywallData(null);
    setPaywallDatasets([]);
    // Cost recomputes via the existing fullDataKey → calculateCartCost effect.
  }, [pendingFullToggleLayerIndex]);

  const handlePaywallClose = useCallback(() => {
    setPendingFullToggleLayerIndex(null);
    setPaywallData(null);
    setPaywallDatasets([]);
    // Re-sync cost in case the user partially purchased via the inline error flows.
    calculateCartCost();
  }, [calculateCartCost]);

  const getLayerSaveSignature = useCallback(
    (layer: Layer) => {
      const fetchedLayerData = layerDataMap[layer.id];
      return JSON.stringify({
        action: layer.action || 'sample',
        backendDatasetId: fetchedLayerData?.bknd_dataset_id || '',
        description: layer.layer_description || '',
        excludedTypes: [...layer.excludedTypes].sort(),
        includedTypes: [...layer.includedTypes].sort(),
        layerDataId: fetchedLayerData?.layer_id || '',
        legend: layer.layer_legend || layer.name || `Layer ${layer.id}`,
        name: layer.name || `Layer ${layer.id}`,
        pointsColor: layer.points_color || getDefaultLayerColor(layer.id),
      });
    },
    [layerDataMap]
  );

  // Save All — persists every layer (mirrors CustomizeLayer.handleSaveAllLayers) then
  // navigates to the catalog tab. Auto-fetch (P6.2/P6.3) is responsible for putting
  // the layer's data into layerDataMap before save; if a layer hasn't been fetched
  // yet we surface that as a validation error.
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveAllError, setSaveAllError] = useState<string | null>(null);

  const handleSaveAll = useCallback(async () => {
    setSaveAllError(null);

    if (layers.length === 0) return;
    if (!selectedCountry || !selectedCity) {
      setSaveAllError(t('please-select-a-country-and-city-before-adding-datasets'));
      return;
    }

    // Every layer needs at least 1 included type and a name.
    const invalid = layers.find(
      l => l.includedTypes.length === 0 || !(l.name || `Layer ${l.id}`)
    );
    if (invalid) {
      setSaveAllError(t('every-layer-needs-at-least-one-dataset-and-a-name'));
      return;
    }

    // Each layer must have been auto-fetched by now (handleFetchDataset populates
    // layerDataMap with the layer_id we need to save).
    const unfetched = layers.find(l => !layerDataMap[l.id]?.layer_id);
    if (unfetched) {
      setSaveAllError(t('layer-data-not-ready-please-wait-a-moment-and-try-again'));
      return;
    }

    const layerCustomizations = layers.map(layer => ({
      layerId: layer.id,
      name: layer.name || `Layer ${layer.id}`,
      legend: layer.layer_legend || layer.name || `Layer ${layer.id}`,
      description: layer.layer_description || '',
      color: layer.points_color || getDefaultLayerColor(layer.id),
    }));

    try {
      setIsSavingAll(true);
      for (const layerData of layerCustomizations) {
        const layer = layers.find(l => l.id === layerData.layerId);
        if (!layer) continue;

        const saveSignature = getLayerSaveSignature(layer);
        setSavingLayerIds(prev => new Set(prev).add(layerData.layerId));

        try {
          await handleSaveLayer({ layers: [layerData] });
          setSavedLayerSignatures(prev => ({
            ...prev,
            [layerData.layerId]: saveSignature,
          }));
          setFailedLayerSignatures(prev => {
            if (!prev[layerData.layerId]) return prev;
            const next = { ...prev };
            delete next[layerData.layerId];
            return next;
          });
        } catch (err) {
          setFailedLayerSignatures(prev => ({
            ...prev,
            [layerData.layerId]: saveSignature,
          }));
          throw err;
        } finally {
          setSavingLayerIds(prev => {
            const next = new Set(prev);
            next.delete(layerData.layerId);
            return next;
          });
        }
      }

      // Mirror CustomizeLayer's post-save: switch tab + fetch geoPoints for each saved layer.
      setSelectedHomeTab('CATALOG');
      layerCustomizations.forEach(l => {
        const savedLayerData = layerDataMap[l.layerId];
        if (savedLayerData?.layer_id) {
          fetchGeoPoints(savedLayerData.layer_id, 'layer');
        }
      });

      clearDraft(draftUserId);
    } catch (err) {
      console.error('Save All failed:', err);
      setSaveAllError(t('failed-to-save-layers-please-try-again'));
    } finally {
      setIsSavingAll(false);
    }
  }, [
    layers,
    selectedCountry,
    selectedCity,
    layerDataMap,
    handleSaveLayer,
    getLayerSaveSignature,
    setSelectedHomeTab,
    fetchGeoPoints,
    draftUserId,
  ]);

  function handleClear() {
    // Clear all layers
    setLayers([]);
    // Clear reqFetchDataset
    setReqFetchDataset(prevData => ({
      ...prevData,
      includedTypes: [],
      excludedTypes: [],
      layers: [],
    }));
    // Reset cost estimate
    setCostEstimate(0.0);
    clearDraft(draftUserId);
  }

  // Add new handler to remove type from specific layer
  const removeTypeFromLayer = (type: string, layerId: number, isExcluded: boolean) => {
    const updatedLayers = layers
      .map(layer => {
        if (layer.id === layerId) {
          return {
            ...layer,
            includedTypes: isExcluded
              ? layer.includedTypes
              : layer.includedTypes.filter(t => t !== type),
            excludedTypes: isExcluded
              ? layer.excludedTypes.filter(t => t !== type)
              : layer.excludedTypes,
          };
        }
        return layer;
      })
      .filter(layer => layer.includedTypes.length > 0 || layer.excludedTypes.length > 0);

    setLayers(updatedLayers);

    // Update reqFetchDataset based on remaining types
    const remainingIncluded = updatedLayers.flatMap(layer => layer.includedTypes);
    const remainingExcluded = updatedLayers.flatMap(layer => layer.excludedTypes);

    setReqFetchDataset(prevData => ({
      ...prevData,
      includedTypes: remainingIncluded,
      excludedTypes: remainingExcluded,
    }));
  };

  // Update getTypeCounts to return layer IDs with the counts
  const getTypeCounts = (type: string) => {
    const includedInLayers = layers
      .filter(layer => layer.includedTypes.includes(type))
      .map(layer => layer.id);
    const excludedInLayers = layers
      .filter(layer => layer.excludedTypes.includes(type))
      .map(layer => layer.id);

    return {
      includedCount: includedInLayers,
      excludedCount: excludedInLayers,
    };
  };

  const handleToggleCategory = (category: string) => {
    if (openedCategories.includes(category)) {
      setOpenedCategories([...openedCategories.filter(x => x !== category)]);
      return;
    }
    setOpenedCategories([...openedCategories.concat(category)]);
  };

  const toggleTypeForLayer = (type: string, layerId: number) => {
    if (!selectedCountry || !selectedCity) {
      toast.error(t('please-select-a-country-and-city-before-adding-datasets'));
      return;
    }
    setLayers(prevLayers => {
      const updatedLayers = prevLayers
        .map(layer => {
          if (layer.id !== layerId) return layer;
          if (layer.includedTypes.includes(type)) {
            return { ...layer, includedTypes: layer.includedTypes.filter(t => t !== type) };
          }
          return {
            ...layer,
            includedTypes: [...layer.includedTypes, type],
            excludedTypes: layer.excludedTypes.filter(t => t !== type),
          };
        })
        .filter(layer => layer.includedTypes.length > 0 || layer.excludedTypes.length > 0);

      const allIncludedTypes = new Set<string>();
      const allExcludedTypes = new Set<string>();
      updatedLayers.forEach(layer => {
        layer.includedTypes.forEach(t => allIncludedTypes.add(t));
        layer.excludedTypes.forEach(t => allExcludedTypes.add(t));
      });
      setReqFetchDataset(prevData => ({
        ...prevData,
        includedTypes: Array.from(allIncludedTypes),
        excludedTypes: Array.from(allExcludedTypes),
      }));

      return updatedLayers;
    });
  };

  const createLayerWithType = (type: string) => {
    if (!selectedCountry || !selectedCity) {
      toast.error(t('please-select-a-country-and-city-before-adding-datasets'));
      return;
    }
    setLayers(prevLayers => {
      const newLayerId =
        prevLayers.length > 0 ? Math.max(...prevLayers.map(l => l.id)) + 1 : 1;
      const newLayer: Layer = {
        id: newLayerId,
        name: `Layer ${newLayerId}`,
        layer_name: `Layer ${newLayerId}`,
        includedTypes: [type],
        excludedTypes: [],
        display: true,
        points_color: getDefaultLayerColor(newLayerId),
        cost: 0,
        action: 'sample',
      };
      return [...prevLayers, newLayer];
    });
  };

  // Add this handler
  const handleLayerNameChange = (index: number, newName: string) => {
    setLayers(prev =>
      prev.map((layer, i) => (i === index ? { ...layer, name: newName } : layer))
    );
  };

  const handleLayerColorChange = (index: number, color: string) => {
    setLayers(prev =>
      prev.map((layer, i) => (i === index ? { ...layer, points_color: color } : layer))
    );
  };

  const handleLayerLegendChange = (index: number, legend: string) => {
    setLayers(prev =>
      prev.map((layer, i) => (i === index ? { ...layer, layer_legend: legend } : layer))
    );
  };

  const handleLayerDescriptionChange = (index: number, description: string) => {
    setLayers(prev =>
      prev.map((layer, i) =>
        i === index ? { ...layer, layer_description: description } : layer
      )
    );
  };

  // Update reqFetchDataset when layers change
  useEffect(() => {
    setReqFetchDataset(prev => ({
      ...prev,
      layers: layers.map(layer => ({
        id: layer.id,
        name: layer.name || `Layer ${layer.id}`,
        points_color: layer.points_color || getDefaultLayerColor(layer.id),
        includedTypes: layer.includedTypes,
        excludedTypes: layer.excludedTypes,
        layer_name: layer.layer_name,
        layer_legend: layer.layer_legend,
        layer_description: layer.layer_description,
        action: layer.action || 'sample',
      })),
      // Maintain backward compatibility
      includedTypes: layers.flatMap(layer => layer.includedTypes),
      excludedTypes: layers.flatMap(layer => layer.excludedTypes),
    }));
  }, [layers, setReqFetchDataset]);

  useEffect(() => {
    if (isError) {
      toast.error(isError.message);
    }
  }, [isError]);

  useEffect(() => {
    if (backendZoom !== null) {
      setReqFetchDataset(prev => {
        const newState = {
          ...prev,
          zoomLevel: backendZoom,
        };
        return newState;
      });
    }
  }, [backendZoom, setReqFetchDataset]);

  const typingDelay = 500;

  useEffect(() => {
    if (!textSearchInput.trim()) {
      setCostEstimate(0.0);
      return;
    }

    if (!selectedCountry || !selectedCity) {
      toast.error(t("please-select-country-and-city-first"));
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      // For keyword search, we don't calculate cost until datasets are actually added to layers
      // The cost will be calculated automatically when datasets are added
      setCostEstimate(0.0);
    }, typingDelay);

    return () => clearTimeout(delayDebounceFn);
  }, [textSearchInput, selectedCountry, selectedCity]);

  const getLayerSaveStatus = useCallback(
    (layer: Layer): LayerSaveStatus => {
      const currentSignature = getLayerSaveSignature(layer);

      if (savingLayerIds.has(layer.id)) return 'saving';
      if (failedLayerSignatures[layer.id] === currentSignature) return 'error';
      if (savedLayerSignatures[layer.id] === currentSignature) return 'saved';
      return 'unsaved';
    },
    [failedLayerSignatures, getLayerSaveSignature, savedLayerSignatures, savingLayerIds]
  );

  const unsavedLayerCount = useMemo(
    () => layers.filter(layer => getLayerSaveStatus(layer) !== 'saved').length,
    [getLayerSaveStatus, layers]
  );

  const allCurrentLayersSaved = layers.length > 0 && unsavedLayerCount === 0;

  return (
    <>
      <div className="flex-1 flex flex-col justify-between overflow-y-auto relative">
        <div className="w-full p-4 overflow-y-auto ">
          <div className="mb-6">
            <label className="block mb-2 text-base font-medium text-black" htmlFor="ai-fetch">{t("ai-powered-dataset-finder")}</label>
            <div className="flex relative w-full" ref={chatAnchorRef}>
              <ChatTrigger
                title={t("ai-dataset-finder")}
                position="auto"
                cN="flex-grow"
                size="h-14"
                colors="bg-gem-gradient border text-gray-200 rounded-lg shadow-md hover:shadow-lg transition-all"
                beforeIcon={<FaWandMagicSparkles />}
                afterIcon={<></>}
              />
              <Chat
                topic={topics.DATASET}
                position="fixed bottom-16 start-[2.5vw] z-50"
                anchorRef={chatAnchorRef as React.RefObject<HTMLElement>}
              />
            </div>
          </div>
          <div>
            <label className="block mb-2 text-md font-medium text-black" htmlFor="country">{t("country")}</label>
            <select
              id="country"
              name="selectedCountry"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              value={selectedCountry || ''}
              onChange={e => {
                setSelectedCountry(e.target.value);
                handleCountryCitySelection(e);
              }}
            >
              <option value="" disabled>{t("select-a-country")}</option>
              {countries.map(country => (
                <option value={country} key={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <label className="block mb-2 text-md font-medium text-black" htmlFor="city">{t("city")}</label>
            <select
              id="city"
              name="selectedCity"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              value={selectedCity || ''}
              onChange={e => {
                setSelectedCity(e.target.value);
                handleCountryCitySelection(e);
              }}
              disabled={!selectedCountry}
            >
              <option value="" disabled>{t("select-a-city")}</option>
              {cities.map(city => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className={`${!selectedCountry || !selectedCity ? 'opacity-50 pointer-events-none' : ''}`}>
          <label className="block my-2 text-base font-medium text-black" htmlFor="layers">{t("layers")}</label>
          <div
            id="layers"
            className="flex text-sm flex-col border border-gray-300 rounded-lg p-4 gap-4"
          >
            {/* Map through layers to create multiple Layer sections */}
            {layers.map((layer, index) => (
              <LayerDisplaySubCategories
                key={layer.id}
                layer={layer}
                layerIndex={index}
                onRemoveType={(type: string) => removeTypeFromLayer(type, layer.id, false)}
                onNameChange={handleLayerNameChange}
                onColorChange={handleLayerColorChange}
                onLegendChange={handleLayerLegendChange}
                onDescriptionChange={handleLayerDescriptionChange}
                onActionChange={handleLayerActionChange}
                onRefresh={refreshLayer}
                isFetching={fetchingLayers.has(layer.id)}
                saveStatus={getLayerSaveStatus(layer)}
                listPrice={getLayerListPrice(layer)}
                formatPrice={formatPrice}
                isPriceVisible={isPriceVisible}
              />
            ))}
          </div>

          <div className="border-t mt-4 pt-2">
            <label className="block mb-2 text-md font-medium text-black" htmlFor="searchType">{t("search-type")}</label>
            <select
              name="searchType"
              id="searchType"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              value={searchType || 'category_search'}
              onChange={e => {
                setSearchType(e.target.value);
              }}
              disabled={!selectedCountry || !selectedCity}
            >
              <option value="category_search">{t("category-search")}</option>
              <option value="keyword_search">{t("keyword-search")}</option>
            </select>
          </div>

          {searchType =="keyword_search" && (
            <div className="pt-4">
              <label
                className="block mb-2 text-md font-medium text-black"
                htmlFor="textSearchInput"
              >{t("search")}</label>
              <input
                type="text"
                id="textSearchInput"
                name="textSearchInput"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                placeholder={t("enter-search-text")}
                value={textSearchInput}
                onChange={e => setTextSearchInput(e.target.value)}
                disabled={!selectedCountry || !selectedCity}
              />

            </div>
          )}

          {searchType !=="keyword_search" && (
            <div className="flex flex-col my-5" ref={categoriesRef}>
              <div className="flex justify-between">
                <label className="mb-4 font-bold">{t("what-are-you-looking-for")}</label>
                <button
                  onClick={handleClear}
                  disabled={!selectedCountry || !selectedCity}
                  className="w-16 h-6 text-sm bg-[#115740] text-white flex justify-center items-center font-semibold rounded-lg hover:bg-[#123f30] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >{t("clear")}</button>
              </div>

              <div className="pb-3">
                <div className="flex justify-end mb-1">
                  <p className="text-[10px] text-gray-500">{t("data-updated-on")}{' '}
                    <span className="text-[#115740] font-medium">{getYesterdayDate()}</span>
                  </p>
                </div>
                <input
                  type="text"
                  id="searchInput"
                  name="searchInput"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  placeholder={t("search-for-a-type")}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  disabled={!selectedCountry || !selectedCity}
                />
              </div>
              <CategoriesBrowserSubCategories
                categories={filteredCategories}
                openedCategories={openedCategories}
                onToggleCategory={handleToggleCategory}
                getTypeCounts={getTypeCounts}
                layers={layers.map(l => ({ id: l.id, name: l.name }))}
                onToggleTypeInLayer={toggleTypeForLayer}
                onCreateLayerWithType={createLayerWithType}
                getPrice={getPrice}
              />
            </div>
          )}
          </div>
        </div>
      </div>
      <div className="flex-col flex px-2 py-2 select-none border-t lg:mb-0 mb-14 relative">
        {layers.length > 0 && (
          <p className={`mb-2 text-xs font-medium ${
            allCurrentLayersSaved ? 'text-green-700' : 'text-amber-700'
          }`}>
            {isSavingAll
              ? t('saving-layer-status')
              : allCurrentLayersSaved
                ? t('all-layers-saved')
                : t('layers-not-saved-count', { count: unsavedLayerCount })}
          </p>
        )}
        {saveAllError && (
          <p className="mb-2 text-sm text-red-600">{saveAllError}</p>
        )}
        <button
          className="w-full bg-[#115740] text-white flex justify-center items-center font-semibold rounded-lg hover:bg-[#123f30] transition-all cursor-pointer px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSaveAll}
          disabled={
            isSavingAll ||
            isLoadingDataset ||
            !selectedCountry ||
            !selectedCity ||
            layers.length === 0 ||
            allCurrentLayersSaved
          }
        >
          <span className="text-lg">
            {isSavingAll
              ? t('saving-all')
              : allCurrentLayersSaved
                ? t('all-saved')
                : t('save-all')}
          </span>
        </button>
      </div>

      {showErrorMessage && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white shadow-xl w-96 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-100  border-b border-gray-300">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <span className="me-2">⚠️</span>{' '}{t("warning")}</h3>
              <button
                onClick={() => setShowErrorMessage(false)}
                className="text-gray-800 hover:text-gray-600 focus:outline-none"
              >
                <PiX className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 text-center">
              <p className="text-base text-gray-800 font-medium">{t("insufficient-funds-for-this-transaction")}</p>
              <p className="text-sm text-gray-600 mt-2">{t("please-add-more-funds-to-continue")}</p>
            </div>

            {/* Footer */}
            <div className="flex justify-center px-6 py-4">
              <button
                onClick={() => nav('/profile/wallet/add')}
                className="w-full h-10 bg-[#115740] text-white flex justify-center items-center font-semibold rounded-lg hover:bg-[#123f30] transition-all cursor-pointer"
              >{t("add-funds")}</button>
            </div>
          </div>
        </div>
      )}

      {paywallData && selectedCountry && selectedCity && (
        <IntelligencePaywallModal
          purchaseKind="dataset"
          datasetNames={paywallDatasets}
          countryName={selectedCountry}
          cityName={selectedCity}
          cartCostData={paywallData}
          onClose={handlePaywallClose}
          onPurchaseSuccess={handlePaywallSuccess}
        />
      )}
    </>
  );
};

export default FetchDatasetForm;
