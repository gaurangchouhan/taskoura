export interface TemplateSummary {
  key: string;
  name: string;
  description: string;
  moduleCount: number;
  taskCount: number;
}

export interface TemplateListResponse {
  templates: TemplateSummary[];
}

export interface ApplyTemplateResponse {
  createdCount: number;
  taskIds: string[];
}
