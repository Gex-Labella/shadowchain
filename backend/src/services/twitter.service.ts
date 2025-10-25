/**
 * Twitter/X Service for fetching tweets
 */

import { TwitterApi } from 'twitter-api-v2';
import config from '../config';
import { fetcherLogger as logger } from '../utils/logger';

export interface TwitterContent {
  source: 'twitter';
  url: string;
  body: string;
  timestamp: number;
  raw_meta: {
    id: string;
    author_id: string;
    conversation_id?: string;
    in_reply_to_user_id?: string;
    referenced_tweets?: Array<{
      type: string;
      id: string;
    }>;
    attachments?: {
      media_keys?: string[];
      poll_ids?: string[];
    };
    public_metrics?: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
    };
  };
}

export class TwitterService {
  private client: TwitterApi;

  constructor() {
    this.client = new TwitterApi(config.twitterBearerToken);
  }

  /**
   * Fetch recent tweets for the configured user
   */
  async fetchRecentTweets(since?: Date): Promise<TwitterContent[]> {
    try {
      const tweets = await this.fetchUserTweets(config.twitterUserId, since);
      
      logger.info({ 
        userId: config.twitterUserId, 
        count: tweets.length 
      }, 'Fetched Twitter posts');
      
      return tweets;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch tweets');
      throw error;
    }
  }

  /**
   * Fetch tweets for a specific user
   */
  private async fetchUserTweets(userId: string, since?: Date): Promise<TwitterContent[]> {
    try {
      const queryParams: any = {
        max_results: Math.min(config.maxItemsPerSync, 100),
        'tweet.fields': [
          'id',
          'text',
          'author_id',
          'created_at',
          'conversation_id',
          'in_reply_to_user_id',
          'referenced_tweets',
          'attachments',
          'public_metrics'
        ].join(','),
        'media.fields': ['url', 'type', 'alt_text'].join(','),
        'user.fields': ['name', 'username'].join(','),
      };

      if (since) {
        queryParams.start_time = since.toISOString();
      }

      const response = await this.client.v2.userTimeline(userId, queryParams);
      const tweets: TwitterContent[] = [];

      for await (const tweet of response) {
        tweets.push(this.formatTweet(tweet));
      }

      return tweets;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch user tweets');
      throw error;
    }
  }

  /**
   * Format tweet data for storage
   */
  private formatTweet(tweet: any): TwitterContent {
    return {
      source: 'twitter',
      url: `https://twitter.com/i/web/status/${tweet.id}`,
      body: tweet.text,
      timestamp: new Date(tweet.created_at).getTime(),
      raw_meta: {
        id: tweet.id,
        author_id: tweet.author_id,
        conversation_id: tweet.conversation_id,
        in_reply_to_user_id: tweet.in_reply_to_user_id,
        referenced_tweets: tweet.referenced_tweets,
        attachments: tweet.attachments,
        public_metrics: tweet.public_metrics,
      },
    };
  }

  /**
   * Validate Twitter bearer token
   */
  async validateToken(): Promise<boolean> {
    try {
      // Test the token by making a simple API call
      await this.client.v2.me();
      logger.info('Twitter bearer token validated');
      return true;
    } catch (error) {
      logger.error({ error }, 'Twitter bearer token validation failed');
      return false;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<any> {
    try {
      const limits = await this.client.v2.getRateLimitStatus();
      return limits;
    } catch (error) {
      logger.error({ error }, 'Failed to get rate limit status');
      throw error;
    }
  }

  /**
   * Search tweets by query
   */
  async searchTweets(query: string, maxResults: number = 10): Promise<TwitterContent[]> {
    try {
      const response = await this.client.v2.search(query, {
        max_results: Math.min(maxResults, 100),
        'tweet.fields': [
          'id',
          'text',
          'author_id',
          'created_at',
          'public_metrics'
        ].join(','),
      });

      const tweets: TwitterContent[] = [];
      
      for await (const tweet of response) {
        tweets.push(this.formatTweet(tweet));
      }

      return tweets;
    } catch (error) {
      logger.error({ error, query }, 'Failed to search tweets');
      throw error;
    }
  }
}

// Export singleton instance
export const twitterService = new TwitterService();