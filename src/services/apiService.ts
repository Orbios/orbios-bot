import axios, { AxiosResponse } from 'axios';
import { Message } from 'discord.js';

import config from '../config.js';
import AIResponse from '../typings/AIResponse.js';
import { AskQuestionRequestBody } from '../typings/api/requests/AskQuestion.js';
import { CreateDiscordMessageBody } from '../typings/api/requests/DiscordMessage.js';
import { UpdateProjectContextRequestBody } from '../typings/api/requests/UpdateProjectContext.js';
import { AskQuestionResponse } from '../typings/api/responses/AskQuestionResponse.js';
import SupportedLanguages from '../enums/supportedLanguages.js';


export const saveDiscordMessage = async (
  message: Message,
  username: string,
  translations: AIResponse,
): Promise<void> => {
  try {
    const { detectedLanguage, originalText, english, thai, russian, ukrainian } = translations;

    const body: CreateDiscordMessageBody = {
      message_id: message.id,
      server_id: message.guildId || '',
      channel_id: message.channelId,
      user_id: message.author.id,
      username: username,
      detected_language: detectedLanguage ?? 'unknown',
      english_content: (detectedLanguage === SupportedLanguages.EN ? originalText : english) ?? '',
      thai_content: (detectedLanguage === SupportedLanguages.TH ? originalText : thai) ?? '',
      russian_content: (detectedLanguage === SupportedLanguages.RU ? originalText : russian) ?? '',
      ukrainian_content: (detectedLanguage === SupportedLanguages.UA ? originalText : ukrainian) ?? '',
    };

    await axios.post(`${config.hasura.baseUrl}/api/rest/message`, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': config.hasura.adminSecret,
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Failed to save Discord message: ${error.message}`);
      console.error('Response data:', error.response?.data);
    } else if (error instanceof Error) {
      console.error(`Failed to save Discord message: ${error.message}`);
    } else {
      console.error('Failed to save Discord message: Unknown error');
    }
  }
};

export const askQuestion = async (
  question: string,
  user: string,
  channelId: string,
  channelName?: string,
): Promise<AskQuestionResponse> => {
  try {
    const body: AskQuestionRequestBody = {
      agent: 'Lana',
      question,
      channel_id: channelId,
      channel_name: channelName,
      user,
    };

    const response: AxiosResponse<AskQuestionResponse> = await axios.post(`${config.backend.baseUrl}/answer`, body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Failed to get answer from API: ${error.message}`);
      throw new Error(`API request failed: ${error.message}`);
    }

    console.log('Failed to get answer from API: Unknown error');
    throw new Error('API request failed: Unknown error');
  }
};

export const updateProjectContext = async (project: string, context: string): Promise<void> => {
  try {
    const body: UpdateProjectContextRequestBody = {
      project,
      context,
    };

    await axios.put(`${config.hasura.baseUrl}/api/rest/summary`, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': config.hasura.adminSecret,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Failed to update project context: ${error.message}`);
      throw new Error(`Project context update failed: ${error.message}`);
    }

    console.log('Failed to update project context: Unknown error');
    throw new Error('Project context update failed: Unknown error');
  }
};
