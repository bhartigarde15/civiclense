import { PriorityService } from './priority.service';

describe('PriorityService', () => {
  let service: PriorityService;

  beforeEach(() => {
    service = new PriorityService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate high priority for critical severity and high affected count', () => {
    const result = service.calculatePriority('Critical', 300, 5, 'Hospital Approach Road');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.severityScore).toBe(50);
    expect(result.affectedPeopleScore).toBe(16);
    expect(result.recurrenceScore).toBe(10);
    expect(result.locationSensitivityScore).toBe(15);
  });

  it('should calculate lower priority for low severity with minimal affected people', () => {
    const result = service.calculatePriority('Low', 5, 0, 'Residential Lane 4');
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.severityScore).toBe(10);
    expect(result.affectedPeopleScore).toBe(4);
    expect(result.recurrenceScore).toBe(0);
  });

  it('should give location sensitivity boost for school and hospital zones', () => {
    const school = service.calculatePriority('Medium', 20, 0, 'Greenwood School Zone');
    const normal = service.calculatePriority('Medium', 20, 0, 'Generic Sector Plot');
    expect(school.locationSensitivityScore).toBeGreaterThan(normal.locationSensitivityScore);
  });
});
