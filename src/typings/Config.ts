import SupportedLanguages from '../enums/supportedLanguages.js';

export type Provider = 'openai' | 'deepseek';
export type Model = 'gpt-4o-mini';

export type ServerType = {
  id: string;
  enabled: boolean;
  targetLanguages: SupportedLanguages[];
  translateText?: boolean;
  transcribeVoice?: boolean;
  translateVoice?: boolean;
  saveToDatabase?: boolean;
  syncPrivateChannels?: boolean;
};

export type Config = {
  isDevLocal: boolean;
  disord: {
    token: string;
    appId: string;
    defaultLanguages: SupportedLanguages[];
    servers: ServerType[];
  };
  openAI: {
    provider: Provider;
    model: Model;
    apiKey: string;
    deepSeekBaseUrl: string;
    deepSeekApiKey: string;
    whisper: {
      model: string;
      maxFileSizeMB: number;
    };
  };
  hasura: {
    baseUrl: string;
    adminSecret: string;
  };
  backend: {
    baseUrl: string;
  };
  googleMeet: {
    permanentLink: string;
  };
  translation: {
    historyCount: number;
  };
}
