import { SlashCommandBuilder, CommandInteraction, InteractionReplyOptions, MessageFlags } from 'discord.js';

import config from '../config.js';

export const callCommand = {
  data: new SlashCommandBuilder().setName('call').setDescription('Create a video call link'),

  async execute(interaction: CommandInteraction) {
    const response: InteractionReplyOptions = {
      content: `🎥 Open video call link available to all server members:\n${config.googleMeet.permanentLink}\n\nFeel free to join anytime!`,
      flags: [MessageFlags.SuppressNotifications], // Empty array for all users
    };

    await interaction.reply(response);
  },
};
