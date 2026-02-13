// Define supported projects as const for literal type inference
const SUPPORTED_PROJECTS = [
  {
    code: 'orbios',
    label: 'Orbios',
  },
  {
    code: 'orbios-camp',
    label: 'Orbios Camp',
  },
  {
    code: 'team-fusion',
    label: 'TeamFusion',
  },
] as const;

// Export utility types for type-safe project selection
export type SupportedProjectCode = (typeof SUPPORTED_PROJECTS)[number]['code'];
export type SupportedProjectLabel = (typeof SUPPORTED_PROJECTS)[number]['label'];
export type SupportedProject = (typeof SUPPORTED_PROJECTS)[number];

// Helper function to get project by code with type safety
export function getProjectByCode<T extends SupportedProjectCode>(code: T): SupportedProject | undefined {
  return SUPPORTED_PROJECTS.find(project => project.code === code);
}

// Helper function to get project by label with type safety
export function getProjectByLabel<T extends SupportedProjectLabel>(label: T): SupportedProject | undefined {
  return SUPPORTED_PROJECTS.find(project => project.label === label);
}

// Helper function to check if a code is valid
export function isValidProjectCode(code: string): code is SupportedProjectCode {
  return SUPPORTED_PROJECTS.some(project => project.code === code);
}

// Helper function to check if a label is valid
export function isValidProjectLabel(label: string): label is SupportedProjectLabel {
  return SUPPORTED_PROJECTS.some(project => project.label === label);
}

export default SUPPORTED_PROJECTS;
