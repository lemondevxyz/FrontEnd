import { useState, useEffect } from 'react';
import { useLayerContext } from '../../context/LayerContext';
import { LayerCustomization } from '../../types/allTypesAndInterfaces';
import LayerCustomizationItem from '../LayerCustomizationItem/LayerCustomizationItem';
import { useCatalogContext } from '../../context/CatalogContext';
import { HiCheck, HiExclamation } from 'react-icons/hi';
import { getDefaultLayerColor } from '../../utils/helperFunctions';
import { t } from '../../i18n';


interface LegendAutoFillData {
  selectedCountry?: string;
  selectedCity?: string;
  action: string;
  includedTypes: string[];
  excludedTypes: string[];
}

function autoFillLegendFormat(data: LegendAutoFillData) {
  if (!data.selectedCountry || !data.selectedCity) return '';

  const actionAbbreviation = data.action.split(' ')[0];

  const cityAbbreviation = data.selectedCity.slice(0, 3).toUpperCase();

  const countryAbbreviation = data.selectedCountry
    .split(' ')
    .map((word: string) => word[0])
    .join('')
    .toUpperCase();

  const included = data.includedTypes.map((type: string) => type.replace('_', ' ')).join(' + ');

  const excluded =
    data.excludedTypes.length > 0
      ? ' + not ' + data.excludedTypes.map((type: string) => type.replace('_', ' ')).join(' + not ')
      : '';
  // Handle special cases for action
  if (actionAbbreviation === 'full') {
    return `${actionAbbreviation}-${countryAbbreviation}-${cityAbbreviation}-${included}${excluded}`;
  } else {
    return `${countryAbbreviation}-${cityAbbreviation}-${included}${excluded}`;
  }
}

function CustomizeLayer() {
  const {
    resetFormStage,
    resetFetchDatasetForm,
    reqFetchDataset,
    handleSaveLayer,
    updateLayerState,
    layerDataMap,
  } = useLayerContext();

  const { removeLayer, setSelectedHomeTab, fetchGeoPoints } = useCatalogContext();

  const [layerCustomizations, setLayerCustomizations] = useState<LayerCustomization[]>([]);
  const [errors, setErrors] = useState<{ [layerId: number]: string }>({});
  const [collapsedLayers, setCollapsedLayers] = useState<Set<number>>(new Set());
  const [savingLayers, setSavingLayers] = useState<Set<number>>(new Set());
  const [savedLayers, setSavedLayers] = useState<Set<number>>(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [globalSaveError, setGlobalSaveError] = useState<string | null>(null);
  const [allSaved, setAllSaved] = useState(false);

  useEffect(() => {
    if (reqFetchDataset?.layers?.length > 0) {
      const initialCustomizations = reqFetchDataset.layers.map(layer => {
        const legendText = autoFillLegendFormat({
          ...reqFetchDataset,
          includedTypes: layer.includedTypes || [],
          excludedTypes: layer.excludedTypes || [],
        });

        return {
          layerId: layer.id,
          name: layer.name || legendText,
          legend: layer.layer_legend || legendText,
          description: layer.layer_description || '',
          color: layer.points_color || getDefaultLayerColor(layer.id),
        };
      });

      setLayerCustomizations(initialCustomizations);
    }
  }, [reqFetchDataset]);

  useEffect(() => {
    if (allSaved && layerCustomizations.length > 0) {
      setSelectedHomeTab('CATALOG');

      layerCustomizations.forEach(layer => {
        const savedLayerData = layerDataMap[layer.layerId];
        if (savedLayerData?.layer_id) {
          fetchGeoPoints(savedLayerData.layer_id, 'layer');
        }
      });
    }
  }, [allSaved, layerCustomizations, layerDataMap, setSelectedHomeTab, fetchGeoPoints]);

  useEffect(() => {
    if (layerCustomizations.length > 0) {
      const allLayersSaved = layerCustomizations.every(layer => savedLayers.has(layer.layerId));
      setAllSaved(allLayersSaved);
    }
  }, [savedLayers, layerCustomizations]);
  console.log('layerCustomizations', layerCustomizations);

  const handleLayerChange = (layerId: number, field: keyof LayerCustomization, value: string) => {
    setLayerCustomizations(prev => {
      const updated = prev.map(layer =>
        layer.layerId === layerId
          ? {
              ...layer,
              [field]: value,
              ...(field === 'color' ? { color: value } : {}),
            }
          : layer
      );
      return updated;
    });

    // Update layer state if the field is 'name'
    if (field === 'name') {
      updateLayerState(layerId, { customName: value });
    }
  };

  const validateLayer = (layerId: number) => {
    const layer = layerCustomizations.find(l => l.layerId === layerId);
    if (!layer?.name || !layer?.legend) {
      setErrors(prev => ({
        ...prev,
          [layerId]: t("name-and-legend-are-required"),
      }));
      return false;
    }
    setErrors(prev => ({ ...prev, [layerId]: '' }));
    return true;
  };

  const saveLayer = async (layerId: number) => {
    if (validateLayer(layerId)) {
      try {
        setSavingLayers(prev => new Set(prev).add(layerId));
        const layerData = layerCustomizations.find(l => l.layerId === layerId);

        if (layerData) {
          await handleSaveLayer({ layers: [layerData] });
          setSavedLayers(prev => new Set(prev).add(layerId));
        }
      } catch {
        setErrors(prev => ({
          ...prev,
          [layerId]: t("failed-to-save-layer-please-try-again"),
        }));
      } finally {
        setSavingLayers(prev => {
          const next = new Set(prev);
          next.delete(layerId);
          return next;
        });
      }
    }
  };

  const handleSaveAllLayers = async () => {
    const allValid = layerCustomizations.every(layer => validateLayer(layer.layerId));
    if (allValid) {
      try {
        setIsSavingAll(true);
        setGlobalSaveError(null);
        const layerIds = layerCustomizations.map(l => l.layerId);
        layerIds.forEach(id => setSavingLayers(prev => new Set(prev).add(id)));

        await handleSaveLayer({ layers: layerCustomizations });

        setSavedLayers(new Set(layerIds));
      } catch {
        setGlobalSaveError(t("failed-to-save-layers-please-try-again"));
        setErrors(prev => ({
          ...prev,
          global: t("failed-to-save-layers-please-try-again"),
        }));
      } finally {
        setIsSavingAll(false);
        setSavingLayers(new Set());
      }
    }
  };

  const handleDiscardLayer = (layerId: number) => {
    setLayerCustomizations(prev => {
      const updated = prev.filter(l => l.layerId !== layerId);
      // If this was the last layer, perform discard all actions
      if (updated.length === 0) {
        resetFetchDatasetForm();
        resetFormStage();
      }
      return updated;
    });
    removeLayer(layerId);
  };

  const handleDiscardAll = () => {
    resetFetchDatasetForm();
    resetFormStage();
  };

  const toggleCollapse = (layerId: number) => {
    setCollapsedLayers(prev => {
      const newSet = new Set(prev);
      if (prev.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  };

  return (
    <div className="flex flex-col p-2 max-h-[100%]">
      <div className="flex flex-col">
        <h1 className="text-lg font-bold">{t("customize-layers")}</h1>
      </div>
      <div className="flex flex-col h-auto overflow-y-scroll space-y-6 p-2">
        {layerCustomizations.map(layer => (
          <LayerCustomizationItem
            key={layer.layerId}
            layer={layer}
            isCollapsed={collapsedLayers.has(layer.layerId)}
            error={errors[layer.layerId]}
            isSaving={savingLayers.has(layer.layerId)}
            isSaved={savedLayers.has(layer.layerId)}
            onToggleCollapse={toggleCollapse}
            onLayerChange={handleLayerChange}
            onDiscard={handleDiscardLayer}
            onSave={saveLayer}
          />
        ))}
      </div>
      {/* Global Controls with Enhanced Feedback */}
      <div className="flex flex-col border-t pt-4">
        {globalSaveError && (
          <div className="mb-3 text-sm text-red-600 flex items-center gap-2">
            <HiExclamation className="h-5 w-5 flex-shrink-0" />
            <span>{globalSaveError}</span>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleDiscardAll}
            className={`px-4 py-2 border rounded-md shadow-sm text-sm font-medium border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
          >{t("go-back")}</button>
          <button
            onClick={handleDiscardAll}
            disabled={allSaved}
            className={`px-4 py-2 border rounded-md shadow-sm text-sm font-medium
              ${
                allSaved
                  ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
              }`}
          >{t("discard-all")}</button>
          <button
            onClick={handleSaveAllLayers}
            disabled={isSavingAll || allSaved}
            className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm 
              font-medium text-white 
              ${
                allSaved
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isSavingAll
                    ? 'bg-gray-500 cursor-not-allowed'
                    : globalSaveError
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
              }
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
              flex items-center justify-center gap-2 min-w-[100px]`}
          >
            {isSavingAll ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>{t("saving-all")}</span>
            ) : allSaved ? (
              <>
                <HiCheck className="h-5 w-5" />{t("all-saved")}</>
            ) : globalSaveError ? (
              <>
                <HiExclamation className="h-5 w-5" />{t("retry-all")}</>
            ) : (t("save-all")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomizeLayer;
