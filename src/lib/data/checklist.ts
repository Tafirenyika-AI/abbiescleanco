export type ChecklistTier = "standard" | "deep" | "moveInOut";

export interface ChecklistTask {
  task: string;
  /** The lightest tier this task is included in. Deep includes Standard; Move-In/Out includes Deep. */
  includedFrom: ChecklistTier;
}

export interface ChecklistRoom {
  room: string;
  tasks: ChecklistTask[];
}

export const tierOrder: ChecklistTier[] = ["standard", "deep", "moveInOut"];

export const tierLabels: Record<ChecklistTier, string> = {
  standard: "Standard Cleaning",
  deep: "Deep Cleaning",
  moveInOut: "Move-In / Move-Out",
};

export const checklist: ChecklistRoom[] = [
  {
    room: "Kitchen",
    tasks: [
      { task: "Counters and backsplash wiped", includedFrom: "standard" },
      { task: "Appliance exteriors cleaned", includedFrom: "standard" },
      { task: "Sink scrubbed and polished", includedFrom: "standard" },
      { task: "Floors vacuumed and mopped", includedFrom: "standard" },
      { task: "Inside microwave", includedFrom: "deep" },
      { task: "Cabinet fronts degreased", includedFrom: "deep" },
      { task: "Inside oven", includedFrom: "moveInOut" },
      { task: "Inside refrigerator", includedFrom: "moveInOut" },
      { task: "Inside all cabinets and drawers", includedFrom: "moveInOut" },
    ],
  },
  {
    room: "Bathrooms",
    tasks: [
      { task: "Toilet, tub, and shower cleaned", includedFrom: "standard" },
      { task: "Mirrors and counters cleaned", includedFrom: "standard" },
      { task: "Floors washed and disinfected", includedFrom: "standard" },
      { task: "Tile and grout scrubbed", includedFrom: "deep" },
      { task: "Fixtures detailed and polished", includedFrom: "deep" },
      { task: "Inside cabinets and drawers", includedFrom: "moveInOut" },
      { task: "Baseboards and vents", includedFrom: "moveInOut" },
    ],
  },
  {
    room: "Bedrooms",
    tasks: [
      { task: "Dusting all reachable surfaces", includedFrom: "standard" },
      { task: "Vacuuming and floor care", includedFrom: "standard" },
      { task: "Bed made / linens tidied", includedFrom: "standard" },
      { task: "Baseboards and trim", includedFrom: "deep" },
      { task: "Under-bed and behind-furniture areas", includedFrom: "deep" },
      { task: "Inside closets", includedFrom: "moveInOut" },
    ],
  },
  {
    room: "Living Spaces",
    tasks: [
      { task: "Dusting furniture and surfaces", includedFrom: "standard" },
      { task: "Vacuuming and floor care", includedFrom: "standard" },
      { task: "High-touch surfaces sanitized", includedFrom: "standard" },
      { task: "Baseboards and trim", includedFrom: "deep" },
      { task: "Light fixtures dusted", includedFrom: "deep" },
      { task: "Interior windows", includedFrom: "moveInOut" },
    ],
  },
  {
    room: "Hallways",
    tasks: [
      { task: "Floors vacuumed and mopped", includedFrom: "standard" },
      { task: "Light switches and door handles wiped", includedFrom: "standard" },
      { task: "Baseboards and trim", includedFrom: "deep" },
      { task: "Light fixtures dusted", includedFrom: "deep" },
    ],
  },
  {
    room: "Home Office",
    tasks: [
      { task: "Dusting reachable surfaces", includedFrom: "standard" },
      { task: "Vacuuming and floor care", includedFrom: "standard" },
      { task: "Electronics wiped down (screens excluded)", includedFrom: "deep" },
      { task: "Baseboards and trim", includedFrom: "deep" },
    ],
  },
  {
    room: "Laundry Areas",
    tasks: [
      { task: "Surfaces wiped and floor cleaned", includedFrom: "standard" },
      { task: "Machine exteriors wiped", includedFrom: "deep" },
      { task: "Laundry wash & fold", includedFrom: "moveInOut" },
      { task: "Organization of shelves/storage", includedFrom: "moveInOut" },
    ],
  },
];

export function tierIncludes(taskTier: ChecklistTier, columnTier: ChecklistTier): boolean {
  return tierOrder.indexOf(columnTier) >= tierOrder.indexOf(taskTier);
}
