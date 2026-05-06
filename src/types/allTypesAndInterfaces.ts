import { AxiosRequestConfig } from 'axios';
import React, { ReactNode } from 'react';
import { MarkerData, MarkerType, MeasurementData } from './marker';
import { Insights } from './casStudy';
import { Descendant } from 'slate';

export interface ModalProps {
  children: React.ReactNode;
  darkBackground?: boolean;
  isSmaller?: boolean;
  hasAutoSize?: boolean;
  isHome?: boolean;
}

export interface ExpandableMenuProps {
  children: ReactNode;
}

export interface MultipleLayersSettingProps {
  layerIndex: number;
}

export interface Catalog {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  image?: string;
  records_number: number;
  catalog_link: string;
  can_access: boolean;
  catalog_id?: string;
  catalog_name?: string;
  total_records?: number;
  catalog_description?: string;
  layers?: { layer_id: string; points_color: string }[];
  display_elements: {
    details: unknown[];
    markers: {
      id: string;
      description: string;
      name: string;
      timestamp: number;
      coordinates: [number, number];
    }[];
    measurements: MeasurementData[];
    case_study: Descendant[];
    polygonData?: {
      polygons: PolygonFeature[];
      sections: Section[];
      benchmarks: Benchmark[];
      isBenchmarkControlOpen: boolean;
      currentStyle: string;
    };
  };
}

export interface UserLayer {
  progress: number;
  layer_id: string;
  layer_name: string;
  points_color?: string;
  layer_legend: string;
  layer_description: string;
  records_count: number;
  is_zone_layer: boolean;
  city_name?: string;
}

export interface CatalogueCardProps {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  records_number: number;
  can_access: boolean;
  onMoreInfo(): void;
  typeOfCard: string;
}

export interface CustomProperties {
  name: string;
  rating: number;
  user_ratings_total: number;
  [key: string]: string | number | string[] | undefined;
}

export interface UserLayerCardProps {
  id: string;
  name: string;
  description: string;
  typeOfCard: string;
  legend: string;
  points_color?: string;
  progress: number;
  onMoreInfo(selectedCatalog: { id: string; name: string; typeOfCard: string }): void;
}
export interface CardItem {
  id: string;
  name: string;
  typeOfCard: string;
  points_color?: string;
  legend?: string;
  display_elements?: {
    details: unknown[];
    markers: {
      id: string;
      description: string;
      name: string;
      timestamp: number;
      coordinates: [number, number];
    }[];
    measurements: MeasurementData[];
    case_study: Descendant[];
    polygonData?: {
      polygons: PolygonFeature[];
      sections: Section[];
      benchmarks: Benchmark[];
      isBenchmarkControlOpen: boolean;
      currentStyle: string;
    };
  };
  layers?: { layer_id: string; points_color: string }[];
  city_name?: string;
}

export interface CatalogContextType {
  formStage: 'catalog' | 'catalogDetails' | 'save';
  saveMethod: string;
  isLoading: boolean;
  isError: Error | null;
  legendList: string[];
  subscriptionPrice: string;
  description: string;
  name: string;
  caseStudyContent?: Descendant[];
  selectedContainerType: 'Catalogue' | 'Layer' | 'Home';
  selectedHomeTab: 'LAYER' | 'CATALOG';
  setSelectedHomeTab: React.Dispatch<React.SetStateAction<'LAYER' | 'CATALOG'>>;
  setFormStage: React.Dispatch<React.SetStateAction<'catalog' | 'catalogDetails' | 'save'>>;
  setSaveMethod: React.Dispatch<React.SetStateAction<string>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsError: React.Dispatch<React.SetStateAction<Error | null>>;
  setLegendList: React.Dispatch<React.SetStateAction<string[]>>;
  setSubscriptionPrice: React.Dispatch<React.SetStateAction<string>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setName: React.Dispatch<React.SetStateAction<string>>;
  setCaseStudyContent: React.Dispatch<React.SetStateAction<Descendant[]>>;
  selectedContainerLayerModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedContainerType: React.Dispatch<React.SetStateAction<'Catalogue' | 'Layer' | 'Home'>>;
  handleAddClick: (
    id: string,
    typeOfCard: string,
    callBack?: (city: string, country: string) => void
  ) => void;
  handleSaveCatalog: () => Promise<void>;
  resetFormStage: (resetTo: 'catalog') => void;
  geoPoints: MapFeatures[];
  setGeoPoints: React.Dispatch<React.SetStateAction<MapFeatures[]>>;
  setGeoPointsWithCb: (geoPoints: MapFeatures[], cB: () => void) => void;
  selectedColor: { name: string; hex: string } | null;
  setSelectedColor: React.Dispatch<React.SetStateAction<{ name: string; hex: string } | null>>;
  resetState: (keepGeoPointsState?: boolean) => void;
  saveResponse: SaveResponse | null;
  saveResponseMsg: string;
  saveReqId: string;
  setSaveResponse: React.Dispatch<React.SetStateAction<SaveResponse | null>>;
  colors: string[][];
  setColors: React.Dispatch<React.SetStateAction<string[][]>>;
  chosenPallet: number | null;
  setChosenPallet: React.Dispatch<React.SetStateAction<number | null>>;
  radiusInput: number | null;
  setRadiusInput: React.Dispatch<React.SetStateAction<number | null>>;
  openDropdownIndices: (number | null)[];
  setOpenDropdownIndices: React.Dispatch<React.SetStateAction<(number | null)[]>>;
  updateDropdownIndex: (index: number, value: number | null) => void;
  reqGradientColorBasedOnZone: ReqGradientColorBasedOnZone;
  setReqGradientColorBasedOnZone: React.Dispatch<React.SetStateAction<ReqGradientColorBasedOnZone>>;
  gradientColorBasedOnZone: GradientColorBasedOnZone[];
  setGradientColorBasedOnZone: React.Dispatch<React.SetStateAction<GradientColorBasedOnZone[]>>;
  handleColorBasedZone: (
    requestData?: ReqGradientColorBasedOnZone
  ) => Promise<GradientColorBasedOnZone[]>;
  selectedBasedon: string;
  setSelectedBasedon: React.Dispatch<React.SetStateAction<string>>;
  layerColors: Record<string, string>;
  setLayerColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isRadiusMode: boolean;
  setIsRadiusMode: React.Dispatch<React.SetStateAction<boolean>>;
  isAdvanced: boolean;
  setIsAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  isAdvancedMode: Record<string, boolean>;
  setIsAdvancedMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  updateLayerColor: (layerId: number, newColor: string) => void;
  updateLayerDisplay: (layerIndex: number, display: boolean) => void;
  updateLayerHeatmap: (layerIndex: number, isHeatmap: boolean) => void;
  updateLayerGrid: (layerIndex: number, isGrid: boolean) => void;
  removeLayer: (layerIndex: number) => void;
  visualizationMode: VisualizationMode;
  setVisualizationMode: React.Dispatch<React.SetStateAction<VisualizationMode>>;
  basedOnLayerId: string | null;
  setBasedOnLayerId: React.Dispatch<React.SetStateAction<string | null>>;
  basedOnProperty: string | null;
  setBasedOnProperty: React.Dispatch<React.SetStateAction<string | null>>;
  updateLayerLegend: (layerId: number, legend: string) => void;
  handleStoreUnsavedGeoPoint: (geoPoints: MapFeatures[]) => void;
  handleNameBasedColorZone: (
    requestData?: ReqGradientColorBasedOnZone
  ) => Promise<GradientColorBasedOnZone[]>;
  handleFilteredZone: (
    requestData?: ReqGradientColorBasedOnZone
  ) => Promise<GradientColorBasedOnZone[]>;
  markers: MarkerData[];
  setMarkers: React.Dispatch<React.SetStateAction<MarkerData[]>>;
  addMarker: (
    name: string,
    description: string,
    coordinates: [number, number],
    colorHEX: string,
    markerType?: MarkerType,
    measurementId?: string
  ) => void;
  deleteMarker: (id: string) => void;
  isMarkersEnabled: boolean;
  setIsMarkersEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  measurements: MeasurementData[];
  addMeasurement: (
    name: string,
    description: string,
    sourcePoint: [number, number],
    destinationPoint: [number, number],
    route: unknown,
    distance: number,
    duration: number,
    measurementId?: string
  ) => string;
  setMeasurements: React.Dispatch<React.SetStateAction<MeasurementData[]>>;
  deleteMeasurement: (id: string) => void;
  currentMeasurementSessionId: string | null;
  startMeasurementSession: () => string;
  endMeasurementSession: () => void;
  clearSessionMarkers: (sessionId?: string) => void;
  clearAllDraftMarkers: () => void;
  clearOtherSessionMarkers: () => void;
  getCurrentSessionId: () => string | null;
  markSessionMarkersForDeletion: (sessionId?: string) => void;
  cleanupMarkedMarkers: () => void;
  nameInputs: string[];
  setNameInputs: (names: string[]) => void;
  selectedOption: string;
  setSelectedOption: React.Dispatch<React.SetStateAction<string>>;
  onColorChange: (color: string) => void;
  propertyThreshold: string;
  setPropertyThreshold: (threshold: string) => void;
  coverageType: string;
  setCoverageType: (type: string) => void;
  coverageValue: string;
  setCoverageValue: (value: string) => void;
  comparisonType: 'more' | 'less';
  setComparisonType: (type: 'more' | 'less') => void;
  polygons: PolygonFeature[];
  setPolygons: React.Dispatch<React.SetStateAction<PolygonFeature[]>>;
  sections: Section[] | PolygonData[];
  setSections: React.Dispatch<React.SetStateAction<Section[] | PolygonData[]>>;
  benchmarks: Benchmark[];
  setBenchmarks: React.Dispatch<React.SetStateAction<Benchmark[]>>;
  isBenchmarkControlOpen: boolean;
  setIsBenchmarkControlOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentStyle: string;
  setCurrentStyle: React.Dispatch<React.SetStateAction<string>>;
  isDraftSaving: boolean;
  setIsDraftSaving: React.Dispatch<React.SetStateAction<boolean>>;
  clearDraft: () => void;
  fetchGeoPoints: (
    id: string,
    typeOfCard: string,
    callBack?: (country: string, city: string) => void
  ) => Promise<void>;
}

export interface GradientColorBasedOnZone extends MapFeatures {
  sub_layer_id: string;
  [key: string]: unknown;
}

export interface ReqGradientColorBasedOnZone {
  layer_id: string;
  user_id: string;
  color_grid_choice: string[];
  change_layer_id: string;
  change_layer_name: string;
  based_on_layer_id: string;
  based_on_layer_name: string;
  coverage_value: number | string;
  coverage_property: string;
  color_based_on: string;
  threshold?: number | string;
  list_names?: string[];
}

interface Color {
  name: string;
  hex: string;
}

export interface SaveResponse {
  message: string;
  request_id: string;
  data: string;
}

export interface City {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  type: string | null;
}

export interface RequestType {
  id: string;
  requestMessage: string;
  error: Error | null;
}

export interface LayerState {
  selectedColor: Color | null;
  saveResponse: SaveResponse | null;
  isLoading: boolean;
  datasetInfo: {
    bknd_dataset_id: string;
    layer_id: string;
  } | null;
  customName?: string;
}

export interface LayerContextType {
  intelligenceViewport: {
    top_lng: number;
    top_lat: number;
    bottom_lng: number;
    bottom_lat: number;
    population: boolean;
    income: boolean;
    zoom_level: number;
  } | null;
  reqSaveLayer: {
    legend: string;
    description: string;
    name: string;
  };
  setReqSaveLayer: React.Dispatch<
    React.SetStateAction<{
      legend: string;
      description: string;
      name: string;
    }>
  >;
  createLayerformStage: string;
  isError: Error | null;
  manyFetchDatasetResp: FetchDatasetResponse | undefined;
  saveMethod: string;
  loading: boolean;
  saveResponse: SaveResponse | null;
  setFormStage: React.Dispatch<React.SetStateAction<string>>;
  setIsError: React.Dispatch<React.SetStateAction<Error | null>>;
  setManyFetchDatasetResp: React.Dispatch<React.SetStateAction<FetchDatasetResponse | undefined>>;
  setSaveMethod: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  incrementFormStage(): void;
  handleSaveLayer(layerData: LayerCustomization | { layers: LayerCustomization[] }): Promise<void>;
  resetFormStage(): void;
  selectedColor: Color | null;
  setSelectedColor: React.Dispatch<React.SetStateAction<Color | null>>;
  saveOption: string;
  setSaveOption: React.Dispatch<React.SetStateAction<string>>;
  datasetInfo: { bknd_dataset_id: string; layer_id: string } | null;
  setDatasetInfo: React.Dispatch<
    React.SetStateAction<{
      bknd_dataset_id: string;
      layer_id: string;
    } | null>
  >;
  saveResponseMsg: string;
  setSaveResponseMsg: React.Dispatch<React.SetStateAction<string>>;
  setSaveResponse: React.Dispatch<React.SetStateAction<SaveResponse | null>>;
  setSaveReqId: React.Dispatch<React.SetStateAction<string>>;
  centralizeOnce: boolean;
  setCentralizeOnce: React.Dispatch<React.SetStateAction<boolean>>;
  initialFlyToDone: boolean;
  setInitialFlyToDone: React.Dispatch<React.SetStateAction<boolean>>;
  showLoaderTopup: boolean;
  setShowLoaderTopup: React.Dispatch<React.SetStateAction<boolean>>;
  handleFetchDataset(action: string, pageToken?: string): void;
  reqFetchDataset: ReqFetchDataset;
  setReqFetchDataset: React.Dispatch<React.SetStateAction<ReqFetchDataset>>;
  textSearchInput: string;
  setTextSearchInput: React.Dispatch<React.SetStateAction<string>>;
  searchType: string;
  setSearchType: React.Dispatch<React.SetStateAction<string>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  countries: string[];
  setCountries: React.Dispatch<React.SetStateAction<string[]>>;
  cities: City[];
  setCities: React.Dispatch<React.SetStateAction<City[]>>;
  citiesData: { [country: string]: City[] };
  setCitiesData: React.Dispatch<React.SetStateAction<{ [country: string]: City[] }>>;
  categories: CategoryData;
  setCategories: React.Dispatch<React.SetStateAction<CategoryData>>;
  handleCountryCitySelection: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  handleTypeToggle: (type: string) => void;
  validateFetchDatasetForm: () => true | Error;
  resetFetchDatasetForm(): void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;

  currentLayerGroup: LayerGroup | null;
  setCurrentLayerGroup: React.Dispatch<React.SetStateAction<LayerGroup | null>>;

  addLayerToGroup(groupId: string, layer: Layer): void;
  removeLayerFromGroup(groupId: string, layerId: number): void;
  updateLayerInGroup(groupId: string, layerId: number, updates: Partial<Layer>): void;

  selectedCountry: string;
  setSelectedCountry: React.Dispatch<React.SetStateAction<string>>;

  layerStates: { [layerId: number]: LayerState };
  updateLayerState: (layerId: number, updates: Partial<LayerState>) => void;
  includePopulation: boolean;
  setIncludePopulation: React.Dispatch<React.SetStateAction<boolean>>;
  handlePopulationLayer: (shouldInclude: boolean) => Promise<void>;
  switchPopulationLayer: () => Promise<void>;
  refetchPopulationLayer: () => Promise<void>;
  handleSubmitFetchDataset: (
    action: string,
    event?: React.MouseEvent<HTMLButtonElement>
  ) => boolean | Error;
  includeIncome: boolean;
  setIncludeIncome: React.Dispatch<React.SetStateAction<boolean>>;
  switchIncomeLayer: () => Promise<void>;
  refetchIncomeLayer: () => Promise<void>;
  includeRealEstate: boolean;
  setIncludeRealEstate: React.Dispatch<React.SetStateAction<boolean>>;
  switchRealEstateLayer: () => Promise<void>;
  refetchRealEstateLayer: () => Promise<void>;
  currentViewportInsights: Insights | null;
  layerDataMap: LayerDataMap;
  setLayerDataMap: React.Dispatch<React.SetStateAction<LayerDataMap>>;
  handleFullDataFetchSuccess: () => void;
  isLoadingDataset: boolean;
  setIsLoadingDataset: React.Dispatch<React.SetStateAction<boolean>>;
  showErrorMessage: boolean;
  setShowErrorMessage: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface ReqFetchDataset {
  selectedCountry: string;
  selectedCity: string;
  action?: string;
  layers: {
    name: string;
    points_color: string;
    id: number;
    includedTypes: string[];
    excludedTypes: string[];
    layer_name?: string;
    layer_legend?: string;
    layer_description?: string;
    action?: LayerAction;
  }[];
  includedTypes: string[];
  excludedTypes: string[];
  zoomLevel?: number;
}

export interface ModalOptions {
  darkBackground?: boolean;
  isSmaller?: boolean;
  hasAutoSize?: boolean;
  isHome?: boolean;
}

export interface UIContextProps {
  isModalOpen: boolean;
  modalContent: ReactNode;
  modalOptions: ModalOptions;
  sidebarMode: string;
  isMenuExpanded: boolean;
  isViewClicked: boolean;
  openModal(content: ReactNode, options?: ModalOptions): void;
  closeModal(): void;
  toggleMenu(): void;
  handleViewClick(): void;
  setSidebarMode(mode: string): void;
  resetViewState(): void;
  isMobile: boolean;
  setIsMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isDrawerOpen: boolean;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface GeoPoint {
  location: { lat: number; lng: number };
}

export type ArrayGeoPoint = Array<GeoPoint>;

export interface BoxmapProperties {
  name: string;
  rating: number | string;
  address: string;
  phone: string;
  website: string;
  business_status: string;
  user_ratings_total: number | string;
  priceLevel?: number;
  heatmap_weight?: number;
  [key: string]: unknown;
}

export interface Feature {
  type: 'Feature';
  properties: BoxmapProperties;
  display: boolean;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}
export interface FetchDatasetResponse {
  type: 'FeatureCollection';
  features: Feature[];
  bknd_dataset_id: string;
  layer_id: string;
  records_count: number;
  next_page_token: string;
  display?: boolean;
  progress?: number;
}

export type Bounds = [number, number, number, number]; // [west, south, east, north]

export interface MapFeatures extends FetchDatasetResponse {
  layer_name?: string;
  points_color?: string;
  layer_legend?: string;
  layer_description?: string;
  is_zone_layer?: string;
  city_name?: string;
  is_heatmap?: boolean;
  is_grid?: boolean;
  bounds?: Bounds;
  basedon: string;
  layerGroupId?: string;
  layerId?: number;
  gradient_groups?: GradientGroup[];
  is_gradient?: boolean;
  gradient_based_on?: string;
  [key: string]: unknown;
}

export interface TabularData {
  formatted_address: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  website: string;
}
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthSuccessResponse {
  localId: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export type AuthResponse = AuthSuccessResponse | null;

export interface AuthContextType {
  authResponse: AuthResponse;
  setAuthResponse: React.Dispatch<React.SetStateAction<AuthResponse>>;
  isAuthenticated: boolean;
  authLoading: boolean;
  logout: () => void;
  sourceLocal: string | null;
}

export interface AuthFailedResponse {
  error: {
    code: number;
    message: string;
    errors: {
      message: string;
      domain: string;
      reason: string;
    }[];
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface CategoryData {
  [category: string]: string[];
}

export interface CostEstimate {
  cost: number;
  api_calls: number;
}

export interface CityBorders {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
}

export interface CityData {
  name: string;
  borders: CityBorders;
}

export type LayerAction = 'sample' | 'full data';

export interface Layer {
  id: number;
  name: string;
  layer_name?: string;
  includedTypes: string[];
  excludedTypes: string[];
  display?: boolean;
  points_color?: string;
  is_heatmap?: boolean;
  is_grid?: boolean;
  basedon?: string;
  layer_legend?: string;
  layer_description?: string;
  layer_id?: string;
  cost: number;
  action?: LayerAction;
}

export interface LayerGroup {
  id: string;
  name: string;
  layers: Layer[];
  created_at?: string;
  updated_at?: string;
}

export interface LayerSettings {
  display: boolean;
  points_color: string;
  is_heatmap: boolean;
  is_grid: boolean;
  basedon?: string;
}

export interface LayerDataMap {
  [layerId: number]: FetchDatasetResponse;
}

export interface LayerCustomization {
  name: string;
  legend: string;
  description: string;
  color: string;
  layerId: number;
}

// Update ReqSaveLayer interface
export interface ReqSaveLayer {
  layers: LayerCustomization[];
}

export type VisualizationMode = 'vertex' | 'heatmap' | 'grid';

export interface GradientGroup {
  color: string;
  legend: string;
  count: number;
}

export const DisplayType = {
  REGULAR: 'regular',
  HEATMAP: 'heatmap',
  GRID: 'grid',
} as const;

export interface PolygonFeature {
  id: string;
  type: string;
  properties: Record<string, unknown> | null;
  geometry: {
    coordinates: number[][][] | number[][][][];
    type: string;
  };
  isStatisticsPopupOpen: boolean;
  pixelPosition: {
    x: number;
    y: number;
  };
}

export interface MapLegendProps {
  geoPoints: MapFeatures[];
}

export type ProviderProps = {
  children: React.ReactNode;
};

export type GeoPointData = {
  features: Feature[];
  avgRating?: number;
  totalUserRatings?: number;
  layer_name?: string;
  points_color?: string;
  layer_legend?: string;
  layer_description?: string;
  is_zone_layer?: string;
  city_name?: string;
  percentageInside?: number;
};

export type Section = {
  title: string;
  points: {
    layer_name: string;
    data: {
      count: number;
      percentage: number;
      avg: number | string;
      area: string;
    }[];
  }[];
};

export type PolygonData = {
  polygon: PolygonFeature;
  sections: Section[];
  areas: string[];
};

export type PolygonContextType = {
  polygons: PolygonFeature[];
  setPolygons: React.Dispatch<React.SetStateAction<PolygonFeature[]>>;
  sections: Section[];
  benchmarks: Benchmark[];
  setBenchmarks: React.Dispatch<React.SetStateAction<Benchmark[]>>;
  isBenchmarkControlOpen: boolean;
  setIsBenchmarkControlOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentStyle: string;
  setCurrentStyle: React.Dispatch<React.SetStateAction<string>>;
};

export type Benchmark = {
  title: string;
  value: number | '';
};

export interface IAuthResponse {
  idToken: string;
  refreshToken: string;
}

export interface ApiRequestOptions extends AxiosRequestConfig {
  authMode?: 'public' | 'private';
  isAuthRequest?: boolean;
  isFormData?: boolean;
  body?: unknown;
  options?: AxiosRequestConfig;
  useCache?: boolean;
}

export interface CategoriesBrowserSubCategoriesProps {
  categories: CategoryData;
  openedCategories: string[];
  onToggleCategory: (category: string) => void;
  getTypeCounts: (type: string) => {
    includedCount: number[];
    excludedCount: number[];
  };
  layers?: { id: number; name: string }[];
  onToggleTypeInLayer?: (type: string, layerId: number) => void;
  onCreateLayerWithType?: (type: string) => void;
  getPrice?: (type: string) => string | React.ReactNode;
  onTypeClick?: (type: string) => void;
  hideAddRemoveButtons?: boolean;
  selectedType?: string;
}

export interface ColorSelectProps {
  layerId: number;
  onColorChange: (color: string) => void;
}

export interface DropdownColorSelectProps {
  layerIndex?: number;
}

export interface LayerCustomizationItemProps {
  layer: LayerCustomization;
  isCollapsed: boolean;
  error?: string;
  onToggleCollapse: (layerId: number) => void;
  onLayerChange: (layerId: number, field: keyof LayerCustomization, value: string) => void;
  onDiscard: (layerId: number) => void;
  onSave: (layerId: number) => void;
  isSaving?: boolean;
  isSaved?: boolean;
}

export interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  phone?: string;
  account_type: string;
  show_price_on_purchase: boolean;
  maker?: Record<string, unknown>;
  has_used_free_location_report?: boolean;
}

export interface PopupInfo {
  type: string;
  name: string;
  data: unknown;
}

export interface PaymentMethod {
  id: number;
  type: string;
  lastFour: string;
  expiry: string;
  isDefault?: boolean;
}

export interface DialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface NavigationSetupProps {
  children: React.ReactNode;
}

export interface BasedOnLayerDropdownProps {
  layerIndex: number;
}

export interface BasedOnDropdownProps {
  layerIndex: number;
}

export interface LayerDisplaySubCategoriesProps {
  layer: Layer;
  layerIndex: number;
  onRemoveType: (type: string) => void;
  onNameChange: (layerIndex: number, newName: string) => void;
  onColorChange: (layerIndex: number, color: string) => void;
  onLegendChange: (layerIndex: number, legend: string) => void;
  onDescriptionChange: (layerIndex: number, description: string) => void;
  onActionChange: (layerIndex: number, action: LayerAction) => void;
  onRefresh: (layerId: number) => void;
  isFetching: boolean;
  saveStatus?: 'saved' | 'unsaved' | 'saving' | 'error';
  listPrice: number;
  formatPrice: (value: number) => string;
  isPriceVisible: boolean;
}

export type MapContextType = {
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  mapContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  drawRef: React.MutableRefObject<MapboxDraw | null>;
  isStyleLoaded: boolean;
  setIsStyleLoaded: (loaded: boolean) => void;
  shouldInitializeFeatures: boolean;
  gridSize: number;
  currentZoom: number | null;
  backendZoom: number | null;
};

export interface PropertyStats {
  sum: number;
  values: number[];
  count: number;
  average?: number;
  median?: number;
}

export interface EvaluationMetrics {
  [key: string]: number;
}

// Specific metric types for different business types
export interface PharmacyMetrics {
  traffic: number;
  demographics: number;
  competition: number;
  cross_shopping: number;
  complementary: number;
}

export interface CafeMetrics {
  traffic: number;
  demographics: number;
  competition: number;
  footfall: number;
  complementary: number;
}

export interface RetailMetrics {
  traffic: number;
  demographics: number;
  competition: number;
  accessibility: number;
  complementary: number;
}

export interface RestaurantMetrics {
  traffic: number;
  demographics: number;
  competition: number;
  footfall: number;
  complementary: number;
}

export interface CustomLocation {
  lat: number;
  lng: number;
  properties: {
    price: number;
  }
}

export interface CurrentLocation {
  lat: number;
  lng: number;
  properties: {
    price: number;
    avg_order_value?: number;
  }
}

// Generic interface for all business report types
export interface CustomReportData {
  user_id: string;
  city_name: string;
  country_name: string;
  Type: string;
  potential_business_type?: string;
  ecosystem_string_name?: string;
  report_tier?: string;
  report_type?: 'full' | 'location';
  // evaluation_metrics: EvaluationMetrics;
  evaluation_metrics: SegmentEvaluationMetrics;
  custom_locations: CustomLocation[];
  current_location: CurrentLocation;
  target_age?: number;
  target_income_level?: string;
  complementary_categories?: string[];
  cross_shopping_categories?: string[];
  competition_categories?: string[];
  delivery_weight?: number;
  dine_in_weight?: number;
}

export interface BusinessCategoryMetrics {
  business_type: string;
  display_name: string;
  icon: string;
  description: string;
  competition_categories: string[];
  complementary_categories: string[];
  cross_shopping_categories: string[];
  metrics: {
    traffic: MetricDetail;
    demographics: MetricDetail;
    competition: MetricDetail;
    complementary: MetricDetail;
  };
}

export interface MetricDetail {
  name: string;
  description: string;
  icon: string;
  default_weight: number;
  min_weight: number;
  max_weight: number;
}

export interface Step {
  id: number;
  title: string;
  description: string;
}

export interface FormErrors {
  [key: string]: string;
}

export type MetricKey = string;

// Business type definitions
export type BusinessType = string;

export interface ReportGenerationResponse {
  success: boolean;
  report_url?: string;
  message?: string;
  error?: string;
}

export interface IntelligenceViewport {
  top_lng: number;
  top_lat: number;
  bottom_lng: number;
  bottom_lat: number;
  population: boolean;
  income: boolean;
  real_estate: boolean;
  zoom_level: number;
  populationSample: boolean;
  incomeSample: boolean;
  realEstateSample: boolean;
  sample?: boolean;
}

export interface SegmentEvaluationMetrics {
  traffic: number;
  demographics: number;
  competition: number;
  complementary: number;
  cross_shopping: number;
}

export interface SegmentAttributes {
  target_income_level: 'low' | 'medium' | 'high';
  target_age: number;
  analysis_radius: number;
  complementary_categories: string[];
  optimal_num_complementary_businesses_per_category: number;
  cross_shopping_categories: string[];
  optimal_num_cross_shopping_businesses_per_category: number;
  competition_categories: string[];
  max_competition_threshold_per_category: number;
  evaluation_metrics: SegmentEvaluationMetrics;
}

export interface SegmentDemographicProfile {
  age_range: string;
  household_size: string;
  income: 'low' | 'medium' | 'high';
  lifestyle: string;
  spending_habits: string;
}

export interface CustomSegment {
  segment_id: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  emoji: string;
  icon: string;
  attributes: SegmentAttributes;
  demographic_profile: SegmentDemographicProfile;
  suitable_businesses: string[];
}

export type CustomSegmentReportResponse = CustomSegment[];
