export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  deadline?: string;
  frontendStack?: string;
  backendStack?: string;
  databaseStack?: string;
  testingStack?: string;
  role?: 'Owner' | 'Member';
  createdAt?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  frontendStack?: string;
  backendStack?: string;
  databaseStack?: string;
  testingStack?: string;
  deadline?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  deadline?: string;
}
