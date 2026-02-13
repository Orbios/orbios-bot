import { Events } from 'discord.js';


import config from './config.js';
import SupportedLanguages from './enums/supportedLanguages.js';
import { notifyUserAboutError, logErrorDetails } from './helpers/errorHandler.js';
import {
  createDiscordClient,
  setupCommands,
  setupInteractionHandlers,
  setupReadyHandler,
  setupCacheMonitoring,
  initializeDiscordClient,
} from './services/discordService.js';
import { runBackfill } from './services/backfillService.js';

import { processMessage } from './services/messageHandler.js';
import TranslationError from './typings/TranslationError.js';

// Initialize Discord client and setup
const discordClient = createDiscordClient();
const commands = setupCommands();

// Setup event handlers
setupReadyHandler(discordClient);
setupInteractionHandlers(discordClient, commands);

// Handle all messages
discordClient.on(Events.MessageCreate, async message => {
  let configuredLanguages: SupportedLanguages[] = [];
  let serverConfig;

  if (!message.guild?.id) {
    configuredLanguages = config.disord.defaultLanguages;
  } else {
    serverConfig = config.disord.servers.find(server => server.id === message.guild?.id);

    if (!serverConfig) {
      configuredLanguages = config.disord.defaultLanguages;
    } else if (!serverConfig.enabled) {
      return;
    } else {
      configuredLanguages =
        serverConfig.targetLanguages.length > 0 ? serverConfig.targetLanguages : config.disord.defaultLanguages;
    }
  }

  try {
    await processMessage(message, configuredLanguages, serverConfig);
  } catch (error: unknown) {
    console.error('Error processing message:', error);

    const translationError = error as TranslationError;

    // Don't delete the original message if translation failed
    await notifyUserAboutError(message, translationError);

    // Log specific error details for monitoring
    logErrorDetails(translationError);
  }
});

// Initialize and start the bot
async function startBot() {
  try {
    await initializeDiscordClient(discordClient);
    setupCacheMonitoring();

    // Start backfill in background
    runBackfill(discordClient).catch(err => console.error('Backfill failed:', err));
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
startBot();
