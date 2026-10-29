import { apiClient } from '../../services/api';

/**
 * Fetch available project templates.
 * GET /api/templates -> { templates: [{ key, name, description, moduleCount, taskCount }] }
 */
export async function getTemplates() {
  const response = await apiClient.get('/templates');
  return response.data;
}

/**
 * Apply a template to a project.
 * POST /api/projects/{projectId}/templates/{key}/apply -> { createdCount, taskIds }
 * Returns 404 if template key is unknown.
 */
export async function applyTemplate(projectId, key) {
  if (!projectId) throw new Error('Project ID is required');
  if (!key) throw new Error('Template key is required');

  const response = await apiClient.post(
    `/projects/${projectId}/templates/${encodeURIComponent(key)}/apply`
  );
  return response.data;
}

export const templateApi = {
  getTemplates,
  applyTemplate,
};

export default templateApi;
