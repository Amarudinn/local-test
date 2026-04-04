'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DebateCard } from './DebateCard';
import { supabaseApi } from '@/lib/supabase-client';
import { Debate } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export function DebateList() {
  const [activeTab, setActiveTab] = useState<'all' | 'OPEN' | 'ENDED' | 'RESOLVED'>('OPEN'); // Default to OPEN
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: debates, isLoading, error } = useQuery({
    queryKey: ['debates', activeTab],
    queryFn: async () => {
      let fetchedDebates;

      if (activeTab === 'all') {
        fetchedDebates = await supabaseApi.getDebates();
      } else if (activeTab === 'OPEN') {
        const openDebates = await supabaseApi.getDebates({ status: 'OPEN' });
        const ongoingDebates = await supabaseApi.getDebates({ status: 'ONGOING' });

        fetchedDebates = [...openDebates, ...ongoingDebates].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else {
        fetchedDebates = await supabaseApi.getDebates({ status: activeTab });
      }

      const now = new Date();
      for (const debate of fetchedDebates) {
        if ((debate.status === 'OPEN' || debate.status === 'ONGOING') && new Date(debate.end_time) < now) {
          try {
            await supabaseApi.updateDebate(debate.id, { status: 'ENDED' });
            debate.status = 'ENDED';

          } catch (error) {
            console.warn(`Failed to auto-update debate ${debate.id} to ENDED:`, error);
          }
        }
      }

      if (activeTab === 'OPEN') {
        return fetchedDebates.filter(d => d.status === 'OPEN' || d.status === 'ONGOING');
      }

      return fetchedDebates;
    },
    refetchInterval: 10000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {

      const allDebates = await supabaseApi.getDebates();

      const now = new Date();
      const SYNC_INTERVAL_SECONDS = 30; 

      const debatesToSync = allDebates.filter(debate => {
        if (debate.status === 'ENDED' || debate.status === 'RESOLVED') {
          return false;
        }

        if (!debate.last_synced_at) {
          return true;
        }

        const lastSync = new Date(debate.last_synced_at);
        const secondsSinceSync = (now.getTime() - lastSync.getTime()) / 1000;

        return secondsSinceSync > SYNC_INTERVAL_SECONDS;
      });


      for (const debate of debatesToSync) {
        try {
          const { getDebateInfo, getParticipants } = await import('@/lib/genlayer-client');
          const { syncParticipantsToDatabase } = await import('@/lib/sync-service');

          const blockchainInfo = await getDebateInfo(debate.contract_address);
          const blockchainParticipants = await getParticipants(debate.contract_address);
          let correctStatus = blockchainInfo.status;
          if (blockchainParticipants.length > 0 && blockchainInfo.status === 'OPEN') {
            correctStatus = 'ONGOING';
          }

          await supabaseApi.updateDebate(debate.id, {
            status: correctStatus as 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED',
            participant_count: blockchainParticipants.length,
            last_synced_at: new Date(),
          });

          if (blockchainParticipants.length > 0) {
            await syncParticipantsToDatabase(debate.contract_address, blockchainParticipants);
          }
        } catch (error) {
          console.warn(`Failed to sync debate ${debate.contract_address}:`, error);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['debates'] });
    } catch (error) {
      console.error('❌ Failed to refresh debates:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading debates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <p className="text-red-500 font-semibold">Failed to load debates</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'OPEN' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('OPEN')}
            className="text-xs md:text-sm h-9"
          >
            Open
          </Button>
          <Button
            variant={activeTab === 'ENDED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('ENDED')}
            className="text-xs md:text-sm h-9"
          >
            Ended
          </Button>
          <Button
            variant={activeTab === 'RESOLVED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('RESOLVED')}
            className="text-xs md:text-sm h-9"
          >
            Resolved
          </Button>
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('all')}
            className="text-xs md:text-sm h-9"
          >
            All
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="gap-2 flex-shrink-0 h-9"
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Refresh
            </>
          )}
        </Button>
      </div>

      <div>
        {!debates || debates.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold text-muted-foreground">No debates found</p>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'all'
                  ? 'Be the first to create a debate!'
                  : activeTab === 'OPEN'
                    ? 'No active debates at the moment'
                    : `No ${activeTab.toLowerCase()} debates at the moment`}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start">
              {debates.map((debate: Debate) => (
                <DebateCard key={debate.id} debate={debate} />
              ))}
            </div>

            <div className="text-center text-xs md:text-sm text-muted-foreground mt-4">
              Showing {debates.length} {debates.length === 1 ? 'debate' : 'debates'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
