/**
 * GitHub Service for fetching commits
 */

import axios from 'axios';
import config from '../config';
import { fetcherLogger as logger } from '../utils/logger';

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
  additions: number;
  deletions: number;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

export interface GitHubContent {
  source: 'github';
  url: string;
  body: string;
  timestamp: number;
  raw_meta: {
    sha: string;
    author: string;
    email: string;
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

export class GitHubService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly headers: Record<string, string>;

  constructor() {
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${config.githubToken}`,
      'User-Agent': 'ShadowChain/1.0',
    };
  }

  /**
   * Fetch recent commits for configured repositories (legacy centralized approach)
   */
  async fetchRecentCommits(since?: Date): Promise<GitHubContent[]> {
    const allCommits: GitHubContent[] = [];

    for (const repo of config.githubRepos) {
      try {
        const commits = await this.fetchRepoCommits(repo, since);
        allCommits.push(...commits);
      } catch (error) {
        logger.error({ error, repo }, 'Failed to fetch commits for repo');
      }
    }

    return allCommits;
  }

  /**
   * Fetch recent commits using user's OAuth token
   */
  async fetchRecentCommitsWithToken(accessToken: string, since?: Date): Promise<GitHubContent[]> {
    const allCommits: GitHubContent[] = [];

    try {
      // First, get user's repositories
      const repos = await this.getUserRepositories(accessToken);
      
      // Then fetch commits from each repo
      for (const repo of repos) {
        try {
          const commits = await this.fetchRepoCommitsWithToken(
            repo.full_name,
            accessToken,
            since
          );
          allCommits.push(...commits);
        } catch (error) {
          logger.error({ error, repo: repo.full_name }, 'Failed to fetch commits for repo');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user repositories');
    }

    return allCommits;
  }

  /**
   * Get user's repositories using OAuth token
   */
  private async getUserRepositories(accessToken: string): Promise<any[]> {
    const response = await axios.get(
      `${this.baseUrl}/user/repos`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          per_page: 30,
          sort: 'pushed',
          direction: 'desc',
        },
      }
    );
    return response.data;
  }

  /**
   * Fetch commits for a specific repository using OAuth token
   */
  private async fetchRepoCommitsWithToken(
    repo: string,
    accessToken: string,
    since?: Date
  ): Promise<GitHubContent[]> {
    try {
      const params: any = {
        per_page: Math.min(config.maxItemsPerSync, 30),
      };

      if (since) {
        params.since = since.toISOString();
      }

      const response = await axios.get(
        `${this.baseUrl}/repos/${repo}/commits`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params,
        }
      );

      const commits: GitHubCommit[] = response.data;
      const detailedCommits: GitHubContent[] = [];

      // Fetch detailed information for each commit
      for (const commit of commits) {
        try {
          const detailed = await this.fetchCommitDetailsWithToken(
            repo,
            commit.sha,
            accessToken
          );
          detailedCommits.push(this.formatCommit(detailed));
        } catch (error) {
          logger.error({ error, sha: commit.sha }, 'Failed to fetch commit details');
        }
      }

      logger.info({ repo, count: detailedCommits.length }, 'Fetched GitHub commits with OAuth token');
      return detailedCommits;
    } catch (error) {
      logger.error({ error, repo }, 'Failed to fetch repo commits with token');
      throw error;
    }
  }

  /**
   * Fetch detailed information for a specific commit using OAuth token
   */
  private async fetchCommitDetailsWithToken(
    repo: string,
    sha: string,
    accessToken: string
  ): Promise<GitHubCommit> {
    const response = await axios.get(
      `${this.baseUrl}/repos/${repo}/commits/${sha}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    return response.data;
  }

  /**
   * Fetch commits for a specific repository
   */
  private async fetchRepoCommits(repo: string, since?: Date): Promise<GitHubContent[]> {
    try {
      const params: any = {
        per_page: Math.min(config.maxItemsPerSync, 100),
      };

      if (since) {
        params.since = since.toISOString();
      }

      const response = await axios.get(
        `${this.baseUrl}/repos/${repo}/commits`,
        {
          headers: this.headers,
          params,
        }
      );

      const commits: GitHubCommit[] = response.data;
      const detailedCommits: GitHubContent[] = [];

      // Fetch detailed information for each commit
      for (const commit of commits) {
        try {
          const detailed = await this.fetchCommitDetails(repo, commit.sha);
          detailedCommits.push(this.formatCommit(detailed));
        } catch (error) {
          logger.error({ error, sha: commit.sha }, 'Failed to fetch commit details');
        }
      }

      logger.info({ repo, count: detailedCommits.length }, 'Fetched GitHub commits');
      return detailedCommits;
    } catch (error) {
      logger.error({ error, repo }, 'Failed to fetch repo commits');
      throw error;
    }
  }

  /**
   * Fetch detailed information for a specific commit
   */
  private async fetchCommitDetails(repo: string, sha: string): Promise<GitHubCommit> {
    const response = await axios.get(
      `${this.baseUrl}/repos/${repo}/commits/${sha}`,
      { headers: this.headers }
    );

    return response.data;
  }

  /**
   * Format commit data for storage
   */
  private formatCommit(commit: GitHubCommit): GitHubContent {
    return {
      source: 'github',
      url: commit.url,
      body: `Commit: ${commit.message}\n\nFiles changed: ${commit.files.length}\n+${commit.additions} -${commit.deletions}`,
      timestamp: new Date(commit.author.date).getTime(),
      raw_meta: {
        sha: commit.sha,
        author: commit.author.name,
        email: commit.author.email,
        additions: commit.additions,
        deletions: commit.deletions,
        filesChanged: commit.files.length,
      },
    };
  }

  /**
   * Validate GitHub token
   */
  async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: this.headers,
      });
      
      logger.info({ user: response.data.login }, 'GitHub token validated');
      return true;
    } catch (error) {
      logger.error({ error }, 'GitHub token validation failed');
      return false;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/rate_limit`, {
        headers: this.headers,
      });
      
      return response.data.rate;
    } catch (error) {
      logger.error({ error }, 'Failed to get rate limit status');
      throw error;
    }
  }
}

// Export singleton instance
export const githubService = new GitHubService();