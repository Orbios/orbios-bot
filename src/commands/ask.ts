import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

import { askQuestion } from '../services/apiService.js';

const ASK_COMMAND_NAME = 'ask';
const OPTION_NAME_QUESTION = 'question';

export const askCommand = {
  data: new SlashCommandBuilder()
    .setName(ASK_COMMAND_NAME)
    .setDescription('Ask a question to the AI agent')
    .addStringOption(option => option.setName(OPTION_NAME_QUESTION).setDescription('Your question').setRequired(true)),

  async execute(interaction: CommandInteraction) {
    try {
      await interaction.deferReply();

      const question = interaction.options.get(OPTION_NAME_QUESTION)?.value as string;
      const user = interaction.user.username;
      const channelId = interaction.channel?.id || 'unknown';

      const response = await askQuestion(question, user, channelId);

      await interaction.editReply({
        content: `**Question:** ${question}\n\n**Answer:** ${response.answer}`,
      });
    } catch (error) {
      console.error('Ask command error:', error);

      await interaction.editReply({
        content: 'Sorry, there was an error processing your question. Please try again later.',
      });
    }
  },
};
