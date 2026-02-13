export const REQUEST_TYPE = {
  GENERAL_QUESTION: 'general_question',
  UPDATE_CONTEXT: 'update_context',
  PLANNING: 'planning',
} as const;

export type RequestType = (typeof REQUEST_TYPE)[keyof typeof REQUEST_TYPE];

export type AskQuestionResponse = {
  question: string;
  context_included: string;
  discord_channel_used: boolean;
  project_specific: boolean;
  request_type: RequestType;
  answer: string;
}
