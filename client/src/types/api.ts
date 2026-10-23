/** Mirrors the server's DesignSummary. */
export type DesignSummary = {
  id: string;
  name: string;
  updatedAt: string;
  plot: { width: number; length: number; roadSide: string };
  floors: number;
  rooms: number;
  shared: boolean;
  outline: [number, number, number, number, 0 | 1][];
};
/** Mirrors shared DemoFacts, as served by /api/demos. */
export type DemoCard = {
  id: string;
  title: string;
  tagline: string;
  facts: {
    plot: { width: number; length: number; roadSide: string };
    builtUpArea: number;
    floors: number;
    bedrooms: number;
    bathrooms: number;
    powderRooms: number;
    parking: string;
    estimate: number;
    outline: [number, number, number, number, 0 | 1][];
  };
};
