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

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  pushed_at: string;
  default_branch: string;
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
  async getUserRepositories(accessToken: string, page: number = 1, perPage: number = 20): Promise<GitHubRepository[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/user/repos`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params: {
            per_page: perPage,
            page: page,
            sort: 'pushed',
            direction: 'desc',
            type: 'all',
          },
        }
      );
      
      logger.info({ count: response.data.length, page }, 'Fetched user repositories');
      return response.data;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user repositories');
      throw error;
    }
  }

  /**
   * Get commits for a specific repository using OAuth token
   */
  async getRepositoryCommits(
    accessToken: string,
    repoFullName: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<GitHubCommit[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/repos/${repoFullName}/commits`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params: {
            per_page: perPage,
            page: page,
          },
        }
      );
      
      logger.info({ count: response.data.length, repo: repoFullName, page }, 'Fetched repository commits');
      return response.data;
    } catch (error) {
      logger.error({ error, repoFullName }, 'Failed to fetch repository commits');
      throw error;
    }
  }

  /**
   * Get formatted commit content for a specific commit
   */
  async getFormattedCommit(
    accessToken: string,
    repoFullName: string,
    commitSha: string
  ): Promise<GitHubContent> {
    try {
      const detailed = await this.fetchCommitDetailsWithToken(
        repoFullName,
        commitSha,
        accessToken
      );
      return this.formatCommit(detailed);
    } catch (error) {
      logger.error({ error, repoFullName, commitSha }, 'Failed to get formatted commit');
      throw error;
    }
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

      // Process commits - the list endpoint already has most info we need
      for (const commit of commits) {
        try {
          // Try to get detailed info, but use list data as fallback
          const detailed = await this.fetchCommitDetailsWithToken(
            repo,
            commit.sha,
            accessToken
          );
          const merged = { ...commit, ...detailed };
          detailedCommits.push(this.formatCommit(merged));
        } catch (error) {
          logger.error({ error, sha: commit.sha }, 'Failed to fetch commit details');
          // Still try to format with the data we have
          detailedCommits.push(this.formatCommit(commit));
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
  ): Promise<any> {
    try {
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
    } catch (error) {
      // If detailed fetch fails, return minimal data
      logger.debug({ error, sha }, 'Failed to fetch detailed commit info, using minimal data');
      return { sha };
    }
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

      // Process commits - the list endpoint already has most info we need
      for (const commit of commits) {
        try {
          // Try to get detailed info, but use list data as fallback
          const detailed = await this.fetchCommitDetails(repo, commit.sha);
          const merged = { ...commit, ...detailed };
          detailedCommits.push(this.formatCommit(merged));
        } catch (error) {
          logger.error({ error, sha: commit.sha }, 'Failed to fetch commit details');
          // Still try to format with the data we have
          detailedCommits.push(this.formatCommit(commit));
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
  private async fetchCommitDetails(repo: string, sha: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/repos/${repo}/commits/${sha}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      // If detailed fetch fails, return minimal data
      logger.debug({ error, sha }, 'Failed to fetch detailed commit info, using minimal data');
      return { sha };
    }
  }

  /**
   * Format commit data for storage
   */
  private formatCommit(commit: any): GitHubContent {
    // Handle different API response formats
    const commitData = commit.commit || commit;
    const message = commitData.message || 'No commit message';
    const author = commitData.author || {};
    const authorName = author.name || 'Unknown';
    const authorEmail = author.email || 'unknown@example.com';
    const authorDate = author.date || new Date().toISOString();
    const files = commit.files || [];
    const additions = commit.stats?.additions || 0;
    const deletions = commit.stats?.deletions || 0;

    return {
      source: 'github',
      url: commit.html_url || commit.url || `https://github.com/commit/${commit.sha}`,
      body: `Commit: ${message}\n\nFiles changed: ${files.length}\n+${additions} -${deletions}`,
      timestamp: new Date(authorDate).getTime(),
      raw_meta: {
        sha: commit.sha,
        author: authorName,
        email: authorEmail,
        additions: additions,
        deletions: deletions,
        filesChanged: files.length,
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