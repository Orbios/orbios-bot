import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import config from '../config.js';
import { messageCache } from '../helpers/messageCache.js';

const CACHE_STATS_COMMAND_NAME = 'cache-stats';

export const cacheStatsCommand = {
  data: new SlashCommandBuilder()
    .setName(CACHE_STATS_COMMAND_NAME)
    .setDescription('Show message cache statistics (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const stats = messageCache.getStats();

      const response = `📊 **Message Cache Statistics**
      **Channels:** ${stats.channels}
      **Total Messages:** ${stats.totalMessages}
      **Memory Usage:** ~${stats.memoryUsageKB}KB
      **History Count:** ${config.translation.historyCount} messages

      *Cache stores last ${config.translation.historyCount} messages per channel for translation context.*
      *Automatic cleanup removes old channels every 30 minutes.*`;

      await interaction.editReply({
        content: response,
      });
    } catch (error) {
      console.error('Cache stats error:', error);

      await interaction.editReply({
        content: '❌ Sorry, there was an error getting cache statistics.',
      });
    }
  },
};
