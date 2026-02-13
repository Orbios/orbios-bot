import { Message } from 'discord.js';

import config from '../config.js';

type CachedMessage = {
  author: string;
  content: string;
  timestamp: number;
}

class MessageCache {
  private cache = new Map<string, CachedMessage[]>();
  private readonly maxMessagesPerChannel = config.translation.historyCount;
  private readonly maxChannels = 100; // Limit total channels to prevent memory issues
  private channelAccessOrder: string[] = []; // Track access order for LRU cleanup

  /**
   * Add a message to the cache before it gets deleted
   */
  addMessage(message: Message): void {
    const channelId = message.channelId;
    const userName = message.author?.globalName || message.author?.username;

    // Skip bot messages and empty content
    if (message.author.bot || !message.content.trim()) {
      return;
    }

    const cachedMessage: CachedMessage = {
      author: userName,
      content: message.content,
      timestamp: Date.now(),
    };

    // Get existing messages for this channel
    let channelMessages = this.cache.get(channelId) || [];

    // Add new message and keep only the last N messages
    channelMessages.push(cachedMessage);
    if (channelMessages.length > this.maxMessagesPerChannel) {
      channelMessages = channelMessages.slice(-this.maxMessagesPerChannel);
    }

    // Update cache
    this.cache.set(channelId, channelMessages);

    // Update access order for LRU
    this.updateChannelAccess(channelId);

    // Clean up if we have too many channels
    this.cleanupIfNeeded();
  }

  /**
   * Get message history for translation context
   */
  getMessageHistory(channelId: string, count: number = config.translation.historyCount): CachedMessage[] {
    const messages = this.cache.get(channelId) || [];
    this.updateChannelAccess(channelId);

    // Return the last N messages (oldest first for context)
    return messages.slice(-Math.min(count, messages.length));
  }

  /**
   * Update channel access order for LRU cleanup
   */
  private updateChannelAccess(channelId: string): void {
    // Remove from current position
    const index = this.channelAccessOrder.indexOf(channelId);
    if (index > -1) {
      this.channelAccessOrder.splice(index, 1);
    }

    // Add to end (most recent)
    this.channelAccessOrder.push(channelId);
  }

  /**
   * Clean up least recently used channels if we exceed the limit
   */
  private cleanupIfNeeded(): void {
    if (this.cache.size <= this.maxChannels) {
      return;
    }

    // Remove oldest 20% of channels to avoid frequent cleanup
    const channelsToRemove = Math.floor(this.maxChannels * 0.2);

    for (let i = 0; i < channelsToRemove && this.channelAccessOrder.length > 0; i++) {
      const oldestChannelId = this.channelAccessOrder.shift();
      if (oldestChannelId) {
        this.cache.delete(oldestChannelId);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): { channels: number; totalMessages: number; memoryUsageKB: number } {
    let totalMessages = 0;
    for (const messages of this.cache.values()) {
      totalMessages += messages.length;
    }

    // Rough memory estimation (each message ~200 bytes average)
    const memoryUsageKB = Math.round((totalMessages * 200) / 1024);

    return {
      channels: this.cache.size,
      totalMessages,
      memoryUsageKB,
    };
  }

  /**
   * Manual cleanup for maintenance
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [channelId, messages] of this.cache.entries()) {
      // Remove messages older than 24 hours
      const recentMessages = messages.filter(msg => now - msg.timestamp < maxAge);

      if (recentMessages.length === 0) {
        this.cache.delete(channelId);
        // Remove from access order
        const index = this.channelAccessOrder.indexOf(channelId);
        if (index > -1) {
          this.channelAccessOrder.splice(index, 1);
        }
      } else if (recentMessages.length !== messages.length) {
        this.cache.set(channelId, recentMessages);
      }
    }
  }
}

// Export singleton instance
export const messageCache = new MessageCache();

// Setup periodic cleanup (every 30 minutes)
setInterval(
  () => {
    messageCache.cleanup();
  },
  30 * 60 * 1000,
);
