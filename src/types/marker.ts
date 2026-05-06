export interface MeasurementData {
  id: string;
  name: string;
  description: string;
  sourcePoint: [number, number];
  destinationPoint: [number, number];
  route: unknown;
  distance: number;
  duration: number;
  timestamp: number;
}

export type MarkerType =
  | 'saved' // User-created permanent markers
  | 'measurement-draft' // Draft markers during measurement (start/end points)
  | 'measurement-saved' // Markers that are part of saved measurements
  | 'measurement-to-delete'; // Temporary markers during measurement (intermediate points)

export interface MarkerData {
  id: string;
  name: string;
  description: string;
  coordinates: [number, number];
  timestamp: number;
  markerType: MarkerType;
  measurementId?: string;
  colorHEX?: string;
  isTemporary?: boolean;
}
