module.exports = {
  apps: [
    {
      name: "tf-bot-prod",
      script: "dist/app.js",
      cwd: "/var/www/discord-bots/team-fusion/apps/bot",
      env: {
        NODE_ENV: "production",
        NODE_PATH: ".",
        ENV_FILE: "/var/www/discord-bots/team-fusion/apps/bot/.env.prod"
      },
      env_file: "/var/www/discord-bots/team-fusion/apps/bot/.env.prod"
    },
    {
      name: "tf-bot-dev",
      script: "dist/app.js",
      cwd: "/var/www/discord-bots/team-fusion/apps/bot",
      env: {
        NODE_ENV: "development",
        NODE_PATH: ".",
        ENV_FILE: "/var/www/discord-bots/team-fusion/apps/bot/.env.dev"
      },
      env_file: "/var/www/discord-bots/team-fusion/apps/bot/.env.dev"
    }
  ]
};
