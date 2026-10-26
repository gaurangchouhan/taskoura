export type BugSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type BugStatus = 'Open' | 'Resolved' | string;

export interface Bug {
  id: string;
  taskId: string;
  severity: BugSeverity;
  status: BugStatus;
  reportedBy: string; // user UUID
  assignedTo?: string | null; // user UUID
  createdAt: string;
  resolvedAt?: string | null;
  description?: string;
}

export interface CreateBugRequest {
  severity: BugSeverity;
  description: string;
  assignedTo?: string | null;
}

export interface TestCase {
  id: string;
  description: string;
  expectedResult: string;
  passed: boolean;
  executedBy: string; // user UUID
  executedAt: string;
}

export interface CreateTestCaseRequest {
  description: string;
  expectedResult: string;
  passed: boolean;
}
