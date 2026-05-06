import pMap from 'p-map';
import * as turf from '@turf/turf';
import _ from 'lodash';
import { PropertyStats } from '../types/allTypesAndInterfaces';
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';

type GridFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;
type PointFeature = Feature<Geometry, Record<string, unknown>>;
type GridFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>> & {
  basedon?: string;
};

const buildSpatialIndex = (featureCollection: GridFeatureCollection) => {
  const tree = turf.geojsonRbush();
  tree.load(featureCollection);
  return tree;
};

self.onmessage = async (event: MessageEvent<{ grid: FeatureCollection; featureCollection: GridFeatureCollection }>) => {
  const { grid, featureCollection } = event.data;
  const concurrency = navigator.hardwareConcurrency || 4;
  const spatialIndex = buildSpatialIndex(featureCollection);

  const processedFeatures = await pMap(
    grid.features as GridFeature[],
    async (cell: GridFeature, index: number) => {
      const pointsWithin = spatialIndex.search(cell) as FeatureCollection<Geometry, Record<string, unknown>>;

      const density =
        featureCollection.basedon && featureCollection.basedon.length > 0
          ? pointsWithin.features.reduce((sum: number, point: PointFeature) => {
              const value = point.properties?.[featureCollection.basedon!];
              return sum + (typeof value === 'number' ? value : 0);
            }, 0)
          : pointsWithin.features.length;

      const center = turf.center(cell);
      const centerCoords = center.geometry.coordinates;
      if (
        !Array.isArray(centerCoords) ||
        centerCoords.length !== 2 ||
        typeof centerCoords[0] !== 'number' ||
        typeof centerCoords[1] !== 'number'
      ) {
        console.error('Invalid center coordinates for cell:', index);
        return cell;
      }
      const center_obj = {
        lng: Number(centerCoords[0]),
        lat: Number(centerCoords[1]),
      };

      const cellProperties: Record<string, PropertyStats> = pointsWithin.features.reduce(
        (acc, point: PointFeature) => {
          Object.entries(point.properties ?? {}).forEach(([key, value]) => {
            if (value == null) return;
            const numValue = Number(value);
            if (isNaN(numValue)) return;
            if (!acc[key]) {
              acc[key] = { sum: 0, values: [], count: 0 };
            }
            acc[key].sum += numValue;
            acc[key].values.push(numValue);
            acc[key].count++;
          });
          return acc;
        },
        {} as Record<string, PropertyStats>
      );

      Object.entries(cellProperties).forEach(([, stats]) => {
        stats.average = stats.sum / stats.count;
        if (stats.values.length > 0) {
          const sorted = [...stats.values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          stats.median =
            sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        }
      });

      const cellStats = Object.entries(cellProperties).reduce(
        (acc, [key, stats]) => {
          acc[key] =
            key === 'backend_opacity'
              ? _.round(stats.average ?? 0, 2)
              : _.round(stats.sum || 0, 2);
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        ...cell,
        id: index,
        properties: {
          ...(cell.properties ?? {}),
          ...cellStats,
          density,
          center: center_obj,
          pointCount: pointsWithin.features.length,
        },
      };
    },
    { concurrency }
  );

  postMessage({ features: processedFeatures });
};
