export type AskQuestionRequestBody = {
  agent: string;
  question: string;
  channel_id: string;
  channel_name?: string;
  user: string;
}
