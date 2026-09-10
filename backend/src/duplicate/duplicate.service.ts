import { Injectable, Logger } from '@nestjs/common';
import { BigQueryService } from '../bigquery/bigquery.service';

export interface DuplicateDetectionResult {
  duplicateCount: number;
  nearbyComplaints: any[];
}

@Injectable()
export class DuplicateService {
  private readonly logger = new Logger(DuplicateService.name);

  constructor(private readonly bigQueryService: BigQueryService) {}

  async detectDuplicates(
    category: string,
    latitude: number,
    longitude: number,
    radiusKm = 1.0,
    daysLimit = 30,
  ): Promise<DuplicateDetectionResult> {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return { duplicateCount: 0, nearbyComplaints: [] };
    }

    try {
      const nearby = await this.bigQueryService.findNearbyDuplicates(
        category,
        latitude,
        longitude,
        radiusKm,
        daysLimit,
      );

      return {
        duplicateCount: nearby.length,
        nearbyComplaints: nearby,
      };
    } catch (error) {
      this.logger.warn(`Duplicate detection error: ${error.message}`);
      return { duplicateCount: 0, nearbyComplaints: [] };
    }
  }
}
