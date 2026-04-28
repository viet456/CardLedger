'use client';
import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, Clock, PlusCircle, Edit2, Trash2 } from 'lucide-react';

type SyncState = 'offline' | 'connecting' | 'synced';

const MOCK_QUEUE = [
    { id: 1, action: 'Added to Collection', target: 'Charizard - Base Set', icon: PlusCircle, color: 'text-blue-500' },
    { id: 2, action: 'Updated Purchase Price', target: 'Lugia - Neo Genesis', icon: Edit2, color: 'text-purple-500' },
    { id: 3, action: 'Removed from Collection', target: 'Pikachu ex - Ascended Heroes', icon: Trash2, color: 'text-red-500'}
];

export function SyncShowcase() {
    const [syncState, setSyncState] = useState<SyncState>('offline');

    useEffect(() => {
        // The infinite state machine loop
        let timeout: NodeJS.Timeout;

        const runLoop = () => {
            // State 1: Offline (stays for 4 seconds to let user read)
            setSyncState('offline');
            
            timeout = setTimeout(() => {
                // State 2: Network detected, flushing queue (2 seconds)
                setSyncState('connecting');
                
                timeout = setTimeout(() => {
                    // State 3: Synced successfully (items slide away) (5 seconds)
                    setSyncState('synced');
                    
                    timeout = setTimeout(runLoop, 5000);
                }, 2000);
            }, 4000);
        };

        runLoop();
        return () => clearTimeout(timeout);
    }, []);

    return (
        <div className='relative flex h-full min-h-[350px] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-green-500/5 via-amber-500/5 to-transparent p-6 md:min-h-[450px]'>
            {/* Background Grid */}
            <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20' />

            {/* Mock Mobile Device / App Frame */}
            <div className='relative z-10 flex w-full max-w-[320px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl'>
                
                {/* Header & Dynamic Status Badge */}
                <div className='flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3'>
                    <span className='font-semibold'>Outbox</span>
                    
                    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-500 ${
                        syncState === 'offline' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        syncState === 'connecting' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        'bg-green-500/10 text-green-500 border border-green-500/20'
                    }`}>
                        {syncState === 'offline' && <WifiOff className='h-3 w-3' />}
                        {syncState === 'connecting' && <RefreshCw className='h-3 w-3 animate-spin' />}
                        {syncState === 'synced' && <CheckCircle2 className='h-3 w-3' />}
                        
                        <span>
                            {syncState === 'offline' ? 'Offline Mode' :
                             syncState === 'connecting' ? 'Syncing...' :
                             'All changes saved'}
                        </span>
                    </div>
                </div>

                {/* Mutation Queue List */}
                <div className='flex min-h-[180px] flex-col gap-3 p-4'>
                    {MOCK_QUEUE.map((item, index) => (
                        <div 
                            key={item.id}
                            className={`flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm transition-all
                                ${syncState === 'synced' 
                                    ? 'opacity-0 translate-x-8 duration-700' 
                                    : 'opacity-100 translate-x-0 duration-500' // Faster reset entrance
                                }
                            `}
                            style={{ transitionDelay: syncState === 'synced' ? `${index * 150}ms` : `${index * 100}ms` }} 
                        >
                            <div className='flex items-center gap-3'>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-muted ${item.color}`}>
                                    <item.icon className='h-4 w-4' />
                                </div>
                                <div className='flex flex-col'>
                                    <span className='text-sm font-medium'>{item.action}</span>
                                    <span className='text-xs text-muted-foreground'>{item.target}</span>
                                </div>
                            </div>
                            
                            {/* Dynamic Item Status Icon */}
                            <div className='text-muted-foreground'>
                                {syncState === 'offline' && <Clock className='h-4 w-4' />}
                                {syncState === 'connecting' && <RefreshCw className='h-4 w-4 animate-spin text-blue-500' />}
                            </div>
                        </div>
                    ))}

                    {/* Empty State message (visible only when synced) */}
                    <div className={`absolute left-0 right-0 top-32 flex flex-col items-center gap-2 text-center transition-all
                        ${syncState === 'synced' 
                            ? 'opacity-100 scale-100 duration-700 delay-300' // Slow entrance
                            : 'opacity-0 scale-95 duration-150 delay-0 pointer-events-none' // Fast exit
                        }
                    `}>
                        <div className='flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500'>
                            <CheckCircle2 className='h-6 w-6' />
                        </div>
                        <p className='text-sm text-muted-foreground'>Queue is empty</p>
                    </div>
                </div>
            </div>
        </div>
    );
}