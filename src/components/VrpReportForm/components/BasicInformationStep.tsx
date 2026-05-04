import {
  FaGlobe,
  FaMapMarkerAlt,
  FaBuilding,
  FaExclamationTriangle,
  FaMotorcycle,
} from 'react-icons/fa';
import { CITY_OPTIONS } from '../constants';
import { t } from '../../../i18n';

interface BasicInformationStepProps {
  formData: {
    country_name: string;
    city_name: string;
    Type: string;
  };
  errors: {
    city_name?: string;
    Type?: string;
  };
  onInputChange: (field: string, value: string) => void;
  disabled?: boolean;
}

const MotorcycleInputNumber = ({
  formData,
  errors,
  onInputChange,
  disabled = false,
  objKey,
  text,
}) => {
	const key = objKey;
	return (
    <div className="space-y-3 flex-1">
      <label htmlFor="Type" className="block text-sm font-semibold text-gray-700">
        <span className="flex items-center gap-2">
          <FaMotorcycle className="w-4 h-4 mr-2 text-primary" />
          {text}
          &nbsp;
          <div className="text-red-500">*</div>
        </span>
      </label>

      <div className="space-y-3">
        <div className="relative">
          <input
            type="number"
            id="num_groups"
            placeholder={text}
            value={formData[key]}
            pattern="[0-9]*"
            required
            onInput={e => {
              if(e.target.checkValidity() || e.target.value === "") {
              
	              onInputChange(key, e.target.value === "" ? "" : Number(e.target.value))
	            } else
	              e.target.value = formData[key]
            }}
            className={`w-full pl-2 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${
              disabled
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
                : errors.Type
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 bg-white'
            }`}
          />
        </div>
      </div>
    </div>
  )
}

const BasicInformationStep = (obj: BasicInformationStepProps) => {
	const {
	  formData,
	  errors,
	  onInputChange,
	  disabled = false,
	} = obj

  return (
    <div className="space-y-3 animate-fade-in-up">
      <div className="text-center mb-3">
        <h3 className="text-lg font-bold text-gray-900 mb-1">{t("basic-information")}</h3>
        <p className="text-sm text-gray-600">{t("let-s-start-with-the-basic-details-for-your-expansion-report")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country (readonly) */}
        <div className="space-y-3">
          <label htmlFor="country_name" className="block text-sm font-semibold text-gray-700">
            <span className="flex items-center gap-2">
              <FaGlobe className="w-4 h-4 mr-2 text-primary" />
              {t("country")}
            </span>
          </label>
          <input
            type="text"
            id="country_name"
            value={formData.country_name}
            readOnly
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>

        {/* City Selection */}
        <div className="space-y-3">
          <label htmlFor="city_name" className="block text-sm font-semibold text-gray-700">
            <span className="flex items-center gap-2">
              <FaMapMarkerAlt className="w-4 h-4 mr-2 text-primary" />
              {t("city")}
              <span className="text-red-500 ml-1">*</span>
            </span>
          </label>
          <select
            id="city_name"
            value={formData.city_name}
            onChange={e => onInputChange('city_name', e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-3 border-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${
              disabled
                ? 'bg-gray-100 cursor-not-allowed opacity-60'
                : errors.city_name
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 hover:border-primary/50 bg-white'
            }`}
          >
            {CITY_OPTIONS.map(city => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          {errors.city_name && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <FaExclamationTriangle className="w-4 h-4 mr-1" />
              {errors.city_name}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-2">	      
	      <MotorcycleInputNumber {...Object.assign({
		      text: t("how-many-groups"),
		      objKey: "num_groups",
		    },obj)} />
	      <MotorcycleInputNumber {...Object.assign({
		      text: t("how-big-are-the-groups"),
		      objKey: "group_size",
		    },obj)} />
      </div>
      
      {/* Type Selection */}
      <div className="flex flex-col lg:flex-row gap-2">

	      <div className="flex-1">
		      <div className="space-y-3 flex-1">
		        <label htmlFor="Type" className="block text-sm font-semibold text-gray-700">
		          <span className="flex items-center gap-2">
		            <FaBuilding className="w-4 h-4 mr-2 text-primary" />
		            {t("manager-phone-number")}
		            &nbsp;
			          <div className="text-red-500">*</div>
		          </span>
		        </label>
		      	<input type="text" 
		      		required
		      		value={formData["manager_phone"]}
              className={`w-full pl-2 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${
              disabled
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
                : errors.Type
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 bg-white'
            }`} placeholder={t("966-5x-xxx-xxxx")} onChange={e => onInputChange("manager_phone", e.target.value)} />
	      	</div>
	      </div>
	      <div className="flex-1">
		      <div className="space-y-3 flex-1">
		        <label htmlFor="Type" className="block text-sm font-semibold text-gray-700">
		          <span className="flex items-center gap-2">
		            <FaMotorcycle className="w-4 h-4 mr-2 text-primary" />
		            {t("driver-phone-number")}
		            &nbsp;
			          <div className="text-red-500">*</div>
		          </span>
		        </label>
		      	<input type="text" 
		      		required
		      		value={formData["groups_info"][0]["phone"]}
              className={`w-full pl-2 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${
              disabled
                ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
                : errors.Type
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 bg-white'
            }`} placeholder={t("966-5x-xxx-xxxx")} onChange={e => onInputChange("groups_info", [Object.assign(formData["groups_info"][0], {
	            "phone": e.target.value
            })])} />
	      	</div>
	      </div>
      </div>
    </div>
  );
};

export default BasicInformationStep;
