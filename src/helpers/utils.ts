import { ChannelType, TextChannel, Message, PermissionFlagsBits, Channel } from 'discord.js';
import { INPUTS_CATEGORY_NAME } from '../commands/setup.js';
import { MAX_LENGTH_FOR_DISCORD_MESSAGE } from '../constants/common.js';
import { getProjectByCode, isValidProjectCode } from '../constants/supportedProjects.js';

export function splitMessage(message: string): string[] {
  const parts: string[] = [];

  while (message.length > 0) {
    let chunk = message.slice(0, MAX_LENGTH_FOR_DISCORD_MESSAGE);

    // Try to split at a newline if possible
    const lastNewline = chunk.lastIndexOf('\n');

    if (lastNewline !== -1 && message.length > MAX_LENGTH_FOR_DISCORD_MESSAGE) {
      chunk = chunk.slice(0, lastNewline);
    }

    parts.push(chunk);

    message = message.slice(chunk.length);
  }

  return parts;
}

export async function isTrackablePrivateChannel(channel: Channel | null): Promise<boolean> {
  if (!channel || channel.type !== ChannelType.GuildText) return false;

  const textChannel = channel as TextChannel;

  // Check if the channel is private (ViewChannel is disabled for @everyone)
  const everyoneRole = textChannel.guild.roles.everyone;
  const isPrivate = !textChannel.permissionsFor(everyoneRole)?.has(PermissionFlagsBits.ViewChannel);

  if (!isPrivate) return true; // Публичный канал → трекаем

  try {
    // Fetch all members of the server with timeout
    await textChannel.guild.members.fetch({ time: 10000 }); // 10 second timeout
  } catch (error) {
    console.warn('Failed to fetch guild members, defaulting to tracking channel:', error);
    // If we can't fetch members, assume it's trackable to be safe
    return true;
  }

  // Count real users who are explicitly added to the channel
  let realUsers = [...textChannel.members.values()].filter(m => !m.user.bot);

  // Consider users from roles
  textChannel.permissionOverwrites.cache.forEach((overwrite, id) => {
    if (overwrite.allow.has(PermissionFlagsBits.ViewChannel)) {
      const role = textChannel.guild.roles.cache.get(id);
      if (role) {
        // Add all real people who have this role
        realUsers = [...realUsers, ...role.members.filter(m => !m.user.bot).values()];
      }
    }
  });

  // Remove duplicates
  const uniqueRealUsers = new Set(realUsers.map(u => u.id));

  // ❌ Don't track if there are exactly 2 real people (without bots)
  return uniqueRealUsers.size !== 2;
}

export function isUserToBotDM(message: Message): boolean {
  return message.guild === null && message.channel.type === ChannelType.DM;
}

export async function isInputChannel(
  channel: Channel | null,
  message: Message,
): Promise<{ isInputChannel: boolean; projectSlug: string }> {
  if (!channel || channel.type !== ChannelType.GuildText) {
    return { isInputChannel: false, projectSlug: '' };
  }

  const textChannel = channel as TextChannel;

  if (textChannel.parentId) {
    const parent = await message.client.channels.fetch(textChannel.parentId);

    // Check if it's a category
    if (parent && parent.type === ChannelType.GuildCategory) {
      const categoryName = parent.name;

      if (categoryName === INPUTS_CATEGORY_NAME && isValidProjectCode(textChannel.name)) {
        const project = getProjectByCode(textChannel.name);
        return { isInputChannel: true, projectSlug: project?.label || '' };
      }
    }
  }

  return { isInputChannel: false, projectSlug: '' };
}

export function isPublicChannel(channel: Channel | null): boolean {
  if (!channel || channel.type !== ChannelType.GuildText) {
    return false;
  }

  const textChannel = channel as TextChannel;
  const everyoneRole = textChannel.guild.roles.everyone;

  // A channel is public if the @everyone role has permission to view it.
  return textChannel.permissionsFor(everyoneRole)?.has(PermissionFlagsBits.ViewChannel) ?? false;
}
