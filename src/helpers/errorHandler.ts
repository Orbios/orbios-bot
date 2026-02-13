import { Message, AttachmentBuilder, GuildTextBasedChannel } from 'discord.js';
import TranslationError from '../typings/TranslationError.js';

/**
 * Handles errors and posts the original message back to the channel
 */
export async function notifyUserAboutError(message: Message, error: TranslationError): Promise<void> {
  try {
    const user = message.author;
    const member = await message.guild?.members.fetch(user.id).catch(() => null);

    // Build display name: FirstName LastName (@nickname)
    const displayNameParts: string[] = [];

    if (member?.nickname) {
      displayNameParts.push(`${user.username} (${member.nickname})`);
    } else if (member?.displayName && member.displayName !== user.username) {
      displayNameParts.push(member.displayName);
    } else {
      displayNameParts.push(user.username);
    }

    const displayName = `${displayNameParts.join(' ')} (<@${user.id}>)`;

    // Create a fallback message indicating translation failed
    const fallbackMessage = `❌ **Translation failed** - ${displayName} said:\n\n${message.content}`;

    // If the original message has attachments, send them with the fallback message
    if (message.attachments.size > 0) {
      const attachmentPromises = message.attachments
        .filter(attachment => !attachment.contentType?.startsWith('audio/'))
        .map(async attachment => {
          const response = await fetch(attachment.url);
          const buffer = await response.arrayBuffer();
          return new AttachmentBuilder(Buffer.from(buffer)).setName(attachment.name);
        });

      const attachmentBuilders = await Promise.all(attachmentPromises);

      // Send original message with attachments back to the channel
      await (message.channel as GuildTextBasedChannel).send({
        content: fallbackMessage,
        files: attachmentBuilders
      });
    } else {
      // Send just the text message back to the channel
      await (message.channel as GuildTextBasedChannel).send(fallbackMessage);
    }

    // Delete the original message that failed translation
    await message.delete();

    // Optionally notify the user via DM about the failure (without the content)
    try {
      const dmChannel = await user.createDM();
      const errorType =
        error.status === 429 ? 'rate limit' :
          error.status === 503 ? 'service unavailable' :
            'translation error';

      await dmChannel.send(
        `⚠️ Your message couldn't be translated due to ${errorType}. Your original message has been posted back to the channel.`
      );
    } catch (dmError) {
      console.warn('Could not send error notification DM to user:', dmError);
    }
  } catch (error) {
    console.error('Failed to handle translation error:', error);
    // As a last resort, don’t delete the original message so it’s not lost
  }
}

/**
 * Logs specific error details for monitoring
 */
export function logErrorDetails(error: TranslationError): void {
  const timestamp = new Date().toISOString();

  if (error.status === 429) {
    console.error(`[${timestamp}] Rate limit exceeded - OpenAI API tokens may be exhausted`);
  } else if (error.status === 503) {
    console.error(`[${timestamp}] Translation service temporarily unavailable`);
  } else if (error.status === 401) {
    console.error(`[${timestamp}] Authentication failed - API key may be invalid or expired`);
  } else if (error.status && error.status >= 500) {
    console.error(`[${timestamp}] Server error (${error.status}): ${error.message}`);
  } else {
    console.error(`[${timestamp}] Translation error (${error.status || 'unknown'}): ${error.message}`);
  }

  if (error.stack && error.status !== 429) {
    console.error(`[${timestamp}] Stack trace:`, error.stack);
  }
}
