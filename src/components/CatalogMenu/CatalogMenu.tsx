import { useState, MouseEvent, useEffect } from 'react';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import DataContainer from '../DataContainer/DataContainer';
import { useCatalogContext } from '../../context/CatalogContext';
import MultipleLayersSetting from '../MultipleLayersSetting/MultipleLayersSetting';
import { useUIContext } from '../../context/UIContext';
import { topics } from '../../types';
import { useLayerContext } from '../../context/LayerContext';
import { defaultMapConfig } from '../../hooks/map/useMapInitialization';
import Chat from '../Chat/Chat';
import ChatTrigger from '../Chat/ChatTrigger';
import { CaseStudyToggle } from '../CaseStudy/CaseStudyToggle';
import { t } from '../../i18n';


const enableAI = true;

function CatalogMenu() {
  const { openModal, setSidebarMode } = useUIContext();

  const {
    setSelectedContainerType,
    setSelectedContainerLayerModalOpen,
    resetState,
    setFormStage,
    setLegendList,
    geoPoints,
    setGeoPoints,
    resetFormStage,
    setMarkers,
    setMeasurements,
    setCaseStudyContent,
    setPolygons,
    setBenchmarks,
    setIsBenchmarkControlOpen,
  } = useCatalogContext();
  const { setSelectedCity, setSelectedCountry } = useLayerContext();

  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem('unsavedCatalogDraft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        if (
          parsedDraft &&
          (parsedDraft.geoPoints?.length > 0 ||
            parsedDraft.markers?.length > 0 ||
            parsedDraft.measurements?.length > 0)
        ) {
          console.log('Found saved draft with:', {
            geoPoints: parsedDraft.geoPoints?.length || 0,
            markers: parsedDraft.markers?.length || 0,
            measurements: parsedDraft.measurements?.length || 0,
            polygons: parsedDraft.polygons?.length || 0,
            benchmarks: parsedDraft.benchmarks?.length || 0,
          });
          setShowRestorePrompt(true);
        }
      } catch (error) {
        console.error('Error parsing saved draft:', error);
        localStorage.removeItem('unsavedCatalogDraft');
      }
    }
  }, []);

  useEffect(() => {
    resetFormStage('catalog');
    setSidebarMode('catalog');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRestoreClick() {
    const savedDraft = localStorage.getItem('unsavedCatalogDraft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        if (parsedDraft) {
          if (parsedDraft.geoPoints && parsedDraft.geoPoints.length > 0) {
            setGeoPoints(prevGeoPoints => [...prevGeoPoints, ...parsedDraft.geoPoints]);

            const firstPoint = parsedDraft.geoPoints[0];
            if (firstPoint && firstPoint.city_name) {
              setSelectedCity(firstPoint.city_name);
            }
            if (firstPoint && firstPoint.country_name) {
              setSelectedCountry(firstPoint.country_name);
            } else if (firstPoint) {
              setSelectedCountry(defaultMapConfig.fallBackCountry);
            }
          }

          if (parsedDraft.markers && parsedDraft.markers.length > 0) {
            setMarkers(parsedDraft.markers);
          }

          if (parsedDraft.measurements && parsedDraft.measurements.length > 0) {
            setMeasurements(parsedDraft.measurements);
          }

          if (parsedDraft.caseStudyContent) {
            setCaseStudyContent(parsedDraft.caseStudyContent);
          }

          if (parsedDraft.polygons && parsedDraft.polygons.length > 0) {
            setPolygons(parsedDraft.polygons);
          }

          if (parsedDraft.benchmarks && parsedDraft.benchmarks.length > 0) {
            setBenchmarks(parsedDraft.benchmarks);
          }

          if (parsedDraft.isBenchmarkControlOpen !== undefined) {
            setIsBenchmarkControlOpen(parsedDraft.isBenchmarkControlOpen);
          }

          console.log('Draft restored successfully with:', {
            geoPoints: parsedDraft.geoPoints?.length || 0,
            markers: parsedDraft.markers?.length || 0,
            measurements: parsedDraft.measurements?.length || 0,
            polygons: parsedDraft.polygons?.length || 0,
            benchmarks: parsedDraft.benchmarks?.length || 0,
          });
        }
      } catch (error) {
        console.error('Error restoring draft:', error);
        localStorage.removeItem('unsavedCatalogDraft');
      }
    }

    setShowRestorePrompt(false);
    localStorage.removeItem('unsavedCatalogDraft');
  }

  function openCatalogModal(contentType: 'Catalogue' | 'Layer') {
    setSelectedContainerType(contentType);
    openModal(<DataContainer />);
  }

  function handleAddCatalogClick() {
    openCatalogModal('Catalogue');
  }

  function handleAddLayerClick() {
    openCatalogModal('Layer');
  }

  function handleDiscardClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    localStorage.removeItem('unsavedCatalogDraft');
    setShowRestorePrompt(false);
    resetState();
  }

  const safeGeoPoints = Array.isArray(geoPoints)
    ? geoPoints.filter(point => !point.isTemporary)
    : [];

  function handleSaveClick() {
    const legends = safeGeoPoints
      .map(function (featureCollection) {
        return featureCollection.layer_legend;
      })
      .filter(function (legend): legend is string {
        return !!legend;
      });

    setLegendList(legends);
    setFormStage('catalogDetails');
    setSidebarMode('catalogDetails');
  }

  return (
    <div className="flex flex-col justify-between h-full w-full pt-3 lg:pe-1.5">
      <div className={`flex flex-col justify-start my-3 flex-1 min-h-0`}>
        <CaseStudyToggle />
        <div className="flex justify-between items-center mx-8 my-2">
          <p className={'text-lg font-semibold'}>{t("datasets")}</p>
          <button
            className={
              'bg-[#115740] border border-white rounded h-16 w-36 text-white hover:bg-[#28a745] transition-all'
            }
            onClick={handleAddCatalogClick}
          >{t("add-catalog")}</button>
        </div>
        <div className={'flex justify-between items-center mx-8 my-2'}>
          <p className={'text-lg font-semibold'}>{t("layers")}</p>
          <button
            className={
              'bg-white border-2 border-[#115740] rounded h-16 w-36 text-black hover:bg-gray-300 transition-all'
            }
            onClick={handleAddLayerClick}
          >{t("add-layer")}</button>
        </div>

        {enableAI && (
          <div className="flex relative w-full">
            <ChatTrigger
              title={t("ai-recolor")}
              position="auto"
              cN="flex-grow "
              size="h-12 mx-8"
              colors="bg-gem-gradient border text-gray-200"
              beforeIcon={<FaWandMagicSparkles />}
              afterIcon={<></>}
            />
            <Chat topic={topics.RECOLOR} position="fixed bottom-16 lg:bottom-auto start-[2.5vw] lg:start-[27.5rem] z-50" />
          </div>
        )}

        {showRestorePrompt && (
          <div className="ms-8 me-8 m-auto border-solid rounded border-2 border-[#115740] p-2 mt-5 ">
            <p className="text-lg text-center font-semibold flex pb-3">{t("you-have-unsaved-data-would-you-like-to-restore-it")}</p>
            <div className="flex w-full gap-2">
              <button
                onClick={() => {
                  if (geoPoints.length > 0) {
                    resetState(true);
                  } else {
                    resetState();
                  }
                  localStorage.removeItem('unsavedCatalogDraft');
                  setShowRestorePrompt(false);
                }}
                className="w-full h-full bg-slate-100 border-2 border-[#115740] text-[#115740] flex justify-center items-center font-semibold rounded-lg
              hover:bg-white transition-all cursor-pointer disabled:text-opacity-55 disabled:hover:bg-slate-100 disabled:cursor-not-allowed"
              >{t("no")}</button>

              <button
                onClick={handleRestoreClick}
                className="w-full h-full bg-[#115740] border-[#115740] border-2 text-white flex justify-center items-center font-semibold rounded-lg hover:bg-[#123f30] 
         transition-all cursor-pointer disabled:text-opacity-55 disabled:hover:bg-[#115740] disabled:cursor-not-allowed"
              >{t("yes")}</button>
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col justify-start items-center px-4">
            {safeGeoPoints.map(function (layer, index) {
              return <MultipleLayersSetting key={layer.uniqueId || index} layerIndex={index} />;
            })}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-center">
        	<button className="px-4 py-2 text-orange-700"
	        	onClick={() => {
	        		setSelectedContainerLayerModalOpen(true)
		        	handleAddLayerClick()
	        	}}>
		        {t("add-your-own-data")}
	        </button>
        </div>
      </div>
      <div className="w-full flex-col flex px-2 py-2 select-none border-t lg:mb-0 mb-14">
        <div className="flex w-full gap-2">
          <button
            disabled={!(safeGeoPoints.length > 0)}
            onClick={handleDiscardClick}
            className="w-full h-10  bg-slate-100 border-2 border-[#115740] text-[#115740] flex justify-center items-center font-semibold rounded-lg
                 hover:bg-white transition-all cursor-pointer disabled:text-opacity-55 disabled:hover:bg-slate-100 disabled:cursor-not-allowed"
          >{t("discard")}</button>

          <button
            onClick={handleSaveClick}
            disabled={!(safeGeoPoints.length > 0)}
            className="w-full h-10  bg-[#115740] text-white flex justify-center items-center font-semibold rounded-lg hover:bg-[#123f30] 
            transition-all cursor-pointer disabled:text-opacity-55 disabled:hover:bg-[#115740] disabled:cursor-not-allowed"
          >{t("save")}</button>
        </div>
      </div>
    </div>
  );
}

export default CatalogMenu;
