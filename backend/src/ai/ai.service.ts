import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { COMPLAINT_ANALYSIS_SYSTEM_PROMPT } from './prompts/complaint-analysis.prompt';
import {
  AiComplaintAnalysis,
  CivicCategory,
  SeverityLevel,
  MunicipalDepartment,
} from './ai.interface';

const ALLOWED_CATEGORIES: CivicCategory[] = [
  'Waste Management',
  'Road Damage',
  'Streetlights',
  'Water Leakage',
  'Drainage',
  'Public Safety',
  'Traffic',
  'Other',
];

const ALLOWED_SEVERITIES: SeverityLevel[] = ['Low', 'Medium', 'High', 'Critical'];

const ALLOWED_DEPARTMENTS: MunicipalDepartment[] = [
  'Municipal Sanitation',
  'Roads Department',
  'Electrical Department',
  'Water Department',
  'Drainage Department',
  'Public Safety Department',
  'Traffic Department',
  'General Municipal Services',
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private generativeModel: GenerativeModel | null = null;
  private isVertexAiReady = false;

  constructor(private readonly configService: ConfigService) {
    const project =
      this.configService.get<string>('GOOGLE_CLOUD_PROJECT') ||
      this.configService.get<string>('GCP_PROJECT_ID');
    const location = this.configService.get<string>('GOOGLE_CLOUD_LOCATION') || 'us-central1';

    if (project) {
      try {
        const vertexAI = new VertexAI({ project, location });
        this.generativeModel = vertexAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: {
            role: 'system',
            parts: [{ text: COMPLAINT_ANALYSIS_SYSTEM_PROMPT }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
        this.isVertexAiReady = true;
        this.logger.log(`Initialized Vertex AI Gemini model (gemini-1.5-flash) in ${location}`);
      } catch (err) {
        this.logger.warn(`Vertex AI initialization deferred: ${err.message}`);
        this.isVertexAiReady = false;
      }
    } else {
      this.logger.log('Vertex AI not configured (missing GOOGLE_CLOUD_PROJECT); using heuristic AI engine fallback.');
    }
  }

  async analyzeComplaint(
    description: string,
    imageFile?: Express.Multer.File,
  ): Promise<AiComplaintAnalysis> {
    if (this.isVertexAiReady && this.generativeModel) {
      try {
        const parts: any[] = [{ text: `Citizen Complaint Description:\n"${description}"` }];

        if (imageFile) {
          parts.push({
            inlineData: {
              data: imageFile.buffer.toString('base64'),
              mimeType: imageFile.mimetype,
            },
          });
        }

        const result = await this.generativeModel.generateContent({
          contents: [{ role: 'user', parts }],
        });

        const response = result.response;
        const candidate = response.candidates?.[0];
        const rawText = candidate?.content?.parts?.[0]?.text;

        if (rawText) {
          const parsed = this.parseAndValidateGeminiResponse(rawText);
          if (parsed) {
            this.logger.log(`Successfully classified complaint via Vertex AI Gemini: [${parsed.category} - ${parsed.severity}]`);
            return parsed;
          }
        }
      } catch (error) {
        this.logger.warn(`Vertex AI Gemini inference failed (${error.message}); falling back to heuristic classification.`);
      }
    }

    // Heuristic fallback classifier
    return this.heuristicFallback(description, imageFile);
  }

  private parseAndValidateGeminiResponse(rawJson: string): AiComplaintAnalysis | null {
    try {
      // Clean potential code block wrapping
      const cleaned = rawJson
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const data = JSON.parse(cleaned);

      const category = ALLOWED_CATEGORIES.includes(data.category)
        ? data.category
        : this.mapCategoryFuzzy(data.category);

      const severity = ALLOWED_SEVERITIES.includes(data.severity)
        ? data.severity
        : 'Medium';

      const department = ALLOWED_DEPARTMENTS.includes(data.department)
        ? data.department
        : this.getDefaultDepartment(category);

      return {
        category,
        severity,
        department,
        summary: data.summary || 'Civic complaint submitted by citizen.',
        reason: data.reason || 'Classified based on contextual risk and civic category parameters.',
      };
    } catch (err) {
      this.logger.warn(`Failed to parse Gemini JSON output: ${err.message}`);
      return null;
    }
  }

  private heuristicFallback(
    description: string,
    imageFile?: Express.Multer.File,
  ): AiComplaintAnalysis {
    const text = description.toLowerCase();

    let category: CivicCategory = 'Other';
    let severity: SeverityLevel = 'Medium';
    let summary = 'Civic issue reported by resident.';
    let reason = 'Standard municipal priority assessment.';

    if (
      text.includes('garbage') ||
      text.includes('trash') ||
      text.includes('waste') ||
      text.includes('dustbin') ||
      text.includes('smell') ||
      text.includes('dump')
    ) {
      category = 'Waste Management';
      severity = text.includes('days') || text.includes('smell') || text.includes('huge') ? 'High' : 'Medium';
      summary = 'Accumulated and overflowing waste causing civic and hygiene concerns.';
      reason = 'Uncollected organic and general waste creates environmental degradation and odor.';
    } else if (
      text.includes('pothole') ||
      text.includes('road') ||
      text.includes('crater') ||
      text.includes('asphalt') ||
      text.includes('tar') ||
      text.includes('cave-in')
    ) {
      category = 'Road Damage';
      severity = text.includes('deep') || text.includes('school') || text.includes('skid') || text.includes('accident') ? 'Critical' : 'High';
      summary = 'Hazardous road surface defect threatening commuter safety.';
      reason = 'Potholes and compromised asphalt present imminent physical hazard for motorists and pedestrians.';
    } else if (
      text.includes('light') ||
      text.includes('streetlight') ||
      text.includes('dark') ||
      text.includes('pole') ||
      text.includes('wire')
    ) {
      category = 'Streetlights';
      severity = text.includes('wire') || text.includes('exposed') ? 'Critical' : text.includes('consecutive') || text.includes('dark') ? 'High' : 'Low';
      summary = 'Non-functional or defective street illumination fixture.';
      reason = 'Poor nighttime visibility reduces safety and increases accident risks.';
    } else if (
      text.includes('water') ||
      text.includes('pipe') ||
      text.includes('leak') ||
      text.includes('burst') ||
      text.includes('supply')
    ) {
      category = 'Water Leakage';
      severity = text.includes('burst') || text.includes('flooding') || text.includes('clean') ? 'Critical' : 'Medium';
      summary = 'Municipal water distribution pipeline or valve leakage.';
      reason = 'Potable water loss and foundation moisture seepage.';
    } else if (
      text.includes('drain') ||
      text.includes('sewage') ||
      text.includes('manhole') ||
      text.includes('gutter') ||
      text.includes('overflow')
    ) {
      category = 'Drainage';
      severity = text.includes('open') || text.includes('manhole') || text.includes('backflow') ? 'Critical' : 'High';
      summary = 'Drainage blockage or open manhole posing contamination hazard.';
      reason = 'Clogged storm drains and open covers are acute biohazards and safety risks.';
    } else if (
      text.includes('traffic') ||
      text.includes('signal') ||
      text.includes('jam') ||
      text.includes('parking') ||
      text.includes('crossing')
    ) {
      category = 'Traffic';
      severity = text.includes('signal') || text.includes('both') ? 'Critical' : 'High';
      summary = 'Traffic congestion or junction management defect.';
      reason = 'Signal failure or corridor obstruction disrupting vehicular flow.';
    } else if (
      text.includes('safety') ||
      text.includes('tree') ||
      text.includes('danger') ||
      text.includes('dog') ||
      text.includes('animal') ||
      text.includes('debris')
    ) {
      category = 'Public Safety';
      severity = text.includes('fall') || text.includes('live') || text.includes('railway') ? 'Critical' : 'High';
      summary = 'Public safety threat requiring municipal intervention.';
      reason = 'Obstruction or structural risk to community members.';
    }

    const department = this.getDefaultDepartment(category);

    return {
      category,
      severity,
      department,
      summary,
      reason,
    };
  }

  private getDefaultDepartment(category: CivicCategory): MunicipalDepartment {
    switch (category) {
      case 'Waste Management':
        return 'Municipal Sanitation';
      case 'Road Damage':
        return 'Roads Department';
      case 'Streetlights':
        return 'Electrical Department';
      case 'Water Leakage':
        return 'Water Department';
      case 'Drainage':
        return 'Drainage Department';
      case 'Public Safety':
        return 'Public Safety Department';
      case 'Traffic':
        return 'Traffic Department';
      default:
        return 'General Municipal Services';
    }
  }

  private mapCategoryFuzzy(raw: string): CivicCategory {
    if (!raw) return 'Other';
    const s = raw.toLowerCase();
    for (const cat of ALLOWED_CATEGORIES) {
      if (s.includes(cat.toLowerCase())) return cat;
    }
    return 'Other';
  }
}
