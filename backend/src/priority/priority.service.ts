import { Injectable, Logger } from '@nestjs/common';
import { SeverityLevel } from '../ai/ai.interface';

export interface PriorityBreakdown {
  score: number;
  severityScore: number;
  affectedPeopleScore: number;
  recurrenceScore: number;
  locationSensitivityScore: number;
}

@Injectable()
export class PriorityService {
  private readonly logger = new Logger(PriorityService.name);

  private readonly SENSITIVE_KEYWORDS = [
    { pattern: /hospital/i, points: 15 },
    { pattern: /school|college|university|kindergarten/i, points: 15 },
    { pattern: /bus stand|bus stop|terminal/i, points: 12 },
    { pattern: /railway|metro|station/i, points: 12 },
    { pattern: /market|bazaar|mall/i, points: 10 },
    { pattern: /highway|flyover|junction|crossing/i, points: 10 },
    { pattern: /park|temple|community center/i, points: 8 },
  ];

  calculatePriority(
    severity: SeverityLevel,
    affectedPeople: number,
    duplicateCount: number,
    locationName?: string,
  ): PriorityBreakdown {
    // 1. Severity points (0 - 50)
    let severityScore = 20;
    switch (severity) {
      case 'Critical':
        severityScore = 50;
        break;
      case 'High':
        severityScore = 40;
        break;
      case 'Medium':
        severityScore = 25;
        break;
      case 'Low':
        severityScore = 10;
        break;
    }

    // 2. Affected people score (0 - 20)
    let affectedPeopleScore = 4;
    const people = Number(affectedPeople) || 0;
    if (people > 500) {
      affectedPeopleScore = 20;
    } else if (people > 200) {
      affectedPeopleScore = 16;
    } else if (people > 50) {
      affectedPeopleScore = 12;
    } else if (people > 10) {
      affectedPeopleScore = 8;
    }

    // 3. Recurrence / duplicate score (0 - 15)
    let recurrenceScore = 0;
    const duplicates = Number(duplicateCount) || 0;
    if (duplicates >= 10) {
      recurrenceScore = 15;
    } else if (duplicates >= 5) {
      recurrenceScore = 10;
    } else if (duplicates >= 2) {
      recurrenceScore = 6;
    } else if (duplicates >= 1) {
      recurrenceScore = 3;
    }

    // 4. Location sensitivity score (0 - 15)
    let locationSensitivityScore = 5; // standard base
    if (locationName) {
      for (const item of this.SENSITIVE_KEYWORDS) {
        if (item.pattern.test(locationName)) {
          locationSensitivityScore = Math.max(locationSensitivityScore, item.points);
        }
      }
    }

    const rawTotal =
      severityScore + affectedPeopleScore + recurrenceScore + locationSensitivityScore;
    const score = Math.min(100, Math.max(10, Math.round(rawTotal)));

    return {
      score,
      severityScore,
      affectedPeopleScore,
      recurrenceScore,
      locationSensitivityScore,
    };
  }
}
