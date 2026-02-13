import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  CommandInteraction,
} from 'discord.js';

import { askCommand } from '../commands/ask.js';
import { cacheStatsCommand } from '../commands/cacheStats.js';
import { callCommand } from '../commands/call.js';
import { setupCommand } from '../commands/setup.js';
import config from '../config.js';
import { messageCache } from '../helpers/messageCache.js';

/**
 * Discord slash command structure
 * Supports both SlashCommandBuilder and SlashCommandOptionsOnlyBuilder
 */
type DiscordCommand = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
};


/**
 * Creates and configures Discord client with necessary intents and partials
 */
export function createDiscordClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  return client;
}

/**
 * Sets up slash commands for the Discord client
 */
export function setupCommands(): Map<string, DiscordCommand> {
  const commands = new Map<string, DiscordCommand>();

  commands.set(callCommand.data.name, callCommand);
  commands.set(cacheStatsCommand.data.name, cacheStatsCommand);
  commands.set(askCommand.data.name, askCommand);
  commands.set(setupCommand.data.name, setupCommand);

  return commands;
}

/**
 * Sets up interaction handlers for slash commands
 */
export function setupInteractionHandlers(client: Client, commands: Map<string, DiscordCommand>): void {
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'There was an error executing this command!',
        ephemeral: true,
      });
    }
  });
}

/**
 * Sets up ready event handler
 */
export function setupReadyHandler(client: Client): void {
  client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  });
}

/**
 * Sets up monitoring for cache stats in production
 */
export function setupCacheMonitoring(): void {
  if (!config.isDevLocal) {
    setInterval(
      () => {
        const stats = messageCache.getStats();
        console.log(
          `MessageCache Stats: ${stats.channels} channels, ${stats.totalMessages} messages, ~${stats.memoryUsageKB}KB memory`,
        );
      },
      10 * 60 * 1000,
    ); // Every 10 minutes
  }
}

/**
 * Initializes Discord client and logs in
 */
export async function initializeDiscordClient(client: Client): Promise<void> {
  try {
    await client.login(config.disord.token);
    console.log('Login successful');
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}
