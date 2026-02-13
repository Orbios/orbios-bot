import { REST, Routes } from 'discord.js';

import { askCommand } from './commands/ask.js';
import { cacheStatsCommand } from './commands/cacheStats.js';
import { callCommand } from './commands/call.js';
import { setupCommand } from './commands/setup.js';
import config from './config.js';

const commands = [
  callCommand.data.toJSON(),
  cacheStatsCommand.data.toJSON(),
  askCommand.data.toJSON(),
  setupCommand.data.toJSON(),
];

const rest = new REST().setToken(config.disord.token);

// Deploy commands to your server
(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(config.disord.appId), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
