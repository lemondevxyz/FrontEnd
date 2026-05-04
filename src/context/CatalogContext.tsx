/* eslint-disable react-refresh/only-export-components */
import excludedPropertiesJson from '../pages/MapContainer/excludedProperties.json';
import * as turf from '@turf/turf';
import {
  CatalogContextType,
  GradientColorBasedOnZone,
  MapFeatures,
  ReqGradientColorBasedOnZone,
  SaveResponse,
  VisualizationMode,
  MarkerData,
  MeasurementData,
  MarkerType,
  PolygonFeature,
  Benchmark,
  Section,
  PolygonData,
} from '../types';
import urls from '../urls.json';
import userIdData from '../currentUserId.json';
import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import apiRequest from '../services/apiRequest';
import html2canvas from 'html2canvas';
import defaultMapConfig from '../mapConfig.json';
import { isIntelligentLayer } from '../utils/layerUtils';
import { v4 as uuidv4 } from 'uuid';
import { Descendant } from 'slate';
import { useIntelligenceViewport } from './IntelligenceViewPortContext';
import { t } from '../i18n';


const defaultCaseStudyContent: Descendant[] = [
  {
    type: 'heading-one',
    direction: 'rtl',
    align: 'right',
    children: [{ text: 'التحليل الديموغرافي' }],
  },
  {
    type: 'paragraph',
    direction: 'rtl',
    align: 'right',
    children: [
      {
        text: 'تُظهِر هذه المنطقة أنماطاً ديموغرافية مثيرة للاهتمام قد تؤثر على قرارات الأعمال والسياسات.',
      },
    ],
  },
  {
    type: 'chart-container',
    placeholderType: 'demographic',
    direction: 'rtl',
    align: 'right',
    placeholder: 'مثال على التحليل الديموغرافي. قم بتعديله لإدراج مخطط معين.',
    children: [{ text: '' }],
  },
  {
    type: 'heading-two',
    direction: 'rtl',
    align: 'right',
    children: [{ text: 'الاستنتاجات الرئيسية' }],
  },
  {
    type: 'paragraph',
    direction: 'rtl',
    align: 'right',
    children: [{ text: 'يتكون السكان العمري (25-54) من 47% من السكان الكلي', bold: true }],
  },
  {
    type: 'paragraph',
    direction: 'rtl',
    align: 'right',
    children: [{ text: 'يتم توزيع الجنسين بشكل متوازن عبر جميع المجموعات العمرية' }],
  },
  {
    type: 'paragraph',
    direction: 'rtl',
    align: 'right',
    children: [
      { text: 'يشير النمو السكاني المتعلق بالأعمار (65+) إلى إمكانية الحاجة إلى خدمات مرتبطة' },
    ],
  },
  {
    type: 'paragraph',
    direction: 'rtl',
    align: 'right',
    children: [{ text: 'التحول المتوقع من الشباب إلى السكان المتقدمين العمرية خلال العقد القادم' }],
  },
  {
    type: 'heading-two',
    direction: 'rtl',
    align: 'right',
    children: [{ text: 'التحليل' }],
  },
  {
    type: 'chart-container',
    placeholderType: 'trend',
    direction: 'rtl',
    align: 'right',
    placeholder: 'مثال على التحليل المتوقع. قم بتعديله لإدراج مخطط معين.',
    children: [{ text: '' }],
  },
  {
    type: 'paragraph',
    direction: 'rtl',
    align: 'right',
    children: [
      {
        text: 'يشير الملف الديموغرافي إلى سوق كبيرة ومستقرة مع قاعدة عملية جيدة من الأفراد العمرية. يشير التوزيع الجنسي المتوازن عبر المجموعات العمرية إلى حاجات خدمة مماثلة لكلا العمرين. ينشأ النمو السكاني المتعلق بالأعمار إمكانيات في الرعاية الصحية، والترفيه، والخدمات التقاعدية.',
      },
    ],
  },
  {
    type: 'paragraph',
    direction: 'rtl',
    align: 'right',
    children: [
      {
        text: 'يشير التحليل المتوقع إلى تقدم عمري للسكان مع الزمن، مع تأثيرات لتخطيط العمالة، الطلب الصحي، والحاجات المنزلية. يجب على الشركات النظر في هذه التحولات الديموغرافية عند تطوير سياسات طويلة المدى لهذه المنطقة.',
      },
    ],
  },
];

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

type GeoJsonFeatureLike = {
  geometry?: {
    coordinates?: unknown;
    type?: string;
  };
  properties?: Record<string, unknown>;
};

type PopupElement = Element & {
  _mapboxgl_popup?: {
    remove?: () => void;
  };
};

type MapElement = Element & {
  _map?: {
    getSource: (id: string) => unknown;
    removeLayer: (id: string) => void;
    removeSource: (id: string) => void;
  };
};

export function CatalogProvider(props: { children: ReactNode }) {
  const {
    viewport,
    setViewport,
    setPendingActivation,
    populationSample,
    setPopulationSample,
    incomeSample,
    setIncomeSample,
  } = useIntelligenceViewport();
  const { authResponse } = useAuth();
  const { children } = props;

  const [formStage, setFormStage] = useState<'catalog' | 'catalogDetails' | 'save'>('catalog');
  const [saveMethod, setSaveMethod] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState<Error | null>(null);
  const [legendList, setLegendList] = useState<string[]>([]);
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [selectedContainerType, setSelectedContainerType] = useState<
    'Catalogue' | 'Layer' | 'Home'
  >('Home');

  const [geoPoints, setGeoPoints] = useState<MapFeatures[]>([]);
  const [, setLastGeoIdRequest] = useState<string | undefined>();
  const [, setLastGeoMessageRequest] = useState<string | undefined>();
  const [, setLastGeoError] = useState<Error | null>(null);

  const [selectedColor, setSelectedColor] = useState<{
    name: string;
    hex: string;
  } | null>(null);

  const [openDropdownIndices, setOpenDropdownIndices] = useState<(number | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [saveResponse, setSaveResponse] = useState<SaveResponse | null>(null);
  const [saveResponseMsg, setSaveResponseMsg] = useState('');
  const [saveReqId, setSaveReqId] = useState('');
  const [currentCatalogId, setCurrentCatalogId] = useState<string | null>(null);
  const [isAdvanced, setIsAdvanced] = useState<boolean>(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState({});
  const [radiusInput, setRadiusInput] = useState<number | null>(null);
  const [isRadiusMode, setIsRadiusMode] = useState(false);
  const [colors, setColors] = useState<string[][]>([]);
  const [reqGradientColorBasedOnZone, setReqGradientColorBasedOnZone] =
    useState<ReqGradientColorBasedOnZone>({
      layer_id: '',
      change_layer_name: '',
      based_on_layer_name: '',
      user_id: '',
      color_grid_choice: [],
      change_layer_id: '',
      based_on_layer_id: '',
      coverage_value: 0,
      coverage_property: '',
      color_based_on: '',
    });
  const [gradientColorBasedOnZone, setGradientColorBasedOnZone] = useState<
    GradientColorBasedOnZone[]
  >([]);
  const [chosenPallet, setChosenPallet] = useState(null);
  const [selectedBasedon, setSelectedBasedon] = useState<string>('');
  const [layerColors, setLayerColors] = useState({});
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('vertex');

  const [basedOnLayerId, setBasedOnLayerId] = useState<string | null>(null);
  const [basedOnProperty, setBasedOnProperty] = useState<string | null>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [isMarkersEnabled, setIsMarkersEnabled] = useState<boolean>(true);
  const [caseStudyContent, setCaseStudyContent] = useState<Descendant[]>(defaultCaseStudyContent);
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
  const [selectedHomeTab, setSelectedHomeTab] = useState<'LAYER' | 'CATALOG'>('LAYER');
  const [currentMeasurementSessionId, setCurrentMeasurementSessionId] = useState<string | null>(
    null
  );
  const currentSessionIdRef = useRef<string | null>(null);
  const [nameInputs, setNameInputs] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('recolor');
  const [propertyThreshold, setPropertyThreshold] = useState<string>('');
  const [coverageType, setCoverageType] = useState<string>('radius');
  const [coverageValue, setCoverageValue] = useState<string>('');
  const [comparisonType, setComparisonType] = useState<'more' | 'less'>('less');
  const [polygons, setPolygons] = useState<PolygonFeature[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [isBenchmarkControlOpen, setIsBenchmarkControlOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState('mapbox://styles/mapbox/streets-v11');
  const [sections, setSections] = useState<Section[] | PolygonData[]>([]);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [selectedContainerLayerModalOpen, setSelectedContainerLayerModalOpen] = useState(false);

  
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (geoPoints.length > 0) {
        console.log('Saving draft before unload - geoPoints count:', geoPoints.length);
        handleStoreUnsavedGeoPoint(geoPoints);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && geoPoints.length > 0) {
        console.log('Saving draft on visibility change - geoPoints count:', geoPoints.length);
        handleStoreUnsavedGeoPoint(geoPoints);
      }
    };

    const handlePageHide = () => {
      if (geoPoints.length > 0) {
        console.log('Saving draft on page hide - geoPoints count:', geoPoints.length);
        handleStoreUnsavedGeoPoint(geoPoints);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
    // handleStoreUnsavedGeoPoint intentionally uses the latest draft state from this provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoPoints]);

  useEffect(() => {
    const calculateSections = () => {
      if (!Array.isArray(polygons) || !Array.isArray(geoPoints)) {
        return [] as Section[];
      }

      const excludedProperties = new Set(excludedPropertiesJson?.excludedProperties || []);

      const getPolygonShape = (coordinates: unknown[], type: string) => {
        if (type === 'MultiPolygon') {
          return coordinates.map(circle => {
            const ring = circle[0];
            if (
              ring.length < 4 ||
              !turf.booleanEqual(turf.point(ring[0]), turf.point(ring[ring.length - 1]))
            ) {
              ring.push(ring[0]); // Ensure closed ring
            }
            return turf.polygon(circle);
          });
        } else if (type === 'Polygon') {
          const ring = coordinates[0];
          if (
            ring.length < 4 ||
            !turf.booleanEqual(turf.point(ring[0]), turf.point(ring[ring.length - 1]))
          ) {
            ring.push(ring[0]); // Ensure closed ring
          }
          return [turf.polygon([ring])];
        }
        return [];
      };

      const processedPolygons: PolygonData[] = polygons.map(polygon => {
        if (!polygon.geometry?.coordinates) {
          return { polygon, sections: [], areas: [] };
        }

        const polygonData: PolygonData = {
          polygon,
          sections: [],
          areas: polygon.properties.shape === 'circle' ? ['1KM', '3KM', '5KM'] : ['Unknown'],
        };

        const polygonShapes = getPolygonShape(polygon.geometry.coordinates, polygon.geometry.type);
        const sectionsMap = new Map();
        const previouslyMatchedPoints = new Set();

        geoPoints.forEach((geoPoint: MapFeatures) => {
          polygonShapes.forEach((polygonShape, index) => {
            const areaName = polygonData.areas[index];
            const matchingFeatures =
	              geoPoint.features?.filter((feature: GeoJsonFeatureLike) => {
                if (
                  !feature.geometry?.coordinates ||
                  !Array.isArray(feature.geometry.coordinates)
                ) {
                  console.error('Invalid coordinates found:', feature.geometry?.coordinates);
                  return false;
                }

                const featureCoords = JSON.stringify(feature.geometry.coordinates);
                if (previouslyMatchedPoints.has(featureCoords)) return false;

                try {
                  // Handling different geometry types
                  let point;
                  if (feature.geometry.type === 'Point') {
                    // Standard point format [lng, lat]
                    point = turf.point(feature.geometry.coordinates);
                  } else if (feature.geometry.type === 'Polygon') {
                    // For polygons, we are using the first coordinate of the first ring
                    if (
                      Array.isArray(feature.geometry.coordinates[0]) &&
                      Array.isArray(feature.geometry.coordinates[0][0])
                    ) {
                      point = turf.point(feature.geometry.coordinates[0][0]);
                    } else {
                      console.error(
                        'Invalid polygon coordinates structure:',
                        feature.geometry.coordinates
                      );
                      return false;
                    }
                  } else {
                    // Extracting coordinates based on the structure
                    let coords;
                    if (Array.isArray(feature.geometry.coordinates[0])) {
                      if (Array.isArray(feature.geometry.coordinates[0][0])) {
                        // Nested array like [[[x,y],[x,y]]]
                        coords = feature.geometry.coordinates[0][0];
                      } else {
                        // Array like [[x,y]]
                        coords = feature.geometry.coordinates[0];
                      }
                    } else {
                      // Simple array like [x,y]
                      coords = feature.geometry.coordinates;
                    }

                    if (!Array.isArray(coords) || coords.length < 2) {
                      console.error('Could not extract valid coordinates:', coords);
                      return false;
                    }

                    point = turf.point(coords);
                  }

                  const isInPolygon = turf.booleanPointInPolygon(point, polygonShape);

                  if (isInPolygon) {
                    previouslyMatchedPoints.add(featureCoords);
                    return true;
                  }
                  return false;
                } catch (error: unknown) {
                  const apiError = error as { message?: string };
                  console.error('Error processing feature:', apiError.message || 'Unknown error');
                  console.error('Problematic coordinates:', feature.geometry?.coordinates);
                  console.error('Feature type:', feature.geometry?.type);
                  return false;
                }
              }) || [];

            matchingFeatures.forEach((feature: GeoJsonFeatureLike) => {
              Object.entries(feature.properties || {}).forEach(([key, val]) => {
                if (!excludedProperties.has(key)) {
                  const numVal = Number(val);
                  if (!isNaN(numVal)) {
                    if (!sectionsMap.has(key)) {
                      sectionsMap.set(key, new Map());
                    }
                    const layerMap = sectionsMap.get(key);
                    const layerName =
                      geoPoint.layer_name || geoPoint.layer_legend || 'Unknown Layer';
                    if (!layerMap.has(layerName)) {
                      layerMap.set(layerName, new Map());
                    }
                    const areaMap = layerMap.get(layerName);
                    if (!areaMap.has(areaName)) {
                      areaMap.set(areaName, { sum: 0, count: 0 });
                    }
                    const areaData = areaMap.get(areaName);
                    areaData.sum += numVal;
                    areaData.count += 1;
                  }
                }
              });
            });
          });
        });

        polygonData.sections = Array.from(sectionsMap, ([title, layerMap]) => ({
          title,
          points: Array.from(layerMap, ([layer_name, areaMap]) => ({
            layer_name,
            data: polygonData.areas.map(area => {
              const areaData = areaMap.get(area) || { sum: 0, count: 0 };
              return {
                count: areaData.count,
                sum: areaData.sum,
                percentage: parseFloat(
                  (
                    (areaData.count /
                      (geoPoints.find((gp: MapFeatures) => gp.layer_name === layer_name)
                        ?.features?.length || 1)) *
                    100
                  ).toFixed(1)
                ),
                avg: areaData.count ? (areaData.sum / areaData.count).toFixed(2) : '-',
                area,
              };
            }),
          })),
        }));

        return polygonData;
      });

      return processedPolygons;
    };

    setSections(calculateSections());
  }, [polygons, geoPoints]);

  useEffect(() => {
    const properties = new Set<string>();
    geoPoints.forEach(layer => {
      layer.features?.forEach(feature => {
        Object.entries(feature.properties).forEach(([key, val]) => {
          if (typeof val === 'number' || !isNaN(Number(val))) {
            properties.add(key);
          }
        });
      });
    });

    setBenchmarks(prev => {
      const additions: Benchmark[] = [];
      properties.forEach(property => {
        if (!prev.some(b => b.title === property)) {
          additions.push({ title: property, value: '' });
        }
      });
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [geoPoints]);

  const onColorChange = (color: string) => {
    console.log('Color changed:', color);
  };

  async function fetchGeoPoints(
    id: string,
    typeOfCard: string,
    callBack?: (country: string, city: string) => void
  ) {
    const apiJsonRequest =
      typeOfCard === 'layer'
        ? {
            layer_id: id,
            user_id: userIdData.user_id,
          }
        : typeOfCard === 'userCatalog'
          ? { catalog_id: id, as_layers: true, user_id: authResponse.localId }
          : { catalogue_dataset_id: id };

    const url =
      typeOfCard === 'layer'
        ? urls.layer_map_data
        : typeOfCard === 'userCatalog'
          ? urls.fetch_catalog_layers
          : urls.http_catlog_data;

    let unprocessedData: MapFeatures | MapFeatures[] | null = null;

    const callData = function (data: MapFeatures | MapFeatures[]) {
      unprocessedData = data;
    };

    try {
      setIsLoading(true);
      const res = await apiRequest({
        url: url,
        method: 'post',
        body: apiJsonRequest,
        isAuthRequest: true,
      });
      if (res?.data?.data) {
        // Handle different response structures for userCatalog vs other types
        if (typeOfCard === 'userCatalog') {
          // userCatalog response has layers_geo_data, display_elements, and intelligence_viewport
          const responseData = res.data.data;
          callData(responseData.layers_geo_data);
          
          // Track the current catalog ID for updates
          setCurrentCatalogId(id);
          
          // Handle display_elements - always set to clear old state
          const displayElements = responseData.display_elements || {};
          setMarkers(displayElements?.annotations?.pins || []);
          setMeasurements(displayElements?.annotations?.routes || []);
          setCaseStudyContent(displayElements?.case_study || []);
          setPolygons(displayElements?.statisticsPopupData?.polygons || []);
          setBenchmarks(displayElements?.statisticsPopupData?.benchmarks || []);
          setIsBenchmarkControlOpen(
            displayElements?.statisticsPopupData?.isBenchmarkControlOpen ?? false
          );
          setCurrentStyle(
            displayElements?.statisticsPopupData?.currentStyle || 'mapbox://styles/mapbox/streets-v11'
          );
          
          // Handle intelligence_viewport - always set to update toggle states
          const intelligenceViewport = responseData.intelligence_viewport;
          if (intelligenceViewport) {
            setViewport(intelligenceViewport);
            // Map separate sample keys if available, otherwise fallback to legacy 'sample'
            if (intelligenceViewport.populationSample !== undefined) {
              setPopulationSample(intelligenceViewport.populationSample);
            } else {
              setPopulationSample(!!intelligenceViewport.sample);
            }

            if (intelligenceViewport.incomeSample !== undefined) {
              setIncomeSample(intelligenceViewport.incomeSample);
            } else {
              setIncomeSample(!!intelligenceViewport.sample);
            }
          } else {
            // Clear viewport if not present
            setViewport(null);
            setPopulationSample(false);
            setIncomeSample(false);
          }
          // Always trigger pending activation to sync toggle states
          setPendingActivation(true);
        } else {
          callData(res.data.data);
        }
        setLastGeoMessageRequest(res.data.message);
        setLastGeoIdRequest(res.data.request_id || res.data.id);
      }
    } catch (error) {
      setIsError(error instanceof Error ? error : new Error(t("failed-to-fetch-geo-points")));
    } finally {
      setIsError(null);
      setIsLoading(false);
    }

    if (isError) {
      console.error('An error occurred while fetching geo points.');
      return;
    }

    if (unprocessedData) {
      const updatedDataArray = (
        Array.isArray(unprocessedData) ? unprocessedData : [unprocessedData]
      ).map(function (layer) {
        return Object.assign({}, layer, { display: true, isTemporary: false, uniqueId: uuidv4() });
      });
      setGeoPoints(function (prevGeoPoints) {
        const updatedGeoPoints = [...prevGeoPoints];

        updatedDataArray.forEach(newLayer => {
          const existingIndex = updatedGeoPoints.findIndex(
            p => p.layer_id === newLayer.layer_id
          );

          if (existingIndex !== -1) {
            updatedGeoPoints[existingIndex] = {
              ...updatedGeoPoints[existingIndex],
              ...newLayer,
              display: updatedGeoPoints[existingIndex].display,
              isTemporary: false,
            };
          } else {
            updatedGeoPoints.push(newLayer);
          }
        });

        return updatedGeoPoints as MapFeatures[];
      });

      if (callBack && updatedDataArray[0].city_name)
        callBack(
          updatedDataArray[0].country_name || defaultMapConfig.fallBackCountry,
          updatedDataArray[0].city_name
        );
    }
  }

  async function handleAddClick(
    id: string,
    typeOfCard: string,
    callBack?: (city: string, country: string) => void
  ) {
    setIsLoading(true);
    try {
      await fetchGeoPoints(id, typeOfCard, callBack);

      // this is the reason for fetching singal catalog while user pressed on add layer.
      if (typeOfCard === 'catalog') {
        try {
          const body = { user_id: authResponse?.localId, catalog_id: id };

          const res = await apiRequest({
            url: urls.fetch_single_catalog,
            method: 'post',
            isAuthRequest: true,
            body: body,
          });

          const catalogData = res.data.data;
          const displayElements = catalogData.display_elements || {};
          
          // Always set to clear old state
          setMarkers(displayElements?.annotations?.pins || []);
          setMeasurements(displayElements?.annotations?.routes || []);
          setCaseStudyContent(displayElements?.case_study || []);
          setPolygons(displayElements?.statisticsPopupData?.polygons || []);
          setBenchmarks(displayElements?.statisticsPopupData?.benchmarks || []);
          setIsBenchmarkControlOpen(
            displayElements?.statisticsPopupData?.isBenchmarkControlOpen ?? false
          );
          setCurrentStyle(
            displayElements?.statisticsPopupData?.currentStyle || 'mapbox://styles/mapbox/streets-v11'
          );
          
          // Handle intelligence_viewport for regular catalogs
          if (catalogData.intelligence_viewport) {
            setViewport(catalogData.intelligence_viewport);
            // Map separate sample keys if available, otherwise fallback to legacy 'sample'
            if (catalogData.intelligence_viewport.populationSample !== undefined) {
              setPopulationSample(catalogData.intelligence_viewport.populationSample);
            } else {
              setPopulationSample(!!catalogData.intelligence_viewport.sample);
            }

            if (catalogData.intelligence_viewport.incomeSample !== undefined) {
              setIncomeSample(catalogData.intelligence_viewport.incomeSample);
            } else {
              setIncomeSample(!!catalogData.intelligence_viewport.sample);
            }
          } else {
            setViewport(null);
            setPopulationSample(false);
            setIncomeSample(false);
          }
          // Always trigger to sync toggle states
          setPendingActivation(true);
        } catch (error) {
          console.error('Error fetching single catalog:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching geo points:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleStoreUnsavedGeoPoint(geoPoints: MapFeatures[]) {
    if (selectedHomeTab !== 'CATALOG' || geoPoints.length === 0) return;

    setIsDraftSaving(true);

    try {
      const draftData = {
        geoPoints: geoPoints.filter((layer: MapFeatures) => !isIntelligentLayer(layer)),
        markers: markers,
        measurements: measurements,
        caseStudyContent: caseStudyContent,
        polygons: polygons,
        benchmarks: benchmarks,
        isBenchmarkControlOpen: isBenchmarkControlOpen,
        timestamp: Date.now(),
      };

      localStorage.setItem('unsavedCatalogDraft', JSON.stringify(draftData));
      console.log('Draft saved successfully with:', {
        geoPoints: draftData.geoPoints.length,
        markers: draftData.markers.length,
        measurements: draftData.measurements.length,
        polygons: draftData.polygons.length,
        benchmarks: draftData.benchmarks.length,
      });
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setTimeout(() => setIsDraftSaving(false), 1000);
    }
  }

  async function generateThumbnail(): Promise<string> {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) {
      console.warn('Map container not found');
      return '';
    }

    try {
      const canvas = await html2canvas(mapContainer);
      const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      return thumbnailDataUrl;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return '';
    }
  }

  async function handleSaveCatalog() {
    try {
      setIsLoading(true);

      const thumbnailDataUrl = await generateThumbnail();

      const formData = new FormData();

      if (thumbnailDataUrl) {
        const thumbnailBlob = await fetch(thumbnailDataUrl).then(r => r.blob());
        formData.append('image', thumbnailBlob, 'thumbnail.jpg');
      }

      const requestBody = {
        message:t("save-catalog-request"),
        request_info: {},
        request_body: {
          // Include catalog_id if updating an existing catalog
          ...(currentCatalogId ? { catalog_id: currentCatalogId } : {}),
          catalog_name: name,
          subscription_price: subscriptionPrice,
          catalog_description: description,
          total_records: 0,
          layers: geoPoints
            .filter(layer => layer.layer_id && !isIntelligentLayer(layer))
            .map(layer => ({
              layer_id: layer.layer_id,
              points_color: layer.points_color,
            })),
          user_id: authResponse.localId,
          display_elements: {
            statisticsPopupData: {
              polygons,
              benchmarks,
              isBenchmarkControlOpen,
              currentStyle,
            },
            annotations: {
              pins: markers,
              routes: measurements,
            },
            case_study: caseStudyContent,
          },
          details: [
            // Only include current layers (deleted layers are removed entirely)
            ...geoPoints
              .filter(layer => layer.layer_id && !isIntelligentLayer(layer))
              .map(layer => ({
                layer_id: layer.layer_id,
                display: layer.display,
                points_color: layer.points_color,
                is_heatmap: layer.is_heatmap,
                is_grid: layer.is_grid,
                is_enabled: layer.is_enabled ?? true,
                opacity: layer.opacity || 1,
              })),
          ],
          // Update viewport based on actual intelligence layers in geoPoints
          intelligence_viewport: viewport ? {
            ...viewport,
            // Check if population layer exists in current geoPoints
            population: geoPoints.some(layer => 
              isIntelligentLayer(layer) && 
              (String(layer.layer_id) === '1001' || layer.basedon === 'population')
            ),
            // Check if income layer exists in current geoPoints
            income: geoPoints.some(layer => 
              isIntelligentLayer(layer) && 
              (String(layer.layer_id) === '1003' || layer.basedon === 'income')
            ),
            // Save separate sample states
            populationSample: populationSample,
            incomeSample: incomeSample,
            // Keep legacy sample for backward compatibility (optional, or just remove if not needed)
            sample: populationSample || incomeSample, 
          } : null
        },
      };

      formData.append('req', JSON.stringify(requestBody));


      const res = await apiRequest({
        url: urls.save_catalog,
        method: 'post',
        body: formData,
        isAuthRequest: true,
        isFormData: true,
      });
      setSaveResponse(res.data.data);
      setSaveResponseMsg(res.data.message);
      setSaveReqId(res.data.request_id || res.data.id);
      setFormStage('catalog');
      setIsBenchmarkControlOpen(false);
      clearDraft();
      setPolygons([]);
      setSections([]);
      setBenchmarks([]);
      setMarkers([]);
      setMeasurements([]);
      setCaseStudyContent([]);
      setCurrentCatalogId(null); // Reset catalog ID after saving

      resetState();
    } catch (error) {
      setIsError(error instanceof Error ? error : new Error(t("failed-to-save-catalog")));
    } finally {
      setIsLoading(false);
    }
  }

  function resetFormStage(resetTo: 'catalog') {
    setDescription('');
    setName('');
    setSubscriptionPrice('');
    setSaveResponse(null);
    setIsError(null);
    setFormStage(resetTo);
    setCurrentCatalogId(null);
  }

  function resetState(keepGeoPointsState?: boolean) {
    if (!keepGeoPointsState) {
      setGeoPoints([]);
      setViewport(null);
      setPopulationSample(false);
      setIncomeSample(false);
    }
    setLastGeoIdRequest(undefined);
    setLastGeoMessageRequest(undefined);
    setLastGeoError(null);
    localStorage.removeItem('unsavedGeoPoints');
  }

  function updateLayerColor(layerId: number, newColor: string) {
    setGeoPoints(prevPoints =>
      prevPoints.map(point => {
        if (point.layerId === layerId) {
          return {
            ...point,
            points_color: newColor,
            display: point.display ?? true,
          };
        }
        return point;
      })
    );
  }

  function updateLayerDisplay(layerIndex: number, display: boolean) {
    setGeoPoints(function (prevGeoPoints) {
      const updatedGeoPoints = prevGeoPoints.slice();
      updatedGeoPoints[layerIndex].display = display;
      return updatedGeoPoints;
    });
    // Bounds will be recalculated via useEffect in MapContainer
  }

  function updateLayerHeatmap(layerIndex: number, isHeatmap: boolean) {
    setGeoPoints(function (prevGeoPoints) {
      const updatedGeoPoints = prevGeoPoints.slice();
      updatedGeoPoints[layerIndex].is_heatmap = isHeatmap;
      return updatedGeoPoints;
    });
  }

  function removeLayer(layerIndex: number) {
    if (typeof layerIndex === 'undefined' || layerIndex === null) {
      console.error('Invalid layer index:', layerIndex);
      return;
    }

    setGeoPoints(prevGeoPoints => {
      if (!Array.isArray(prevGeoPoints) || prevGeoPoints.length === 0) {
        return [];
      }

      // Remove the layer from geoPoints - fix syntax error
      return prevGeoPoints.filter(point => String(point.layerId) !== String(layerIndex));
    });
  }

  async function setGeoPointsWithCb(
    geoPoints: MapFeatures[] | ((prev: MapFeatures[]) => MapFeatures[]),
    cB?: (city: string, country: string) => void
  ) {
    let geoPointsToUse;

    setGeoPoints(prev => {
      geoPointsToUse = typeof geoPoints === 'function' ? geoPoints(prev) : geoPoints;
      return geoPointsToUse;
    });

    if (cB && geoPointsToUse && geoPointsToUse[0].city_name && geoPointsToUse[0].country_name)
      cB(geoPointsToUse[0].city_name, geoPointsToUse[0].country_name);
  }

  async function handleColorBasedZone(
    requestData?: ReqGradientColorBasedOnZone
  ): Promise<GradientColorBasedOnZone[]> {
    const dataToUse = requestData || reqGradientColorBasedOnZone;

    try {
      const res = await apiRequest({
        url: urls.recolor_based,
        method: 'post',
        body: dataToUse,
        isAuthRequest: true,
      });
      if (res.data?.data && Array.isArray(res.data.data)) {
        setGradientColorBasedOnZone(res.data.data);
        return res.data.data;
      }
      return [];
    } catch (error) {
      console.error('Request failed:', error);
      setIsError(error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  const updateDropdownIndex = (index: number, value: number | null) => {
    setOpenDropdownIndices(prev => {
      const updatedIndices = [...prev];
      updatedIndices[index] = value;
      return updatedIndices;
    });
  };

  function updateLayerGrid(layerIndex: number, isGrid: boolean) {
    setGeoPoints(function (prevGeoPoints) {
      const updatedGeoPoints = prevGeoPoints.slice();
      if (isGrid) {
        // If enabling grid, disable heatmap
        updatedGeoPoints[layerIndex] = {
          ...updatedGeoPoints[layerIndex],
          is_grid: true,
          is_heatmap: false,
        };
      } else {
        updatedGeoPoints[layerIndex] = {
          ...updatedGeoPoints[layerIndex],
          is_grid: false,
        };
      }
      return updatedGeoPoints;
    });
  }

  const updateLayerLegend = (layerId: number, legend: string) => {
    setGeoPoints(prevPoints =>
      prevPoints.map(point =>
        point.layerId === layerId ? { ...point, layer_legend: legend } : point
      )
    );
  };

  async function handleFilteredZone(
    requestData?: ReqGradientColorBasedOnZone
  ): Promise<GradientColorBasedOnZone[]> {
    const dataToUse = requestData || reqGradientColorBasedOnZone;

    try {
      const res = await apiRequest({
        url: urls.filter_based_zone,
        method: 'post',
        body: dataToUse,
        isAuthRequest: true,
      });
      if (res.data?.data && Array.isArray(res.data.data)) {
        setGradientColorBasedOnZone(res.data.data);
        return res.data.data;
      }
      return [];
    } catch (error) {
      console.error('Request failed:', error);
      setIsError(error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async function handleNameBasedColorZone(
    requestData?: ReqGradientColorBasedOnZone
  ): Promise<GradientColorBasedOnZone[]> {
    const dataToUse = requestData || reqGradientColorBasedOnZone;

    try {
      const res = await apiRequest({
        url: urls.recolor_based,
        method: 'post',
        body: dataToUse,
        isAuthRequest: true,
      });
      if (res.data?.data && Array.isArray(res.data.data)) {
        setGradientColorBasedOnZone(res.data.data);
        return res.data.data;
      }
      return [];
    } catch (error) {
      console.error('Request failed:', error);
      setIsError(error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  function addMarker(
    name: string,
    description: string,
    coordinates: [number, number],
    colorHEX: string,
    markerType: MarkerType = 'saved',
    measurementId?: string
  ) {
    console.log('addMarker called with:', {
      name,
      markerType,
      measurementId,
      currentSessionId: currentSessionIdRef.current,
    });

    const finalMeasurementId =
      markerType === 'measurement-draft' && !measurementId
        ? currentSessionIdRef.current || undefined
        : measurementId;

    console.log('Final measurementId assigned:', finalMeasurementId);

    const newMarker: MarkerData = {
      id: uuidv4(),
      name,
      description,
      coordinates,
      timestamp: Date.now(),
      markerType,
      measurementId: finalMeasurementId,
      colorHEX,
      isTemporary: markerType === 'measurement-draft',
    };

    console.log('Created marker:', newMarker);
    setMarkers(prevMarkers => [...prevMarkers, newMarker]);
  }

  function deleteMarker(id: string) {
    setMarkers(prevMarkers => {
      const updatedMarkers = prevMarkers.filter(marker => marker.id !== id);
      return updatedMarkers;
    });
  }

  function addMeasurement(
    name: string,
    description: string,
    sourcePoint: [number, number],
    destinationPoint: [number, number],
    route: unknown,
    distance: number,
    duration: number,
    measurementId?: string
  ): string {
    const id = measurementId || uuidv4();
    const newMeasurement: MeasurementData = {
      id,
      name,
      description,
      sourcePoint,
      destinationPoint,
      route,
      distance,
      duration,
      timestamp: Date.now(),
    };

    setMeasurements(prevMeasurements => [...prevMeasurements, newMeasurement]);
    return id;
  }

  function deleteMeasurement(id: string) {
    // Remove the measurement from state
    setMeasurements(prevMeasurements =>
      prevMeasurements.filter(measurement => measurement.id !== id)
    );

    // Close any popups related to this measurement
    document.querySelectorAll('.measurement-popup').forEach(popup => {
      const popupInstance = (popup as PopupElement)._mapboxgl_popup;
      if (popupInstance && popupInstance.remove) {
        popupInstance.remove();
      } else {
        popup.remove();
      }
    });

    // Remove ALL markers associated with this measurement (both draft and saved)
    setMarkers(prevMarkers => {
      console.log('Deleting measurement:', id);
      console.log('Markers before filtering:', prevMarkers);

      const filteredMarkers = prevMarkers.filter(marker => {
        const shouldKeep = marker.measurementId !== id;

        console.log(`Marker ${marker.id} (${marker.name}):`, {
          markerType: marker.markerType,
          measurementId: marker.measurementId,
          targetMeasurementId: id,
          shouldKeep,
        });

        return shouldKeep;
      });

      console.log('Markers after filtering:', filteredMarkers);
      console.log('Markers removed:', prevMarkers.length - filteredMarkers.length);

      return filteredMarkers;
    });

    // Remove the route layer from the map if it exists
    const mapElement = document.querySelector('#map-container');
    const map = mapElement ? (mapElement as MapElement)._map : null;
    if (map) {
      if (map.getSource(`measure-route-${id}`)) {
        map.removeLayer(`measure-route-line-${id}`);
        map.removeSource(`measure-route-${id}`);
      }
    }
  }

  function startMeasurementSession(): string {
    const sessionId = uuidv4();
    setCurrentMeasurementSessionId(sessionId);
    currentSessionIdRef.current = sessionId;
    console.log('Started measurement session:', sessionId);
    return sessionId;
  }

  function endMeasurementSession() {
    console.log('Ending measurement session:', currentSessionIdRef.current);
    setCurrentMeasurementSessionId(null);
    currentSessionIdRef.current = null;
  }

  function clearSessionMarkers(sessionId?: string) {
    const targetSessionId = sessionId || currentSessionIdRef.current;
    if (!targetSessionId) {
      console.log('No session ID provided for clearing markers');
      return;
    }

    console.log('Clearing markers for session:', targetSessionId);
    setMarkers(prevMarkers => {
      console.log('Current markers before filtering:', prevMarkers);

      const filteredMarkers = prevMarkers.filter(marker => {
        const shouldKeep =
          marker.markerType !== 'measurement-draft' || marker.measurementId !== targetSessionId;

        console.log(`Marker ${marker.id} (${marker.name}):`, {
          markerType: marker.markerType,
          measurementId: marker.measurementId,
          targetSessionId,
          shouldKeep,
        });

        return shouldKeep;
      });

      console.log('Filtered markers after filtering:', filteredMarkers);
      console.log('Markers removed:', prevMarkers.length - filteredMarkers.length);

      return filteredMarkers;
    });
  }

  function clearAllDraftMarkers() {
    console.log('Clearing all draft markers');
    setMarkers(prevMarkers => {
      console.log('Current markers before filtering:', prevMarkers);

      const filteredMarkers = prevMarkers.filter(marker => {
        const shouldKeep = marker.markerType !== 'measurement-draft';

        console.log(`Marker ${marker.id} (${marker.name}):`, {
          markerType: marker.markerType,
          measurementId: marker.measurementId,
          shouldKeep,
        });

        return shouldKeep;
      });

      console.log('Filtered markers after filtering:', filteredMarkers);
      console.log('Markers removed:', prevMarkers.length - filteredMarkers.length);

      return filteredMarkers;
    });
  }

  function clearOtherSessionMarkers() {
    const currentSessionId = currentSessionIdRef.current;
    console.log('Clearing markers from other sessions, keeping current session:', currentSessionId);

    setMarkers(prevMarkers => {
      console.log('Current markers before filtering:', prevMarkers);

      const filteredMarkers = prevMarkers.filter(marker => {
        // Keep all non-draft markers
        if (marker.markerType !== 'measurement-draft') {
          return true;
        }

        // Keep draft markers from current session
        const shouldKeep = marker.measurementId === currentSessionId;

        console.log(`Marker ${marker.id} (${marker.name}):`, {
          markerType: marker.markerType,
          measurementId: marker.measurementId,
          currentSessionId,
          shouldKeep,
        });

        return shouldKeep;
      });

      console.log('Filtered markers after filtering:', filteredMarkers);
      console.log('Markers removed:', prevMarkers.length - filteredMarkers.length);

      return filteredMarkers;
    });
  }

  function markSessionMarkersForDeletion(sessionId?: string) {
    const targetSessionId = sessionId || currentSessionIdRef.current;
    if (!targetSessionId) {
      console.log('No session ID provided for marking markers for deletion');
      return;
    }

    console.log('Marking markers for deletion for session:', targetSessionId);
    setMarkers(prevMarkers => {
      console.log('Current markers before marking for deletion:', prevMarkers);

      const updatedMarkers = prevMarkers.map(marker => {
        if (marker.markerType === 'measurement-draft' && marker.measurementId === targetSessionId) {
          console.log(`Marking marker ${marker.id} (${marker.name}) for deletion`);
          return {
            ...marker,
            markerType: 'measurement-to-delete' as MarkerType,
          };
        }
        return marker;
      });

      const markedCount =
        updatedMarkers.filter(m => m.markerType === 'measurement-to-delete').length -
        prevMarkers.filter(m => m.markerType === 'measurement-to-delete').length;
      console.log('Markers marked for deletion:', markedCount);

      return updatedMarkers;
    });
  }

  function cleanupMarkedMarkers() {
    console.log('Cleaning up markers marked for deletion');
    setMarkers(prevMarkers => {
      console.log('Current markers before cleanup:', prevMarkers);

      const filteredMarkers = prevMarkers.filter(marker => {
        const shouldKeep = marker.markerType !== 'measurement-to-delete';

        if (!shouldKeep) {
          console.log(`Removing marker ${marker.id} (${marker.name}) marked for deletion`);
        }

        return shouldKeep;
      });

      console.log('Markers after cleanup:', filteredMarkers);
      console.log('Markers removed:', prevMarkers.length - filteredMarkers.length);

      return filteredMarkers;
    });
  }

  function getCurrentSessionId(): string | null {
    return currentSessionIdRef.current;
  }

  function clearDraft() {
    localStorage.removeItem('unsavedCatalogDraft');
    console.log('Catalog draft cleared.');
  }

  return (
    <CatalogContext.Provider
      value={{
        formStage,
        saveMethod,
        isLoading,
        isError,
        legendList,
        subscriptionPrice,
        description,
        name,
        setFormStage,
        setSaveMethod,
        setIsLoading,
        setIsError,
        setLegendList,
        setSubscriptionPrice,
        setDescription,
        setName,
        handleAddClick,
        handleSaveCatalog,
        resetFormStage,
        selectedContainerType,
        setSelectedContainerType,
        geoPoints,
        setGeoPoints,
        setGeoPointsWithCb,
        selectedColor,
        setSelectedColor,
        resetState,
        saveResponse,
        saveResponseMsg,
        saveReqId,
        setSaveResponse,
        updateLayerColor,
        updateLayerDisplay,
        updateLayerHeatmap,
        removeLayer,
        isAdvanced,
        setIsAdvanced,
        isAdvancedMode,
        setIsAdvancedMode,
        setRadiusInput,
        radiusInput,
        openDropdownIndices,
        setOpenDropdownIndices,
        updateDropdownIndex,
        colors,
        setColors,
        chosenPallet,
        setChosenPallet,
        reqGradientColorBasedOnZone,
        setReqGradientColorBasedOnZone,
        gradientColorBasedOnZone,
        setGradientColorBasedOnZone,
        handleColorBasedZone,
        selectedBasedon,
        setSelectedBasedon,
        layerColors,
        setLayerColors,
        isRadiusMode,
        setIsRadiusMode,
        updateLayerGrid,

        visualizationMode,
        setVisualizationMode,
        basedOnLayerId,
        setBasedOnLayerId,
        basedOnProperty,
        setBasedOnProperty,
        updateLayerLegend,
        handleStoreUnsavedGeoPoint,
        handleNameBasedColorZone,
        handleFilteredZone,
        markers,
        setMarkers,
        addMarker,
        deleteMarker,
        isMarkersEnabled,
        setIsMarkersEnabled,
        caseStudyContent,
        setCaseStudyContent,
        measurements,
        addMeasurement,
        setMeasurements,
        deleteMeasurement,
        selectedHomeTab,
        setSelectedHomeTab,
        currentMeasurementSessionId,
        startMeasurementSession,
        endMeasurementSession,
        clearSessionMarkers,
        clearAllDraftMarkers,
        clearOtherSessionMarkers,
        getCurrentSessionId,
        markSessionMarkersForDeletion,
        cleanupMarkedMarkers,
        nameInputs,
        setNameInputs,
        selectedOption,
        setSelectedOption,
        onColorChange,
        propertyThreshold,
        setPropertyThreshold,
        coverageType,
        setCoverageType,
        coverageValue,
        setCoverageValue,
        comparisonType,
        setComparisonType,
        polygons,
        setPolygons,
        sections,
        setSections: () => {},
        benchmarks,
        setBenchmarks,
        isBenchmarkControlOpen,
        setIsBenchmarkControlOpen,
        currentStyle,
        setCurrentStyle,
        isDraftSaving,
        setIsDraftSaving,
        clearDraft,
        fetchGeoPoints,
				selectedContainerLayerModalOpen,
				setSelectedContainerLayerModalOpen,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalogContext() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error(t("usecatalogcontext-must-be-used-within-a-catalogprovider"));
  }
  return context;
}

export function calculatePolygonStats(
  polygon: Parameters<typeof turf.booleanPointInPolygon>[1],
  geoPoints: Array<{
    layer_name?: string;
    layer_legend?: string;
    features: GeoJsonFeatureLike[];
  }>
) {
  // Process points within polygon
  const pointsWithin = geoPoints.map(layer => {
    console.log(
      `Processing layer in calculatePolygonStats: ${layer.layer_name || 'unnamed'}`
    );
    console.log(`Layer has ${layer.features?.length || 0} features`);

    const matchingPoints = layer.features.filter((point: GeoJsonFeatureLike) => {
      try {
        // Check if coordinates exist
        if (!point.geometry?.coordinates || !Array.isArray(point.geometry.coordinates)) {
          console.error('Invalid point coordinates:', point.geometry?.coordinates);
          return false;
        }

        // Handle different geometry types and coordinate structures
        let turfPoint;
        if (point.geometry.type === 'Point') {
          // Standard point format [lng, lat]
          turfPoint = turf.point(point.geometry.coordinates);
        } else if (point.geometry.type === 'Polygon') {
          // For polygons, use the first coordinate of the first ring
          if (
            Array.isArray(point.geometry.coordinates[0]) &&
            Array.isArray(point.geometry.coordinates[0][0])
          ) {
            turfPoint = turf.point(point.geometry.coordinates[0][0]);
          } else {
            console.error('Invalid polygon coordinates structure:', point.geometry.coordinates);
            return false;
          }
        } else {
          // Extract coordinates based on the structure
          let coords;
          if (Array.isArray(point.geometry.coordinates[0])) {
            if (Array.isArray(point.geometry.coordinates[0][0])) {
              // Nested array like [[[x,y],[x,y]]]
              coords = point.geometry.coordinates[0][0];
            } else {
              // Array like [[x,y]]
              coords = point.geometry.coordinates[0];
            }
          } else {
            // Simple array like [x,y]
            coords = point.geometry.coordinates;
          }

          if (!Array.isArray(coords) || coords.length < 2) {
            console.error('Could not extract valid coordinates:', coords);
            return false;
          }

          turfPoint = turf.point(coords);
        }

        return turf.booleanPointInPolygon(turfPoint, polygon);
      } catch (error: unknown) {
        const apiError = error as { message?: string };
        console.error('Error in point-in-polygon check:', apiError.message || 'Unknown error');
        console.error('Problematic point geometry:', point.geometry);
        return false;
      }
    });

    return {
      title: layer.layer_legend || layer.layer_name,
      count: matchingPoints.length,
      percentage: ((matchingPoints.length / layer.features.length) * 100).toFixed(1),
    };
  });

  return pointsWithin;
}
