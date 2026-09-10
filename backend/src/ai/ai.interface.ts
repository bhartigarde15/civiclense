export type CivicCategory =
  | 'Waste Management'
  | 'Road Damage'
  | 'Streetlights'
  | 'Water Leakage'
  | 'Drainage'
  | 'Public Safety'
  | 'Traffic'
  | 'Other';

export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type MunicipalDepartment =
  | 'Municipal Sanitation'
  | 'Roads Department'
  | 'Electrical Department'
  | 'Water Department'
  | 'Drainage Department'
  | 'Public Safety Department'
  | 'Traffic Department'
  | 'General Municipal Services';

export interface AiComplaintAnalysis {
  category: CivicCategory;
  severity: SeverityLevel;
  department: MunicipalDepartment;
  summary: string;
  reason: string;
}
