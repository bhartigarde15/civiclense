import { Injectable } from '@nestjs/common';
import { BigQueryService } from '../bigquery/bigquery.service';
import {
  DashboardSummary,
  CategoryMetric,
  SeverityMetric,
  DepartmentMetric,
  TrendMetric,
  HotspotMetric,
} from '../bigquery/bigquery.interface';

@Injectable()
export class DashboardService {
  constructor(private readonly bigQueryService: BigQueryService) {}

  async getSummary(): Promise<DashboardSummary> {
    return this.bigQueryService.getDashboardSummary();
  }

  async getCategories(): Promise<CategoryMetric[]> {
    return this.bigQueryService.getCategoriesDistribution();
  }

  async getSeverity(): Promise<SeverityMetric[]> {
    return this.bigQueryService.getSeverityDistribution();
  }

  async getDepartmentWorkload(): Promise<DepartmentMetric[]> {
    return this.bigQueryService.getDepartmentWorkload();
  }

  async getTrends(): Promise<TrendMetric[]> {
    return this.bigQueryService.getComplaintTrends();
  }

  async getHotspots(limit = 15): Promise<HotspotMetric[]> {
    return this.bigQueryService.getCivicHotspots(limit);
  }
}
