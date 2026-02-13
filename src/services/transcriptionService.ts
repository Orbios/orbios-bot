import { Attachment } from 'discord.js';
import OpenAI from 'openai';

import config from '../config.js';

const openai = new OpenAI({
  apiKey: config.openAI.apiKey,
});

/**
 * Downloads audio from a Discord attachment.
 * @param attachment The audio attachment.
 * @returns A buffer containing the audio data.
 */
async function downloadAudio(attachment: Attachment): Promise<Buffer> {
  // Check file size limit
  const maxSizeBytes = config.openAI.whisper.maxFileSizeMB * 1024 * 1024;
  if (attachment.size > maxSizeBytes) {
    throw new Error(`Audio file too large. Maximum size is ${config.openAI.whisper.maxFileSizeMB}MB`);
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Transcribes audio using the OpenAI Whisper API.
 * @param audioBuffer The audio data to transcribe.
 * @param fileName The name of the audio file.
 * @param contentType The MIME type of the audio file.
 * @returns The transcribed text.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string = 'audio.ogg',
  contentType: string = 'audio/ogg',
): Promise<string> {
  try {
    // Convert Buffer to Uint8Array for File API compatibility
    const file = new File([new Uint8Array(audioBuffer)], fileName, { type: contentType });

    const transcription = await openai.audio.transcriptions.create({
      model: config.openAI.whisper.model,
      file,
    });

    return transcription.text;
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw new Error('Failed to transcribe audio.');
  }
}

/**
 * Handles voice messages by transcribing them.
 * @param attachment The Discord attachment containing the audio.
 * @param audioBuffer Optional pre-downloaded audio buffer to avoid duplicate downloads.
 * @returns The transcribed text or an error message.
 */
export async function handleVoiceMessage(
  attachment: Attachment,
  audioBuffer?: Buffer,
): Promise<string> {
  try {
    const buffer = audioBuffer || (await downloadAudio(attachment));
    const transcription = await transcribeAudio(
      buffer,
      attachment.name || 'audio.ogg',
      attachment.contentType || 'audio/ogg',
    );
    return transcription;
  } catch (error) {
    console.error('Voice message handling error:', error);
    return 'Error: Could not transcribe the voice message.';
  }
}
