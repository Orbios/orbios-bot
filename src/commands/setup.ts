import { SlashCommandBuilder, CommandInteraction, ChannelType, Guild, PermissionFlagsBits } from 'discord.js';

import SUPPORTED_PROJECTS from '../constants/supportedProjects.js';

// Bot permissions for private categories and channels
const BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
];

export const INPUTS_CATEGORY_NAME = '🧠 Inputs';
export const UPDATES_CATEGORY_NAME = '📢 Updates';
export const CHATS_CATEGORY_NAME = '💬 Chats';

export const setupCommand = {
  data: new SlashCommandBuilder().setName('setup').setDescription('Setup the server'),

  async execute(interaction: CommandInteraction) {
    const guild = interaction.guild;

    if (!guild) return;

    // Get bot member to ensure it has permissions
    const botMember = guild.members.cache.get(interaction.client.user.id);
    if (!botMember) {
      await interaction.reply('❌ Bot member not found in guild.');
      return;
    }

    // Create private categories with permission overwrites
    let inputCategory = findCategoryByName(guild, INPUTS_CATEGORY_NAME);
    if (!inputCategory) {
      inputCategory = await guild.channels.create({
        name: INPUTS_CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: botMember.id,
            allow: BOT_PERMISSIONS,
          },
        ],
      });
    }

    let updateCategory = findCategoryByName(guild, UPDATES_CATEGORY_NAME);
    if (!updateCategory) {
      updateCategory = await guild.channels.create({
        name: UPDATES_CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: botMember.id,
            allow: BOT_PERMISSIONS,
          },
        ],
      });
    }

    let chatCategory = findCategoryByName(guild, CHATS_CATEGORY_NAME);
    if (!chatCategory) {
      chatCategory = await guild.channels.create({
        name: CHATS_CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: botMember.id,
            allow: BOT_PERMISSIONS,
          },
        ],
      });
    }

    // Create project channels only if they don't exist
    // Channels inherit permissions from their parent category
    for (const project of SUPPORTED_PROJECTS) {
      // Check if input channel exists for this project
      const existingInputChannel = findTextChannelByNameInCategory(guild, project.code, inputCategory.id);
      if (!existingInputChannel) {
        await guild.channels.create({
          name: project.code,
          parent: inputCategory.id,
          type: ChannelType.GuildText,
        });
      }

      // Check if update channel exists for this project
      const existingUpdateChannel = findTextChannelByNameInCategory(guild, project.code, updateCategory.id);
      if (!existingUpdateChannel) {
        await guild.channels.create({
          name: project.code,
          parent: updateCategory.id,
          type: ChannelType.GuildText,
        });
      }
    }

    await interaction.reply(
      '✅ Setup complete. Private channels created with bot permissions (skipped existing ones).',
    );
  },
};

// Helper function to find existing category by name
const findCategoryByName = (guild: Guild, name: string) => {
  return guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name === name);
};

// Helper function to find existing text channel by name in a specific category
const findTextChannelByNameInCategory = (guild: Guild, name: string, categoryId: string) => {
  return guild.channels.cache.find(
    channel => channel.type === ChannelType.GuildText && channel.name === name && channel.parentId === categoryId,
  );
};
