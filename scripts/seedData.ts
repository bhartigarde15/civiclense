import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';
import * as path from 'path';

export interface ComplaintSeed {
  complaint_id: string;
  description: string;
  image_url: string | null;
  category: string;
  severity: string;
  department: string;
  location_name: string;
  latitude: number;
  longitude: number;
  affected_people: number;
  priority_score: number;
  duplicate_count: number;
  ai_summary: string;
  ai_reason: string;
  status: string;
  created_at: string;
}

// Allowed civic categories
const CATEGORIES = [
  'Waste Management',
  'Road Damage',
  'Streetlights',
  'Water Leakage',
  'Drainage',
  'Public Safety',
  'Traffic',
  'Other',
];

// Allowed municipal departments
const DEPARTMENTS: Record<string, string> = {
  'Waste Management': 'Municipal Sanitation',
  'Road Damage': 'Roads Department',
  'Streetlights': 'Electrical Department',
  'Water Leakage': 'Water Department',
  'Drainage': 'Drainage Department',
  'Public Safety': 'Public Safety Department',
  'Traffic': 'Traffic Department',
  'Other': 'General Municipal Services',
};

// Base civic locations (realistic civic zones)
const LOCATIONS = [
  { name: 'Sector 15 Main Market', lat: 28.5355, lng: 77.3910, sensitivity: 15 },
  { name: 'Government Hospital Area', lat: 28.5420, lng: 77.3980, sensitivity: 25 },
  { name: 'Central Bus Stand', lat: 28.5290, lng: 77.3850, sensitivity: 20 },
  { name: 'Greenwood School Zone', lat: 28.5480, lng: 77.4020, sensitivity: 25 },
  { name: 'Residential Block A', lat: 28.5310, lng: 77.3940, sensitivity: 10 },
  { name: 'Industrial Area Phase 2', lat: 28.5550, lng: 77.4100, sensitivity: 5 },
  { name: 'Railway Station Road', lat: 28.5250, lng: 77.3800, sensitivity: 20 },
  { name: 'Civil Lines Crossing', lat: 28.5390, lng: 77.3890, sensitivity: 15 },
  { name: 'Gandhi Park South Gate', lat: 28.5330, lng: 77.3960, sensitivity: 10 },
  { name: 'University Campus Road', lat: 28.5450, lng: 77.4050, sensitivity: 20 },
];

const COMPLAINT_TEMPLATES: Record<
  string,
  { descriptions: string[]; severities: ('Low' | 'Medium' | 'High' | 'Critical')[]; summaries: string[]; reasons: string[] }
> = {
  'Waste Management': {
    descriptions: [
      'Garbage has been overflowing near our apartment for three days with a severe foul smell.',
      'Open dumping along the market sidewalk blocking pedestrians and attracting stray animals.',
      'Community dustbins have not been cleared this week, overflowing onto the main street.',
      'Commercial waste dumped behind the vegetable market creating unsanitary conditions.',
      'Hazardous medical and electronic waste discarded near the municipal park perimeter.',
    ],
    severities: ['Medium', 'High', 'Critical', 'Medium', 'High'],
    summaries: [
      'Overflowing residential garbage creating sanitation concerns.',
      'Sidewalk blocked by illegal commercial waste dumping.',
      'Community bins uncleared for a week posing hygiene risk.',
      'Vegetable market waste accumulation requiring immediate clearing.',
      'Improperly discarded mixed waste near public recreation area.',
    ],
    reasons: [
      'Prolonged accumulation creates public health hazards and pest breeding.',
      'Obstruction of pedestrian pathways and degradation of neighborhood cleanliness.',
      'Delayed municipal collection leading to odor and street pollution.',
      'High footfall area impacted by rotting organic waste.',
      'Environmental safety risk in proximity to residential and park areas.',
    ],
  },
  'Road Damage': {
    descriptions: [
      'Deep pothole on the right lane causing two-wheelers to skid and lose balance.',
      'Massive crater formed after recent rains right outside the primary school entrance.',
      'Uneven road surface and collapsed asphalt near the bus terminal exit.',
      'Loose gravel and broken tarmac spreading across the busy commercial intersection.',
      'Road cave-in near storm drain junction creating an immediate crash hazard.',
    ],
    severities: ['High', 'Critical', 'Medium', 'High', 'Critical'],
    summaries: [
      'Deep dangerous pothole threatening two-wheeler safety.',
      'Severe road crater directly in front of school entrance.',
      'Asphalt subsidence near heavy transit bus terminal.',
      'Loose gravel and surface degradation at active crossing.',
      'Road surface cave-in presenting severe vehicle collision danger.',
    ],
    reasons: [
      'Direct risk of physical injury and vehicle damage for daily commuters.',
      'High vulnerability zone with children and school buses traversing daily.',
      'Transit congestion and risk to heavy public transport vehicles.',
      'Slipping hazard during braking at a high-volume traffic node.',
      'Structural collapse requiring immediate barricading and emergency repair.',
    ],
  },
  'Streetlights': {
    descriptions: [
      'Three consecutive streetlights are completely non-functional creating a dark blindspot.',
      'Street pole light flickering continuously and buzzing loudly near the park lane.',
      'Exposed wiring at the base of streetlight pole accessible to children.',
      'Entire residential lane plunged into total darkness for the past 4 nights.',
      'Streetlight tilted at an angle after storm winds, leaning toward the main carriageway.',
    ],
    severities: ['High', 'Low', 'Critical', 'Medium', 'High'],
    summaries: [
      'Consecutive non-functional streetlights causing dark transit corridor.',
      'Faulty flickering streetlight fixture with electrical buzz.',
      'Exposed live electrical wiring at public street pole base.',
      'Multi-pole blackout in residential sector impacting night safety.',
      'Structurally compromised streetlight pole posing falling hazard.',
    ],
    reasons: [
      'Impaired night visibility increases criminal vulnerability and accident risk.',
      'Minor electrical defect causing public nuisance and visual distraction.',
      'Critical electrocution hazard requiring urgent electrical shutdown and repair.',
      'General safety and mobility concern for pedestrians after sundown.',
      'Physical hazard of pole collapsing onto vehicular traffic.',
    ],
  },
  'Water Leakage': {
    descriptions: [
      'Main drinking water pipeline burst flooding the road with clean potable water.',
      'Continuous underground pipe leakage seeping through road foundation.',
      'Broken municipal valve spraying water continuously across the walkway.',
      'Low water pressure in residential sector due to visible mainline fracture.',
      'Contaminated water backflow mixing near damaged supply pipe joint.',
    ],
    severities: ['Critical', 'Medium', 'High', 'Medium', 'Critical'],
    summaries: [
      'Major drinking water pipeline rupture causing roadway flooding.',
      'Underground water line seepage destabilizing pavement.',
      'High-pressure municipal valve leak wasting potable water.',
      'Mainline fracture reducing residential supply volume.',
      'Cross-contamination risk from cracked water supply conduit.',
    ],
    reasons: [
      'Massive loss of treated drinking water and severe street submergence.',
      'Subsurface erosion that could trigger sudden road collapse.',
      'Significant resource wastage and pedestrian path disruption.',
      'Essential utility disruption affecting hundreds of households.',
      'Immediate threat to community health from potential potable water contamination.',
    ],
  },
  'Drainage': {
    descriptions: [
      'Storm drain completely clogged with plastic and silt, overflowing onto sidewalk.',
      'Open manhole without cover near pedestrian crossing with no warning signs.',
      'Sewage water backing up into ground floor residential compounds.',
      'Stagnant blackwater pool in roadside ditch emitting foul odor and breeding mosquitoes.',
      'Collapsed drainage culvert causing waterlogging across both lanes.',
    ],
    severities: ['High', 'Critical', 'Critical', 'Medium', 'High'],
    summaries: [
      'Clogged stormwater drain causing street waterlogging.',
      'Uncovered open manhole on active pedestrian sidewalk.',
      'Severe sewage backflow into residential properties.',
      'Stagnant roadside wastewater breeding disease vectors.',
      'Collapsed culvert obstructing neighborhood runoff.',
    ],
    reasons: [
      'Inundation impairs local traffic flow and damages surrounding infrastructure.',
      'Severe life-safety hazard for pedestrians and two-wheelers in low light.',
      'Acute biohazard and property damage demanding emergency intervention.',
      'Vector-borne disease risk including dengue and malaria.',
      'Blockage of key drainage artery during regular monsoon discharges.',
    ],
  },
  'Public Safety': {
    descriptions: [
      'Fallen tree branch hanging over high-voltage power lines after gusty winds.',
      'Abandoned construction debris and sharp metal rods left unguarded on sidewalk.',
      'Stray cattle and aggressive dogs congregating at the hospital approach road.',
      'Damaged pedestrian bridge guardrail over the railway tracks.',
      'Broken glass and hazardous chemicals spilled from commercial transport truck.',
    ],
    severities: ['Critical', 'High', 'Medium', 'Critical', 'High'],
    summaries: [
      'Tree branch dangerously resting on live power lines.',
      'Hazardous unguarded construction debris on pedestrian pathway.',
      'Animal hazard obstructing critical hospital emergency access.',
      'Broken safety guardrail on elevated railway overpass.',
      'Hazardous commercial chemical spill on arterial roadway.',
    ],
    reasons: [
      'Imminent fire and power grid disruption risk.',
      'Presents puncture and injury risks to daily walkers and children.',
      'Impedes emergency vehicle transit and poses collision risk.',
      'Catastrophic fall risk for commuters using elevated pedestrian walkway.',
      'Chemical exposure and vehicle skidding hazard.',
    ],
  },
  'Traffic': {
    descriptions: [
      'Traffic signal malfunctioning showing both green and red simultaneously.',
      'Illegal commercial parking choking access to emergency lane.',
      'Missing directional signage at complex five-way roundabout causing near-misses.',
      'Disabled cargo vehicle blocking two main lanes of the transit corridor.',
      'Pedestrian zebra crossing faded completely near busy transit junction.',
    ],
    severities: ['Critical', 'High', 'Medium', 'High', 'Low'],
    summaries: [
      'Malfunctioning traffic light creating severe junction confusion.',
      'Illegal parking obstructing critical emergency transit corridor.',
      'Absence of roundabout signage causing near collisions.',
      'Stalled heavy vehicle blocking primary thoroughfare.',
      'Faded pedestrian crosswalk markings reducing crossing safety.',
    ],
    reasons: [
      'High probability of right-angle vehicular collisions at junction.',
      'Delays emergency response ambulances and municipal vehicles.',
      'Confuses unfamiliar drivers leading to dangerous lane switching.',
      'Bottleneck generating kilometers of peak-hour commuter gridlock.',
      'Reduced pedestrian visibility and driver compliance.',
    ],
  },
};

// Deterministic Priority Scoring helper
function calculateDeterministicPriority(
  severity: string,
  affectedPeople: number,
  locationSensitivity: number,
  duplicateCount: number,
): number {
  // 1. Severity points (0-50)
  const severityPoints: Record<string, number> = {
    Low: 10,
    Medium: 25,
    High: 40,
    Critical: 50,
  };
  const baseSeverity = severityPoints[severity] || 20;

  // 2. Affected people score (0-20)
  let peopleScore = 5;
  if (affectedPeople > 500) peopleScore = 20;
  else if (affectedPeople > 200) peopleScore = 16;
  else if (affectedPeople > 50) peopleScore = 12;
  else if (affectedPeople > 10) peopleScore = 8;

  // 3. Recurrence / Duplicate score (0-15)
  let recurrenceScore = 0;
  if (duplicateCount >= 10) recurrenceScore = 15;
  else if (duplicateCount >= 5) recurrenceScore = 10;
  else if (duplicateCount >= 2) recurrenceScore = 6;
  else if (duplicateCount >= 1) recurrenceScore = 3;

  // 4. Location sensitivity (0-15)
  const locScore = Math.min(15, locationSensitivity * 0.6);

  const total = baseSeverity + peopleScore + recurrenceScore + locScore;
  return Math.min(100, Math.max(10, Math.round(total)));
}

export function generateSeedData(totalCount = 120): ComplaintSeed[] {
  const complaints: ComplaintSeed[] = [];
  const now = Date.now();

  // Create hotspot hubs with intentional repeats
  for (let i = 1; i <= totalCount; i++) {
    // Pick location (with deliberate weighting for hotspots)
    const locIndex = i % LOCATIONS.length;
    const loc = LOCATIONS[locIndex];

    // Pick category
    const catKeys = Object.keys(COMPLAINT_TEMPLATES);
    const category = catKeys[i % catKeys.length];
    const template = COMPLAINT_TEMPLATES[category];

    const variantIndex = (i * 3) % template.descriptions.length;
    const description = template.descriptions[variantIndex];
    const severity = template.severities[variantIndex];
    const summary = template.summaries[variantIndex];
    const reason = template.reasons[variantIndex];
    const department = DEPARTMENTS[category] || 'General Municipal Services';

    // Jitter coordinates slightly within 200m to simulate real-world duplicate cluster
    const latJitter = (Math.sin(i * 99) * 0.0018);
    const lngJitter = (Math.cos(i * 99) * 0.0018);
    const latitude = Math.round((loc.lat + latJitter) * 100000) / 100000;
    const longitude = Math.round((loc.lng + lngJitter) * 100000) / 100000;

    // Affected people
    const affectedPeople = Math.floor(10 + Math.abs(Math.sin(i * 13)) * 600);

    // Intentionally cluster duplicates for certain locations
    const duplicateCount = (i % 7 === 0) ? Math.floor(8 + (i % 15)) : (i % 3 === 0) ? Math.floor(2 + (i % 5)) : 0;

    const priorityScore = calculateDeterministicPriority(
      severity,
      affectedPeople,
      loc.sensitivity,
      duplicateCount,
    );

    // Spread created_at across last 28 days
    const dayOffset = (i % 28);
    const hourOffset = (i * 7) % 24;
    const createdAtDate = new Date(now - (dayOffset * 86400000 + hourOffset * 3600000));

    const complaintId = `CL-${String(i).padStart(4, '0')}`;
    const status = (i % 8 === 0) ? 'RESOLVED' : (i % 5 === 0) ? 'IN_PROGRESS' : 'OPEN';

    complaints.push({
      complaint_id: complaintId,
      description,
      image_url: i % 4 === 0 ? `https://storage.googleapis.com/civiclens-demo/complaint_${i}.jpg` : null,
      category,
      severity,
      department,
      location_name: loc.name,
      latitude,
      longitude,
      affected_people: affectedPeople,
      priority_score: priorityScore,
      duplicate_count: duplicateCount,
      ai_summary: summary,
      ai_reason: reason,
      status,
      created_at: createdAtDate.toISOString(),
    });
  }

  return complaints;
}

async function runSeed() {
  console.log('🚀 Generating CivicLens synthetic complaint seed data...');
  const seedData = generateSeedData(120);

  // Save to JSON for mock/seed usage
  const outDir = path.join(__dirname, '../data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonPath = path.join(outDir, 'seed_complaints.json');
  fs.writeFileSync(jsonPath, JSON.stringify(seedData, null, 2));
  console.log(`✅ Written ${seedData.length} records to ${jsonPath}`);

  // Summary statistics
  const categoriesCount = seedData.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Category Distribution:');
  console.table(categoriesCount);

  // Attempt BigQuery insertion if configured
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET || 'civiclens';
  const tableId = process.env.BIGQUERY_TABLE || 'complaints';

  if (projectId) {
    console.log(`\n🌐 Attempting insertion into Google Cloud BigQuery (${projectId}.${datasetId}.${tableId})...`);
    try {
      const bq = new BigQuery({ projectId });
      await bq.dataset(datasetId).table(tableId).insert(seedData);
      console.log('✅ Successfully loaded seed data into BigQuery!');
    } catch (err: any) {
      console.log(`ℹ️ BigQuery insert skipped or table not yet provisioned (${err.message}). Local JSON dataset ready.`);
    }
  } else {
    console.log('\nℹ️ GCP project not configured in .env. Seed data is saved locally to data/seed_complaints.json.');
  }
}

if (require.main === module) {
  runSeed();
}
