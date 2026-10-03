export type JourneyPriority = 'balanced' | 'cost' | 'duration' | 'walking' | 'transfers';
export interface JourneyNeeds {
  notes?: string[];
  priority: JourneyPriority;
  maxCost: number | null;
  maxWalkingMinutes: number | null;
  maxDurationMinutes: number | null;
  maxTransfers: number | null;
}
export interface JourneyIntent extends JourneyNeeds {
  origin: string | null;
  destination: string | null;
  notes: string[];
}
export const defaultNeeds: JourneyNeeds = {
  priority: 'balanced', maxCost: null, maxWalkingMinutes: null,
  maxDurationMinutes: null, maxTransfers: null,
};
