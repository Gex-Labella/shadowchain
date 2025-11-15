import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWalletStore } from '../store/wallet';
import { submitShadowItemTransaction } from '../services/transactions';

interface GitHubRepository {
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

interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  content: any;
  contentSize: number;
}

export const RepositoryList: React.FC = () => {
  const { selectedAccount } = useWalletStore();
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [selectedCommits, setSelectedCommits] = useState<GitHubCommit[]>([]);
  const [syncingRepos, setSyncingRepos] = useState<Set<string>>(new Set());
  const [signingCommit, setSigningCommit] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const reposPerPage = 6;

  // Fetch repositories
  const { data: repositories, isLoading: reposLoading, error: reposError } = useQuery({
    queryKey: ['repositories', selectedAccount?.address],
    queryFn: async () => {
      if (!selectedAccount) return [];
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      
      try {
        const response = await axios.get(
          `${baseUrl}/api/shadow/github/repositories/${selectedAccount.address}`
        );
        return response.data.repositories as GitHubRepository[];
      } catch (error: any) {
        if (error.response?.status === 401) {
          throw new Error('Please connect your GitHub account first');
        }
        throw error;
      }
    },
    enabled: !!selectedAccount,
  });

  // Fetch commits for a repository
  const fetchCommits = async (repoFullName: string) => {
    if (!selectedAccount) return;

    const syncingSet = new Set(syncingRepos);
    syncingSet.add(repoFullName);
    setSyncingRepos(syncingSet);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      
      const response = await axios.get(
        `${baseUrl}/api/shadow/github/repositories/${encodeURIComponent(repoFullName)}/commits`,
        {
          params: {
            userAddress: selectedAccount.address,
            perPage: 5 // Show last 5 commits
          }
        }
      );

      const commits = response.data.commits as GitHubCommit[];
      
      if (commits.length === 0) {
        toast.info('No commits found in this repository');
      } else {
        setSelectedRepo(repoFullName);
        setSelectedCommits(commits);
        setShowCommitModal(true);
      }
    } catch (error: any) {
      console.error('Failed to fetch commits:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch commits');
    } finally {
      const syncingSet = new Set(syncingRepos);
      syncingSet.delete(repoFullName);
      setSyncingRepos(syncingSet);
    }
  };

  // Submit a single commit
  const submitCommit = async (commit: GitHubCommit) => {
    if (!selectedAccount || !selectedRepo) return;

    setSigningCommit(commit.sha);
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      
      // First prepare the transaction
      const prepareResponse = await axios.post(
        `${baseUrl}/api/shadow/github/submit-commit`,
        {
          userAddress: selectedAccount.address,
          repoFullName: selectedRepo,
          commitSha: commit.sha
        }
      );

      // Then sign with user's wallet
      await submitShadowItemTransaction(prepareResponse.data.transaction);

      toast.success('Commit submitted successfully!');
      
      // Remove submitted commit from list
      setSelectedCommits(prev => prev.filter(c => c.sha !== commit.sha));
      
      if (selectedCommits.length === 1) {
        setShowCommitModal(false);
      }
    } catch (error: any) {
      console.error('Failed to submit commit:', error);
      toast.error(error.message || 'Failed to submit commit');
    } finally {
      setSigningCommit(null);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  // Pagination logic
  const totalPages = Math.ceil((repositories?.length || 0) / reposPerPage);
  const paginatedRepos = repositories?.slice(
    (currentPage - 1) * reposPerPage,
    currentPage * reposPerPage
  );

  if (reposError) {
    return (
      <div className="shadow-card" style={{
        textAlign: 'center',
        padding: '2rem',
        border: '1px solid var(--error-crimson)'
      }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--error-crimson)',
          marginBottom: '1rem'
        }}>
          {(reposError as Error).message}
        </p>
        <a
          href={`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/auth/github?userAddress=${selectedAccount?.address}`}
          className="btn-neon"
          style={{ padding: '0.5rem 1.5rem' }}
        >
          Connect GitHub
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Repository List */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            color: 'var(--ghost-white)',
            letterSpacing: '0.05em'
          }}>
            GITHUB REPOSITORIES
          </h2>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--neon-violet)',
            padding: '0.25rem 0.75rem',
            border: '1px solid var(--neon-violet)',
            borderRadius: 'var(--radius-sharp)'
          }}>
            {repositories?.length || 0} REPOS
          </span>
        </div>

        {reposLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-dots" style={{ justifyContent: 'center' }}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--neon-violet)',
              fontSize: '0.875rem',
              marginTop: '1rem'
            }}>
              LOADING REPOSITORIES...
            </p>
          </div>
        ) : repositories && repositories.length > 0 ? (
          <>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {paginatedRepos?.map((repo) => (
                <div
                  key={repo.id}
                  className="shadow-card"
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    borderLeft: '4px solid var(--neon-violet)'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '0.5rem'
                    }}>
                      <h3 style={{
                        fontFamily: 'var(--font-tech)',
                        fontSize: '1rem',
                        color: 'var(--ghost-white)',
                        margin: 0
                      }}>
                        {repo.name}
                      </h3>
                      {repo.language && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: 'var(--neon-cyan)',
                          padding: '0.125rem 0.5rem',
                          border: '1px solid var(--neon-cyan)',
                          borderRadius: 'var(--radius-sharp)'
                        }}>
                          {repo.language}
                        </span>
                      )}
                      {repo.private && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: 'var(--warning-amber)',
                          padding: '0.125rem 0.5rem',
                          border: '1px solid var(--warning-amber)',
                          borderRadius: 'var(--radius-sharp)'
                        }}>
                          PRIVATE
                        </span>
                      )}
                    </div>
                    
                    {repo.description && (
                      <p style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.813rem',
                        color: 'var(--static-gray)',
                        margin: '0.5rem 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {repo.description}
                      </p>
                    )}
                    
                    <div style={{
                      display: 'flex',
                      gap: '1.5rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--static-gray)'
                    }}>
                      <span>⭐ {repo.stargazers_count}</span>
                      <span>Updated {formatDate(repo.pushed_at)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => fetchCommits(repo.full_name)}
                    disabled={syncingRepos.has(repo.full_name) || repo.private}
                    className="btn-neon"
                    style={{
                      padding: '0.5rem 1rem',
                      minWidth: '120px',
                      opacity: repo.private ? 0.5 : 1,
                      cursor: repo.private ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {syncingRepos.has(repo.full_name) ? (
                      <div className="loading-dots" style={{ scale: '0.7' }}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <span>{repo.private ? 'PRIVATE' : 'SYNC COMMITS'}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '2rem'
              }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn-shadow"
                  style={{
                    padding: '0.5rem 1rem',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  ← PREV
                </button>
                
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  color: 'var(--ghost-white)',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {currentPage} / {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-shadow"
                  style={{
                    padding: '0.5rem 1rem',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  NEXT →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="shadow-card" style={{
            textAlign: 'center',
            padding: '3rem'
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              color: 'var(--static-gray)'
            }}>
              No repositories found
            </p>
          </div>
        )}
      </div>

      {/* Commit Preview Modal */}
      {showCommitModal && selectedCommits.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 9, 8, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div className="shadow-card" style={{
            maxWidth: '800px',
            width: '90%',
            padding: '2rem',
            border: '2px solid var(--neon-violet)',
            position: 'relative',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <button
              onClick={() => setShowCommitModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--error-crimson)',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              color: 'var(--ghost-white)',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              COMMIT PREVIEW
            </h3>
            
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              color: 'var(--neon-violet)',
              textAlign: 'center',
              marginBottom: '2rem'
            }}>
              {selectedRepo}
            </p>

            <div style={{
              background: 'var(--shadow-void)',
              border: '1px solid var(--warning-amber)',
              borderRadius: 'var(--radius-sharp)',
              padding: '1rem',
              marginBottom: '2rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.813rem'
            }}>
              <div style={{ color: 'var(--warning-amber)' }}>
                ⚠ Each commit will be stored permanently on the blockchain
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {selectedCommits.map((commit) => (
                <div
                  key={commit.sha}
                  className="shadow-card"
                  style={{
                    padding: '1.5rem',
                    border: '1px solid var(--shadow-steel)',
                    position: 'relative'
                  }}
                >
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.813rem',
                      color: 'var(--neon-cyan)',
                      marginBottom: '0.5rem'
                    }}>
                      SHA: {commit.sha.substring(0, 8)}
                    </div>
                    <h4 style={{
                      fontFamily: 'var(--font-tech)',
                      fontSize: '1rem',
                      color: 'var(--ghost-white)',
                      margin: '0.5rem 0'
                    }}>
                      {commit.message}
                    </h4>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--static-gray)'
                    }}>
                      {commit.author.name} • {formatDate(commit.author.date)}
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--shadow-void)',
                    border: '1px solid var(--shadow-steel)',
                    borderRadius: 'var(--radius-sharp)',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--static-gray)'
                  }}>
                    Size: {commit.contentSize} bytes
                  </div>

                  <button
                    onClick={() => submitCommit(commit)}
                    disabled={signingCommit === commit.sha}
                    className="btn-neon"
                    style={{
                      width: '100%',
                      padding: '0.75rem'
                    }}
                  >
                    {signingCommit === commit.sha ? (
                      <div className="loading-dots" style={{ justifyContent: 'center' }}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <span>SIGN & SUBMIT</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};