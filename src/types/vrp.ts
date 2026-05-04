import PolygonFeature from "./allTypesAndInterfaces.ts";

export interface VrpReportData {
  user_id: string;
  city_name: string;
  country_name: string;
  Type: string;
  potential_business_type?: string;
  start: number[];
  polygon: PolygonFeature[];
  num_groups: number;
  group_size: number;
}
