#!/usr/bin/env node
/**
 * CivicLens — BigQuery Seed Script (Plain JavaScript, runs directly in Cloud Shell)
 *
 * Usage:
 *   node scripts/seed_bigquery.js
 *
 * Prerequisites (set in Cloud Shell or export in your terminal):
 *   export GOOGLE_CLOUD_PROJECT=your-project-id
 *   export BIGQUERY_DATASET=civiclens        (default: civiclens)
 *   export BIGQUERY_TABLE=complaints          (default: complaints)
 *   export GOOGLE_CLOUD_LOCATION=us-central1  (default: us-central1)
 *
 * The script will:
 *   1. Create the BigQuery dataset if it does not exist
 *   2. Create the complaints table if it does not exist
 *   3. Clear existing demo rows (to avoid duplicates on re-runs)
 *   4. Insert 120 synthetic complaint records
 */

'use strict';

const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
const DATASET_ID = process.env.BIGQUERY_DATASET || 'civiclens';
const TABLE_ID   = process.env.BIGQUERY_TABLE   || 'complaints';
const LOCATION   = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

if (!PROJECT_ID) {
  console.error('\n❌  ERROR: No GCP Project ID found in environment.\n');
  console.error('   Set it with:  export GOOGLE_CLOUD_PROJECT=your-project-id\n');
  process.exit(1);
}

// ── Data generation ──────────────────────────────────────────────────────────
const CATEGORIES = ['Waste Management','Road Damage','Streetlights','Water Leakage','Drainage','Public Safety','Traffic','Other'];

const DEPARTMENTS = {
  'Waste Management': 'Municipal Sanitation',
  'Road Damage': 'Roads Department',
  'Streetlights': 'Electrical Department',
  'Water Leakage': 'Water Department',
  'Drainage': 'Drainage Department',
  'Public Safety': 'Public Safety Department',
  'Traffic': 'Traffic Department',
  'Other': 'General Municipal Services',
};

const LOCATIONS = [
  { name: 'Sector 15 Main Market',      lat: 28.5355, lng: 77.3910, sensitivity: 15 },
  { name: 'Government Hospital Area',   lat: 28.5420, lng: 77.3980, sensitivity: 25 },
  { name: 'Central Bus Stand',          lat: 28.5290, lng: 77.3850, sensitivity: 20 },
  { name: 'Greenwood School Zone',      lat: 28.5480, lng: 77.4020, sensitivity: 25 },
  { name: 'Residential Block A',        lat: 28.5310, lng: 77.3940, sensitivity: 10 },
  { name: 'Industrial Area Phase 2',    lat: 28.5550, lng: 77.4100, sensitivity:  5 },
  { name: 'Railway Station Road',       lat: 28.5250, lng: 77.3800, sensitivity: 20 },
  { name: 'Civil Lines Crossing',       lat: 28.5390, lng: 77.3890, sensitivity: 15 },
  { name: 'Gandhi Park South Gate',     lat: 28.5330, lng: 77.3960, sensitivity: 10 },
  { name: 'University Campus Road',     lat: 28.5450, lng: 77.4050, sensitivity: 20 },
];

const TEMPLATES = {
  'Waste Management': {
    descriptions: [
      'Garbage has been overflowing near our apartment for three days with a severe foul smell.',
      'Open dumping along the market sidewalk blocking pedestrians and attracting stray animals.',
      'Community dustbins have not been cleared this week, overflowing onto the main street.',
      'Commercial waste dumped behind the vegetable market creating unsanitary conditions.',
      'Hazardous medical and electronic waste discarded near the municipal park perimeter.',
    ],
    severities: ['Medium','High','Critical','Medium','High'],
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
    severities: ['High','Critical','Medium','High','Critical'],
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
    severities: ['High','Low','Critical','Medium','High'],
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
    severities: ['Critical','Medium','High','Medium','Critical'],
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
    severities: ['High','Critical','Critical','Medium','High'],
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
    severities: ['Critical','High','Medium','Critical','High'],
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
    severities: ['Critical','High','Medium','High','Low'],
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
  'Other': {
    descriptions: [
      'Unauthorized banners and hoardings blocking visibility at the main intersection.',
      'Stray dogs near the school gate creating fear among students and parents.',
      'Encroachment on public footpath by street vendors blocking pedestrian access.',
      'Noise pollution from illegal construction activities during night hours.',
      'Unauthorized parking on footpaths forcing pedestrians onto the road.',
    ],
    severities: ['Low','Medium','Medium','Low','Medium'],
    summaries: [
      'Illegal hoardings obstructing traffic visibility.',
      'Stray dog menace near educational institution.',
      'Footpath encroachment disrupting pedestrian movement.',
      'Nighttime construction noise violating civic norms.',
      'Footpath parking forcing pedestrians onto traffic lanes.',
    ],
    reasons: [
      'Visibility obstruction poses safety risk for vehicles approaching the junction.',
      'Safety concern for children and staff in school vicinity.',
      'Inaccessibility issue for elderly and differently-abled persons.',
      'Noise ordinance violation causing community disturbance.',
      'Pedestrian safety risk due to forced road walking.',
    ],
  },
};

function calcPriority(severity, affectedPeople, locationSensitivity, duplicateCount) {
  const sp = { Low: 10, Medium: 25, High: 40, Critical: 50 };
  const base = sp[severity] || 20;
  let people = 5;
  if (affectedPeople > 500) people = 20;
  else if (affectedPeople > 200) people = 16;
  else if (affectedPeople > 50)  people = 12;
  else if (affectedPeople > 10)  people = 8;
  let rec = 0;
  if (duplicateCount >= 10) rec = 15;
  else if (duplicateCount >= 5) rec = 10;
  else if (duplicateCount >= 2) rec = 6;
  else if (duplicateCount >= 1) rec = 3;
  const locScore = Math.min(15, locationSensitivity * 0.6);
  return Math.min(100, Math.max(10, Math.round(base + people + rec + locScore)));
}

function generateRecords(total = 120) {
  const rows = [];
  const now = Date.now();
  const catKeys = Object.keys(TEMPLATES);

  for (let i = 1; i <= total; i++) {
    const loc = LOCATIONS[i % LOCATIONS.length];
    const category = catKeys[i % catKeys.length];
    const t = TEMPLATES[category];
    const vi = (i * 3) % t.descriptions.length;

    const affectedPeople = Math.floor(10 + Math.abs(Math.sin(i * 13)) * 600);
    const duplicateCount = (i % 7 === 0) ? Math.floor(8 + (i % 15)) : (i % 3 === 0) ? Math.floor(2 + (i % 5)) : 0;
    const dayOffset  = (i % 28);
    const hourOffset = (i * 7) % 24;
    const createdAt  = new Date(now - (dayOffset * 86400000 + hourOffset * 3600000)).toISOString();

    rows.push({
      complaint_id:    `CL-${String(i).padStart(4, '0')}`,
      description:     t.descriptions[vi],
      image_url:       i % 4 === 0 ? `https://storage.googleapis.com/civiclens-demo/complaint_${i}.jpg` : null,
      category,
      severity:        t.severities[vi],
      department:      DEPARTMENTS[category] || 'General Municipal Services',
      location_name:   loc.name,
      latitude:        Math.round((loc.lat + Math.sin(i * 99) * 0.0018) * 100000) / 100000,
      longitude:       Math.round((loc.lng + Math.cos(i * 99) * 0.0018) * 100000) / 100000,
      affected_people: affectedPeople,
      priority_score:  calcPriority(t.severities[vi], affectedPeople, loc.sensitivity, duplicateCount),
      duplicate_count: duplicateCount,
      ai_summary:      t.summaries[vi],
      ai_reason:       t.reasons[vi],
      status:          i % 8 === 0 ? 'RESOLVED' : i % 5 === 0 ? 'IN_PROGRESS' : 'OPEN',
      created_at:      createdAt,
    });
  }
  return rows;
}

// ── BigQuery schema ──────────────────────────────────────────────────────────
const SCHEMA = [
  { name: 'complaint_id',    type: 'STRING'    },
  { name: 'description',     type: 'STRING'    },
  { name: 'image_url',       type: 'STRING'    },
  { name: 'category',        type: 'STRING'    },
  { name: 'severity',        type: 'STRING'    },
  { name: 'department',      type: 'STRING'    },
  { name: 'location_name',   type: 'STRING'    },
  { name: 'latitude',        type: 'FLOAT64'   },
  { name: 'longitude',       type: 'FLOAT64'   },
  { name: 'affected_people', type: 'INTEGER'   },
  { name: 'priority_score',  type: 'FLOAT64'   },
  { name: 'duplicate_count', type: 'INTEGER'   },
  { name: 'ai_summary',      type: 'STRING'    },
  { name: 'ai_reason',       type: 'STRING'    },
  { name: 'status',          type: 'STRING'    },
  { name: 'created_at',      type: 'TIMESTAMP' },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀  CivicLens BigQuery Seed Script');
  console.log(`   Project  : ${PROJECT_ID}`);
  console.log(`   Dataset  : ${DATASET_ID}`);
  console.log(`   Table    : ${TABLE_ID}`);
  console.log(`   Location : ${LOCATION}\n`);

  const bq = new BigQuery({ projectId: PROJECT_ID });

  // 1. Ensure dataset exists
  const dataset = bq.dataset(DATASET_ID, { location: LOCATION });
  const [dsExists] = await dataset.exists();
  if (!dsExists) {
    console.log(`📦  Creating dataset "${DATASET_ID}"...`);
    await bq.createDataset(DATASET_ID, { location: LOCATION });
    console.log(`✅  Dataset created.\n`);
  } else {
    console.log(`✅  Dataset "${DATASET_ID}" already exists.\n`);
  }

  // 2. Ensure table exists
  const table = dataset.table(TABLE_ID);
  const [tblExists] = await table.exists();
  if (!tblExists) {
    console.log(`📋  Creating table "${TABLE_ID}"...`);
    await dataset.createTable(TABLE_ID, { schema: SCHEMA });
    console.log(`✅  Table created.\n`);
  } else {
    console.log(`✅  Table "${TABLE_ID}" already exists.\n`);
  }

  // 3. Check existing row count
  const [[{ cnt }]] = await bq.query({
    query: `SELECT COUNT(*) AS cnt FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``,
  });
  const existingCount = Number(cnt);

  if (existingCount > 0) {
    console.log(`ℹ️   Table already has ${existingCount} rows.`);
    console.log(`    Deleting existing demo rows (complaint_id starts with "CL-")...`);
    await bq.query({
      query: `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` WHERE complaint_id LIKE 'CL-%'`,
    });
    console.log(`✅  Old demo rows removed.\n`);
  }

  // 4. Generate & insert seed records
  const records = generateRecords(120);
  console.log(`📝  Inserting ${records.length} synthetic complaint records...`);

  // Insert in batches of 50 to avoid payload limits
  const BATCH = 50;
  for (let start = 0; start < records.length; start += BATCH) {
    const batch = records.slice(start, start + BATCH);
    await table.insert(batch);
    console.log(`   ✔  Inserted rows ${start + 1}–${start + batch.length}`);
  }

  console.log(`\n✅  Successfully seeded ${records.length} records into BigQuery!\n`);

  // 5. Print category distribution
  const [[rows]] = await bq.query({
    query: `
      SELECT category, COUNT(*) AS cnt, ROUND(AVG(priority_score),1) AS avg_priority
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      GROUP BY category
      ORDER BY cnt DESC
    `,
  });

  console.log('📊  Category Distribution in BigQuery:');
  console.table(rows.map(r => ({ Category: r.category, Count: Number(r.cnt), 'Avg Priority': Number(r.avg_priority) })));

  // 6. Also save locally
  const outPath = path.join(__dirname, '../data/seed_complaints.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
  console.log(`💾  Local copy saved to: data/seed_complaints.json\n`);
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  if (err.errors) {
    console.error('    Details:', JSON.stringify(err.errors, null, 2));
  }
  process.exit(1);
});
