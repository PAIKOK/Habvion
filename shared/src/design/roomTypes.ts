import { ROOM_TYPES, type RoomType } from "../types/home";
export type RoomInfo = {
  label: string;
  width: number;
  length: number;
  minWidth: number;
  minArea: number;
  color: string;
};
const sizes: Partial<Record<RoomType, [number, number, number, number]>> = {
  "master-bedroom": [12, 12, 9, 120],
  bedroom: [10, 10, 7, 70],
  "guest-bedroom": [10, 10, 7, 70],
  "kids-bedroom": [10, 10, 7, 70],
  servant: [8, 9, 7, 63],
  living: [12, 14, 10, 120],
  family: [12, 12, 8, 90],
  dining: [10, 12, 7, 70],
  hall: [4, 12, 3, 24],
  foyer: [6, 8, 4, 30],
  bathroom: [6, 8, 5, 30],
  "attached-bathroom": [6, 8, 5, 30],
  powder: [5, 6, 4, 20],
  kitchen: [10, 10, 7, 50],
  pantry: [5, 6, 3, 15],
  laundry: [6, 8, 4, 24],
  utility: [6, 8, 4, 24],
  study: [8, 10, 6, 48],
  "home-office": [8, 10, 6, 48],
  "home-theatre": [14, 16, 10, 140],
  gym: [12, 12, 8, 80],
  hobby: [10, 10, 6, 50],
  pooja: [5, 6, 4, 20],
  dressing: [6, 8, 4, 24],
  "walk-in-wardrobe": [6, 8, 4, 24],
  store: [5, 6, 3, 15],
  balcony: [5, 10, 3, 15],
  terrace: [12, 12, 3, 25],
  courtyard: [8, 8, 4, 25],
  garden: [10, 10, 2, 8],
  parking: [10, 16, 8, 130],
  garage: [12, 18, 9, 160],
  porch: [6, 8, 3, 18],
  staircase: [10, 16, 3, 40],
  other: [8, 10, 3, 15],
};
export const ROOM_INFO = Object.fromEntries(
  ROOM_TYPES.map((type) => {
    const [width, length, minWidth, minArea] = sizes[type]!;
    return [
      type,
      {
        label: type
          .split("-")
          .map((s) => s[0]!.toUpperCase() + s.slice(1))
          .join(" "),
        width,
        length,
        minWidth,
        minArea,
        color: isOpenAir(type)
          ? "#dbe6cf"
          : ["bathroom", "attached-bathroom", "powder", "laundry"].includes(type)
            ? "#dce9ea"
            : type.includes("bedroom")
              ? "#eadfce"
              : type === "kitchen"
                ? "#efe0cd"
                : type === "staircase" || type === "hall"
                  ? "#e9e6e0"
                  : "#f2e6db",
      },
    ];
  }),
) as Record<RoomType, RoomInfo>;
export function isOpenAir(type: RoomType) {
  return ["balcony", "terrace", "courtyard", "garden", "parking", "porch"].includes(type);
}
export function roomName(type: RoomType, names: string[]) {
  const name = ROOM_INFO[type].label;
  if (!names.includes(name)) return name;
  let n = 2;
  while (names.includes(`${name} ${n}`)) n++;
  return `${name} ${n}`;
}
