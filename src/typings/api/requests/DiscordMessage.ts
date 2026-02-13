export type CreateDiscordMessageBody = {
  message_id: string;
  server_id: string;
  channel_id: string;
  user_id: string;
  username: string;
  detected_language: string;
  english_content: string;
  thai_content?: string;
  russian_content?: string;
  ukrainian_content?: string;
}
