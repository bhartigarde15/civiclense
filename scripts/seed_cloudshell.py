#!/usr/bin/env python3
"""
CivicLens — BigQuery Seed Script (Python, runs in Cloud Shell)

Usage in Cloud Shell:
    python3 scripts/seed_cloudshell.py

Requires (pre-installed in Cloud Shell):
    google-cloud-bigquery
"""

import os, math, json, subprocess, pathlib
from datetime import datetime, timedelta, timezone

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT_ID")
if not PROJECT_ID:
    try:
        r = subprocess.run(["gcloud","config","get-value","project"], capture_output=True, text=True, check=True)
        PROJECT_ID = r.stdout.strip()
    except Exception:
        pass

if not PROJECT_ID:
    print("\n❌  ERROR: No GCP Project ID found.")
    print("   Run:  gcloud config set project YOUR_PROJECT_ID\n")
    raise SystemExit(1)

DATASET_ID = os.environ.get("BIGQUERY_DATASET", "civiclens")
TABLE_ID   = os.environ.get("BIGQUERY_TABLE",   "complaints")
LOCATION   = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

DEPARTMENTS = {
    "Waste Management": "Municipal Sanitation", "Road Damage": "Roads Department",
    "Streetlights": "Electrical Department", "Water Leakage": "Water Department",
    "Drainage": "Drainage Department", "Public Safety": "Public Safety Department",
    "Traffic": "Traffic Department", "Other": "General Municipal Services",
}

LOCATIONS = [
    {"name":"Sector 15 Main Market","lat":28.5355,"lng":77.3910,"s":15},
    {"name":"Government Hospital Area","lat":28.5420,"lng":77.3980,"s":25},
    {"name":"Central Bus Stand","lat":28.5290,"lng":77.3850,"s":20},
    {"name":"Greenwood School Zone","lat":28.5480,"lng":77.4020,"s":25},
    {"name":"Residential Block A","lat":28.5310,"lng":77.3940,"s":10},
    {"name":"Industrial Area Phase 2","lat":28.5550,"lng":77.4100,"s":5},
    {"name":"Railway Station Road","lat":28.5250,"lng":77.3800,"s":20},
    {"name":"Civil Lines Crossing","lat":28.5390,"lng":77.3890,"s":15},
    {"name":"Gandhi Park South Gate","lat":28.5330,"lng":77.3960,"s":10},
    {"name":"University Campus Road","lat":28.5450,"lng":77.4050,"s":20},
]

TEMPLATES = {
    "Waste Management": {
        "desc":["Garbage overflowing near apartment for three days with severe foul smell.","Open dumping along market sidewalk blocking pedestrians.","Community dustbins not cleared this week, overflowing onto street.","Commercial waste dumped behind vegetable market.","Hazardous waste discarded near municipal park."],
        "sev":["Medium","High","Critical","Medium","High"],
        "sum":["Overflowing residential garbage creating sanitation concerns.","Sidewalk blocked by illegal waste dumping.","Bins uncleared posing hygiene risk.","Vegetable market waste requiring immediate clearing.","Improperly discarded waste near park."],
        "rsn":["Prolonged accumulation creates public health hazards.","Obstruction of pedestrian pathways.","Delayed municipal collection causing pollution.","High footfall area impacted by rotting waste.","Environmental safety risk near park."],
    },
    "Road Damage": {
        "desc":["Deep pothole causing two-wheelers to skid.","Massive crater outside primary school entrance.","Uneven road surface near bus terminal.","Loose gravel at busy commercial intersection.","Road cave-in near storm drain junction."],
        "sev":["High","Critical","Medium","High","Critical"],
        "sum":["Deep pothole threatening two-wheeler safety.","Severe crater in front of school.","Asphalt subsidence near bus terminal.","Loose gravel at active crossing.","Road cave-in presenting collision danger."],
        "rsn":["Direct risk of injury for daily commuters.","High vulnerability zone with school children.","Risk to public transport vehicles.","Slipping hazard at high-volume traffic node.","Structural collapse requiring emergency repair."],
    },
    "Streetlights": {
        "desc":["Three consecutive streetlights non-functional.","Street pole flickering and buzzing near park.","Exposed wiring at streetlight pole base.","Entire lane dark for past 4 nights.","Streetlight tilted toward carriageway."],
        "sev":["High","Low","Critical","Medium","High"],
        "sum":["Non-functional streetlights causing dark corridor.","Faulty flickering streetlight.","Exposed live wiring at public pole.","Multi-pole blackout in residential sector.","Compromised pole posing falling hazard."],
        "rsn":["Impaired visibility increases accident risk.","Minor defect causing public nuisance.","Critical electrocution hazard.","Safety concern for pedestrians after sundown.","Hazard of pole collapsing onto traffic."],
    },
    "Water Leakage": {
        "desc":["Main pipeline burst flooding road with potable water.","Underground pipe leakage seeping through road foundation.","Broken municipal valve spraying water across walkway.","Low water pressure due to mainline fracture.","Contaminated water backflow near damaged pipe joint."],
        "sev":["Critical","Medium","High","Medium","Critical"],
        "sum":["Pipeline rupture causing roadway flooding.","Underground seepage destabilizing pavement.","Municipal valve leak wasting potable water.","Mainline fracture reducing residential supply.","Cross-contamination risk from cracked conduit."],
        "rsn":["Massive loss of drinking water.","Subsurface erosion risking road collapse.","Significant resource wastage.","Essential utility disruption affecting households.","Immediate threat to community health."],
    },
    "Drainage": {
        "desc":["Storm drain clogged, overflowing onto sidewalk.","Open manhole without cover near pedestrian crossing.","Sewage backing up into residential compounds.","Stagnant blackwater breeding mosquitoes.","Collapsed drainage culvert causing waterlogging."],
        "sev":["High","Critical","Critical","Medium","High"],
        "sum":["Clogged drain causing waterlogging.","Uncovered manhole on active sidewalk.","Sewage backflow into residential properties.","Stagnant wastewater breeding disease vectors.","Collapsed culvert obstructing runoff."],
        "rsn":["Inundation impairs traffic flow.","Severe hazard for pedestrians in low light.","Biohazard demanding emergency intervention.","Vector-borne disease risk.","Blockage of key drainage artery."],
    },
    "Public Safety": {
        "desc":["Tree branch hanging over high-voltage power lines.","Construction debris and metal rods on sidewalk.","Stray cattle at hospital approach road.","Damaged bridge guardrail over railway tracks.","Chemical spill from commercial transport truck."],
        "sev":["Critical","High","Medium","Critical","High"],
        "sum":["Tree branch resting on live power lines.","Hazardous debris on pedestrian pathway.","Animal hazard obstructing hospital access.","Broken safety guardrail on railway overpass.","Hazardous chemical spill on roadway."],
        "rsn":["Imminent fire and power grid risk.","Injury risk to daily walkers.","Impedes emergency vehicle transit.","Catastrophic fall risk on elevated walkway.","Chemical exposure and skidding hazard."],
    },
    "Traffic": {
        "desc":["Traffic signal malfunctioning - both red and green showing.","Illegal parking choking emergency lane.","Missing signage at five-way roundabout.","Disabled cargo vehicle blocking two main lanes.","Pedestrian crossing faded at transit junction."],
        "sev":["Critical","High","Medium","High","Low"],
        "sum":["Malfunctioning traffic light at junction.","Illegal parking obstructing emergency corridor.","Missing roundabout signage causing collisions.","Stalled vehicle blocking thoroughfare.","Faded crosswalk reducing crossing safety."],
        "rsn":["High probability of vehicular collisions.","Delays emergency response vehicles.","Confuses drivers causing lane switching.","Bottleneck generating commuter gridlock.","Reduced pedestrian visibility."],
    },
    "Other": {
        "desc":["Unauthorized banners blocking visibility at intersection.","Stray dogs near school gate.","Footpath encroachment by street vendors.","Noise pollution from illegal night construction.","Unauthorized parking on footpaths."],
        "sev":["Low","Medium","Medium","Low","Medium"],
        "sum":["Illegal hoardings obstructing visibility.","Stray dog menace near school.","Footpath encroachment disrupting pedestrians.","Nighttime construction noise violation.","Footpath parking forcing pedestrians onto road."],
        "rsn":["Visibility obstruction poses junction safety risk.","Safety concern for children near school.","Inaccessibility for elderly and differently-abled.","Noise ordinance violation.","Pedestrian safety risk from forced road walking."],
    },
}

def calc_priority(sev, affected, sensitivity, duplicates):
    base = {"Low":10,"Medium":25,"High":40,"Critical":50}.get(sev, 20)
    people = 5
    if affected>500: people=20
    elif affected>200: people=16
    elif affected>50: people=12
    elif affected>10: people=8
    rec = 0
    if duplicates>=10: rec=15
    elif duplicates>=5: rec=10
    elif duplicates>=2: rec=6
    elif duplicates>=1: rec=3
    return min(100, max(10, round(base + people + rec + min(15, sensitivity*0.6))))

def generate_records(total=120):
    rows = []
    cat_keys = list(TEMPLATES.keys())
    now = datetime.now(timezone.utc)
    for i in range(1, total+1):
        loc = LOCATIONS[i % len(LOCATIONS)]
        cat = cat_keys[i % len(cat_keys)]
        t = TEMPLATES[cat]
        vi = (i*3) % len(t["desc"])
        affected = int(10 + abs(math.sin(i*13))*600)
        dups = int(8+(i%15)) if i%7==0 else int(2+(i%5)) if i%3==0 else 0
        created = (now - timedelta(days=(i%28), hours=(i*7)%24)).isoformat()
        rows.append({
            "complaint_id": f"CL-{i:04d}",
            "description": t["desc"][vi],
            "image_url": f"https://storage.googleapis.com/civiclens-demo/complaint_{i}.jpg" if i%4==0 else None,
            "category": cat,
            "severity": t["sev"][vi],
            "department": DEPARTMENTS.get(cat, "General Municipal Services"),
            "location_name": loc["name"],
            "latitude": round(loc["lat"] + math.sin(i*99)*0.0018, 5),
            "longitude": round(loc["lng"] + math.cos(i*99)*0.0018, 5),
            "affected_people": affected,
            "priority_score": float(calc_priority(t["sev"][vi], affected, loc["s"], dups)),
            "duplicate_count": dups,
            "ai_summary": t["sum"][vi],
            "ai_reason": t["rsn"][vi],
            "status": "RESOLVED" if i%8==0 else "IN_PROGRESS" if i%5==0 else "OPEN",
            "created_at": created,
        })
    return rows

SCHEMA_DEF = [
    {"name":"complaint_id","type":"STRING"},{"name":"description","type":"STRING"},
    {"name":"image_url","type":"STRING"},{"name":"category","type":"STRING"},
    {"name":"severity","type":"STRING"},{"name":"department","type":"STRING"},
    {"name":"location_name","type":"STRING"},{"name":"latitude","type":"FLOAT64"},
    {"name":"longitude","type":"FLOAT64"},{"name":"affected_people","type":"INTEGER"},
    {"name":"priority_score","type":"FLOAT64"},{"name":"duplicate_count","type":"INTEGER"},
    {"name":"ai_summary","type":"STRING"},{"name":"ai_reason","type":"STRING"},
    {"name":"status","type":"STRING"},{"name":"created_at","type":"TIMESTAMP"},
]

def main():
    print(f"\n🚀  CivicLens BigQuery Seed (Python)")
    print(f"   Project : {PROJECT_ID}")
    print(f"   Dataset : {DATASET_ID}.{TABLE_ID}")
    print(f"   Location: {LOCATION}\n")

    from google.cloud import bigquery
    client = bigquery.Client(project=PROJECT_ID)

    # Create dataset
    ds_ref = bigquery.Dataset(f"{PROJECT_ID}.{DATASET_ID}")
    ds_ref.location = LOCATION
    try:
        client.get_dataset(ds_ref)
        print(f"✅  Dataset '{DATASET_ID}' exists.")
    except Exception:
        print(f"📦  Creating dataset '{DATASET_ID}'...")
        client.create_dataset(ds_ref, exists_ok=True)
        print(f"✅  Dataset created.")

    # Create table
    schema = [bigquery.SchemaField(f["name"], f["type"]) for f in SCHEMA_DEF]
    tbl_ref = bigquery.Table(f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}", schema=schema)
    try:
        client.get_table(tbl_ref)
        print(f"✅  Table '{TABLE_ID}' exists.")
    except Exception:
        print(f"📋  Creating table '{TABLE_ID}'...")
        client.create_table(tbl_ref, exists_ok=True)
        print(f"✅  Table created.")

    # Clear old demo rows
    cnt = list(client.query(f"SELECT COUNT(*) AS c FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`").result())[0]["c"]
    if cnt > 0:
        print(f"\nℹ️   {cnt} rows exist — removing old CL-XXXX demo rows...")
        client.query(f"DELETE FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}` WHERE complaint_id LIKE 'CL-%'").result()
        print("✅  Old rows cleared.")

    # Insert
    records = generate_records(120)
    print(f"\n📝  Inserting {len(records)} records...")
    errors = client.insert_rows_json(f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}", records)
    if errors:
        print(f"⚠️   Errors: {errors}")
    else:
        print(f"✅  All {len(records)} records inserted!\n")

    # Summary
    rows = list(client.query(f"""
        SELECT category, COUNT(*) AS cnt, ROUND(AVG(priority_score),1) AS avg_p
        FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
        GROUP BY category ORDER BY cnt DESC
    """).result())
    print(f"📊  Category breakdown:")
    print(f"  {'Category':<25} {'Count':>5}  {'Avg Priority':>12}")
    print(f"  {'-'*46}")
    for r in rows:
        print(f"  {r['category']:<25} {int(r['cnt']):>5}  {float(r['avg_p']):>12.1f}")

    # Save local
    out = pathlib.Path(__file__).parent.parent / "data" / "seed_complaints.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(records, indent=2))
    print(f"\n💾  Saved local copy: data/seed_complaints.json\n")

if __name__ == "__main__":
    main()
