import {
  Message,
  AttachmentBuilder,
  GuildTextBasedChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  MessageCreateOptions,
  MessageEditOptions,
} from 'discord.js';
import config from '../config.js';
import SupportedLanguages from '../enums/supportedLanguages.js';
import { messageCache } from '../helpers/messageCache.js';
import { formatTranslations } from '../helpers/messageFormatter.js';
import { splitMessage, isUserToBotDM, isInputChannel, isPublicChannel } from '../helpers/utils.js';
import AIResponse from '../typings/AIResponse.js';
import { REQUEST_TYPE } from '../typings/api/responses/AskQuestionResponse.js';
import { ServerType } from '../typings/Config.js';
import { saveDiscordMessage, askQuestion, updateProjectContext } from './apiService.js';
import { handleVoiceMessage } from './transcriptionService.js';
import { translateMessage, translateMessageWithHistory } from './translationService.js';

/**
 * Handles direct messages between user and bot
 */
async function handleDirectMessage(message: Message): Promise<void> {
  let thinkingMessage;

  try {
    // Start typing indicator (if available)
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    // Send a temporary "thinking" message
    thinkingMessage = await message.reply('🤔 Thinking about your question...');

    const response = await askQuestion(message.content, message.author.username, message.channelId);
    const formattedMessage = splitMessage(response.answer);

    // Edit the thinking message with the actual response
    if (Array.isArray(formattedMessage)) {
      // For multiple parts, edit the first message and send additional parts
      await thinkingMessage.edit(formattedMessage[0]);
      for (let i = 1; i < formattedMessage.length; i++) {
        await message.reply(formattedMessage[i]);
      }
    } else {
      await thinkingMessage.edit(formattedMessage);
    }
  } catch {
    if (thinkingMessage) {
      await thinkingMessage.edit('Sorry, there was an error processing your message.');
    } else {
      await message.reply('Sorry, there was an error processing your message.');
    }
  }
}

/**
 * Handles messages in trackable private channels with input channels
 */
async function handleInputChannelMessage(message: Message, projectSlug: string): Promise<void> {
  let thinkingMessage;

  try {
    // Start typing indicator (if available)
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    // Send a temporary "thinking" message
    thinkingMessage = await message.reply('🤔 Processing your request...');

    const response = await askQuestion(message.content, message.author.username, message.channelId, projectSlug);

    const formattedMessage = splitMessage(response.answer);

    // Check request type to determine how to handle the response
    if (response.request_type === REQUEST_TYPE.UPDATE_CONTEXT) {
      // Create buttons for update/cancel
      const updateButton = new ButtonBuilder()
        .setCustomId('context_update')
        .setLabel('Update Context')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const cancelButton = new ButtonBuilder()
        .setCustomId('context_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(updateButton, cancelButton);

      // Edit the thinking message with the formatted response and buttons
      let replyMessage;
      if (Array.isArray(formattedMessage)) {
        // For long messages (multiple chunks), edit the thinking message with first chunk and send additional chunks
        await thinkingMessage.edit(formattedMessage[0]);
        for (let i = 1; i < formattedMessage.length - 1; i++) {
          await message.reply(formattedMessage[i]);
        }

        // Send the last chunk with buttons
        const lastChunk = formattedMessage[formattedMessage.length - 1];
        const messageOptions: MessageCreateOptions = {
          content: lastChunk + '\n\n**Would you like to update the project context?**',
          // Discord.js v14 has type incompatibility with ActionRowBuilder
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          components: [actionRow as any],
        };
        replyMessage = await message.reply(messageOptions);
      } else {
        // For short messages (single chunk), edit the thinking message and add buttons
        const editOptions: MessageEditOptions = {
          content: formattedMessage + '\n\n**Would you like to update the project context?**',
          // Discord.js v14 has type incompatibility with ActionRowBuilder
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          components: [actionRow as any],
        };
        replyMessage = await thinkingMessage.edit(editOptions);
      }

      // Create a collector for button interactions
      const filter = (buttonInteraction: ButtonInteraction) => {
        return buttonInteraction.user.id === message.author.id;
      };

      // Discord.js v14 typing issue with message.channel and collector
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const collector = (message.channel as any)?.createMessageComponentCollector({
        filter,
        time: 60000, // 60 seconds timeout
      });

      collector?.on('collect', async (buttonInteraction: ButtonInteraction) => {
        if (buttonInteraction.customId === 'context_update') {
          try {
            // Update the project context
            await updateProjectContext(projectSlug, response.answer);

            await buttonInteraction.update({
              content: '✅ **Context successfully updated!**\n\n*The project context has been saved to the database.*',
              components: [],
            });
          } catch (error) {
            console.error('Failed to update project context:', error);

            await buttonInteraction.update({
              content:
                '❌ **Failed to update context.**\n\n*An error occurred while updating the project context. Please try again later.*',
              components: [],
            });
          }
        } else if (buttonInteraction.customId === 'context_cancel') {
          await buttonInteraction.update({
            content: '❌ **Context update cancelled.**\n\n*The project context was not updated.*',
            components: [],
          });
        }

        collector.stop();
      });

      // Discord.js v14 typing issue with collector.on('end') parameter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collector?.on('end', async (collected: any) => {
        if (collected.size === 0) {
          // Timeout - no button was clicked
          try {
            await replyMessage.edit({
              content:
                '⏰ **Context update timed out.**\n\n*Please use the command again if you want to update the context.*',
              components: [],
            });
          } catch (error) {
            console.error('Error updating message on timeout:', error);
          }
        }
      });
    } else {
      // Edit the thinking message with the formatted response
      if (Array.isArray(formattedMessage)) {
        // For multiple parts, edit the thinking message with the first part and send additional parts
        await thinkingMessage.edit(formattedMessage[0]);
        for (let i = 1; i < formattedMessage.length; i++) {
          await message.reply(formattedMessage[i]);
        }
      } else {
        await thinkingMessage.edit(formattedMessage);
      }
    }
  } catch {
    if (thinkingMessage) {
      await thinkingMessage.edit('Sorry, there was an error processing your message.');
    } else {
      await message.reply('Sorry, there was an error processing your message.');
    }
  }
}

/**
 * Handles regular messages that need translation
 */
async function handleTranslationMessage(
  message: Message,
  configuredLanguages: SupportedLanguages[],
  saveToDatabase = true,
  syncPrivateChannels = false,
): Promise<{
  translations: AIResponse;
  attachmentBuilders: AttachmentBuilder[];
  referenceMessageId?: string;
  referenceChannelId?: string;
  silent?: boolean;
}> {
  // Process attachments before deleting the message
  const attachmentPromises = message.attachments
    .filter(attachment => !attachment.contentType?.startsWith('audio/'))
    .map(async attachment => {
      const response = await fetch(attachment.url);
      const buffer = await response.arrayBuffer();
      return new AttachmentBuilder(Buffer.from(buffer)).setName(attachment.name);
    });

  const attachmentBuilders = await Promise.all(attachmentPromises);

  const userName = message.author?.globalName || message.author?.username;

  // Check if channel is public
  const channel = await message.client.channels.fetch(message.channelId);
  const isPublic = isPublicChannel(channel);

  console.log(`DEBUG: MsgId: ${message.id}, ChannelId: ${message.channelId}, IsPublic: ${isPublic}, SyncPrivate: ${syncPrivateChannels}`);

  let translations: AIResponse | null;

  // If private and sync is enabled, we perform "Silent Sync"
  // We do NOT translate, we just save the original content to DB.
  if (!isPublic && syncPrivateChannels) {
    console.log(`Silent syncing private message from channel: ${message.channelId}`);
    translations = {
      detectedLanguage: 'english', // Defaulting to english for schema strictness, though 'unknown' fits better if supported
      originalText: message.content,
      english: message.content, // Map original to english field to ensure visibility in DB
      thai: '',
      russian: '',
      ukrainian: '',
    };
  } else {
    // Public channel: Perform full AI translation
    try {
      translations = await translateMessageWithHistory(
        message.content,
        userName,
        message.channelId,
        configuredLanguages,
      );
    } catch (historyError) {
      console.warn('History translation failed, falling back to basic translation:', historyError);
      translations = await translateMessage(message.content, userName, configuredLanguages);
    }
  }

  if (!translations) {
    throw new Error('Failed to translate message');
  }

  // IMPORTANT: Cache the message BEFORE deleting it for future context
  // (Even for silent sync, caching might be useful for history context if we enable it later, but harmless now)
  messageCache.addMessage(message);

  // Save message to db checking config
  // logic: if dev local -> skip
  // else if public OR (private AND sync enabled) -> save
  if (!config.isDevLocal && (isPublic || syncPrivateChannels) && saveToDatabase) {
    await saveDiscordMessage(message, userName, translations);
  }

  // Save information about reference message before deleting
  const referenceMessageId = message.reference?.messageId;
  const referenceChannelId = message.reference?.channelId;

  return {
    translations,
    attachmentBuilders,
    referenceMessageId,
    referenceChannelId,
    silent: !isPublic, // Return silent flag if private
  };
}

/**
 * Handles voice messages by transcribing them and sending the transcription back to the user.
 * @param message The message containing the voice attachment.
 */
export async function handleVoiceMessageProcessing(message: Message) {
  for (const attachment of message.attachments.values()) {
    if (attachment.contentType?.startsWith('audio/')) {
      try {
        // Download audio once
        const audioBuffer = await (await fetch(attachment.url)).arrayBuffer();
        const fileBuffer = Buffer.from(audioBuffer);

        // Pass the buffer to avoid duplicate download
        const transcription = await handleVoiceMessage(attachment, fileBuffer);

        return {
          transcription,
          voiceAttachment: new AttachmentBuilder(fileBuffer, { name: attachment.name || 'voice_message.ogg' }),
        };
      } catch (error) {
        console.error('Voice message processing error:', error);
        await message.reply('❌ Sorry, I could not transcribe the voice message.');
      }
    }
  }

  return null;
}

/**
 * Main message processor that routes messages to appropriate handlers
 */
export async function processMessage(
  message: Message,
  configuredLanguages: SupportedLanguages[],
  serverConfig?: ServerType,
): Promise<void> {
  // Ignore messages from bots to prevent loops
  if (message.author.bot) return;

  // Handle voice messages
  const hasAudioAttachment = Array.from(message.attachments.values()).some(att =>
    att.contentType?.startsWith('audio/'),
  );

  let voiceAttachment;
  let transcriptionText: string | undefined;

  if (hasAudioAttachment && serverConfig?.transcribeVoice != false) {
    const result = await handleVoiceMessageProcessing(message);
    if (result?.transcription) {
      transcriptionText = result.transcription;
      voiceAttachment = result.voiceAttachment;
      message.content = transcriptionText;
    }
  }

  // If it's a voice message but text transcribe is disabled, skip everything else
  if (hasAudioAttachment && serverConfig?.transcribeVoice === false) {
    return;
  }

  // If it's a text message and translation is disabled, skip everything entirely
  if (!hasAudioAttachment && serverConfig?.translateText === false) {
    return;
  }

  // Handle direct messages to bot
  if (isUserToBotDM(message)) {
    await handleDirectMessage(message);
    return;
  }

  // Ignore messages that don't have content
  if (!message.content) return;

  // Get channel for checking
  const channel = await message.client.channels.fetch(message.channelId);
  const inputChannel = await isInputChannel(channel, message);

  // Handle input channel messages
  if (inputChannel.isInputChannel) {
    await handleInputChannelMessage(message, inputChannel.projectSlug!);
    return;
  }

  // Handle regular translation messages
  const { translations, attachmentBuilders, referenceMessageId, referenceChannelId, silent } =
    await handleTranslationMessage(
      message,
      configuredLanguages,
      serverConfig?.saveToDatabase,
      serverConfig?.syncPrivateChannels,
    );

  // If silent mode (private channel), we stop here.
  // The message was saved to DB (if configured) in handleTranslationMessage.
  // We do NOT delete the original message, nor do we send an embed.
  if (silent) {
    return;
  }

  const userName = message.author?.globalName || message.author?.username;
  const userAvatar = message.author.displayAvatarURL({ extension: 'png', size: 128 });

  if (
    translations.detectedLanguage === 'english' &&
    configuredLanguages.includes(SupportedLanguages.EN) &&
    configuredLanguages.includes(SupportedLanguages.ORIGINAL) &&
    !configuredLanguages.includes(SupportedLanguages.UA)
  ) {
    configuredLanguages = [...configuredLanguages, SupportedLanguages.UA];
  }

  const { embeds, messages } = formatTranslations(translations, userName, userAvatar, configuredLanguages);

  // Delete the original message
  try {
    if (message.deletable) {
      await message.delete();
    }
  } catch (e) {
    console.error('Failed to delete message:', e);
  }

  // If the original message has attachments, send them
  if (attachmentBuilders.length > 0) {
    await (message.channel as GuildTextBasedChannel).send({ files: attachmentBuilders });
  }

  // Prepare options for the reply message
  const messageOptions: { reply?: { messageReference: string } } = {};
  if (referenceMessageId && referenceChannelId) {
    messageOptions.reply = { messageReference: referenceMessageId };
  }

  // Send the formatted message embed
  if (embeds) {
    for (const embed of embeds) {
      await (message.channel as GuildTextBasedChannel).send({ embeds: [embed], ...messageOptions });
    }
  }

  // If this message had a voice attachment — send it AFTER embeds
  if (voiceAttachment) {
    await (message.channel as GuildTextBasedChannel).send({
      content: '## **Original voice message:**',
      files: [voiceAttachment],
      ...messageOptions,
    });

    // If voice translation is disabled — send only transcription
    if (serverConfig?.translateVoice === false && transcriptionText) {
      const voiceContent = `## **Original voice message transcription:**\n${transcriptionText}`;
      await (message.channel as GuildTextBasedChannel).send({ content: voiceContent, ...messageOptions });
      return;
    }
  }

  // Send the formatted message regular text
  if (messages) {
    for (const msg of messages) {
      await (message.channel as GuildTextBasedChannel).send({ content: msg, ...messageOptions });
    }
  }
}
