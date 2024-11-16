import {Client, EmbedBuilder, Snowflake, TextChannel} from "discord.js";
import Configuration from "./Configuration";
import ServerStatusFeed from "./ServerStatusFeed";
import {Logger} from "winston";
import Logging from "./Logging";

export default class DiscordEmbed {
    private appLogger: Logger;
    private discordAppClient: Client;
    private appConfiguration: Configuration;
    private serverStatsFeed: ServerStatusFeed;
    private firstMessageId: Snowflake | null = null;

    public constructor(discordAppClient: Client) {
        this.appLogger = Logging.getLogger();
        this.discordAppClient = discordAppClient;
        this.appConfiguration = new Configuration();
        this.serverStatsFeed = new ServerStatusFeed();

        (async () => {
            // Delete all messages in the channel
            await this.deleteAllMessages();
            // Start the update loop, which updates the discord embed every x seconds itself
            await this.updateDiscordEmbed();
        })();
    }

    /**
     * Update the discord embed with the server status, player list and server time
     * This method is called every x seconds to update the discord embed.
     * @private
     */
    private async updateDiscordEmbed(): Promise<void> {
        try {
            await this.serverStatsFeed.updateServerFeed();
            if(this.serverStatsFeed.isFetching()) {
                this.appLogger.info('Server status feed is still fetching, try again...');
                setTimeout(() => {
                    this.updateDiscordEmbed();
                }, 1000);
                return;
            }
            this.discordAppClient.channels.fetch(this.appConfiguration.discord.channelId as Snowflake).then(async channel => {
                this.generateEmbedFromStatusFeed(this.serverStatsFeed).then(embedMessage => {
                    if (this.firstMessageId !== null) {
                        (channel as TextChannel).messages.fetch(this.firstMessageId).then(message => {
                            message.edit({embeds: [embedMessage]});
                        });
                    } else {
                        (channel as TextChannel).send({embeds: [embedMessage]}).then(message => {
                            this.firstMessageId = message.id;
                        })
                    }
                });
            });
        } catch (exception) {
            this.appLogger.error(exception);
        }

        setTimeout(() => {
            this.updateDiscordEmbed();
        }, this.appConfiguration.application.updateIntervalSeconds * 1000);
    }

    /**
     * Delete all messages in a text channel to clear the channel
     * @private
     */
    private async deleteAllMessages(): Promise<boolean> {
        let textChannel = this.discordAppClient.channels.cache.get(this.appConfiguration.discord.channelId as Snowflake) as TextChannel;
        this.appLogger.info(`Deleting all messages in discord text channel ${textChannel.id}`);
        textChannel.messages.fetch().then(messages => {
            messages.forEach(message => {
                message.delete();
            });
        });
        return true;
    }

    /**
     * Send server stats embed in a channel
     * @param serverStats
     */
    private async generateEmbedFromStatusFeed(serverStats: ServerStatusFeed): Promise<EmbedBuilder> {
        let embed = new EmbedBuilder();
        let config = this.appConfiguration;

        embed.setTitle(config.translation.discordEmbed.title);
        if (!serverStats.isOnline()) {
            embed.setDescription(config.translation.discordEmbed.descriptionOffline);
        } else if (serverStats.isFetching()) {
            embed.setDescription(config.translation.discordEmbed.descriptionUnknown);
        } else {
            embed.setDescription(config.translation.discordEmbed.descriptionOnline);
            embed.setTimestamp(new Date());
            embed.setThumbnail(config.application.serverMapUrl);

            let playerListString: string = '';
            if(serverStats.getPlayerList().length === 0) {
                playerListString = config.translation.discordEmbed.noPlayersOnline;
            } else {
                playerListString = serverStats.getPlayerList().map(p => p.username).join(', ');
            }

            // @ts-ignore
            embed.addFields(
                {name: config.translation.discordEmbed.titleServerName, value: serverStats.getServerName()},
                {name: config.translation.discordEmbed.titleServerPassword, value: config.application.serverPassword},
                {name: config.translation.discordEmbed.titleServerTime, value: serverStats.getServerTime()},
                {
                    name: `${config.translation.discordEmbed.titlePlayerCount} (${serverStats.getPlayerCount()}/${serverStats.getMaxPlayerCount()}):`,
                    value: playerListString
                },
            );
        }
        this.appLogger.debug(embed);
        return embed;
    }
}