import dotenv from 'dotenv';
import SupportedLanguages from './enums/supportedLanguages.js';
import { Config } from './typings/Config.js';

const envFilePath = process.env.ENV_FILE;

if (envFilePath) {
  dotenv.config({ path: envFilePath });
} else {
  dotenv.config();
}

const isDevLocal = process.env.NODE_ENV !== 'production';

const config: Config = {
  isDevLocal,
  disord: {
    token: process.env.DISCORD_TOKEN || '',
    appId: process.env.APP_ID || '',
    defaultLanguages: [
      SupportedLanguages.EN,
      SupportedLanguages.ORIGINAL,
      SupportedLanguages.TH,
      SupportedLanguages.RU,
      SupportedLanguages.UA,
    ],
    servers: [
      {
        id: '1414519140861083792', // Orbios Open
        enabled: true, // enable or disable translation of messages
        targetLanguages: [SupportedLanguages.EN, SupportedLanguages.ORIGINAL], // array of supported languages
        syncPrivateChannels: true, // Enable syncing of private channels
      },
      {
        id: '1412083987475595479', // DevForge
        enabled: true,
        targetLanguages: [SupportedLanguages.EN, SupportedLanguages.ORIGINAL],
      },
      {
        id: '1299257625992757299', // Orbios Core
        enabled: true,
        targetLanguages: [],
        translateText: false, // Enable/disable text message translation
        transcribeVoice: true, // Enable/disable voice message transcription
        translateVoice: false, // Enable/disable voice message translation (requires transcribeVoice)
        saveToDatabase: false, // Enable/disable saving messages to database
      },
      {
        id: '1352546708822949959', // TeamFusion
        enabled: false,
        targetLanguages: [],
      },
    ],
  },
  openAI: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY || '',
    deepSeekBaseUrl: 'https://api.deepseek.com',
    deepSeekApiKey: process.env.DEEPSEEK_API_KEY || '',
    whisper: {
      model: 'whisper-1',
      maxFileSizeMB: 25,
    },
  },
  hasura: {
    baseUrl: process.env.API_BASE_URL || '',
    adminSecret: process.env.HASURA_GRAPHQL_ADMIN_SECRET || '',
  },
  backend: {
    baseUrl: process.env.BACKEND_BASE_URL || '',
  },
  googleMeet: {
    permanentLink: 'https://meet.google.com/woh-gxma-sqm',
  },
  translation: {
    historyCount: 5,
  },
};

if (config.isDevLocal) {
  console.log(JSON.stringify(config, null, 2));
}

export default config;
