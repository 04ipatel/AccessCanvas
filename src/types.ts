// Canvas API response shapes
export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollments?: Array<{
    type: string;
    computed_current_score: number | null;
    computed_current_grade: string | null;
    computed_final_score: number | null;
    computed_final_grade: string | null;
  }>;
}

export interface CanvasSubmission {
  score: number | null;
  grade: string | null;
  submitted_at: string | null;
  missing: boolean;
  late: boolean;
  workflow_state: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number;
  submission_types: string[];
  course_id: number;
  submission?: CanvasSubmission;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items_count: number;
  items_url: string;
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  position: number;
  indent: number;
  type: 'File' | 'Page' | 'Discussion' | 'Assignment' | 'Quiz' | 'SubHeader' | 'ExternalUrl' | 'ExternalTool';
  content_id?: number;
  html_url?: string;
  url?: string;
  page_url?: string;
  external_url?: string;
  locked_for_user?: boolean;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  content_type: string;
}

export interface CanvasPage {
  page_id: number;
  url: string;
  title: string;
  body: string;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message: string;
  posted_at: string;
}

// MCP tool output shapes (trimmed — only what Claude needs)
export interface FileRef {
  name: string;
  fileId: string | null;
  apiEndpoint: string | null;
}

export interface ExternalLink {
  title: string;
  url: string;
}

export interface ParsedContent {
  plainText: string;
  files: FileRef[];
  externalLinks: ExternalLink[];
}

export interface ModuleItemSummary {
  id: string;
  title: string;
  type: string;
  locked: boolean;
  fileId?: string;
  pageUrl?: string;
  assignmentId?: string;
  externalUrl?: string;
  password?: string;
  discussionId?: string;
}

export interface ModuleSummary {
  id: string;
  name: string;
  items: ModuleItemSummary[];
}

// Config
export interface Config {
  token: string;
  baseUrl: string;
}
