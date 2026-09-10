import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { AiService } from '../ai/ai.service';
import { PriorityService } from '../priority/priority.service';
import { DuplicateService } from '../duplicate/duplicate.service';
import { BigQueryService } from '../bigquery/bigquery.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintSubmissionResponse } from './interfaces/complaint-response.interface';
import { ComplaintRecord } from '../bigquery/bigquery.interface';

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly aiService: AiService,
    private readonly priorityService: PriorityService,
    private readonly duplicateService: DuplicateService,
    private readonly bigQueryService: BigQueryService,
  ) {}

  async createComplaint(
    dto: CreateComplaintDto,
    imageFile?: Express.Multer.File,
  ): Promise<ComplaintSubmissionResponse> {
    this.logger.log(`Processing new complaint for location: ${dto.locationName}`);

    // 1. Upload image if provided
    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await this.storageService.uploadComplaintImage(imageFile);
    }

    // 2. Multimodal AI Analysis with Gemini
    const aiResult = await this.aiService.analyzeComplaint(dto.description, imageFile);

    // 3. Duplicate Detection within 1km radius and 30-day window
    const duplicateResult = await this.duplicateService.detectDuplicates(
      aiResult.category,
      dto.latitude,
      dto.longitude,
      1.0,
      30,
    );

    // 4. Deterministic Priority Calculation (0-100)
    const affectedPeople = dto.affectedPeople || 20;
    const priorityBreakdown = this.priorityService.calculatePriority(
      aiResult.severity,
      affectedPeople,
      duplicateResult.duplicateCount,
      dto.locationName,
    );

    // 5. Generate Complaint ID and Timestamp
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const complaintId = `CL-${Date.now().toString().slice(-4)}${randomSuffix}`;
    const createdAt = new Date().toISOString();

    // 6. Persist to BigQuery
    const record: ComplaintRecord = {
      complaint_id: complaintId,
      description: dto.description,
      image_url: imageUrl,
      category: aiResult.category,
      severity: aiResult.severity,
      department: aiResult.department,
      location_name: dto.locationName,
      latitude: dto.latitude,
      longitude: dto.longitude,
      affected_people: affectedPeople,
      priority_score: priorityBreakdown.score,
      duplicate_count: duplicateResult.duplicateCount,
      ai_summary: aiResult.summary,
      ai_reason: aiResult.reason,
      status: 'OPEN',
      created_at: createdAt,
    };

    await this.bigQueryService.insertComplaint(record);

    this.logger.log(
      `Complaint ${complaintId} created: [${aiResult.category} | ${aiResult.severity} | Priority: ${priorityBreakdown.score}]`,
    );

    return {
      complaintId,
      category: aiResult.category,
      severity: aiResult.severity,
      department: aiResult.department,
      priorityScore: priorityBreakdown.score,
      duplicateCount: duplicateResult.duplicateCount,
      summary: aiResult.summary,
      reason: aiResult.reason,
      status: 'OPEN',
      imageUrl,
      locationName: dto.locationName,
      latitude: dto.latitude,
      longitude: dto.longitude,
      affectedPeople,
      createdAt,
    };
  }

  async getComplaints(limit = 50, offset = 0): Promise<ComplaintRecord[]> {
    return this.bigQueryService.getComplaints(limit, offset);
  }

  async getComplaintById(id: string): Promise<ComplaintRecord> {
    const complaint = await this.bigQueryService.getComplaintById(id);
    if (!complaint) {
      throw new NotFoundException(`Complaint with ID '${id}' not found.`);
    }
    return complaint;
  }
}
