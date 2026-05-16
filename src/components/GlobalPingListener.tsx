import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, X, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useGameStore } from '../store/useGameStore';

interface PingToast {
  id: string;
  senderName: string;
  timestamp: number;
  type: 'ping' | 'chat';
  text?: string;
}

export default function GlobalPingListener() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<PingToast[]>([]);
  const [_unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const addEphemeralMessage = useGameStore(state => state.addEphemeralMessage);
  const activeChatFriendId = useGameStore(state => state.activeChatFriendId);
  const activeChatFriendIdRef = useRef(activeChatFriendId);
  useEffect(() => { activeChatFriendIdRef.current = activeChatFriendId; }, [activeChatFriendId]);

  // Fetch unread pings on mount (for when user was offline)
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('pings')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    // Subscribe to real-time pings via Broadcast
    const channel = supabase.channel(`pings_${user.id}`);
    channel
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        const toast: PingToast = {
          id: Math.random().toString(36).substr(2, 9),
          senderName: payload.fromName,
          timestamp: payload.timestamp,
          type: 'ping'
        };
        setToasts(prev => [toast, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, 5000);
      })
      .on('broadcast', { event: 'direct_message' }, ({ payload }) => {
        // Save to ephemeral RAM store
        addEphemeralMessage(payload.senderId, payload);
        
        // Only show toast if we aren't currently looking at the chat with this user
        if (activeChatFriendIdRef.current !== payload.senderId) {
          const toast: PingToast = {
            id: Math.random().toString(36).substr(2, 9),
            senderName: payload.senderName,
            timestamp: payload.timestamp,
            type: 'chat',
            text: payload.text || 'sent an image'
          };
          setToasts(prev => [toast, ...prev]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toast.id));
          }, 5000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-slate-800/95 backdrop-blur-xl border border-orange-500/40 rounded-2xl p-4 flex items-center gap-3 shadow-2xl shadow-orange-900/20 animate-in slide-in-from-right fade-in duration-300 max-w-xs"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toast.type === 'ping' ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
            {toast.type === 'ping' ? (
              <Bell className="w-5 h-5 text-orange-400 animate-bounce" />
            ) : (
              <MessageCircle className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {toast.type === 'ping' ? (
              <p className="text-white font-bold text-sm truncate">
                <span className="text-orange-400">{toast.senderName}</span> pinged you!
              </p>
            ) : (
              <div>
                <p className="text-white font-bold text-sm truncate">
                  <span className="text-blue-400">{toast.senderName}</span>
                </p>
                <p className="text-slate-300 text-xs truncate mt-0.5">{toast.text}</p>
              </div>
            )}
            <p className="text-slate-400 text-[10px] mt-0.5">{formatTime(toast.timestamp)}</p>
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
