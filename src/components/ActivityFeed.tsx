import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useWalletStore } from '../store/wallet';

interface ActivityItem {
  id: string;
  source: 'github' | 'twitter' | 'blockchain';
  type: 'commit' | 'pr' | 'issue' | 'tweet' | 'retweet' | 'transaction';
  content: string;
  url?: string;
  author: string;
  timestamp: number;
  metadata?: any;
  onChain?: boolean;
  encrypted?: boolean;
}

interface ActivityFeedProps {
  limit?: number;
  showFilters?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ 
  limit = 20, 
  showFilters = true 
}) => {
  const { selectedAccount } = useWalletStore();
  const [activeFilter, setActiveFilter] = useState<'all' | 'github' | 'twitter' | 'blockchain'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch activity from all sources
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ['activity-feed', selectedAccount?.address],
    queryFn: async () => {
      if (!selectedAccount) return [];
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      
      try {
        // In a real implementation, this would be a unified endpoint
        const [githubRes, twitterRes, blockchainRes] = await Promise.allSettled([
          axios.get(`${baseUrl}/api/shadow/github/activity/${selectedAccount.address}`),
          axios.get(`${baseUrl}/api/shadow/twitter/activity/${selectedAccount.address}`),
          axios.get(`${baseUrl}/api/shadow/items/${selectedAccount.address}/blockchain`)
        ]);

        const activities: ActivityItem[] = [];
        
        // Process GitHub activities
        if (githubRes.status === 'fulfilled' && githubRes.value.data) {
          activities.push(...githubRes.value.data.map((item: any) => ({
            id: item.id,
            source: 'github' as const,
            type: item.type || 'commit',
            content: item.message || item.title,
            url: item.url,
            author: item.author?.name || 'Unknown',
            timestamp: new Date(item.created_at).getTime(),
            metadata: item,
            onChain: false,
            encrypted: false
          })));
        }

        // Process Twitter activities
        if (twitterRes.status === 'fulfilled' && twitterRes.value.data) {
          activities.push(...twitterRes.value.data.map((item: any) => ({
            id: item.id,
            source: 'twitter' as const,
            type: item.type || 'tweet',
            content: item.text,
            url: item.url,
            author: item.author?.username || 'Unknown',
            timestamp: new Date(item.created_at).getTime(),
            metadata: item,
            onChain: false,
            encrypted: false
          })));
        }

        // Process blockchain items
        if (blockchainRes.status === 'fulfilled' && blockchainRes.value.data?.items) {
          activities.push(...blockchainRes.value.data.items.map((item: any) => ({
            id: item.id,
            source: 'blockchain' as const,
            type: 'transaction',
            content: item.content,
            url: item.metadata?.url,
            author: selectedAccount.address,
            timestamp: item.timestamp,
            metadata: item,
            onChain: true,
            encrypted: true
          })));
        }

        // Sort by timestamp (newest first)
        return activities.sort((a, b) => b.timestamp - a.timestamp);
      } catch (error) {
        console.error('Failed to fetch activity feed:', error);
        return [];
      }
    },
    enabled: !!selectedAccount,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter and search activities
  const filteredActivities = useMemo(() => {
    let filtered = activities || [];
    
    // Apply source filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(item => item.source === activeFilter);
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.content.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query)
      );
    }
    
    // Apply limit
    if (limit) {
      filtered = filtered.slice(0, limit);
    }
    
    return filtered;
  }, [activities, activeFilter, searchQuery, limit]);

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  // Get source icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'github':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 14.002-7.496 14.002-13.986 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
        );
      case 'blockchain':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  // Get activity type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'commit':
        return '⚡';
      case 'pr':
        return '🔀';
      case 'issue':
        return '📝';
      case 'tweet':
        return '💬';
      case 'retweet':
        return '🔄';
      case 'transaction':
        return '🔗';
      default:
        return '📌';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="bg-glass-dark backdrop-blur-xl border border-glass-light rounded-smooth p-4 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-glass-white border border-glass-light rounded-sharp text-white placeholder-gray-400 focus:outline-none focus:border-dot-primary transition-colors"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {['all', 'github', 'twitter', 'blockchain'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter as any)}
                className={`px-4 py-1.5 rounded-pill text-xs font-mono transition-all duration-200 ${
                  activeFilter === filter
                    ? 'bg-dot-primary text-white shadow-glow-sm'
                    : 'bg-glass-white text-gray-300 hover:bg-glass-medium hover:text-white'
                }`}
              >
                {filter.toUpperCase()}
                {filter !== 'all' && (
                  <span className="ml-2 opacity-60">
                    {filteredActivities.filter(a => a.source === filter).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-glass-light rounded-full animate-spin border-t-dot-primary" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-glass-light rounded-full animate-spin-slow border-t-dot-accent opacity-30" />
          </div>
          <p className="mt-4 text-sm text-gray-400 font-mono">Loading activity...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-glass-dark backdrop-blur-xl border border-trust-error rounded-smooth p-6 text-center">
          <p className="text-trust-error mb-2">Failed to load activities</p>
          <p className="text-xs text-gray-400">Please check your connection and try again</p>
        </div>
      )}

      {/* Activity Items */}
      {!isLoading && !error && filteredActivities.length > 0 && (
        <div className="space-y-3">
          {filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="group bg-glass-dark backdrop-blur-xl border border-glass-light rounded-smooth p-4 hover:border-dot-primary/50 transition-all duration-300 hover:shadow-glow-sm animate-slide-up"
              style={{ animationDelay: `${Math.random() * 0.2}s` }}
            >
              <div className="flex items-start gap-4">
                {/* Source Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-source-${activity.source}/20 text-source-${activity.source}`}>
                  {getSourceIcon(activity.source)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getTypeIcon(activity.type)}</span>
                    <span className="text-xs font-mono text-gray-400">
                      {activity.author}
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                    {activity.onChain && (
                      <>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-trust-verified font-mono">ON-CHAIN</span>
                      </>
                    )}
                    {activity.encrypted && (
                      <svg className="w-3 h-3 text-trust-encrypted" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-sm text-white/90 mb-2 line-clamp-2">
                    {activity.content}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {activity.url && (
                      <a
                        href={activity.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-dot-accent hover:text-dot-primary transition-colors"
                      >
                        View Source →
                      </a>
                    )}
                    {!activity.onChain && (
                      <button className="text-xs text-gray-400 hover:text-white transition-colors">
                        Submit to Chain
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.onChain ? 'bg-trust-verified' : 'bg-trust-pending'
                  } animate-pulse`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredActivities.length === 0 && (
        <div className="bg-glass-dark backdrop-blur-xl border border-glass-light rounded-smooth p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-shadow-100 to-shadow-200 flex items-center justify-center">
            <span className="text-3xl">🌌</span>
          </div>
          <h3 className="text-lg font-display text-white mb-2">No Activity Yet</h3>
          <p className="text-sm text-gray-400 mb-4">
            Connect your Web2 accounts to start building your digital shadow
          </p>
          <button className="px-6 py-2 bg-dot-primary text-white rounded-sharp hover:bg-dot-accent transition-colors shadow-glow-sm">
            Connect Accounts
          </button>
        </div>
      )}

      {/* Load More */}
      {!isLoading && filteredActivities.length >= limit && (
        <div className="text-center">
          <button className="px-6 py-2 bg-glass-white text-gray-300 rounded-sharp hover:bg-glass-medium hover:text-white transition-all duration-200 hover:shadow-glow-sm">
            Load More Activities
          </button>
        </div>
      )}
    </div>
  );
};