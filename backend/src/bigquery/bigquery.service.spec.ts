import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BigQueryService } from './bigquery.service';

describe('BigQueryService', () => {
  let service: BigQueryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BigQueryService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'BIGQUERY_DATASET') return 'civiclens';
              if (key === 'BIGQUERY_TABLE') return 'complaints';
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<BigQueryService>(BigQueryService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should load seed data and calculate dashboard summary', async () => {
    const summary = await service.getDashboardSummary();
    expect(summary).toBeDefined();
    expect(summary.totalComplaints).toBeGreaterThan(0);
    expect(summary.avgPriorityScore).toBeGreaterThan(0);
  });

  it('should return category distribution metrics', async () => {
    const categories = await service.getCategoriesDistribution();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toHaveProperty('category');
    expect(categories[0]).toHaveProperty('percentage');
  });

  it('should detect duplicate and nearby complaints', async () => {
    // Sector 15 coordinates: 28.5355, 77.3910
    const duplicates = await service.findNearbyDuplicates(
      'Waste Management',
      28.5355,
      77.3910,
      1.5,
      30,
    );
    expect(Array.isArray(duplicates)).toBe(true);
  });

  it('should calculate hotspots with recurring incidents', async () => {
    const hotspots = await service.getCivicHotspots(5);
    expect(Array.isArray(hotspots)).toBe(true);
    expect(hotspots.length).toBeGreaterThan(0);
    expect(hotspots[0].complaintCount).toBeGreaterThanOrEqual(2);
  });

  it('should insert a new complaint record', async () => {
    const newRecord = {
      complaint_id: 'CL-TEST-999',
      description: 'Test complaint for unit test',
      image_url: null,
      category: 'Road Damage',
      severity: 'High',
      department: 'Roads Department',
      location_name: 'Test Square',
      latitude: 28.5355,
      longitude: 77.3910,
      affected_people: 50,
      priority_score: 75,
      duplicate_count: 1,
      ai_summary: 'Test summary',
      ai_reason: 'Test reason',
      status: 'OPEN',
      created_at: new Date().toISOString(),
    };

    await service.insertComplaint(newRecord);
    const retrieved = await service.getComplaintById('CL-TEST-999');
    expect(retrieved).toBeDefined();
    expect(retrieved?.complaint_id).toBe('CL-TEST-999');
  });
});
