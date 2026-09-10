export interface ComplaintRecord {
  complaint_id: string;
  description: string;
  image_url: string | null;
  category: string;
  severity: string;
  department: string;
  location_name: string;
  latitude: number;
  longitude: number;
  affected_people: number;
  priority_score: number;
  duplicate_count: number;
  ai_summary: string;
  ai_reason: string;
  status: string;
  created_at: string | Date;
}

export interface DashboardSummary {
  totalComplaints: number;
  highPriorityCount: number;
  criticalCount: number;
  avgPriorityScore: number;
  topCategory: string;
}

export interface CategoryMetric {
  category: string;
  count: number;
  percentage: number;
}

export interface SeverityMetric {
  severity: string;
  count: number;
  avgPriority: number;
}

export interface DepartmentMetric {
  department: string;
  totalAssigned: number;
  openIssues: number;
  urgentIssues: number;
  avgPriority: number;
}

export interface TrendMetric {
  date: string;
  totalComplaints: number;
  criticalCount: number;
  avgPriority: number;
}

export interface HotspotMetric {
  locationName: string;
  category: string;
  latitude: number;
  longitude: number;
  complaintCount: number;
  avgPriority: number;
  latestComplaintAt: string;
}
