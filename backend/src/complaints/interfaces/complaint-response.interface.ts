import { CivicCategory, SeverityLevel, MunicipalDepartment } from '../../ai/ai.interface';

export interface ComplaintSubmissionResponse {
  complaintId: string;
  category: CivicCategory;
  severity: SeverityLevel;
  department: MunicipalDepartment;
  priorityScore: number;
  duplicateCount: number;
  summary: string;
  reason: string;
  status: string;
  imageUrl: string | null;
  locationName: string;
  latitude: number;
  longitude: number;
  affectedPeople: number;
  createdAt: string;
}
