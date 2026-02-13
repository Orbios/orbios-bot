
import { Client, ChannelType, TextChannel, Message, Collection } from 'discord.js';
import config from '../config.js';
import { saveDiscordMessage } from './apiService.js';
import { isPublicChannel } from '../helpers/utils.js';
import { translateMessage } from './translationService.js';
import SupportedLanguages from '../enums/supportedLanguages.js';

const BACKFILL_LIMIT = 1000;
const BATCH_SIZE = 100;

export async function runBackfill(client: Client) {
    console.log('🔄 Starting background backfill process...');

    const servers = config.disord.servers.filter(s => s.enabled && (s.saveToDatabase !== false));

    for (const serverConfig of servers) {
        try {
            const guild = await client.guilds.fetch(serverConfig.id);
            if (!guild) continue;

            console.log(`Checking guild: ${guild.name} (${guild.id})`);

            const channels = await guild.channels.fetch();

            for (const [channelId, channel] of channels) {
                if (!channel || channel.type !== ChannelType.GuildText) continue;

                const textChannel = channel as TextChannel;
                const isPublic = isPublicChannel(textChannel);

                // Check if channel should be synced based on server config
                if (!config.isDevLocal && !isPublic && !serverConfig.syncPrivateChannels) {
                    continue;
                }

                await backfillChannel(textChannel);
            }

        } catch (error) {
            console.error(`Error processing guild ${serverConfig.id}:`, error);
        }
    }

    console.log('✅ Backfill process completed.');
}

async function backfillChannel(channel: TextChannel) {
    console.log(`  -> Backfilling channel: ${channel.name}`);

    let lastMessageId: string | undefined;
    let totalFetched = 0;

    while (totalFetched < BACKFILL_LIMIT) {
        try {
            const options: any = { limit: BATCH_SIZE };
            if (lastMessageId) options.before = lastMessageId;

            // Cast to unkown then Collection to force type. fetch(options) returns Promise<Collection>
            const messages = (await channel.messages.fetch(options)) as unknown as Collection<string, Message<true>>;

            if (messages.size === 0) break;

            console.log(`     Fetched ${messages.size} messages (Total: ${totalFetched + messages.size})`);

            for (const message of messages.values()) {
                if (!message.content) continue;
                if (message.author.bot) continue; // Skip bots

                const mockTranslations = {
                    detectedLanguage: 'original',
                    originalText: message.content,
                    english: message.content, // Fallback
                    thai: '',
                    russian: '',
                    ukrainian: '',
                    answer: '',
                    request_type: '',
                    sentiment: '',
                };

                const userName = message.author.globalName || message.author.username;

                try {
                    await saveDiscordMessage(message, userName, mockTranslations as any);
                } catch (e: any) {
                    // Ignore duplicate errors, verify via log if needed
                    // console.warn(`     Failed to save ${message.id}: ${e.message}`);
                }
            }

            lastMessageId = messages.last()?.id;
            totalFetched += messages.size;

            // Rate limit protection
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`     Error fetching messages:`, error);
            break;
        }
    }
}
