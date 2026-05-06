/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components */
// src/context/LayerContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  FetchDatasetResponse,
  LayerContextType,
  SaveResponse,
  ReqFetchDataset,
  City,
  CategoryData,
  LayerDataMap,
  LayerCustomization,
  LayerState,
  MapFeatures,
  Insights,
} from '../types/allTypesAndInterfaces';
import urls from '../urls.json';
import { useCatalogContext } from './CatalogContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { processCityData, getDefaultLayerColor, colorOptions } from '../utils/helperFunctions';
import apiRequest from '../services/apiRequest';
import { defaultMapConfig } from '../hooks/map/useMapInitialization';
import { useMapContext } from './MapContext';
import { isIntelligentLayer } from '../utils/layerUtils';
import _ from 'lodash';
import { useIntelligenceViewport } from './IntelligenceViewPortContext';
import { t } from '../i18n';

const LayerContext = createContext<LayerContextType | undefined>(undefined);

export function LayerProvider(props: { children: ReactNode }) {
   const { 
    viewport: intelligenceViewport, 
    setViewport, 
    pendingActivation, 
    setPendingActivation,
    populationSample,
    incomeSample,
    realEstateSample
  } = useIntelligenceViewport(); // get the shared state
  const navigate = useNavigate();
  const { authResponse } = useAuth();
  const { children } = props;
  const { geoPoints, setGeoPoints } = useCatalogContext();
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesData, setCitiesData] = useState<{ [country: string]: City[] }>({});
  const [categories, setCategories] = useState<CategoryData>({});
  const [reqFetchDataset, setReqFetchDataset] = useState<ReqFetchDataset>({
    selectedCountry: 'Saudi Arabia',
    selectedCity: 'Riyadh',
    layers: [],
    includedTypes: [],
    excludedTypes: [],
    zoomLevel: defaultMapConfig.zoomLevel,
  });
  const [reqSaveLayer, setReqSaveLayer] = useState({
    legend: '',
    description: '',
    name: '',
  });

  const [createLayerformStage, setCreateLayerformStage] = useState<string>('initial');
  const [loading, setLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<Error | null>(null);
  const [manyFetchDatasetResp, setManyFetchDatasetResp] = useState<
    FetchDatasetResponse | undefined
  >(undefined);
  const [saveMethod, setSaveMethod] = useState<string>('');
  const [datasetInfo, setDatasetInfo] = useState<{
    bknd_dataset_id: string;
    layer_id: string;
  } | null>(null);

  const [saveResponse, setSaveResponse] = useState<SaveResponse | null>(null);
  const [saveResponseMsg, setSaveResponseMsg] = useState<string>('');
  const [saveReqId, setSaveReqId] = useState<string>('');

  const [selectedColor, setSelectedColor] = useState<{
    name: string;
    hex: string;
  } | null>(null);
  const [saveOption, setSaveOption] = useState<string>('');

  const [centralizeOnce, setCentralizeOnce] = useState<boolean>(false);
  const [initialFlyToDone, setInitialFlyToDone] = useState<boolean>(false);

  const [showLoaderTopup, setShowLoaderTopup] = useState<boolean>(false);

  const [textSearchInput, setTextSearchInput] = useState<string>('');
  const [searchType, setSearchType] = useState<string>('category_search');
  const [password, setPassword] = useState<string>('');

  const pageCountsRef = useRef<{ [layerId: string]: number }>({});

  const [layerDataMap, setLayerDataMap] = useState<LayerDataMap>({});
  const [showErrorMessage, setShowErrorMessage] = useState<boolean>(false);

  const [selectedCountry, setSelectedCountry] = useState<string>('Saudi Arabia');
  const [selectedCity, setSelectedCity] = useState<string>('Riyadh');

  const [layerStates, setLayerStates] = useState<{
    [layerId: number]: LayerState;
  }>({});

  const { mapRef, shouldInitializeFeatures, backendZoom } = useMapContext();
  const { selectedContainerType } = useCatalogContext();

  const currentZoomLevel = useMemo(() => backendZoom ?? defaultMapConfig.zoomLevel, [backendZoom]);

  const [currentViewportInsights, setCurrentViewportInsights] = useState<Insights | any | null>(
    null
  );

  const [includePopulation, setIncludePopulation] = useState(false);
  const [includeIncome, setIncludeIncome] = useState(false);
  const [includeRealEstate, setIncludeRealEstate] = useState(false);

  const [isLoadingDataset, setIsLoadingDataset] = useState(false);

  function incrementFormStage() {
    if (createLayerformStage === 'initial') {
      setCreateLayerformStage('secondStep');
    } else if (createLayerformStage === 'secondStep') {
      setCreateLayerformStage('thirdStep');
    }
  }

  async function handleSaveLayer(layerData: LayerCustomization | { layers: LayerCustomization[] }) {
    if ('layers' in layerData) {
      // Handle multiple layers
      for (const layer of layerData.layers) {
        await saveSingleLayer(layer);
      }
    } else {
      // Handle single layer
      await saveSingleLayer(layerData);
    }
  }

  async function saveSingleLayer(layerData: LayerCustomization) {
    const postData = {
      layer_name: layerData.name,
      layer_id: layerDataMap[layerData.layerId]?.layer_id,
      bknd_dataset_id: layerDataMap[layerData.layerId]?.bknd_dataset_id,
      points_color: layerData.color,
      layer_legend: layerData.legend,
      layer_description: layerData.description,
      city_name: reqFetchDataset.selectedCity,
      user_id: authResponse?.localId,
    };

    try {
      const res = await apiRequest({
        url: urls.save_layer,
        method: 'post',
        body: postData,
        isAuthRequest: true,
      });
      setSaveResponse(res.data.data);
      setSaveResponseMsg(res.data.message);
      setSaveReqId(res.data.id);
    } catch (error) {
      const saveError = error instanceof Error ? error : new Error(String(error));
      setIsError(saveError);
      throw saveError;
    }
  }

  function resetFormStage() {
    setIsError(null);
    setCreateLayerformStage('initial');
  }

  function updateGeoJSONDataset(data: any, layerId: number, layerName: string) {
    setGeoPoints((prevPoints: MapFeatures[] | MapFeatures | any) => {
      const layerKey = String(layerId);

      pageCountsRef.current[layerKey] = (pageCountsRef.current[layerKey] || 0) + 1;

      // Skip merging if response has no features
      if (!data.features?.length) {
        console.warn(`No features in response for layer ${layerId}, skipping...`);
        return prevPoints;
      }

      const existingPoint = prevPoints.find(
        (p: MapFeatures) => String(p.layerId) === String(layerId)
      );

      const newPoint = {
        type: 'FeatureCollection',
        features: [
          ...(existingPoint?.features || []), // Keep existing features if any
          ...data.features.map(f => ({
            type: 'Feature',
            geometry: f.geometry,
            properties: f.properties,
            layerId: String(layerId),
          })),
        ],
        display: true,
        points_color: existingPoint?.points_color || getDefaultLayerColor(layerId),
        layerId: String(layerId),
        city_name: reqFetchDataset.selectedCity,
        layer_legend: layerName,
        layer_name: layerName,
        layer_id: data.layer_id,
        bknd_dataset_id: data.bknd_dataset_id,
        isTemporary: true,
      };

      const filteredPoints = prevPoints.filter(p => String(p.layerId) !== String(layerId));
      const newPoints = [...filteredPoints, newPoint];
      console.log('data', data);

      if (data.next_page_token) {
        // Disable fetching new page temporarily if there is a next page token
        // fetchAllPagesForLayer(
        //   layerId,
        //   layerName,
        //   data.next_page_token,
        //   data.layer_id,
        // ).catch((err) => {
        //   console.error(`Error fetching page for layer ${layerId}:`, err);
        // });
      } else {
        delete pageCountsRef.current[layerKey];
      }

      return newPoints;
    });
  }
  //To be removed after fixed on backend
  function assignPopularityCategory(json: any): void {
    const features = json.features;

    // Extract popularity scores
    const scores = features.map(f => f.properties.popularity_score);

    // Compute percentiles
    scores.sort((a, b) => b - a);
    const quartile = Math.ceil(scores.length / 4);

    const thresholds = {
      very_high: scores[quartile - 1] || 0,
      high: scores[2 * quartile - 1] || 0,
      mid: scores[3 * quartile - 1] || 0,
    };

    // Assign categories
    features.forEach(feature => {
      if (!feature.properties.popularity_score_category) {
        const score = feature.properties.popularity_score;
        if (score >= thresholds.very_high) {
          feature.properties.popularity_score_category = 'very high';
        } else if (score >= thresholds.high) {
          feature.properties.popularity_score_category = 'high';
        } else if (score >= thresholds.mid) {
          feature.properties.popularity_score_category = 'mid';
        } else {
          feature.properties.popularity_score_category = 'low';
        }
      }
    });
  }

  const layerDataMapRef = useRef<LayerDataMap>({});
  useEffect(() => {
    layerDataMapRef.current = layerDataMap;
  }, [layerDataMap]);

  async function handleFetchDataset(
    action: string,
    pageToken?: string,
    layerId?: number,
    prevLayerId?: string,
    customBody?: any
  ) {
    if (!pageToken && !layerId) {
      setIsLoadingDataset(true);
      setGeoPoints(prev => prev.filter(p => isIntelligentLayer(p)));
      setLayerDataMap({});
    }

    let user_id: string;
    let idToken: string;

    try {
      if (authResponse && 'idToken' in authResponse) {
        user_id = authResponse.localId;
        idToken = authResponse.idToken;
      } else if (action == 'full data') {
        navigate('/auth');
        setIsError(new Error(t("user-is-not-authenticated")));
        return;
      } else {
        user_id = '0000';
        idToken = '';
      }

      // For keyword search, set up the layer first, as text search can have max 1 layer
      if (searchType === 'keyword_search' && textSearchInput?.trim()) {
        const keywordLayer = {
          id: 1,
          name: textSearchInput.trim(),
          points_color: '',
          excludedTypes: [],
          includedTypes: [textSearchInput.trim()],
        };

        // Update reqFetchDataset with the keyword layer
        setReqFetchDataset(prev => ({
          ...prev,
          layers: [keywordLayer],
        }));

        // Use this layer for the request
        layerId = 1;
      }

      const layers = layerId
        ? [reqFetchDataset.layers.find(l => l.id === layerId)]
        : reqFetchDataset.layers;

      setReqFetchDataset(prev => ({
        ...prev,
        action: action,
      }));
      if (searchType !== 'keyword_search') {
        // Process all layers and track completion
        const layerPromises = layers.map(async layer => {
          if (!layer) return;

          // Skip if layer already processed
          if (layerDataMap[layer.id]) {
            return;
          }

          const defaultName = `${reqFetchDataset.selectedCountry} ${reqFetchDataset.selectedCity} ${
            layer.includedTypes?.map(type => type.replace('_', ' ')).join(' + ') || ''
          }${
            layer.excludedTypes?.length > 0
              ? ' + not ' + layer.excludedTypes.map(type => type.replace('_', ' ')).join(' + not ')
              : ''
          }`;

          const LayerId = layerDataMapRef.current[layer.id]?.layer_id;
          const payloadLayerId = pageToken
            ? prevLayerId || layerDataMapRef.current[layer.id]?.layer_id || ''
            : '';

          try {
            // Each layer carries its own action (sample/full data). Fall back to the
            // form-level action only if the layer didn't set one (legacy paths).
            const layerAction = layer.action || action;

            // Get viewport bounds for sample action (per-layer)
            let viewportBounds = null;
            if (layerAction === 'sample' && mapRef.current) {
              const bounds = mapRef.current.getBounds();
              viewportBounds = {
                bottom_lng: bounds.getWest(),
                bottom_lat: bounds.getSouth(),
                top_lng: bounds.getEast(),
                top_lat: bounds.getNorth(),
              };
            }

            const requestBody: Record<string, unknown> = {
              country_name: reqFetchDataset.selectedCountry,
              city_name: reqFetchDataset.selectedCity,
              boolean_query: layer.includedTypes?.join(' OR '),
              layerId: payloadLayerId,
              layer_name: defaultName,
              action: layerAction,
              search_type: searchType,
              text_search: textSearchInput?.trim() || '',
              page_token: pageToken || '',
              user_id: user_id,
              zoom_level: currentZoomLevel,
            };

            // Add viewport bounds for sample action
            if (viewportBounds) {
              requestBody.bottom_lng = viewportBounds.bottom_lng;
              requestBody.bottom_lat = viewportBounds.bottom_lat;
              requestBody.top_lng = viewportBounds.top_lng;
              requestBody.top_lat = viewportBounds.top_lat;
            }

            const res = await apiRequest({
              url: urls.fetch_dataset,
              method: 'post',
              body: requestBody,
              isAuthRequest: true,
            });
            console.log('res', res);
            if (res?.data?.data) {
              await assignPopularityCategory(res?.data?.data); //To be removed after fixed on backend
              setLayerDataMap(prev => ({
                ...prev,
                [layer.id]: res.data.data,
              }));

              updateGeoJSONDataset(res.data.data, layer.id, defaultName);
            }
          } catch (error) {
            console.error(`Error fetching layer ${layer?.id}:`, error);
            if (error?.response?.data?.detail === 'Insufficient balance in wallet') {
              resetFormStage();
              setShowErrorMessage(true);
              throw error;
            }
            setIsError(error instanceof Error ? error : new Error(String(error)));
            throw error;
          }
        });

        // Wait for all layer requests to complete
        try {
          await Promise.all(layerPromises);
          setIsLoadingDataset(false);
        } catch (error) {
          console.error('Error processing layers:', error);
          throw error;
        }
      } else {
        const defaultName = `${reqFetchDataset.selectedCountry} ${reqFetchDataset.selectedCity} ${textSearchInput?.trim()}`;

        // Get viewport bounds for sample action
        let viewportBounds = null;
        if (action === 'sample' && mapRef.current) {
          const bounds = mapRef.current.getBounds();
          viewportBounds = {
            bottom_lng: bounds.getWest(),
            bottom_lat: bounds.getSouth(),
            top_lng: bounds.getEast(),
            top_lat: bounds.getNorth(),
          };
        }

        const requestBody: any = {
          country_name: reqFetchDataset.selectedCountry,
          city_name: reqFetchDataset.selectedCity,
          boolean_query: `@${textSearchInput?.trim()}@`, // Use the search term as the boolean query
          layerId: pageToken ? prevLayerId || '' : '',
          layer_name: defaultName,
          action: action,
          search_type: searchType,
          text_search: textSearchInput?.trim(),
          page_token: pageToken || '',
          user_id: user_id,
          zoom_level: currentZoomLevel,
        };

        // Add viewport bounds for sample action
        if (viewportBounds) {
          requestBody.bottom_lng = viewportBounds.bottom_lng;
          requestBody.bottom_lat = viewportBounds.bottom_lat;
          requestBody.top_lng = viewportBounds.top_lng;
          requestBody.top_lat = viewportBounds.top_lat;
        }

        const res = await apiRequest({
          url: urls.fetch_dataset,
          method: 'post',
          body: requestBody,
          isAuthRequest: true,
        });
        if (res?.data?.data) {
          await assignPopularityCategory(res?.data?.data); //To be removed after fixed on backend
          setLayerDataMap(prev => ({
            ...prev,
            [1]: res.data.data,
          }));
          const layers = [
            {
              id: 1,
              name: textSearchInput?.trim(),
              points_color: '',
              excludedTypes: [],
              includedTypes: [textSearchInput?.trim()],
            },
          ];
          updateGeoJSONDataset(res.data.data, 1, defaultName);
          setReqFetchDataset(prev => ({
            ...prev,
            layers: layers,
          }));
        }
      }

      if (customBody) {
        try {
          // Set the country and city directly
          const countryName = customBody.country_name || customBody.selectedCountry;
          const cityName = customBody.city_name || customBody.selectedCity;
          setSelectedCountry(countryName);
          setSelectedCity(cityName);

          // Extract layer name and other properties from customBody
          const defaultName =
            customBody.layer_name ||
            `${customBody.city_name || customBody.selectedCity} ${_.upperFirst(customBody.boolean_query)}`;

          // If this is coming from the LLM, we need to prepare the body for the fetch_dataset endpoint
          const fetchBody: any = {
            user_id: authResponse?.localId,
            city_name: customBody.city_name || customBody.selectedCity,
            country_name: customBody.country_name || customBody.selectedCountry,
            boolean_query: customBody.boolean_query || '',
            action: action || customBody.action || 'sample',
            search_type: customBody.search_type || 'category_search',
            zoom_level: backendZoom || defaultMapConfig.zoomLevel,
            ...customBody,
          };

          // Add this line to log the page token
          if (pageToken) {
            fetchBody.page_token = pageToken;
          }

          // Get viewport bounds for sample action
          const currentAction = action || customBody.action || 'sample';
          if (currentAction === 'sample' && mapRef.current) {
            const bounds = mapRef.current.getBounds();
            fetchBody.bottom_lng = bounds.getWest();
            fetchBody.bottom_lat = bounds.getSouth();
            fetchBody.top_lng = bounds.getEast();
            fetchBody.top_lat = bounds.getNorth();
          }

          const res = await apiRequest({
            url: urls.fetch_dataset,
            method: 'post',
            body: fetchBody,
            isAuthRequest: true,
          });

          if (res?.data?.data) {
            await assignPopularityCategory(res?.data?.data);

            // Update layer data map
            setLayerDataMap(prev => ({
              ...prev,
              1002: res.data.data,
            }));

            // Create a proper layer configuration
            const layers = [
              {
                id: 1002,
                name: defaultName,
                points_color: customBody.points_color || getDefaultLayerColor(1002),
                excludedTypes: customBody.excludedTypes || [],
                includedTypes: customBody.boolean_query
                  ? [customBody.boolean_query]
                  : customBody.includedTypes || [],
              },
            ];

            setReqFetchDataset(prev => ({
              ...prev,
              layers: layers,
              selectedCity: customBody.city_name || customBody.selectedCity || prev.selectedCity,
              selectedCountry: customBody.country_name || prev.selectedCountry,
            }));

            updateGeoJSONDataset(res.data.data, 1002, defaultName);

            if (action === 'full data' || customBody.action === 'full data') {
              setCentralizeOnce(true);
            }

            incrementFormStage();

            // For full data, we handle pagination
            if (
              (action === 'full data' || customBody.action === 'full data') &&
              res.data.data.next_page_token &&
              !pageToken // Only call fetchAllPages if this is the initial request
            ) {
              fetchAllPages(1002, res.data.data.next_page_token, customBody);
            }

            return res.data.data;
          }
        } catch (error) {
          console.error(`Error fetching custom layer`, error);
          setIsError(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      }
    } catch (error) {
      console.error('handleFetchDataset error:', error);
      setIsError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setShowLoaderTopup(false);
      if (!pageToken) {
        setIsLoadingDataset(false);
      }
    }
  }

  async function fetchAllPages(layerId: number, initialPageToken: string, customBody?: any) {
    let pageToken = initialPageToken;
    let prevLayerId = '';

    while (pageToken) {
      const resData = await handleFetchDataset(
        'full data',
        pageToken,
        layerId,
        prevLayerId,
        customBody
      );

      if (!resData) {
        console.log('No data returned, stopping pagination');
        break;
      }

      // Use the layer_id from the current response for the next call
      prevLayerId = resData.layer_id;

      pageToken = resData.next_page_token || '';
    }
  }

  async function fetchAllPagesForLayer(
    layerId: number,
    defaultName: string,
    initialPageToken: string,
    initialLayerId: string
  ) {
    let pageToken = initialPageToken;
    let prevLayerId = initialLayerId;
    // Loop until there is no pageToken
    while (pageToken) {
      // Await each API call and get its response data
      const resData = await handleFetchDataset('full data', pageToken, layerId, prevLayerId);
      if (!resData) break;
      // Use the layer_id from the current response for the next call
      prevLayerId = resData.layer_id;
      pageToken = resData.next_page_token || '';
    }
  }

  async function handleGetCountryCityCategory() {
    try {
      const res = await apiRequest({
        url: urls.country_city,
        method: 'get',
      });
      setCountries(processCityData(res.data.data, setCitiesData));
    } catch (error) {
      setIsError(error);
    }

    try {
      const res = await apiRequest({
        url: urls.nearby_categories,
        method: 'get',
      });
      setCategories(res.data.data);
    } catch (error) {
      setIsError(error);
    }
  }

  const resetAreaIntelligence = () => {
    setIncludePopulation(false);
    setIncludeIncome(false);
  };

  function handleCountryCitySelection(event: React.ChangeEvent<HTMLSelectElement>) {
    const { name, value } = event.target;

    if (name === 'selectedCountry') {
      // Update country and reset city
      setSelectedCountry(value);
      setSelectedCity('');

      // Reset area intelligence
      resetAreaIntelligence();

      // Get cities for selected country
      const selectedCountryCities = citiesData[value] || [];
      setCities(selectedCountryCities);

      // Update reqFetchDataset
      setReqFetchDataset(prev => ({
        ...prev,
        selectedCountry: value,
        selectedCity: '', // Reset city when country changes
      }));
    } else if (name === 'selectedCity') {
      setSelectedCity(value);

      setReqFetchDataset(prev => ({
        ...prev,
        selectedCity: value,
      }));
    }
  }

  function handleTypeToggle(type: string) {
    setReqFetchDataset(prevData => {
      if (prevData.includedTypes.includes(type)) {
        return {
          ...prevData,
          includedTypes: prevData.includedTypes.filter(t => t !== type),
          excludedTypes: [...prevData.excludedTypes, type],
        };
      } else if (prevData.excludedTypes.includes(type)) {
        return {
          ...prevData,
          excludedTypes: prevData.excludedTypes.filter(t => t !== type),
        };
      } else {
        return {
          ...prevData,
          includedTypes: [...prevData.includedTypes, type],
        };
      }
    });
  }

  function validateFetchDatasetForm() {
    if (!reqFetchDataset.selectedCountry || !reqFetchDataset.selectedCity) {
      return new Error(t("country-and-city-are-required"));
    }
    if (
      reqFetchDataset.includedTypes.length === 0 &&
      reqFetchDataset.excludedTypes.length === 0 &&
      searchType !== 'keyword_search'
    ) {
      console.log(
        'At least one category must be included or excluded.',
        reqFetchDataset,
        searchType
      );
      return new Error(t("at-least-one-category-must-be-included-or-excluded"));
    }
    if (reqFetchDataset.includedTypes.length > 50 || reqFetchDataset.excludedTypes.length > 50) {
      return new Error(t("up-to-50-types-can-be-specified-in-each-type-restriction-category"));
    }
    return true;
  }

  function resetFetchDatasetForm() {
    setReqFetchDataset(prev => ({
      selectedCountry: prev.selectedCountry,
      selectedCity: prev.selectedCity,
      layers: [],
      includedTypes: [],
      excludedTypes: [],
      zoomLevel: defaultMapConfig.zoomLevel,
    }));
    setLayerDataMap({});
    resetAreaIntelligence();
    setTextSearchInput('');
    setSearchType('category_search');
    setPassword('');
    setGeoPoints([]);
  }

  useEffect(() => {
    if (isError) {
      setShowLoaderTopup(false);
    }
  }, [isError]);

  useEffect(() => {
    handleGetCountryCityCategory();
  }, []);

  const updateLayerState = (layerId: number, updates: Partial<LayerState>) => {
    setLayerStates(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        ...updates,
      },
    }));
  };

  useEffect(() => {
    if (reqFetchDataset?.layers?.length > 0) {
      // Initialize layer states while preserving existing states
      setLayerStates(prev => {
        const initialStates = reqFetchDataset.layers.reduce(
          (acc, layer) => {
            if (layer && typeof layer.id === 'number') {
              acc[layer.id] = {
                ...prev[layer.id], // Preserve existing state if any
                selectedColor: prev[layer.id]?.selectedColor || null,
                isLoading: false, // Reset loading state
                saveResponse: prev[layer.id]?.saveResponse || null,
                datasetInfo: prev[layer.id]?.datasetInfo || null,
              };
            }
            return acc;
          },
          {} as { [key: number]: LayerState }
        );

        return initialStates;
      });
    }
  }, [reqFetchDataset?.layers]);

  const fetchAreaIntelligenceByViewport = useCallback(
    async ({
      withPopulation,
      withIncome,
      withRealEstate = false,
      shouldReturnFeatures = false,
      sample = false,
    }: {
      withPopulation: boolean;
      withIncome: boolean;
      withRealEstate?: boolean;
      shouldReturnFeatures?: boolean;
      sample?: boolean;
    }): Promise<any> => {
      const map = mapRef.current;
      if (!map) {
        console.warn('Map not initialized');
        return;
      }
      const bounds = map.getBounds();

      const reqBody = {
        bottom_lng: bounds.getWest(),
        bottom_lat: bounds.getSouth(),
        top_lng: bounds.getEast(),
        top_lat: bounds.getNorth(),
        population: withPopulation,
        income: withIncome,
        real_estate: withRealEstate,
        zoom_level: 7 + currentZoomLevel,
        user_id: authResponse?.localId,
        sample: sample,
      };
      
      setViewport({
  bottom_lng: bounds.getWest(),
  bottom_lat: bounds.getSouth(),
  top_lng: bounds.getEast(),
  top_lat: bounds.getNorth(),
  population: withPopulation,
  income: withIncome,
  real_estate: withRealEstate,
  zoom_level: 7 + currentZoomLevel,
  populationSample: populationSample,
  incomeSample: incomeSample,
  realEstateSample: realEstateSample,
});
      const res = await apiRequest({
        url: urls.fetch_intelligence_by_viewport,
        method: 'post',
        body: reqBody,
        isAuthRequest: true,
        useCache: true,
      });
      if (!res.data.data) {
        throw new Error(t("no-data-returned-for-current-viewport"));
      }
      const features = res.data.data.features;
      const metadata = res.data.data.metadata;

      if (shouldReturnFeatures) {
        return { features, metadata };
      }

      const insights = calculateInsights(features);
      setCurrentViewportInsights(insights);
      return null;
    },
    [currentZoomLevel, mapRef.current]
  );

  const fetchPopulationByViewport = (shouldReturnFeatures: boolean = false) =>
    fetchAreaIntelligenceByViewport({
      withPopulation: true,
      withIncome: false,
      shouldReturnFeatures,
      sample: populationSample,
    });
  const fetchIncomeByViewport = (shouldReturnFeatures: boolean = false) =>
    fetchAreaIntelligenceByViewport({
      withPopulation: true,
      withIncome: true,
      shouldReturnFeatures,
      sample: incomeSample,
    });
  const fetchRealEstateByViewport = (shouldReturnFeatures: boolean = false) =>
    fetchAreaIntelligenceByViewport({
      withPopulation: false,
      withIncome: false,
      withRealEstate: true,
      shouldReturnFeatures,
      sample: realEstateSample,
    });

  useEffect(() => {
    resetAreaIntelligence();
  }, [selectedContainerType]);

  async function switchPopulationLayer() {
    if (!includePopulation && includeIncome) handleIncomeLayer(false);
    if (!includePopulation && includeRealEstate) handleRealEstateLayer(false);
    const shouldInclude = !includePopulation;
    handlePopulationLayer(shouldInclude);
  }

  async function refetchPopulationLayer() {
    await handlePopulationLayer(false);
    await handlePopulationLayer(true, true);
  }

  const waitForMapReady = () =>
    new Promise<void>(resolve => {
      const map = mapRef.current;
      if (!map) {
        console.warn('Map not initialized');
        return;
      }
      if (map.isStyleLoaded() && !map.isMoving()) {
        resolve();
        return;
      }

      const checkMapReady = () => {
        if (map.isStyleLoaded() && !map.isMoving()) {
          map.off('idle', checkMapReady);
          map.off('render', checkMapReady);
          resolve();
        }
      };

      map.on('idle', checkMapReady);
      map.on('render', checkMapReady);

      setTimeout(() => {
        map.off('idle', checkMapReady);
        map.off('render', checkMapReady);
        resolve();
      }, 5000);
    });

  const _handlePopulationLayer = useCallback(
    async (shouldInclude: boolean, isRefetch: boolean = false) => {
      const map = mapRef.current;

      if (!shouldInitializeFeatures || !map) {
        console.warn('Map not initialized');
        return;
      }
      try {
        await waitForMapReady();

        // Check authentication
        if (!authResponse?.localId || !authResponse?.idToken) {
          const message = t("authentication-required-please-log-in-to-use-this-feature");
          console.error(message);
          setIsError(new Error(message));
          setShowLoaderTopup(false);
          return;
        }

        setIncludePopulation(shouldInclude);

        if (shouldInclude) {
          setShowLoaderTopup(true);
          try {
            const { features, metadata } = await fetchPopulationByViewport(true);

            setGeoPoints(prevPoints => {
              const populationLayer = {
                layerId: 1001, // Special ID for population layer
                type: 'FeatureCollection',
                features: features,
                display: true,
                points_color: metadata?.color || colorOptions[0].hex,
                layer_legend: `Population Layer (${features?.length})`,
                is_grid: true,
                is_intelligent: true,
                is_backend_grid: true,
                is_refetch: isRefetch,
                basedon: 'population',
                visualization_mode: 'grid',
              };

              const filteredPoints = prevPoints.filter(
                point => point.layerId !== populationLayer.layerId
              );
              return [...filteredPoints, populationLayer];
            });

            // Update layer data map
            setLayerDataMap(prev => ({
              ...prev,
              1001: features,
            }));

            // Update viewport to reflect population layer is active
            setViewport(prev => prev ? { ...prev, population: true } : prev);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : t("failed-to-fetch-population-data");
            console.error('Population layer error:', error);
            setIsError(new Error(message));
          } finally {
            setShowLoaderTopup(false);
          }
        } else {
          // Remove population layer
          setGeoPoints(prev =>
            prev.filter(point => !(point.is_intelligent && point.basedon === 'population'))
          );

          // Clean up layer data map
          setLayerDataMap(prev => {
            const newMap = { ...prev };
            delete newMap[1001];
            return newMap;
          });

          // Update viewport to reflect population layer is inactive
          setViewport(prev => prev ? { ...prev, population: false } : prev);
        }
      } catch (error) {
        console.error('Error updating population layer:', error);
        setIsError(new Error(t("failed-to-update-population-layer")));
        setShowLoaderTopup(false);
      }
    },
    [
      mapRef,
      shouldInitializeFeatures,
      authResponse,
      fetchPopulationByViewport,
      setGeoPoints,
      setLayerDataMap,
      setIsError,
      setShowLoaderTopup,
      setIncludePopulation,
    ]
  );

  const handlePopulationLayer = useMemo(
    () => _.debounce(_handlePopulationLayer, 300),
    [_handlePopulationLayer]
  );

  useEffect(() => {
    console.debug('includePopulation', includePopulation, 'includeIncome', includeIncome, 'includeRealEstate', includeRealEstate);
  }, [includePopulation, includeIncome, includeRealEstate]);

  // Trigger refetch when population sample toggle changes
  useEffect(() => {
    if (includePopulation) {
      handlePopulationLayer(true);
    }
  }, [populationSample]);

  // Trigger refetch when income sample toggle changes
  useEffect(() => {
    if (includeIncome) {
      handleIncomeLayer(true);
    }
  }, [incomeSample]);

  // Handle pending activation from loaded catalog's intelligence_viewport
  useEffect(() => {
    if (pendingActivation) {
      if (intelligenceViewport) {
        console.debug('Activating intelligence layers from loaded catalog:', intelligenceViewport);
        
        // Activate/deactivate population layer based on saved catalog setting
        if (intelligenceViewport.population && !includePopulation) {
          handlePopulationLayer(true);
        } else if (!intelligenceViewport.population && includePopulation) {
          handlePopulationLayer(false);
        }
        
        // Activate/deactivate income layer based on saved catalog setting
        if (intelligenceViewport.income && !includeIncome) {
          handleIncomeLayer(true);
        } else if (!intelligenceViewport.income && includeIncome) {
          handleIncomeLayer(false);
        }
      } else {
        // No intelligence viewport - turn off both toggles
        console.debug('No intelligence viewport - disabling intelligence layers');
        if (includePopulation) {
          handlePopulationLayer(false);
        }
        if (includeIncome) {
          handleIncomeLayer(false);
        }
      }
      
      // Reset pending activation flag
      setPendingActivation(false);
    }
  }, [pendingActivation, intelligenceViewport]);

  const _handleIncomeLayer = useCallback(
    async (shouldInclude: boolean, isRefetch: boolean = false) => {
      const map = mapRef.current;

      if (!shouldInitializeFeatures || !map) {
        console.warn('Map not initialized');
        return;
      }
      try {
        await waitForMapReady();

        // Check authentication
        if (!authResponse?.localId || !authResponse?.idToken) {
          const message = t("authentication-required-please-log-in-to-use-this-feature");
          console.error(message);
          setIsError(new Error(message));
          setShowLoaderTopup(false);
          return;
        }

        setIncludeIncome(shouldInclude);

        if (shouldInclude) {
          setShowLoaderTopup(true);
          try {
            const { features, metadata } = await fetchIncomeByViewport(true);
            console.log('features', features.length);

            console.log('Raw INCOME features for geoPoints:', JSON.stringify(features, null, 2));

            setGeoPoints(prevPoints => {
              const incomeLayer = {
                layerId: 1003, // Special ID for income layer
                type: 'FeatureCollection',
                features: features,
                display: true,
                points_color: metadata?.color || colorOptions[3].hex,
                layer_legend: `Income Intelligence (${features?.length})`,
                is_grid: true,
                is_intelligent: true,
                is_backend_grid: true,
                is_refetch: isRefetch,
                basedon: 'income',
                visualization_mode: 'grid',
              };

              const filteredPoints = prevPoints.filter(
                point => point.layerId !== incomeLayer.layerId
              );
              return [...filteredPoints, incomeLayer];
            });

            setLayerDataMap(prev => {
              const newMap = { ...prev };
              delete newMap[1001]; // Remove population layer if exists
              delete newMap[1003]; // Remove income layer if exists
              newMap[1003] = features; // Add income layer
              return newMap;
            });

            // Update viewport to reflect income layer is active
            setViewport(prev => prev ? { ...prev, income: true } : prev);
          } catch (error) {
            const message = error instanceof Error ? error.message : t("failed-to-fetch-income-data");
            console.error('Income layer error:', error);
            setIsError(new Error(message));
          } finally {
            setShowLoaderTopup(false);
          }
        } else {
          // Remove income layer
          setGeoPoints(prev =>
            prev.filter(point => !(point.is_intelligent && point.basedon === 'income'))
          );

          // Clean up layer data map
          setLayerDataMap(prev => {
            const newMap = { ...prev };
            delete newMap[1003];
            return newMap;
          });

          // Update viewport to reflect income layer is inactive
          setViewport(prev => prev ? { ...prev, income: false } : prev);
        }
      } catch (error) {
        console.error('Error updating income layer:', error);
        setIsError(new Error(t("failed-to-update-income-layer")));
        setShowLoaderTopup(false);
      }
    },
    [
      mapRef,
      shouldInitializeFeatures,
      authResponse,
      fetchIncomeByViewport,
      setGeoPoints,
      setLayerDataMap,
      setIsError,
      setShowLoaderTopup,
      setIncludeIncome,
    ]
  );

  const handleIncomeLayer = useMemo(
    () => _.debounce(_handleIncomeLayer, 300),
    [_handleIncomeLayer]
  );

  async function switchIncomeLayer() {
    if (!includeIncome && includePopulation) handlePopulationLayer(false);
    if (!includeIncome && includeRealEstate) handleRealEstateLayer(false);
    const shouldInclude = !includeIncome;
    handleIncomeLayer(shouldInclude);
  }

  async function refetchIncomeLayer() {
    await handleIncomeLayer(false);
    await handleIncomeLayer(true, true);
  }

  const _handleRealEstateLayer = useCallback(
    async (shouldInclude: boolean, isRefetch: boolean = false) => {
      const map = mapRef.current;

      if (!shouldInitializeFeatures || !map) {
        console.warn('Map not initialized');
        return;
      }
      try {
        await waitForMapReady();

        // Check authentication
        if (!authResponse?.localId || !authResponse?.idToken) {
          const message = t("authentication-required-please-log-in-to-use-this-feature");
          console.error(message);
          setIsError(new Error(message));
          setShowLoaderTopup(false);
          return;
        }

        setIncludeRealEstate(shouldInclude);

        if (shouldInclude) {
          setShowLoaderTopup(true);
          try {
            const { features, metadata } = await fetchRealEstateByViewport(true);

            setGeoPoints(prevPoints => {
              const realEstateLayer: MapFeatures = {
                layerId: 1005, // Special ID for real estate layer
                type: 'FeatureCollection',
                features: features,
                display: true,
                points_color: metadata?.color || colorOptions[2].hex,
                layer_legend: `Real Estate Intelligence (${features?.length})`,
                is_grid: true,
                is_intelligent: true,
                is_backend_grid: true,
                is_refetch: isRefetch,
                basedon: 'total_category_listings',
                visualization_mode: 'grid',
                bknd_dataset_id: '',
                layer_id: '',
                records_count: features?.length ?? 0,
                next_page_token: '',
              };

              const filteredPoints = prevPoints.filter(
                point => point.layerId !== realEstateLayer.layerId
              );
              return [...filteredPoints, realEstateLayer];
            });

            setLayerDataMap(prev => ({
              ...prev,
              1005: features,
            }));

            // Update viewport to reflect real estate layer is active
            setViewport(prev => prev ? { ...prev, real_estate: true } : prev);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : t("failed-to-fetch-real-estate-data");
            console.error('Real estate layer error:', error);
            setIsError(new Error(message));
          } finally {
            setShowLoaderTopup(false);
          }
        } else {
          // Remove real estate layer (identified by layerId 1005; basedon is 'total_category_listings')
          setGeoPoints(prev =>
            prev.filter(point => !point.is_intelligent)
          );

          // Clean up layer data map
          setLayerDataMap(prev => {
            const newMap = { ...prev };
            delete newMap[1005];
            return newMap;
          });

          // Update viewport to reflect real estate layer is inactive
          setViewport(prev => prev ? { ...prev, real_estate: false } : prev);
        }
      } catch (error) {
        console.error('Error updating real estate layer:', error);
        setIsError(new Error(t("failed-to-update-real-estate-layer")));
        setShowLoaderTopup(false);
      }
    },
    [
      mapRef,
      shouldInitializeFeatures,
      authResponse,
      fetchRealEstateByViewport,
      setGeoPoints,
      setLayerDataMap,
      setIsError,
      setShowLoaderTopup,
      setIncludeRealEstate,
    ]
  );

  const handleRealEstateLayer = useMemo(
    () => _.debounce(_handleRealEstateLayer, 300),
    [_handleRealEstateLayer]
  );

  async function switchRealEstateLayer() {
    if (!includeRealEstate && includePopulation) handlePopulationLayer(false);
    if (!includeRealEstate && includeIncome) handleIncomeLayer(false);
    const shouldInclude = !includeRealEstate;
    handleRealEstateLayer(shouldInclude);
  }

  async function refetchRealEstateLayer() {
    await handleRealEstateLayer(false);
    await handleRealEstateLayer(true, true);
  }

  // Trigger refetch when real estate sample toggle changes
  useEffect(() => {
    if (includeRealEstate) {
      handleRealEstateLayer(true);
    }
  }, [realEstateSample]);

  async function refetchIntelligenceLayers() {
    if (includeIncome) {
      refetchIncomeLayer();
      handlePopulationLayer(false);
    } else {
      refetchPopulationLayer();
    }
  }

  const handleSubmitFetchDataset = (
    action: string,
    event?: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (event) event.preventDefault();

    const result = validateFetchDatasetForm();
    if (result === true) {
      if (action === 'full data') {
        setCentralizeOnce(true);
      }
      // will be moved to the
      // setShowLoaderTopup(true);
      // incrementFormStage();
      handleFetchDataset(action);
      return true;
    } else if (result instanceof Error) {
      return result;
    }
    return false;
  };

  function handleFullDataFetchSuccess() {
    setShowLoaderTopup(true);
    incrementFormStage();
  }

  function calculateInsights(features: any) {
    if (features.length === 0) return null;

    // Initialize aggregation variables
    let totalPopulation = 0;
    let totalMalePopulation = 0;
    let totalFemalePopulation = 0;
    const medianAgesTotal: number[] = [];
    const medianAgesFemale: number[] = [];
    const densityValues: number[] = [];

    // Collect data for aggregation
    for (const feature of features) {
      const props = feature.properties;

      totalPopulation += props.Population_Count;
      totalMalePopulation += props.Male_Population;
      totalFemalePopulation += props.Female_Population;
      medianAgesTotal.push(props.Median_Age_Total);
      medianAgesFemale.push(props.Median_Age_Female); // Collect female median ages
      densityValues.push(props.Population_Density_KM2);
    }

    // Calculate median of Median_Age_Total
    medianAgesTotal.sort((a, b) => a - b);
    const medianOfMedianAgesTotal =
      medianAgesTotal.length > 0
        ? medianAgesTotal.length % 2 === 0
          ? (medianAgesTotal[medianAgesTotal.length / 2 - 1] +
              medianAgesTotal[medianAgesTotal.length / 2]) /
            2
          : medianAgesTotal[Math.floor(medianAgesTotal.length / 2)]
        : 0;

    // Calculate median of Median_Age_Female
    medianAgesFemale.sort((a, b) => a - b);
    const medianOfMedianAgesFemale =
      medianAgesFemale.length > 0
        ? medianAgesFemale.length % 2 === 0
          ? (medianAgesFemale[medianAgesFemale.length / 2 - 1] +
              medianAgesFemale[medianAgesFemale.length / 2]) /
            2
          : medianAgesFemale[Math.floor(medianAgesFemale.length / 2)]
        : 0;

    // Calculate median of population densities
    densityValues.sort((a, b) => a - b);
    const medianDensity =
      densityValues.length > 0
        ? densityValues.length % 2 === 0
          ? (densityValues[densityValues.length / 2 - 1] +
              densityValues[densityValues.length / 2]) /
            2
          : densityValues[Math.floor(densityValues.length / 2)]
        : 0;

    // Calculate average density (simple average)
    const avgDensity =
      densityValues.length > 0
        ? densityValues.reduce((sum, value) => sum + value, 0) / densityValues.length
        : 0;

    // Calculate female population percentage
    const femalePercentage =
      totalPopulation > 0 ? (totalFemalePopulation / totalPopulation) * 100 : 0;
    const malePercentage = totalPopulation > 0 ? (totalMalePopulation / totalPopulation) * 100 : 0;

    return {
      population: {
        total: totalPopulation,
        male: totalMalePopulation,
        female: totalFemalePopulation,
        femalePercentage: parseFloat(femalePercentage.toFixed(2)),
        malePercentage: parseFloat(malePercentage.toFixed(2)),
      },
      populationDensity: {
        average: parseFloat(avgDensity.toFixed(2)),
        median: parseFloat(medianDensity.toFixed(2)),
      },
      age: {
        medianOfMediansTotal: parseFloat(medianOfMedianAgesTotal?.toFixed(1)),
        medianOfMediansFemale: parseFloat(medianOfMedianAgesFemale?.toFixed(1)),
      },
      featureCount: features.length,
    };
  }


  return (
    <LayerContext.Provider
      value={{
        reqSaveLayer,
        setReqSaveLayer,
        createLayerformStage,
        isError,
        manyFetchDatasetResp,
        saveMethod,
        loading,
        saveResponse,
        setFormStage: setCreateLayerformStage,
        setIsError,
        setManyFetchDatasetResp,
        setSaveMethod,
        setLoading,
        incrementFormStage,
        handleSaveLayer,
        resetFormStage,
        selectedColor,
        setSelectedColor,
        saveOption,
        setSaveOption,
        datasetInfo,
        setDatasetInfo,
        saveResponseMsg,
        setSaveResponseMsg,
        setSaveResponse,
        setSaveReqId,
        centralizeOnce,
        setCentralizeOnce,
        initialFlyToDone,
        setInitialFlyToDone,
        showLoaderTopup,
        setShowLoaderTopup,
        handleFetchDataset,
        showErrorMessage,
        setShowErrorMessage,
        textSearchInput,
        setTextSearchInput,
        searchType,
        setSearchType,
        password,
        setPassword,
        countries,
        setCountries,
        cities,
        setCities,
        citiesData,
        setCitiesData,
        categories,
        setCategories,
        reqFetchDataset,
        setReqFetchDataset,
        handleCountryCitySelection,
        handleTypeToggle,
        validateFetchDatasetForm,
        resetFetchDatasetForm,
        layerDataMap,
        setLayerDataMap,
        selectedCountry,
        setSelectedCountry,
        selectedCity,
        setSelectedCity,
        layerStates,
        updateLayerState,
        includePopulation,
        setIncludePopulation,
        includeIncome,
        setIncludeIncome,
        handlePopulationLayer,
        switchPopulationLayer,
        refetchPopulationLayer,
        handleIncomeLayer,
        switchIncomeLayer,
        refetchIncomeLayer,
        includeRealEstate,
        setIncludeRealEstate,
        switchRealEstateLayer,
        refetchRealEstateLayer,
        handleSubmitFetchDataset,
        currentViewportInsights,
        handleFullDataFetchSuccess,
        isLoadingDataset,
        setIsLoadingDataset,
      }}
    >
      {children}
    </LayerContext.Provider>
  );
}

export function useLayerContext() {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error(t("uselayercontext-must-be-used-within-a-layerprovider"));
  }
  return context;
}
