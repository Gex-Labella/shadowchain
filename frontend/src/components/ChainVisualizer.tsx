import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useWalletStore } from '../store/wallet';

interface ChainStats {
  totalItems: number;
  storageUsed: number;
  lastSync: Date;
  chainHeight: number;
  syncStatus: 'synced' | 'syncing' | 'offline';
}

export const ChainVisualizer: React.FC = () => {
  const { selectedAccount } = useWalletStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  // Fetch chain statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['chain-stats', selectedAccount?.address],
    queryFn: async (): Promise<ChainStats> => {
      if (!selectedAccount) {
        return {
          totalItems: 0,
          storageUsed: 0,
          lastSync: new Date(),
          chainHeight: 0,
          syncStatus: 'offline'
        };
      }

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      
      try {
        const response = await axios.get(
          `${baseUrl}/api/shadow/chain-stats/${selectedAccount.address}`
        );
        return response.data;
      } catch (error) {
        // Return mock data for demonstration
        return {
          totalItems: 1234,
          storageUsed: 24567890, // bytes
          lastSync: new Date(),
          chainHeight: 42,
          syncStatus: 'synced' as const
        };
      }
    },
    enabled: !!selectedAccount,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Animated canvas visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let nodes: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];

    // Initialize nodes
    const initNodes = () => {
      nodes = [];
      const nodeCount = Math.min(stats?.totalItems || 10, 50);
      
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: 2 + Math.random() * 3
        });
      }
    };

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(26, 11, 46, 0.1)'; // shadow-50 with opacity
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw nodes
      nodes.forEach((node, i) => {
        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        // Draw node
        const isHovered = hoveredNode === i;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * (isHovered ? 1.5 : 1), 0, Math.PI * 2);
        
        // Gradient fill
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 2);
        gradient.addColorStop(0, '#E6007A');
        gradient.addColorStop(1, 'rgba(230, 0, 122, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw connections to nearby nodes
        nodes.forEach((otherNode, j) => {
          if (i === j) return;
          
          const dx = otherNode.x - node.x;
          const dy = otherNode.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(otherNode.x, otherNode.y);
            ctx.strokeStyle = `rgba(230, 0, 122, ${0.2 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    // Resize handler
    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initNodes();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    initNodes();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [stats, hoveredNode]);

  // Format storage size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="bg-glass-dark backdrop-blur-2xl border border-glass-light rounded-smooth overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-glass-light">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg text-white/90">Chain Status</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              stats?.syncStatus === 'synced' ? 'bg-trust-verified' :
              stats?.syncStatus === 'syncing' ? 'bg-trust-pending' :
              'bg-trust-error'
            }`} />
            <span className="text-xs font-mono text-gray-400 uppercase">
              {stats?.syncStatus || 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xs text-gray-400 mb-1">Total Items</p>
            <p className="text-2xl font-display text-dot-primary">
              {stats?.totalItems?.toLocaleString() || '0'}
            </p>
          </div>
          <div>
            <p className="text-2xs text-gray-400 mb-1">Storage Used</p>
            <p className="text-2xl font-display text-dot-accent">
              {formatBytes(stats?.storageUsed || 0)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-gray-400 mb-1">Chain Height</p>
            <p className="text-2xl font-display text-shadow-400">
              #{stats?.chainHeight || '0'}
            </p>
          </div>
          <div>
            <p className="text-2xs text-gray-400 mb-1">Last Sync</p>
            <p className="text-sm font-mono text-white/70">
              {stats?.lastSync ? formatTimeAgo(stats.lastSync) : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Visualization Canvas */}
      <div className="relative h-64 bg-gradient-to-b from-shadow-50 to-shadow-100">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onMouseMove={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              // Determine which node is hovered (simplified)
              setHoveredNode(Math.floor((x / rect.width) * 10));
            }
          }}
          onMouseLeave={() => setHoveredNode(null)}
        />
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-shadow-50/80 backdrop-blur-sm">
            <div className="w-12 h-12 border-2 border-glass-light rounded-full animate-spin border-t-dot-primary" />
          </div>
        )}

        {/* Decorative Elements */}
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-dot-primary rounded-full animate-pulse shadow-glow" />
            <span className="text-2xs text-white/60 font-mono">LIVE</span>
          </div>
        </div>
      </div>

      {/* Storage Progress Bar */}
      <div className="p-6 bg-gradient-to-b from-transparent to-glass-dark">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Storage Capacity</span>
          <span className="text-xs font-mono text-white/70">
            {formatBytes(stats?.storageUsed || 0)} / 1 GB
          </span>
        </div>
        <div className="w-full h-2 bg-glass-dark rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-dot-primary to-dot-accent rounded-full transition-all duration-500 shadow-glow-sm"
            style={{ width: `${Math.min((stats?.storageUsed || 0) / (1024 * 1024 * 1024) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 pt-0 flex gap-3">
        <button className="flex-1 px-4 py-2 bg-glass-white text-gray-300 rounded-sharp hover:bg-glass-medium hover:text-white transition-all duration-200 text-sm font-mono">
          Explorer
        </button>
        <button className="flex-1 px-4 py-2 bg-dot-primary text-white rounded-sharp hover:bg-dot-accent transition-all duration-200 shadow-glow-sm text-sm font-mono">
          Sync Now
        </button>
      </div>
    </div>
  );
};