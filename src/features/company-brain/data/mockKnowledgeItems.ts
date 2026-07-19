// ============================================================
// Company Brain — Mock Knowledge Items
// Sprint 20
//
// Representative knowledge items showing different types, lifecycle
// states, and operational connections across LOOP domains.
// ============================================================

import type { KnowledgeItem } from "../types/knowledgeItem";

export const mockKnowledgeItems: KnowledgeItem[] = [
  // ------------------------------------------------------------------
  // SOPs
  // ------------------------------------------------------------------
  {
    id: "ki-001",
    title: "Mitsubishi Mini-Split Startup Checklist",
    summary:
      "Complete pre-startup and commissioning procedure for all Mitsubishi mini-split systems. Use before first power-on after installation.",
    body: `## Mitsubishi Mini-Split Startup Checklist

### Before Power-On
1. Confirm all refrigerant lines are properly flared and torqued to spec
2. Verify the line set has been pressure tested at 500 PSI for 24 hours
3. Confirm vacuum has reached 500 microns and held for 30 minutes
4. Verify outdoor unit service valves are fully closed
5. Confirm drain line is pitched correctly and drains to a safe location

### Electrical Checks
1. Verify circuit breaker size matches unit requirements (see nameplate)
2. Confirm wire gauge matches breaker size and run length
3. Verify disconnect is within sight of outdoor unit
4. Check line voltage at outdoor unit — must be within ±10% of nameplate rating
5. Confirm all low-voltage connections are tight and correctly wired

### Startup Sequence
1. Open outdoor unit service valves fully
2. Energize indoor unit first
3. Wait 3 minutes before energizing outdoor unit
4. Allow system to run for 15 minutes before checking operating pressures
5. Record suction and discharge pressures, outdoor ambient, return air, and supply air temps

### Documentation
- Photograph all completed paperwork
- Record model and serial numbers in LOOP
- Submit commissioning sheet before leaving the job`,
    knowledgeType: "sop",
    status: "published",
    version: 3,
    tags: ["mitsubishi", "mini-split", "startup", "commissioning", "hvac"],
    owner: "Install Manager",
    relatedDomains: ["equipment", "installed_systems", "jobs"],
    createdAt: "2024-09-12T08:00:00Z",
    updatedAt: "2025-04-02T14:30:00Z",
  },
  {
    id: "ki-002",
    title: "Job Site Safety Checklist — Pre-Work",
    summary:
      "Required pre-work safety assessment for all job sites. Must be completed before any installation or service work begins.",
    body: `## Job Site Safety Checklist

### Personal Protective Equipment
- Hard hat required on all active construction sites
- Safety glasses required when drilling, cutting, or using power tools
- Gloves required when handling refrigerant or sharp sheet metal
- High-visibility vest required on commercial sites with vehicle traffic

### Electrical Safety
1. Confirm power is locked out and tagged before working on electrical
2. Verify lockout with a voltage tester — trust nothing you did not personally lock
3. Identify all circuits that feed the equipment area
4. Post DANGER — DO NOT ENERGIZE tags at the breaker panel

### Fall Protection
- Ladders must extend 3 feet above the working surface
- Extension ladders must be secured at top and bottom
- Roof work requires harness and anchor point for any pitch above 4:12

### Refrigerant Handling
- Never vent refrigerant to atmosphere
- Use an EPA-certified recovery machine
- Keep manifold gauges calibrated and in good condition
- Recover refrigerant before cutting any lines`,
    knowledgeType: "safety_procedure",
    status: "published",
    version: 2,
    tags: ["safety", "pre-work", "checklist", "all-jobs"],
    owner: "Service Manager",
    relatedDomains: ["jobs", "procedures"],
    createdAt: "2024-06-01T09:00:00Z",
    updatedAt: "2025-01-15T11:00:00Z",
  },

  // ------------------------------------------------------------------
  // Installation Guides
  // ------------------------------------------------------------------
  {
    id: "ki-003",
    title: "Curb Adapter Installation — Rooftop Unit",
    summary:
      "Step-by-step guide for installing curb adapters when replacing a rooftop unit where the existing curb does not match the new unit footprint.",
    body: `## Curb Adapter Installation — Rooftop Unit

### When This Applies
Use this procedure when replacing a rooftop unit where the existing curb dimensions do not match the replacement unit.

### Materials Required
- Curb adapter kit (verify fit before ordering — measure old unit and new unit footprint)
- Sealant (see manufacturer spec — typically Tremco Vulkem 116)
- Sheet metal screws #10 x 1"
- Butyl tape (minimum 3/8" x 1-1/2" roll)
- Isolation pads if required by manufacturer

### Procedure
1. Remove old unit — crane required if over 300 lbs
2. Inspect existing curb for rot, rust, or structural damage — replace curb if compromised
3. Clean curb surface — remove all old sealant and debris
4. Dry-fit the curb adapter — confirm clearance and alignment
5. Apply butyl tape to the perimeter of the existing curb
6. Set the curb adapter and align square to the roof opening
7. Secure curb adapter with sheet metal screws at 12" spacing
8. Apply Vulkem 116 sealant to all exterior seams — tool smooth
9. Set new unit onto curb adapter — confirm drain alignment
10. Reconnect electrical and refrigerant connections per startup checklist

### Common Mistakes
- Ordering the wrong curb adapter (measure twice, order once)
- Insufficient sealant at transitions — this is the most common leak point
- Forgetting isolation pads when required — creates warranty issues`,
    knowledgeType: "installation_guide",
    status: "published",
    version: 1,
    tags: ["rooftop", "curb-adapter", "commercial", "replacement"],
    owner: "Install Manager",
    relatedDomains: ["equipment", "inventory", "jobs"],
    createdAt: "2024-10-05T10:00:00Z",
    updatedAt: "2024-10-05T10:00:00Z",
  },
  {
    id: "ki-004",
    title: "HRV Commissioning — Fantech and Lifebreath Units",
    summary:
      "Complete commissioning checklist for HRV installations including airflow balancing, controls wiring, and documentation requirements.",
    body: `## HRV Commissioning — Fantech and Lifebreath

### Overview
HRV commissioning is required on every installation to ensure proper airflow balance and energy recovery performance.

### Tools Required
- Exhaust-only flow hood or manometer with pitot tube
- Digital multimeter
- Screwdriver set
- Phone/tablet for documentation

### Airflow Balancing
1. Install unit and connect all ductwork before commencing commissioning
2. Energize unit and allow 10 minutes to reach steady-state
3. Measure supply and exhaust airflows at the unit's test ports
4. Adjust dampers to achieve balance — supply and exhaust within 5% of each other
5. Measure airflow at each exhaust grille — record all readings
6. Record fresh air supply flowrate
7. Verify total exhaust equals total supply ± 5%

### Controls Wiring
- Verify dehumidistat wiring matches specification
- Test all modes: low, high, and boost
- Confirm boost mode triggers from kitchen and bathroom controls
- Check defrost operation if ambient is below -10°C / 14°F

### Documentation
- Complete airflow commissioning sheet
- Attach to the property record in LOOP
- Leave owner manual at the job site`,
    knowledgeType: "installation_guide",
    status: "published",
    version: 2,
    tags: ["hrv", "fantech", "lifebreath", "commissioning", "ventilation"],
    owner: "Install Manager",
    relatedDomains: ["equipment", "installed_systems", "jobs"],
    createdAt: "2024-11-20T09:00:00Z",
    updatedAt: "2025-03-10T15:00:00Z",
  },

  // ------------------------------------------------------------------
  // Troubleshooting
  // ------------------------------------------------------------------
  {
    id: "ki-005",
    title: "Troubleshooting: Mini-Split Not Cooling — E1 and E6 Fault Codes",
    summary:
      "Diagnostic steps for Mitsubishi and Daikin mini-split units showing E1 or E6 fault codes. Covers communication errors and refrigerant pressure faults.",
    body: `## Mini-Split Not Cooling — E1 / E6 Fault Codes

### E1 Code — Communication Fault
E1 typically indicates a communication failure between indoor and outdoor units.

**Check First:**
1. Confirm low-voltage communication wire is connected at both units
2. Verify wire gauge is correct (typically 18/2 stranded, under 50 ft run)
3. Inspect for physical damage to communication wire (pinched, cut)
4. Verify power is stable — communication faults can appear under voltage fluctuation

**Diagnostic Steps:**
1. Remove power from the outdoor unit
2. Disconnect communication wire at both units
3. Measure resistance of the wire — should read near zero, not OL
4. Reconnect and restore power — observe the fault code
5. If fault clears and returns, suspect a failing control board

### E6 Code — Outdoor Unit High Pressure Fault
E6 indicates the high-pressure switch has tripped.

**Check First:**
1. Is the outdoor unit coil clean? A dirty coil will cause high head pressure in warm weather
2. Is the outdoor unit fan running?
3. Is there adequate clearance around the outdoor unit?

**Diagnostic Steps:**
1. Connect manifold gauges — record head pressure
2. If pressure is above 400 PSI, suspect airflow problem first
3. Check outdoor fan motor amp draw
4. If outdoor fan is running and coil is clean, suspect refrigerant overcharge or non-condensable gas
5. Check liquid line temperature — should be 90–110°F in summer conditions

### When to Escalate
- E6 on a system less than 1 year old — potential factory charge issue
- Both codes appearing simultaneously — possible control board failure
- Fault reappears within 24 hours of clearing — investigate root cause before returning`,
    knowledgeType: "troubleshooting",
    status: "published",
    version: 4,
    tags: [
      "troubleshooting",
      "mini-split",
      "e1",
      "e6",
      "fault-code",
      "mitsubishi",
      "daikin",
    ],
    owner: "Service Manager",
    relatedDomains: ["equipment", "installed_systems"],
    createdAt: "2024-08-14T12:00:00Z",
    updatedAt: "2025-05-01T09:00:00Z",
  },
  {
    id: "ki-006",
    title: "Troubleshooting: No Heat on Gas Furnace — Igniter and Pressure Switch",
    summary:
      "Diagnostic sequence for gas furnaces with no heat, focusing on hot surface igniter failures and pressure switch issues — the two most common causes.",
    body: `## No Heat — Gas Furnace Diagnostics

### Safety First
- Confirm gas valve is in the ON position
- Verify the gas meter is not showing a lockout
- Never bypass a safety device as a permanent fix

### Diagnostic Sequence
1. Check thermostat — confirm call for heat, verify fan/heat settings
2. Check filter — a severely blocked filter can cause limit trips that look like ignition failures
3. Observe the ignition sequence with the furnace cover removed
4. Note where in the sequence the furnace fails

### Hot Surface Igniter Failure
**Symptoms:** Furnace starts sequence, igniter glows briefly or not at all, no ignition

**Checks:**
1. Measure igniter resistance cold — typical value is 40–90 ohms (silicon nitride) or 20–40 ohms (silicon carbide)
2. Measure igniter voltage at the harness — should see 120V during ignition trial
3. If voltage is present and igniter measures OL, the igniter is failed — replace
4. Allow igniter to warm up before measuring resistance — cold measurement may not reflect hot failure

### Pressure Switch Failure
**Symptoms:** Furnace starts inducer, inducer runs, but main sequence does not proceed

**Checks:**
1. Listen for inducer motor — should hear it ramping up
2. Check pressure switch hose for cracks, kinks, or blockages
3. Measure pressure switch with a manometer — confirm it is closing at the correct pressure
4. If pressure switch is open when it should be closed, check drain line for blockage before replacing switch`,
    knowledgeType: "troubleshooting",
    status: "published",
    version: 2,
    tags: ["troubleshooting", "gas-furnace", "igniter", "pressure-switch", "no-heat"],
    owner: "Service Manager",
    relatedDomains: ["equipment", "installed_systems"],
    createdAt: "2024-12-01T08:00:00Z",
    updatedAt: "2025-02-20T16:00:00Z",
  },

  // ------------------------------------------------------------------
  // Best Practices
  // ------------------------------------------------------------------
  {
    id: "ki-007",
    title: "Breaker Sizing Guide — Condensing Units",
    summary:
      "Reference guide for selecting the correct breaker and wire size for residential and light commercial condensing units. Covers common equipment from 1.5 to 5 ton.",
    body: `## Breaker Sizing Guide — Condensing Units

### The Rule
Always refer to the unit nameplate for MOCP (Maximum Over Current Protection) and MCA (Minimum Circuit Ampacity). The nameplate is the authority — this guide is a field reference only.

### Common Sizing Reference
| Unit Size | Typical MCA | Typical MOCP | Recommended Wire |
|-----------|------------|--------------|-----------------|
| 1.5 ton   | 14–16 A    | 20–25 A      | 12 AWG          |
| 2 ton     | 16–18 A    | 25–30 A      | 12 AWG          |
| 2.5 ton   | 18–22 A    | 30–35 A      | 10 AWG          |
| 3 ton     | 20–25 A    | 35–40 A      | 10 AWG          |
| 3.5 ton   | 24–28 A    | 40–45 A      | 8 AWG           |
| 4 ton     | 26–30 A    | 45–50 A      | 8 AWG           |
| 5 ton     | 30–36 A    | 50–60 A      | 6 AWG           |

### Notes
- Always use copper wire — aluminum is not permitted on residential installs
- Add 125% to MCA when calculating minimum wire size for runs over 50 ft
- MOCP is the maximum — a smaller breaker is acceptable if above MCA
- VFD-driven units have different requirements — always check the VFD nameplate, not the compressor nameplate`,
    knowledgeType: "best_practice",
    status: "published",
    version: 1,
    tags: ["electrical", "breaker", "condensing-unit", "wire-sizing", "reference"],
    owner: "Install Manager",
    relatedDomains: ["equipment", "inventory"],
    createdAt: "2025-01-10T10:00:00Z",
    updatedAt: "2025-01-10T10:00:00Z",
  },
  {
    id: "ki-008",
    title: "Refrigerant Handling — EPA 608 Field Requirements",
    summary:
      "Field requirements for compliant refrigerant handling under EPA Section 608. Covers recovery requirements, recordkeeping, and equipment certification.",
    body: `## Refrigerant Handling — EPA 608 Requirements

### Legal Requirements
All technicians who purchase or work with regulated refrigerants must hold an EPA 608 certification. As of January 1, 2018, this includes all refrigerants — not just CFCs and HCFCs.

### Recovery Requirements
- Recover refrigerant before opening any system or disposing of any appliance
- Recovery equipment must be certified to ARI 740 standards
- For systems with charges over 200 lbs, document the recovery in writing

### Recordkeeping
For commercial refrigeration systems with 50+ lbs of charge:
- Log all additions and removals
- Track annual leak rate
- If leak rate exceeds 20%, a repair plan must be in place within 30 days

### What We Do
1. Always use our certified recovery machine (located in warehouse, red cart)
2. Log refrigerant added to the recovery cylinder on the barrel tag
3. Never add refrigerant to an unknown system without checking for leaks first
4. If a customer declines leak repair, document it in the service ticket`,
    knowledgeType: "best_practice",
    status: "published",
    version: 1,
    tags: ["refrigerant", "epa-608", "compliance", "recovery", "legal"],
    owner: "Service Manager",
    relatedDomains: ["procedures"],
    createdAt: "2025-01-22T09:00:00Z",
    updatedAt: "2025-01-22T09:00:00Z",
  },

  // ------------------------------------------------------------------
  // Service Bulletin
  // ------------------------------------------------------------------
  {
    id: "ki-009",
    title: "Service Bulletin: Daikin RX Series — Defrost Board Recall",
    summary:
      "Internal notice for Daikin RX Series heat pumps manufactured 2022–2023. Defrost control board may fail at low ambient temperatures. Affects units below -15°C.",
    body: `## Daikin RX Series Defrost Board — Service Advisory

### Affected Units
- Daikin RX-09, RX-12, RX-18, RX-24 Series
- Manufactured: January 2022 – September 2023
- Serial number prefix: RX22xxxxx, RX23xxxxx (prior to September)

### Issue
The defrost control board may fail to initiate defrost cycles at ambient temperatures below -15°C (5°F). This causes frost accumulation on the outdoor coil, eventually leading to restricted airflow and loss of heating capacity.

### Symptoms
- Reduced heating capacity at low outdoor temperatures
- Visible frost on the outdoor coil that does not clear
- Unit running continuously without defrost cycle
- Increased electricity consumption

### Resolution
Daikin has issued a replacement defrost board (part number: 1241720). Replacement is covered under Daikin warranty for affected units.

### Action Required
1. Check your installed systems list for affected units
2. Contact Daikin technical support to confirm warranty coverage before ordering parts
3. Document the board replacement in LOOP on the installed system record
4. Notify affected customers proactively — do not wait for a service call`,
    knowledgeType: "service_bulletin",
    status: "published",
    version: 1,
    tags: ["daikin", "rx-series", "defrost", "recall", "service-bulletin", "heat-pump"],
    owner: "Service Manager",
    relatedDomains: ["equipment", "installed_systems", "manufacturers"],
    createdAt: "2025-03-15T14:00:00Z",
    updatedAt: "2025-03-15T14:00:00Z",
  },

  // ------------------------------------------------------------------
  // Policy
  // ------------------------------------------------------------------
  {
    id: "ki-010",
    title: "Permit Policy — When Permits Are Required",
    summary:
      "Company policy on permit requirements for HVAC work. Covers when permits are mandatory, who pulls them, and what to do if a customer declines.",
    body: `## Permit Policy — HVAC Work

### When Permits Are Required
A permit is required for:
- Any new equipment installation (furnace, AC, heat pump, HRV, ERV)
- Any equipment replacement that requires new electrical circuits
- Any ductwork modifications over 10 linear feet
- All commercial work regardless of scope

A permit is NOT typically required for:
- Service and repair work on existing equipment
- Filter replacements or maintenance
- Control board replacements (no structural or electrical change)
- Refrigerant additions alone

### Who Pulls the Permit
- We pull all permits — customers do not
- Office is responsible for permit applications for scheduled installs
- Permit fees are included in the project quote
- Installation cannot begin until permit is issued

### If a Customer Declines
If a customer asks us to proceed without a permit:
1. Explain why permits exist (safety inspection, insurance, resale disclosure)
2. Document the conversation in the job record
3. Do not proceed without a permit — we carry the liability, not the customer
4. Escalate to ownership if the customer continues to push back

### Inspection Coordination
- Book inspection as soon as rough-in is complete
- Do not close up walls before rough-in inspection
- Final inspection must be completed before handing the job to billing`,
    knowledgeType: "policy",
    status: "published",
    version: 2,
    tags: ["permits", "policy", "compliance", "installation", "legal"],
    owner: "Owner",
    relatedDomains: ["jobs", "procedures"],
    createdAt: "2024-07-01T09:00:00Z",
    updatedAt: "2025-02-01T10:00:00Z",
  },

  // ------------------------------------------------------------------
  // Training
  // ------------------------------------------------------------------
  {
    id: "ki-011",
    title: "New Installer Onboarding — First 30 Days",
    summary:
      "Structured learning path for new installation technicians covering company processes, safety standards, and equipment familiarity in the first 30 days.",
    body: `## New Installer Onboarding — First 30 Days

### Week 1: Company Process and Safety
- Day 1: Company tour, introductions, safety orientation
- Day 2: Review all safety SOPs in Company Brain
- Day 3: Shadow lead installer on a residential install
- Day 4: Review EPA 608 requirements and refrigerant handling procedures
- Day 5: Review LOOP — how we manage jobs, installed systems, and inventory

### Week 2: Equipment Familiarity
- Mitsubishi mini-split line — models, specs, and startup checklist
- Daikin mini-split line — differences from Mitsubishi
- Gas furnace fundamentals — ignition sequence, safety devices, common faults
- HRV/ERV basics — types, balancing, commissioning

### Week 3: Assisted Installation
- Supervised residential mini-split installation
- Supervised furnace replacement
- Practice with commissioning documentation in LOOP

### Week 4: Assessment
- Written safety quiz
- Walk through a startup checklist with senior technician
- Review any gaps identified in weeks 1–3

### Resources
All referenced procedures are available in Company Brain. Ask your lead installer for direct links.`,
    knowledgeType: "training",
    status: "published",
    version: 1,
    tags: ["onboarding", "training", "new-hire", "installer"],
    owner: "Owner",
    relatedDomains: ["procedures"],
    createdAt: "2025-01-05T09:00:00Z",
    updatedAt: "2025-01-05T09:00:00Z",
  },

  // ------------------------------------------------------------------
  // Draft / In Progress
  // ------------------------------------------------------------------
  {
    id: "ki-012",
    title: "Geothermal Loop Field — Pre-Drill Checklist",
    summary:
      "Pre-drill checklist and soil report requirements for geothermal loop field installations. Currently in draft — review before first geo job.",
    body: `## Geothermal Loop Field — Pre-Drill Checklist (DRAFT)

### Status
This knowledge item is under review. Do not rely on it as a final procedure.

### Planned Content
- Soil report requirements and who to order from
- Minimum loop field size calculations by system capacity
- Horizontal vs vertical loop selection criteria
- Local authority permit requirements
- Grout mix and installation requirements
- Pressure testing loop field before backfill`,
    knowledgeType: "sop",
    status: "draft",
    version: 1,
    tags: ["geothermal", "loop-field", "pre-drill", "draft"],
    owner: "Install Manager",
    relatedDomains: ["equipment", "jobs"],
    createdAt: "2025-06-01T11:00:00Z",
    updatedAt: "2025-06-01T11:00:00Z",
  },
  {
    id: "ki-013",
    title: "Carrier RTU Commissioning Checklist",
    summary:
      "Commissioning procedure for Carrier rooftop units. Reviewed and ready for field use — final signoff pending.",
    body: `## Carrier RTU Commissioning Checklist

### Overview
This procedure covers commissioning of Carrier 48/50 series rooftop units in commercial applications.

### Pre-Power Checks
1. Verify all refrigerant connections are complete and leak-checked
2. Confirm drain pan is clean and drain line is clear
3. Check economizer damper operation — opens and closes fully
4. Verify all electrical connections are torqued to spec

### Power-On Sequence
1. Energize unit — observe for any smoke, sparks, or unusual sounds
2. Confirm supply and return air temperatures
3. Verify compressor and condenser fan operation
4. Check operating pressures at the service ports
5. Document all readings on the commissioning sheet`,
    knowledgeType: "installation_guide",
    status: "reviewed",
    version: 1,
    tags: ["carrier", "rtu", "rooftop", "commissioning", "commercial"],
    owner: "Install Manager",
    relatedDomains: ["equipment", "installed_systems", "jobs"],
    createdAt: "2025-05-20T10:00:00Z",
    updatedAt: "2025-06-10T14:00:00Z",
  },
  {
    id: "ki-014",
    title: "Mini-Split Multi-Zone Wiring — Common Mistakes",
    summary:
      "Lessons learned from multi-zone mini-split installs. Documents the most common wiring mistakes and how to avoid them.",
    body: `## Multi-Zone Mini-Split — Common Wiring Mistakes

### Background
This article captures lessons learned from service calls traced back to installation errors on multi-zone systems.

### Mistake 1: Communication Wire Polarity
Multi-zone systems are polarity-sensitive on the communication bus. Swapping the S1 and S2 wires will cause communication faults on one or more zones.

**Lesson:** Label the communication wire at both ends before routing. Verify polarity at each indoor unit before powering on.

### Mistake 2: Grouping Multiple Zones on One Breaker
Each outdoor unit requires its own dedicated circuit. Running two outdoor units from one breaker will cause nuisance trips.

**Lesson:** Confirm circuit count with the estimator before starting rough-in.

### Mistake 3: Incorrect Zone Assignment in Remote Controllers
On some systems, the zone assignment is done via the remote controller during commissioning. If zones are assigned incorrectly, the wrong thermostat controls the wrong room.

**Lesson:** Confirm zone-to-controller mapping with the customer before commissioning.`,
    knowledgeType: "best_practice",
    status: "improved",
    version: 2,
    tags: ["multi-zone", "mini-split", "wiring", "lessons-learned", "commissioning"],
    owner: "Service Manager",
    relatedDomains: ["equipment", "installed_systems"],
    createdAt: "2024-10-18T09:00:00Z",
    updatedAt: "2025-04-12T16:00:00Z",
  },
];
