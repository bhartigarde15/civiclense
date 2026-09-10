-- ==============================================================================
-- CivicLens Dashboard Analytics & Reporting SQL Queries
-- Target Dataset: `civiclens`
-- ==============================================================================

-- 1. High-Level KPI Summary (Total complaints, High priority count, Critical count, Average priority, Top Issue)
SELECT
  COUNT(1) AS total_complaints,
  COUNTIF(priority_score >= 70) AS high_priority_count,
  COUNTIF(severity = 'Critical') AS critical_count,
  ROUND(AVG(priority_score), 1) AS avg_priority_score,
  APPROX_TOP_COUNT(category, 1)[OFFSET(0)].value AS top_category
FROM `civiclens.complaints`;

-- 2. Complaints by Category & Percentage
WITH TotalCount AS (
  SELECT COUNT(1) AS total FROM `civiclens.complaints`
)
SELECT
  c.category,
  COUNT(1) AS count,
  ROUND(COUNT(1) * 100.0 / MAX(t.total), 1) AS percentage
FROM `civiclens.complaints` c
CROSS JOIN TotalCount t
GROUP BY c.category
ORDER BY count DESC;

-- 3. Severity Distribution
SELECT
  severity,
  COUNT(1) AS count,
  ROUND(AVG(priority_score), 1) AS avg_priority
FROM `civiclens.complaints`
GROUP BY severity
ORDER BY 
  CASE severity
    WHEN 'Critical' THEN 1
    WHEN 'High' THEN 2
    WHEN 'Medium' THEN 3
    WHEN 'Low' THEN 4
    ELSE 5
  END;

-- 4. Department Workload
SELECT
  department,
  COUNT(1) AS total_assigned,
  COUNTIF(status = 'OPEN') AS open_issues,
  COUNTIF(severity = 'Critical' OR priority_score >= 70) AS urgent_issues,
  ROUND(AVG(priority_score), 1) AS avg_priority
FROM `civiclens.complaints`
GROUP BY department
ORDER BY total_assigned DESC;

-- 5. Complaint Trends (Daily)
SELECT
  DATE(created_at) AS date,
  COUNT(1) AS total_complaints,
  COUNTIF(severity = 'Critical') AS critical_count,
  ROUND(AVG(priority_score), 1) AS avg_priority
FROM `civiclens.complaints`
GROUP BY date
ORDER BY date ASC;

-- 6. Civic Hotspots (Geographic Aggregation / Repeated Incident Clusters)
SELECT
  location_name,
  category,
  ROUND(AVG(latitude), 4) AS latitude,
  ROUND(AVG(longitude), 4) AS longitude,
  COUNT(1) AS complaint_count,
  ROUND(AVG(priority_score), 1) AS avg_priority,
  MAX(created_at) AS latest_complaint_at
FROM `civiclens.complaints`
GROUP BY location_name, category
HAVING complaint_count >= 2
ORDER BY complaint_count DESC, avg_priority DESC
LIMIT 15;

-- 7. High Priority Complaints Table (for operational action)
SELECT
  complaint_id,
  category,
  severity,
  department,
  location_name,
  priority_score,
  duplicate_count,
  ai_summary,
  status,
  created_at
FROM `civiclens.complaints`
WHERE priority_score >= 70 OR severity = 'Critical'
ORDER BY priority_score DESC, created_at DESC
LIMIT 50;

-- 8. Recurring Issues by Location Name
SELECT
  location_name,
  category,
  COUNT(1) AS occurrence_count,
  ARRAY_AGG(STRUCT(complaint_id, severity, priority_score, created_at) ORDER BY created_at DESC LIMIT 5) AS recent_complaints
FROM `civiclens.complaints`
GROUP BY location_name, category
HAVING occurrence_count > 1
ORDER BY occurrence_count DESC;

-- 9. Duplicate / Nearby Complaints Search Template (Parameterized for BigQuery Service)
-- Parameters: @category STRING, @lat FLOAT64, @lng FLOAT64, @radiusKm FLOAT64, @daysLimit INT64
-- Uses the Spherical Law of Cosines / Haversine or ST_DISTANCE for GIS
SELECT
  complaint_id,
  category,
  location_name,
  latitude,
  longitude,
  created_at,
  ST_DISTANCE(ST_GEOGPOINT(longitude, latitude), ST_GEOGPOINT(@lng, @lat)) / 1000.0 AS distance_km
FROM `civiclens.complaints`
WHERE category = @category
  AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @daysLimit DAY)
  AND ST_DISTANCE(ST_GEOGPOINT(longitude, latitude), ST_GEOGPOINT(@lng, @lat)) <= (@radiusKm * 1000.0)
ORDER BY distance_km ASC;
