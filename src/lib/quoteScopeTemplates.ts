/**
 * Reusable starting points for the "Scope of Service" field -- generic, reusable content keyed by
 * property TYPE (dental office, general office, etc.), never anything specific to one named
 * customer. Picking one fills the textarea; it stays fully editable before sending, same as if the
 * admin had typed it by hand. Minimal by design: plain constants, no separate CRUD/admin-editable
 * subsystem, consistent with how small this app's own email-template defaults started out.
 */

export interface ScopeTemplate {
  key: string;
  label: string;
  text: string;
}

export const SCOPE_TEMPLATES: ScopeTemplate[] = [
  {
    key: "commercial-general",
    label: "Commercial Cleaning",
    text: `Routine commercial cleaning of the agreed facility areas.

• Dust and wipe accessible surfaces
• Empty ordinary waste bins and replace liners as required
• Vacuum carpeted areas
• Sweep and mop hard floors
• Clean entryways and common areas
• Clean and disinfect restrooms
• Clean mirrors, sinks, counters, and fixtures`,
  },
  {
    key: "dental-office",
    label: "Dental Office",
    text: `Routine commercial cleaning of the agreed facility areas, including 13 rooms, 2 restrooms, reception/waiting areas, hallways, and common areas.

• Dust and wipe accessible surfaces
• Clean agreed high-touch non-clinical surfaces
• Vacuum carpeted areas
• Sweep and mop hard floors
• Clean reception and waiting areas
• Clean and disinfect restrooms
• Clean mirrors, sinks, counters, and fixtures
• Empty ordinary waste bins and replace liners as required`,
  },
  {
    key: "general-office",
    label: "General Office",
    text: `Routine commercial cleaning of the agreed office areas.

• Dust and wipe desks, counters, and accessible surfaces
• Empty waste and recycling bins, replace liners as required
• Vacuum carpeted areas
• Sweep and mop hard floors
• Clean and disinfect restrooms and break room
• Clean conference rooms and common areas
• Clean interior glass and mirrors`,
  },
  {
    key: "residential",
    label: "Residential",
    text: `Routine residential cleaning of the agreed living areas.

• Dust and wipe accessible surfaces
• Vacuum carpets and rugs
• Sweep and mop hard floors
• Clean and disinfect kitchen counters and fixtures
• Clean and disinfect bathrooms
• Empty trash bins
• Make beds (linens not changed unless provided)`,
  },
  {
    key: "move-in-out",
    label: "Move-In / Move-Out",
    text: `Deep clean of the full property to prepare for move-in or move-out.

• Clean inside and outside of all cabinets and drawers
• Clean inside of oven, refrigerator, and other appliances
• Clean all windows, sills, and tracks (interior)
• Wipe down all baseboards, doors, and door frames
• Clean and disinfect all bathrooms, including grout and fixtures
• Vacuum and mop all floors
• Remove dust and cobwebs from ceilings, vents, and light fixtures`,
  },
  {
    key: "deep-cleaning",
    label: "Deep Cleaning",
    text: `One-time deep clean, more thorough than a routine maintenance visit.

• Detailed dusting of all surfaces, including baseboards and vents
• Clean inside of microwave and exterior of other appliances
• Clean light switches, door handles, and other high-touch points
• Scrub and disinfect bathrooms, including grout
• Vacuum and mop all floors, including under reachable furniture
• Clean interior windows and mirrors`,
  },
];
