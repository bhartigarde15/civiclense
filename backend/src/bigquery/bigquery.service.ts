import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';
import * as path from 'path';
import {
  ComplaintRecord,
  DashboardSummary,
  CategoryMetric,
  SeverityMetric,
  DepartmentMetric,
  TrendMetric,
  HotspotMetric,
} from './bigquery.interface';

@Injectable()
export class BigQueryService implements OnModuleInit {
  private readonly logger = new Logger(BigQueryService.name);
  private bigquery: BigQuery | null = null;
  private datasetId: string;
  private tableId: string;
  private isClientReady = false;

  // In-memory store for fallback/local development when BigQuery is not yet provisioned
  private fallbackStore: ComplaintRecord[] = [];

  constructor(private readonly configService: ConfigService) {
    this.datasetId = this.configService.get<string>('BIGQUERY_DATASET') || 'civiclens';
    this.tableId = this.configService.get<string>('BIGQUERY_TABLE') || 'complaints';
  }

  async onModuleInit() {
    const projectId =
      this.configService.get<string>('GOOGLE_CLOUD_PROJECT') ||
      this.configService.get<string>('GCP_PROJECT_ID');

    try {
      if (projectId) {
        this.bigquery = new BigQuery({ projectId });
        this.logger.log(`Initialized BigQuery client for project: ${projectId}, dataset: ${this.datasetId}, table: ${this.tableId}`);
        this.isClientReady = true;
      } else {
        this.logger.log('No GCP project configured in environment; running with local analytical store.');
        this.isClientReady = false;
      }
    } catch (error) {
      this.logger.warn(`BigQuery client initialization deferred or using fallback: ${error.message}`);
      this.isClientReady = false;
    }

    // Attempt to preload synthetic seed data if fallback store is empty
    this.loadInitialSeedIfAvailable();
  }

  private loadInitialSeedIfAvailable() {
    try {
      const candidates = [
        path.join(process.cwd(), '../data/seed_complaints.json'),
        path.join(process.cwd(), 'data/seed_complaints.json'),
        path.join(__dirname, '../../../data/seed_complaints.json'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8');
          const records = JSON.parse(raw);
          if (Array.isArray(records) && records.length > 0) {
            this.fallbackStore = records;
            this.logger.log(`Loaded ${records.length} demo complaint records into memory store.`);
            break;
          }
        }
      }
    } catch (e) {
      // Ignore seed preload errors
    }
  }

  private get fullTableName(): string {
    return `\`${this.datasetId}.${this.tableId}\``;
  }

  async insertComplaint(complaint: ComplaintRecord): Promise<void> {
    // Keep local fallback in sync
    this.fallbackStore.push({ ...complaint });

    if (!this.isClientReady || !this.bigquery) {
      this.logger.log(`[Local Fallback] Stored complaint ${complaint.complaint_id} in memory`);
      return;
    }

    try {
      const row = {
        complaint_id: complaint.complaint_id,
        description: complaint.description,
        image_url: complaint.image_url,
        category: complaint.category,
        severity: complaint.severity,
        department: complaint.department,
        location_name: complaint.location_name,
        latitude: complaint.latitude,
        longitude: complaint.longitude,
        affected_people: complaint.affected_people,
        priority_score: complaint.priority_score,
        duplicate_count: complaint.duplicate_count,
        ai_summary: complaint.ai_summary,
        ai_reason: complaint.ai_reason,
        status: complaint.status || 'OPEN',
        created_at:
          complaint.created_at instanceof Date
            ? complaint.created_at.toISOString()
            : complaint.created_at || new Date().toISOString(),
      };

      await this.bigquery.dataset(this.datasetId).table(this.tableId).insert([row]);
      this.logger.log(`Inserted complaint ${complaint.complaint_id} into BigQuery`);
    } catch (error) {
      this.logger.warn(
        `Failed to insert into BigQuery (using fallback store): ${error.message}`,
      );
    }
  }

  async getComplaintById(complaintId: string): Promise<ComplaintRecord | null> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `SELECT * FROM ${this.fullTableName} WHERE complaint_id = @complaintId LIMIT 1`;
        const [rows] = await this.bigquery.query({
          query,
          params: { complaintId },
        });

        if (rows && rows.length > 0) {
          return this.mapRowToComplaint(rows[0]);
        }
      } catch (error) {
        this.logger.warn(`BigQuery getComplaintById error, using fallback: ${error.message}`);
      }
    }

    const found = this.fallbackStore.find((c) => c.complaint_id === complaintId);
    return found ? { ...found } : null;
  }

  async updateComplaintStatus(
    complaintId: string,
    status: ComplaintRecord['status'],
  ): Promise<void> {
    // Keep the local analytical fallback consistent even when BigQuery is enabled.
    const fallbackComplaint = this.fallbackStore.find(
      (complaint) => complaint.complaint_id === complaintId,
    );
    if (fallbackComplaint) fallbackComplaint.status = status;

    if (!this.isClientReady || !this.bigquery) return;

    try {
      await this.bigquery.query({
        query: `UPDATE ${this.fullTableName} SET status = @status WHERE complaint_id = @complaintId`,
        params: { complaintId, status },
      });
      this.logger.log(`Updated complaint ${complaintId} status to ${status} in BigQuery`);
    } catch (error) {
      this.logger.warn(
        `Failed to update complaint ${complaintId} status in BigQuery; local fallback was updated: ${error.message}`,
      );
    }
  }

  async getComplaints(limit = 50, offset = 0): Promise<ComplaintRecord[]> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          SELECT * FROM ${this.fullTableName}
          ORDER BY created_at DESC
          LIMIT @limit OFFSET @offset
        `;
        const [rows] = await this.bigquery.query({
          query,
          params: { limit, offset },
        });
        return rows.map((r) => this.mapRowToComplaint(r));
      } catch (error) {
        this.logger.warn(`BigQuery getComplaints error, using fallback: ${error.message}`);
      }
    }

    return [...this.fallbackStore]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit);
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          SELECT
            COUNT(1) AS total_complaints,
            COUNTIF(priority_score >= 70) AS high_priority_count,
            COUNTIF(severity = 'Critical') AS critical_count,
            ROUND(IFNULL(AVG(priority_score), 0), 1) AS avg_priority_score,
            IFNULL(APPROX_TOP_COUNT(category, 1)[OFFSET(0)].value, 'N/A') AS top_category
          FROM ${this.fullTableName}
        `;
        const [rows] = await this.bigquery.query({ query });
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            totalComplaints: Number(r.total_complaints) || 0,
            highPriorityCount: Number(r.high_priority_count) || 0,
            criticalCount: Number(r.critical_count) || 0,
            avgPriorityScore: Number(r.avg_priority_score) || 0,
            topCategory: r.top_category || 'N/A',
          };
        }
      } catch (error) {
        this.logger.warn(`BigQuery getDashboardSummary error, using fallback: ${error.message}`);
      }
    }

    const total = this.fallbackStore.length;
    if (total === 0) {
      return {
        totalComplaints: 0,
        highPriorityCount: 0,
        criticalCount: 0,
        avgPriorityScore: 0,
        topCategory: 'None',
      };
    }

    const highPriorityCount = this.fallbackStore.filter((c) => c.priority_score >= 70).length;
    const criticalCount = this.fallbackStore.filter((c) => c.severity === 'Critical').length;
    const avgPriorityScore =
      Math.round(
        (this.fallbackStore.reduce((acc, c) => acc + (c.priority_score || 0), 0) / total) * 10,
      ) / 10;

    const categoryCounts: Record<string, number> = {};
    for (const c of this.fallbackStore) {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    }
    const topCategory =
      Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] ||
      'None';

    return {
      totalComplaints: total,
      highPriorityCount,
      criticalCount,
      avgPriorityScore,
      topCategory,
    };
  }

  async getCategoriesDistribution(): Promise<CategoryMetric[]> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          WITH TotalCount AS (
            SELECT COUNT(1) AS total FROM ${this.fullTableName}
          )
          SELECT
            c.category,
            COUNT(1) AS count,
            ROUND(COUNT(1) * 100.0 / NULLIF(MAX(t.total), 0), 1) AS percentage
          FROM ${this.fullTableName} c
          CROSS JOIN TotalCount t
          GROUP BY c.category
          ORDER BY count DESC
        `;
        const [rows] = await this.bigquery.query({ query });
        return rows.map((r) => ({
          category: r.category,
          count: Number(r.count),
          percentage: Number(r.percentage),
        }));
      } catch (error) {
        this.logger.warn(`BigQuery getCategoriesDistribution error, using fallback: ${error.message}`);
      }
    }

    const total = this.fallbackStore.length;
    if (total === 0) return [];

    const counts: Record<string, number> = {};
    for (const c of this.fallbackStore) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count * 1000) / total) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getSeverityDistribution(): Promise<SeverityMetric[]> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          SELECT
            severity,
            COUNT(1) AS count,
            ROUND(IFNULL(AVG(priority_score), 0), 1) AS avg_priority
          FROM ${this.fullTableName}
          GROUP BY severity
          ORDER BY
            CASE severity
              WHEN 'Critical' THEN 1
              WHEN 'High' THEN 2
              WHEN 'Medium' THEN 3
              WHEN 'Low' THEN 4
              ELSE 5
            END
        `;
        const [rows] = await this.bigquery.query({ query });
        return rows.map((r) => ({
          severity: r.severity,
          count: Number(r.count),
          avgPriority: Number(r.avg_priority),
        }));
      } catch (error) {
        this.logger.warn(`BigQuery getSeverityDistribution error, using fallback: ${error.message}`);
      }
    }

    const orderMap: Record<string, number> = { Critical: 1, High: 2, Medium: 3, Low: 4, Other: 5 };
    const groups: Record<string, { count: number; totalScore: number }> = {};

    for (const c of this.fallbackStore) {
      if (!groups[c.severity]) groups[c.severity] = { count: 0, totalScore: 0 };
      groups[c.severity].count += 1;
      groups[c.severity].totalScore += c.priority_score || 0;
    }

    return Object.entries(groups)
      .map(([severity, data]) => ({
        severity,
        count: data.count,
        avgPriority: Math.round((data.totalScore * 10) / data.count) / 10,
      }))
      .sort((a, b) => (orderMap[a.severity] || 99) - (orderMap[b.severity] || 99));
  }

  async getDepartmentWorkload(): Promise<DepartmentMetric[]> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          SELECT
            department,
            COUNT(1) AS total_assigned,
            COUNTIF(status = 'OPEN') AS open_issues,
            COUNTIF(severity = 'Critical' OR priority_score >= 70) AS urgent_issues,
            ROUND(IFNULL(AVG(priority_score), 0), 1) AS avg_priority
          FROM ${this.fullTableName}
          GROUP BY department
          ORDER BY total_assigned DESC
        `;
        const [rows] = await this.bigquery.query({ query });
        return rows.map((r) => ({
          department: r.department,
          totalAssigned: Number(r.total_assigned),
          openIssues: Number(r.open_issues),
          urgentIssues: Number(r.urgent_issues),
          avgPriority: Number(r.avg_priority),
        }));
      } catch (error) {
        this.logger.warn(`BigQuery getDepartmentWorkload error, using fallback: ${error.message}`);
      }
    }

    const groups: Record<string, { total: number; open: number; urgent: number; scoreSum: number }> = {};
    for (const c of this.fallbackStore) {
      if (!groups[c.department]) {
        groups[c.department] = { total: 0, open: 0, urgent: 0, scoreSum: 0 };
      }
      groups[c.department].total += 1;
      if (c.status === 'OPEN') groups[c.department].open += 1;
      if (c.severity === 'Critical' || c.priority_score >= 70) groups[c.department].urgent += 1;
      groups[c.department].scoreSum += c.priority_score || 0;
    }

    return Object.entries(groups)
      .map(([dept, d]) => ({
        department: dept,
        totalAssigned: d.total,
        openIssues: d.open,
        urgentIssues: d.urgent,
        avgPriority: Math.round((d.scoreSum * 10) / d.total) / 10,
      }))
      .sort((a, b) => b.totalAssigned - a.totalAssigned);
  }

  async getComplaintTrends(): Promise<TrendMetric[]> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          SELECT
            CAST(DATE(created_at) AS STRING) AS date,
            COUNT(1) AS total_complaints,
            COUNTIF(severity = 'Critical') AS critical_count,
            ROUND(IFNULL(AVG(priority_score), 0), 1) AS avg_priority
          FROM ${this.fullTableName}
          GROUP BY date
          ORDER BY date ASC
          LIMIT 30
        `;
        const [rows] = await this.bigquery.query({ query });
        return rows.map((r) => ({
          date: r.date,
          totalComplaints: Number(r.total_complaints),
          criticalCount: Number(r.critical_count),
          avgPriority: Number(r.avg_priority),
        }));
      } catch (error) {
        this.logger.warn(`BigQuery getComplaintTrends error, using fallback: ${error.message}`);
      }
    }

    const dayMap: Record<string, { total: number; critical: number; scoreSum: number }> = {};
    for (const c of this.fallbackStore) {
      const d =
        c.created_at instanceof Date
          ? c.created_at.toISOString().split('T')[0]
          : String(c.created_at).split('T')[0];
      if (!dayMap[d]) dayMap[d] = { total: 0, critical: 0, scoreSum: 0 };
      dayMap[d].total += 1;
      if (c.severity === 'Critical') dayMap[d].critical += 1;
      dayMap[d].scoreSum += c.priority_score || 0;
    }

    return Object.entries(dayMap)
      .map(([date, d]) => ({
        date,
        totalComplaints: d.total,
        criticalCount: d.critical,
        avgPriority: Math.round((d.scoreSum * 10) / d.total) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getCivicHotspots(limit = 15): Promise<HotspotMetric[]> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          SELECT
            location_name,
            category,
            ROUND(AVG(latitude), 4) AS latitude,
            ROUND(AVG(longitude), 4) AS longitude,
            COUNT(1) AS complaint_count,
            ROUND(IFNULL(AVG(priority_score), 0), 1) AS avg_priority,
            CAST(MAX(created_at) AS STRING) AS latest_complaint_at
          FROM ${this.fullTableName}
          GROUP BY location_name, category
          HAVING complaint_count >= 2
          ORDER BY complaint_count DESC, avg_priority DESC
          LIMIT @limit
        `;
        const [rows] = await this.bigquery.query({
          query,
          params: { limit },
        });
        return rows.map((r) => ({
          locationName: r.location_name,
          category: r.category,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          complaintCount: Number(r.complaint_count),
          avgPriority: Number(r.avg_priority),
          latestComplaintAt: r.latest_complaint_at,
        }));
      } catch (error) {
        this.logger.warn(`BigQuery getCivicHotspots error, using fallback: ${error.message}`);
      }
    }

    const clusters: Record<
      string,
      {
        locationName: string;
        category: string;
        latSum: number;
        lngSum: number;
        count: number;
        scoreSum: number;
        latestDate: string;
      }
    > = {};

    for (const c of this.fallbackStore) {
      const key = `${c.location_name}_${c.category}`;
      if (!clusters[key]) {
        clusters[key] = {
          locationName: c.location_name,
          category: c.category,
          latSum: 0,
          lngSum: 0,
          count: 0,
          scoreSum: 0,
          latestDate: '',
        };
      }
      clusters[key].latSum += c.latitude;
      clusters[key].lngSum += c.longitude;
      clusters[key].count += 1;
      clusters[key].scoreSum += c.priority_score || 0;
      const cDateStr =
        c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at);
      if (!clusters[key].latestDate || cDateStr > clusters[key].latestDate) {
        clusters[key].latestDate = cDateStr;
      }
    }

    return Object.values(clusters)
      .filter((cl) => cl.count >= 2)
      .map((cl) => ({
        locationName: cl.locationName,
        category: cl.category,
        latitude: Math.round((cl.latSum / cl.count) * 10000) / 10000,
        longitude: Math.round((cl.lngSum / cl.count) * 10000) / 10000,
        complaintCount: cl.count,
        avgPriority: Math.round((cl.scoreSum * 10) / cl.count) / 10,
        latestComplaintAt: cl.latestDate,
      }))
      .sort((a, b) => b.complaintCount - a.complaintCount || b.avgPriority - a.avgPriority)
      .slice(0, limit);
  }

  async findNearbyDuplicates(
    category: string,
    lat: number,
    lng: number,
    radiusKm = 1.0,
    daysLimit = 30,
  ): Promise<any[]> {
    if (this.isClientReady && this.bigquery) {
      try {
        const query = `
          SELECT
            complaint_id,
            category,
            location_name,
            latitude,
            longitude,
            created_at,
            ST_DISTANCE(ST_GEOGPOINT(longitude, latitude), ST_GEOGPOINT(@lng, @lat)) / 1000.0 AS distance_km
          FROM ${this.fullTableName}
          WHERE category = @category
            AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @daysLimit DAY)
            AND ST_DISTANCE(ST_GEOGPOINT(longitude, latitude), ST_GEOGPOINT(@lng, @lat)) <= (@radiusKm * 1000.0)
          ORDER BY distance_km ASC
        `;
        const [rows] = await this.bigquery.query({
          query,
          params: { category, lat, lng, radiusKm, daysLimit },
        });
        return rows;
      } catch (error) {
        this.logger.warn(`BigQuery findNearbyDuplicates error, using fallback: ${error.message}`);
      }
    }

    // Haversine calculation for fallback
    const now = new Date().getTime();
    const cutoff = now - daysLimit * 24 * 60 * 60 * 1000;

    return this.fallbackStore
      .filter((c) => {
        if (c.category !== category) return false;
        const cTime = new Date(c.created_at).getTime();
        if (cTime < cutoff) return false;
        const dist = this.haversineDistance(lat, lng, c.latitude, c.longitude);
        return dist <= radiusKm;
      })
      .map((c) => ({
        complaint_id: c.complaint_id,
        category: c.category,
        location_name: c.location_name,
        latitude: c.latitude,
        longitude: c.longitude,
        created_at: c.created_at,
        distance_km:
          Math.round(this.haversineDistance(lat, lng, c.latitude, c.longitude) * 100) / 100,
      }));
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private mapRowToComplaint(row: any): ComplaintRecord {
    return {
      complaint_id: row.complaint_id,
      description: row.description,
      image_url: row.image_url || null,
      category: row.category,
      severity: row.severity,
      department: row.department,
      location_name: row.location_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      affected_people: Number(row.affected_people),
      priority_score: Number(row.priority_score),
      duplicate_count: Number(row.duplicate_count),
      ai_summary: row.ai_summary,
      ai_reason: row.ai_reason,
      status: row.status || 'OPEN',
      created_at: row.created_at?.value || row.created_at,
    };
  }

  // Helper method to preload data into fallback or BigQuery for testing/seed
  seedLocal(complaints: ComplaintRecord[]) {
    this.fallbackStore = [...complaints];
    this.logger.log(`Local fallback store seeded with ${complaints.length} records`);
  }
}
