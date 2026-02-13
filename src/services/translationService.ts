import OpenAI from 'openai';


import config from '../config.js';
import SupportedLanguages from '../enums/supportedLanguages.js';
import { findUserContext } from '../helpers/contextUtils.js';
import { detectLanguage, isReliableDetection } from '../helpers/languageDetection.js';
import { messageCache } from '../helpers/messageCache.js';
import AIResponse from '../typings/AIResponse.js';
import { UserContext } from '../typings/UsersContext.js';

const MAX_RETRIES = 3;

export async function translateMessage(
  text: string,
  userName: string,
  configuredLanguages: SupportedLanguages[],
): Promise<AIResponse | null> {
  let attempts = 0;
  let translation: AIResponse | null = null;

  while (attempts < MAX_RETRIES) {
    try {
      translation = await attemptTranslation(text, userName, configuredLanguages);

      if (translation && isValidTranslation(translation, configuredLanguages)) {
        return translation;
      }

      attempts++;
      if (attempts < MAX_RETRIES) {
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Translation attempt failed:', error);
      attempts++;
    }
  }

  throw new Error('Failed to get valid translation after maximum retries');
}

export async function translateMessageWithHistory(
  text: string,
  userName: string,
  channelId: string,
  configuredLanguages: SupportedLanguages[],
): Promise<AIResponse | null> {
  let attempts = 0;
  let translation: AIResponse | null = null;

  while (attempts < MAX_RETRIES) {
    try {
      // Get cached message history using config
      const messageHistory = messageCache.getMessageHistory(channelId, config.translation.historyCount);

      translation = await attemptTranslationWithHistory(text, userName, messageHistory, configuredLanguages);

      if (translation && isValidTranslation(translation, configuredLanguages)) {
        return translation;
      }

      attempts++;
      if (attempts < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Translation with history attempt failed:', error);
      attempts++;
    }
  }

  throw new Error('Failed to get valid translation with history after maximum retries');
}

// Helper methods

async function attemptTranslation(
  text: string,
  userName: string,
  configuredLanguages: SupportedLanguages[],
): Promise<AIResponse | null> {
  const userContext = findUserContext(userName);

  // Perform local language detection first
  const detectionResult = await detectLanguage(text);
  const useLocalDetection = isReliableDetection(detectionResult);
  const preDetectedLanguage = useLocalDetection ? detectionResult.language : undefined;

  const prompt = buildPrompt(text, userName, userContext, configuredLanguages, preDetectedLanguage);
  return executeTranslation(prompt);
}

async function attemptTranslationWithHistory(
  text: string,
  userName: string,
  messageHistory: Array<{ author: string; content: string; timestamp: number }>,
  configuredLanguages: SupportedLanguages[],
): Promise<AIResponse | null> {
  const userContext = findUserContext(userName);

  // Perform local language detection first
  const detectionResult = await detectLanguage(text);
  const useLocalDetection = isReliableDetection(detectionResult);
  const preDetectedLanguage = useLocalDetection ? detectionResult.language : undefined;

  const prompt = buildPromptWithHistory(text, userName, userContext, messageHistory, configuredLanguages, preDetectedLanguage);
  return executeTranslation(prompt);
}

async function executeTranslation(prompt: string): Promise<AIResponse | null> {
  const provider = config.openAI.provider;

  let baseURL = undefined;
  let apiKey = '';

  if (provider === 'deepseek') {
    baseURL = config.openAI.deepSeekBaseUrl;
    apiKey = config.openAI.deepSeekApiKey;
  } else {
    apiKey = config.openAI.apiKey;
  }

  const openaiClient = new OpenAI({ baseURL, apiKey });

  const completion = await openaiClient.chat.completions.create({
    model: config.openAI.model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  return completion.choices[0].message.content ? JSON.parse(completion.choices[0].message.content) : null;
}

function buildPrompt(
  text: string,
  userName: string,
  userContext: UserContext | null,
  configuredLanguages: SupportedLanguages[],
  preDetectedLanguage?: SupportedLanguages,
): string {
  const ensuredLanguages = Array.from(new Set([...configuredLanguages, SupportedLanguages.UA]));
  const languagesList = ensuredLanguages.join(', ').toUpperCase();

  const jsonFields = [
    `"detectedLanguage": "english/thai/russian/ukrainian"`,
    `"originalText": "the original input text"`,
    ...ensuredLanguages
      .map(lang => {
        switch (lang) {
          case SupportedLanguages.EN:
            return `"english": "translation or preserved original if english is the source"`;
          case SupportedLanguages.UA:
            return `"ukrainian": "translation or preserved original if ukrainian is the source"`;
          case SupportedLanguages.RU:
            return `"russian": "translation or preserved original if russian is the source"`;
          case SupportedLanguages.TH:
            return `"thai": "translation or preserved original if thai is the source"`;
          case SupportedLanguages.ORIGINAL:
            return null;
          default:
            return null;
        }
      })
      .filter(Boolean),
  ].join(',\n          ');

  const languageHint = preDetectedLanguage
    ? `\nPRE-DETECTED SOURCE LANGUAGE: ${preDetectedLanguage.toUpperCase()}\nThis language was detected by advanced local analysis. Trust this detection and use "${preDetectedLanguage}" as the detectedLanguage in your response.\n`
    : '';

  return `
      You are a precise translation system.
      You MUST ONLY provide translations for the following target languages: ${languagesList}.
      CRITICAL REQUIREMENT: Never return empty or missing translations.
      You MUST fill ALL requested languages: ${languagesList}.
      Empty strings are FORBIDDEN. If unsure, output the best possible translation.
      Never omit or leave fields blank.

      Team Members (ALWAYS use these exact name variants):
      - Erik: English (Erik), Thai (อีริค), Russian (Эрик), Ukrainian (Ерік)
      - Nana: English (Nana), Thai (นานา), Russian (Нана), Ukrainian (Нана)
      - Rai: English (Rai), Thai (ไร), Russian (Рай), Ukrainian (Рай)
      - Andrew: English (Andrew), Thai (แอนดรูว์), Russian (Андрей), Ukrainian (Андрій)
      - Olha: English (Olha), Thai (โอลห่า), Russian (Оля), Ukrainian (Ольга)

      Current Message Author Context:
      - Name: ${userName}
      ${userContext ? `- Gender: ${userContext.gender}` : ''}
      ${userContext ? `- Native Language: ${userContext.nativeLanguage}` : ''}
      ${userContext ? `- English Level: ${userContext.englishLevel}` : ''}
      ${languageHint}

      Message to process: "${text}"

      Translation Requirements:
      1. ${preDetectedLanguage ? `The source language has been reliably detected as ${preDetectedLanguage.toUpperCase()}. Use this in your response.` : 'DETECT the source language (English, Thai, Russian, or Ukrainian)'}
      2. ${!preDetectedLanguage ? `Pay special attention to distinguishing Ukrainian from Russian:
         - If the text contains "і", "ї", "є", "ґ" → it is Ukrainian.
         - If the text uses "ы", "э", "ё" → it is Russian.
         - If the text has common Ukrainian words ("також", "будь ласка", "дякую", "привіт") → it is Ukrainian.
         - Do NOT misclassify Ukrainian as Russian.` : ''}
      3. TRANSLATE according to these rules:
         - If source is English: preserve English, translate only into requested target languages.
           **Special Rule:** If source is English, you MUST ALSO provide a Ukrainian translation.
         - If source is Thai: preserve Thai, translate only into requested target languages
         - If source is Russian: preserve Russian, translate only into requested target languages
         - If source is Ukrainian: preserve Ukrainian, translate only into requested target languages
      4. ENSURE:
         - Use the exact name spellings above
         - Gender-appropriate pronouns
         - Cultural nuances, idioms, technical terminology consistency
      5. JSON Response must include ONLY these fields:
      {
        ${jsonFields}
      }

      IMPORTANT:
      - NEVER include languages not listed in configuredLanguages
      - ALWAYS preserve the original text exactly
      - NEVER leave required fields empty
      - DO NOT include any other fields such as "original", "text", "source", etc.
    `;
}

function buildPromptWithHistory(
  text: string,
  userName: string,
  userContext: UserContext | null,
  messageHistory: Array<{ author: string; content: string; timestamp: number }>,
  configuredLanguages: SupportedLanguages[],
  preDetectedLanguage?: SupportedLanguages,
): string {
  const historyContext =
    messageHistory.length > 0
      ? `\n\nCONVERSATION HISTORY (for context only):\n${messageHistory
          .map(msg => `${msg.author}: ${msg.content}`)
          .join('\n')}\n\nCURRENT MESSAGE TO TRANSLATE:`
      : '';
  const ensuredLanguages = Array.from(new Set([...configuredLanguages, SupportedLanguages.UA]));
  const languagesList = ensuredLanguages.join(', ').toUpperCase();

  const jsonFields = [
    `"detectedLanguage": "english/thai/russian/ukrainian"`,
    `"originalText": "the original input text"`,
    ...ensuredLanguages
      .map(lang => {
        switch (lang) {
          case SupportedLanguages.EN:
            return `"english": "translation or preserved original if english is the source"`;
          case SupportedLanguages.UA:
            return `"ukrainian": "translation or preserved original if ukrainian is the source"`;
          case SupportedLanguages.RU:
            return `"russian": "translation or preserved original if russian is the source"`;
          case SupportedLanguages.TH:
            return `"thai": "translation or preserved original if thai is the source"`;
          case SupportedLanguages.ORIGINAL:
            return null;
          default:
            return null;
        }
      })
      .filter(Boolean),
  ].join(',\n          ');

  const languageHint = preDetectedLanguage
    ? `\nPRE-DETECTED SOURCE LANGUAGE: ${preDetectedLanguage.toUpperCase()}\nThis language was detected by advanced local analysis. Trust this detection and use "${preDetectedLanguage}" as the detectedLanguage in your response.\n`
    : '';

  return `
      You are a precise translation system.
      You MUST ONLY provide translations for the following target languages: ${languagesList}.
      CRITICAL REQUIREMENT: Never return empty or missing translations.
      You MUST fill ALL requested languages: ${languagesList}.
      Empty strings are FORBIDDEN. If unsure, output the best possible translation.
      Never omit or leave fields blank.

      Team Members (ALWAYS use these exact name variants):
      - Erik: English (Erik), Thai (อีริค), Russian (Эрик), Ukrainian (Ерік)
      - Nana: English (Nana), Thai (นานา), Russian (Нана), Ukrainian (Нана)
      - Rai: English (Rai), Thai (ไร), Russian (Рай), Ukrainian (Рай)
      - Andrew: English (Andrew), Thai (แอนดรูว์), Russian (Андрей), Ukrainian (Андрій)
      - Olha: English (Olha), Thai (โอลห่า), Russian (Оля), Ukrainian (Ольга)

      Current Message Author Context:
      - Name: ${userName}
      ${userContext ? `- Gender: ${userContext.gender}` : ''}
      ${userContext ? `- Native Language: ${userContext.nativeLanguage}` : ''}
      ${userContext ? `- English Level: ${userContext.englishLevel}` : ''}
      ${languageHint}
      ${historyContext}

      Message to process: "${text}"

      Translation Requirements:
      1. ${preDetectedLanguage ? `The source language has been reliably detected as ${preDetectedLanguage.toUpperCase()}. Use this in your response.` : 'DETECT the source language (English, Thai, Russian, or Ukrainian)'}
      2. ${!preDetectedLanguage ? `Pay special attention to distinguishing Ukrainian from Russian:
         - If the text contains "і", "ї", "є", "ґ" → it is Ukrainian.
         - If the text uses "ы", "э", "ё" → it is Russian.
         - If the text has common Ukrainian words ("також", "будь ласка", "дякую", "привіт") → it is Ukrainian.
         - Do NOT misclassify Ukrainian as Russian.` : ''}
      3. TRANSLATE according to these rules:
         - If source is English: preserve English, translate only into requested target languages
         **Special Rule:** If source is English, you MUST ALSO provide a Ukrainian translation.
         - If source is Thai: preserve Thai, translate only into requested target languages
         - If source is Russian: preserve Russian, translate only into requested target languages
         - If source is Ukrainian: preserve Ukrainian, translate only into requested target languages
      4. ENSURE:
         - Use the exact name spellings above
         - Gender-appropriate pronouns
         - Cultural nuances, idioms, technical terminology consistency
      5. JSON Response must include ONLY these fields:
      {
        ${jsonFields}
      }

      IMPORTANT:
      - NEVER include languages not listed in configuredLanguages
      - ALWAYS preserve the original text exactly
      - NEVER leave required fields empty
      - DO NOT include any other fields such as "original", "text", "source", etc.
    `;
}

function isValidTranslation(translation: AIResponse, configuredLanguages: SupportedLanguages[]): boolean {
  if (!translation?.detectedLanguage?.trim() || !translation?.originalText?.trim()) {
    return false;
  }

  for (const lang of configuredLanguages) {
    switch (lang) {
      case SupportedLanguages.EN:
        if (translation.detectedLanguage !== 'english' && !translation.english?.trim()) {
          return false;
        }
        break;
      case SupportedLanguages.UA:
        if (translation.detectedLanguage !== 'ukrainian' && !translation.ukrainian?.trim()) {
          return false;
        }
        break;
      case SupportedLanguages.RU:
        if (translation.detectedLanguage !== 'russian' && !translation.russian?.trim()) {
          return false;
        }
        break;
      case SupportedLanguages.TH:
        if (translation.detectedLanguage !== 'thai' && !translation.thai?.trim()) {
          return false;
        }
        break;
      case SupportedLanguages.ORIGINAL:
        if (!translation.originalText?.trim()) return false;
        break;
    }
  }

  return true;
}
