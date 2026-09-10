-- CivicLens BigQuery Schema Definition
-- Dataset: civiclens
-- Table: complaints

CREATE SCHEMA IF NOT EXISTS `civiclens`
OPTIONS (
  location = 'us-central1'
);

CREATE TABLE IF NOT EXISTS `civiclens.complaints` (
  complaint_id STRING NOT NULL,
  description STRING,
  image_url STRING,
  category STRING,
  severity STRING,
  department STRING,
  location_name STRING,
  latitude FLOAT64,
  longitude FLOAT64,
  affected_people INT64,
  priority_score FLOAT64,
  duplicate_count INT64,
  ai_summary STRING,
  ai_reason STRING,
  status STRING,
  created_at TIMESTAMP
);

-- Indexing / Clustering recommendations:
-- Cluster by (category, status, created_at) for efficient analytical querying
