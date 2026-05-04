import { useState, useEffect } from 'react';
import CatalogueCard from '../CatalogueCard/CatalogueCard';
import urls from '../../urls.json';
import { Catalog, UserLayer, CardItem } from '../../types/allTypesAndInterfaces';
import { useCatalogContext } from '../../context/CatalogContext';
import UserLayerCard from '../UserLayerCard/UserLayerCard';
import { isValidColor } from '../../utils/helperFunctions';
import { useAuth } from '../../context/AuthContext';
import { useUIContext } from '../../context/UIContext';
import apiRequest from '../../services/apiRequest';
import { useLayerContext } from '../../context/LayerContext';
import CampaignPage from '../../pages/Campaign/campaign_home';
import { Spinner } from '../common';
import { t } from '../../i18n';

import Modal from '../common/Modal';

function LayerUploadFileInput({
	label,
	disabled,
	name,
	type,
	value,
	setFormData,
	...rest
}) {
	return (<div className="space-y-3" key={name}>
	  <label htmlFor="country_name" className="block text-sm font-semibold text-gray-700">
	    <span className="flex items-center">
	      {label}
	    </span>
	  </label>
	  {type !== "textarea" ?
	    (<input
	      type={type}
	      className={"px-2 py-1 border-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-300 focus:enabled:outline-none focus:enabled:ring-2 focus:enabled:ring-primary/20 focus:enabled:border-primary transition-all duration-200 text-sm " + (type !== "checkbox" ? "w-full" : "")}
	      disabled={disabled && disabled()}
	      onChange={e => {
		      setFormData(name, type === "checkbox" ? !value : e.target.value)
	      }}
	      value={value}
	      name={name}
	      {...rest}
	    />) :
	    (<textarea
		    onChange={e => setFormData(name, e.target.value)}
		    value={value}
	      className="w-full px-2 py-1 border-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"></textarea>)}
	</div>)
}

function DataContainer() {
  const {
    selectedContainerType,
    selectedContainerLayerModalOpen,
    setSelectedContainerLayerModalOpen,
    handleAddClick,
    setGeoPoints,
    isLoading,
  } = useCatalogContext();
  const { setSelectedCity, setSelectedCountry } = useLayerContext();
  const { authResponse } = useAuth();
  const { closeModal } = useUIContext();
  const [activeTab, setActiveTab] = useState('Data Catalogue');
  const [resData, setResData] = useState<(Catalog | UserLayer)[] | string>('');
  // layers data that will be sat after user clicks Add Layer
  const [userLayersData, setUserLayersData] = useState<UserLayer[]>([]);
  const [userCatalogsData, setUserCatalogsData] = useState<Catalog[]>([]);
  const [, setResMessage] = useState<string>('');
  const [, setResId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const [, setWsResMessage] = useState<string>('');
  const [, setWsResId] = useState<string>('');
  const [, setWsResLoading] = useState<boolean>(false);
  const [, setWsResError] = useState<Error | null>(null);
  const [loadFiles, setLoadFiles] = [selectedContainerLayerModalOpen, setSelectedContainerLayerModalOpen];
  const [loadFilesLayers, setLoadFilesLayers] = useState([]);
  const [formData, setFormData] = useState({deduplicate: false});
  
  useEffect(() => {
	  if(selectedContainerLayerModalOpen)
		  setActiveTab('Load Files') 
  }, [selectedContainerLayerModalOpen]);
   
  useEffect(() => {
  	(async () => {
	  	if(activeTab === "Load Files") {
	  		setLoading(true);
	  		try {
		      const body = { user_id: authResponse?.localId };
		      const res = await apiRequest({
		        url: urls.layers_upload_file_all,
		        method: 'post',
		        isAuthRequest: true,
		        body: body,
		      });
		      
		  		setLoadFilesLayers(res.data.data);
	      } catch(e) {
	      	console.log(e)
	      }
	  		setLoading(false);
	  	}
  	})();
  }, [activeTab, authResponse]);

  useEffect(() => {
    async function fetchUserLayers() {
      setLoading(true);

      const body = { user_id: authResponse?.localId };
      try {
        const res = await apiRequest({
          url: urls.user_layers,
          method: 'post',
          isAuthRequest: true,
          body: body,
        });
        setUserLayersData(res.data.data);
        setResMessage(res.data.message);
        setResId(res.data.request_id);
      } catch (error) {
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    }

    async function fetchUserCatalogs() {
      setLoading(true);

      const body = { user_id: authResponse?.localId };
      try {
        const res = await apiRequest({
          url: urls.user_catalogs,
          method: 'post',
          isAuthRequest: true,
          body: body,
        });
        setUserCatalogsData(res.data.data);
        setResMessage(res.data.message);
        setResId(res.data.request_id);
      } catch (error) {
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    }

    // Determine which data to fetch based on selected container type
    async function fetchData() {
      setLoading(true);
      setError(null);
      console.log(612, selectedContainerType)
      if (selectedContainerType === 'Layer') {
        await fetchUserLayers();
      } else if (selectedContainerType === 'Catalogue') {
        await fetchUserCatalogs();
      }

      setLoading(false);
    }

    fetchData();
  }, [selectedContainerType, authResponse]);

  useEffect(
    function () {
      // Select the data shown in the modal based on the current mode.
      if (selectedContainerType === 'Catalogue') {
        if (JSON.stringify(resData) !== JSON.stringify(userCatalogsData)) {
          setResData(userCatalogsData);
        }
      } else if (selectedContainerType === 'Layer') {
        if (JSON.stringify(resData) !== JSON.stringify(userLayersData)) {
          setResData(userLayersData);
        }
      } else if (selectedContainerType === 'Home') {
        if (resData !== '') {
          setResData('');
        }
      }
    },
    [userLayersData, userCatalogsData, selectedContainerType, resData]
  );

  // Handle click event on catalog card
  async function handleCatalogCardClick(selectedItem: CardItem) {
    if (selectedContainerType === 'Home') {
      setWsResLoading(true);

      try {
        const res = await apiRequest({
          url: urls.http_catlog_data,
          method: 'post',
          body: { catalogue_dataset_id: selectedItem.id },
        });
        setGeoPoints(res.data.data);
        setWsResMessage(res.data.message);
        setWsResId(res.data.request_id);
        setWsResLoading(false);
        closeModal();
        console.log('res', res);
      } catch (error) {
        setWsResError(error instanceof Error ? error : new Error(String(error)));
      }
    } else {
      // layer or catalog
      // we are here
      await handleAddClick(
        selectedItem.id,
        selectedItem.typeOfCard,
        (country: string, city: string) => {
          setSelectedCountry(country);
          setSelectedCity(city);
        }
      );
    }

    closeModal();
  }

  // Render a card based on the item type
  function makeCard(item: Catalog | UserLayer, index: number) {
    if ('layer_id' in item) {
      // Render UserLayerCard if item is a user layer
      return (
        <UserLayerCard
          key={item.layer_id + '-' + index} // Use a combination of id and index
          id={item.layer_id}
          name={item.layer_name}
          description={item.layer_description}
          legend={item.layer_legend}
          typeOfCard="layer"
          points_color={item.points_color}
          progress={item.progress}
          onMoreInfo={function () {
            handleCatalogCardClick({
              id: item.layer_id,
              name: item.layer_name,
              typeOfCard: 'layer',
              points_color: isValidColor(item.points_color as string)
                ? item.points_color
                : undefined,
              legend: item.layer_legend,
            });
          }}
        />
      );
    } else {
      // Render CatalogueCard if item is a catalog
      const typeOfCard = 'catalog_name' in item ? 'userCatalog' : 'catalog';
      return (
        <CatalogueCard
          key={(item.id || item.catalog_id || '') + '-' + index}
          id={item.id || item.catalog_id || ''}
          thumbnail_url={item.thumbnail_url || item.image || ''}
          name={item.name || item.catalog_name || ''}
          records_number={item.records_number || item.total_records || 0}
          description={item.description || item.catalog_description || ''}
          onMoreInfo={function () {
            handleCatalogCardClick({
              id: item.id || item.catalog_id || '',
              name: item.name || item.catalog_name || '',
              typeOfCard: typeOfCard,
              ...(typeOfCard === 'userCatalog' && { layers: item.layers }),
            });
          }}
          can_access={item.can_access ?? false}
          typeOfCard={typeOfCard}
        />
      );
    }
  }

  // Render cards based on filtered data
  function renderCards() {
    if (typeof resData === 'string') {
      return <div>{resData}</div>;
    }

    if (Array.isArray(resData)) {
      return resData.map(function (item, index) {
        return makeCard(item, index);
      });
    }

    return null;
  }

  if (error) {
    return <div>{t("error")}{' '}{error.message}</div>;
  }
  const layerUploadFileSetInput = (k, v) =>
	  setFormData(prev => ({...prev, [k]: v}));

  if (loading) {
    return <Spinner className="size-32 " />;
  }
  
  const addLayerUploadFile = async function(body) {
  	setLoading(true);
  	try {
	  	await apiRequest({
		    url: urls.layers_upload_file_new,
		    method: 'post',
		    isAuthRequest: true,
		    body,
		    isFormData: true,
		  })
		  setLoadFiles(false);
	  } catch(e) {
	  	console.log(e);
	  }

  	setLoading(false);
  }

  return (
    <div className={`lg:p-6 h-full ${selectedContainerType === 'Home' ? 'px-2 py-1' : 'p-2'}`}>
      {/* when add layer or category */}
      {isLoading && (
        <div className="fixed top-0 start-0 w-screen h-screen bg-black bg-opacity-30 z-50">
          <Spinner className="size-32 border-white border-4" />
        </div>
      )}

      <h2 className="text-2xl text-center font-semibold">
        {selectedContainerType ==="Catalogue"
          ?t("add-data-to-map")
          : selectedContainerType ==="Home"
            ? ''
            :t("add-layers-to-map")}
      </h2>
      {selectedContainerType ==="Home" ? (
        <>
          <CampaignPage />
        </>
      ) : (
        <>
          <div className="flex flex-wrap lg:gap-0 gap-2 w-full justify-center items-center my-4 rounded-xl font-semibold">
            <button
              className={`${
                (activeTab === 'Data Catalogue' && selectedContainerType === 'Catalogue') ||
                (activeTab === 'Data Layer' && selectedContainerType === 'Layer')
                  ? 'bg-white text-[#333] border-2 border-[#f5f5f5] font-bold text-base py-[10px] px-5'
                  : 'bg-[#f5f5f5] border-none py-[10px] px-[20px] cursor-pointer text-base text-[#333] transition-colors duration-300 hover:bg-[#e6e6e6]'
              } text-nowrap flex-1`}
              onClick={function () {
                setActiveTab(
                  selectedContainerType === 'Catalogue' ? 'Data Catalogue' : 'Data Layer'
                );
              }}
            >
              {selectedContainerType ==="Catalogue" ?t("data-catalogue") :t("data-layer")}
            </button>
            <button
              className={`${
                activeTab === 'Load Files'
                  ? 'bg-white text-[#333] border-2 border-[#f5f5f5] font-bold text-base py-[10px] px-5'
                  : 'bg-[#f5f5f5] border-none py-[10px] px-[20px] cursor-pointer text-base text-[#333] transition-colors duration-300 hover:bg-[#e6e6e6]'
              } text-nowrap flex-1`}
              onClick={function () {
                setActiveTab('Load Files');
              }}
            >{t("load-files")}</button>
            <button
              className={`${
                activeTab === 'Connect Your Data'
                  ? 'bg-white text-[#333] border-2 border-[#f5f5f5] font-bold text-base py-[10px] px-5'
                  : 'bg-[#f5f5f5] border-none py-[10px] px-[20px] cursor-pointer text-base text-[#333] transition-colors duration-300 hover:bg-[#e6e6e6]'
              } text-nowrap flex-1`}
              onClick={function () {
                setActiveTab('Connect Your Data');
              }}
            >{t("connect-your-data")}</button>
          </div>
          {activeTab ==="Data Catalogue" || activeTab ==="Data Layer" ? (
            <div className="w-full pb-10">
              {selectedContainerType ==="Catalogue" && activeTab ==="Data Catalogue" && (
                <div className="mb-6 p-4 rounded-xl bg-[#f0f7ff] border border-[#c5d9f1] text-[#1a365d]">
                  <p className="font-semibold mb-2">{t("build-your-own-data-catalogue")}</p>
                  <p className="text-sm leading-relaxed">{t("create-a-catalogue-by-adding-multiple")}{' '}<strong>{t("layers-2")}</strong>{' '}{t("from-the-layers-section-and-saving-them-together-you-can-combine-layers-with")}{' '}<strong>{t("pins")}</strong>{' '}{t("and")}{' '}<strong>{t("drawings")}</strong>{' '}{t("on-the-map-to-organize-your-data-the-way-you-want-once-saved-your-layers-and-ann")}</p>
                </div>
              )}
              <div
                className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 md:gap-x-2 gap-y-10 w-full"
                // overflow-y-auto
              >
                {renderCards()}
              </div>
              {selectedContainerType ==="Catalogue" &&
                activeTab ==="Data Catalogue" &&
                Array.isArray(resData) &&
                resData.length === 0 && (
                  <div className="mt-6 rounded-xl border border-dashed border-[#c5d9f1] bg-[#f8fbff] p-6 text-center text-[#1a365d]">{t("no-saved-catalogues-yet-build-one-by-adding-layers-to-the-map-and-saving-them-as")}</div>
                )}
            </div>
          ) : activeTab === 'Load Files' ? (
            <div className="text-center p-8 text-[1.2rem] text-[#666]">
              <div
                className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 md:gap-x-2 gap-y-10 w-full"
              >
		            {loadFilesLayers.map((item, index) => 
                 <UserLayerCard
					          key={item.layer_id + '-' + index} // Use a combination of id and index
					          id={item.layer_id}
					          name={item.title}
					          description={item.description}
					          legend={""}
					          typeOfCard="layer"
					          points_color={item.points_color}
					          progress={null}
					          onMoreInfo={function () {
					          	(async function() {
					          		setLoading(true);
									      try {
									        const res = await apiRequest({
									          url: urls.layers_upload_file_single,
									          method: 'post',
									          body: { layer_id: item.layer_id, user_id: authResponse?.localId },
									        });
									        const data = Object.assign({}, res.data.data);
									        data.features = data.features.filter((item) =>
										        item.geometry.coordinates.every(number => 
										        	number <= 90 &&
										        	number >= -90))
											    setGeoPoints(function (prevGeoPoints) {
											      const updatedGeoPoints = prevGeoPoints.slice().concat(data);
											      return updatedGeoPoints;
											    });
									        setResMessage(res.data.message);
									        setResId(res.data.request_id);
									        closeModal();
									        console.log('res', res);
									      } catch (error) {
									        setWsResError(error instanceof Error ? error : new Error(String(error)));
									      } finally {
									        console.log('finally.....................');
									      }
					          		setLoading(false);
								      })()
					          }}
					        />)}
		            <UserLayerCard
				          id={0}
				          name={t("add-your-own-data")}
				          description={t("import-your-own-data-file-types")}
				          legend={""}
				          typeOfCard="layer"
				          points_color={"orange"}
				          onMoreInfo={function () {
 					          setLoadFiles(true);
				          }}
			            />
	            </div>
	            <div className="absolute top-0 left-0 h-full">
	            	<Modal
					        open={loadFiles}
					        onOpenChange={setLoadFiles}
					        title={t("layers")}
					        contentClassName="max-w-4xl h-full"
		            	>
		            	<form className="flex flex-col gap-2" onSubmit={e => {
		            		e.preventDefault()
		            		if(!e.target.reportValidity()) return;
		            		addLayerUploadFile(new FormData(e.target));
		            	}}>
		            		<input type="hidden" name="user_id" value={authResponse?.localId} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
											required="required"
			            		label={t("title")} name="title" value={formData["title"]} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
			            		label={t("file")} name="file" type="file"
											required="required"
			            		accept=".xlsx,.csv,.json" />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
			            		label={t("delete-after-days")} type="number" name="delete_after_days"
											required="required"
			            		value={formData["delete_after_days"]} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
		            			label={t("color")}
		            			type="color"
											required="required"
		            			name="points_color"
		            			value={formData["points_color"]} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
		            			label={t("deduplicate")}
		            			type="checkbox"
		            			name="deduplicate"
		            			value={formData["deduplicate"]} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
		            			label={t("deduplicate-by-how-many-meters")}
		            			type="number"
		            			disabled={() => formData["deduplicate"] === false}
											required={formData["deduplicate"]}
		            			name="deduplicate_meters"
		            			value={formData["deduplicate_meters"]} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
		            			label={t("name-of-the-'name'-column")}
		            			type="string"
											required="required"
		            			name="name_column"
		            			value={formData["name_column"]} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
		            			label={t("name-of-the-latitude-column")}
		            			type="string"
											required="required"
		            			name="lat_column"
		            			value={formData["lat_column"]} />
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
		            			label={t("name-of-the-longitude-column")}
		            			type="string"
											required="required"
		            			name="lon_column"
		            			value={formData["lon_column"]} />
		            		{/*
		            		<LayerUploadFileInput setFormData={layerUploadFileSetInput}
		            			label="Description"
		            			type="textarea"
		            			name="description"
		            			value={formData["description"]} />
		            		*/}
		            		<button className="border px-4 py-2 hover:border-black">{t("Submit")}</button>
		            	</form>
	            	</Modal>
	            </div>
            </div>
          ) : (
            <div className="text-center p-8 text-[1.2rem] text-[#666]">{t("connect-your-data-content")}</div>
          )}
        </>
      )}
    </div>
  );
}

export default DataContainer;
