import { useState, useEffect, useRef, memo } from 'react';
import { MessageCircle, Send, X, Paperclip, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useGameStore, ChatMessage } from '../store/useGameStore';
import { useAuth } from '../contexts/AuthContext';

interface IncomingImage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  totalChunks: number;
  chunks: string[];
}

interface LiveChatProps {
  mode?: 'match' | 'direct';
  recipientId?: string; // For direct mode
  channelId?: string;   // For match mode
  userId: string;
  userName: string;
  embedded?: boolean;
}

const LiveChat = memo(({ mode = 'match', recipientId, channelId, userId, userName, embedded = false }: LiveChatProps) => {
  const { onlineUsers } = useAuth();
  const isDirect = mode === 'direct' && recipientId;
  const isOffline = isDirect && recipientId && !onlineUsers.has(recipientId);

  const ephemeralDict = useGameStore(state => state.ephemeralMessages);
  const directMessages = (isDirect && recipientId) ? (ephemeralDict[recipientId] || []) : [];
  const addEphemeralMessage = useGameStore(state => state.addEphemeralMessage);

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messages = isDirect ? directMessages : localMessages;

  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(embedded);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  // Use a ref for isOpen to access latest value in channel callbacks
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const incomingChunksRef = useRef<Record<string, IncomingImage>>({});

  useEffect(() => {
    // For direct mode, we don't need a dedicated listening channel inside the component
    // because GlobalPingListener handles incoming messages. We just need a channel to send on.
    if (isDirect) {
      const channel = supabase.channel(`pings_${recipientId}`);
      channel.subscribe();
      channelRef.current = channel;
      return () => { supabase.removeChannel(channel); };
    }

    if (!channelId) return;

    const channel = supabase.channel(channelId, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'message' }, (payload) => {
        const msg = payload.payload as ChatMessage;
        setLocalMessages(prev => [...prev, msg]);
        if (!isOpenRef.current) setHasNewMessage(true);
      })
      .on('broadcast', { event: 'image_start' }, ({ payload }) => {
        incomingChunksRef.current[payload.imageId] = {
          senderId: payload.senderId,
          senderName: payload.senderName,
          text: payload.text || '',
          timestamp: payload.timestamp,
          totalChunks: payload.totalChunks,
          chunks: new Array(payload.totalChunks).fill('')
        };
      })
      .on('broadcast', { event: 'image_chunk' }, ({ payload }) => {
        const img = incomingChunksRef.current[payload.imageId];
        if (!img) return;

        img.chunks[payload.chunkIndex] = payload.data;
        const received = img.chunks.filter(c => c !== '').length;

        if (received === img.totalChunks) {
          const fullData = img.chunks.join('');
          setLocalMessages(prev => [...prev, {
            id: payload.imageId,
            senderId: img.senderId,
            senderName: img.senderName,
            text: img.text,
            timestamp: img.timestamp,
            imageUrl: fullData
          }]);
          if (!isOpenRef.current) setHasNewMessage(true);
          delete incomingChunksRef.current[payload.imageId];
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, isDirect, recipientId]);

  // Mark as read when opening
  useEffect(() => {
    if (isOpen) setHasNewMessage(false);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const sendMessage = () => {
    if ((!inputText.trim() && !stagedImage) || !channelRef.current) return;

    if (stagedImage) {
      processAndSendImage(stagedImage, inputText.trim());
      setStagedImage(null);
      setInputText('');
      return;
    }

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: userId,
      senderName: userName,
      text: inputText.trim(),
      timestamp: Date.now()
    };

    channelRef.current.send({
      type: 'broadcast',
      event: isDirect ? 'direct_message' : 'message',
      payload: newMessage
    });

    if (isDirect && recipientId) {
      addEphemeralMessage(recipientId, newMessage);
    } else {
      setLocalMessages(prev => [...prev, newMessage]);
    }
    setInputText('');
  };

  // Helper to compress image if it's too large
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 1920;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
            else { width = Math.round((width * maxDim) / height); height = maxDim; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // compress to 80% JPEG
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const processAndSendImage = async (file: File, text: string) => {
    if (!channelRef.current) return;
    setIsUploading(true);

    try {
      let base64Data: string;
      // If > 4MB, compress client-side
      if (file.size > 4 * 1024 * 1024) {
        base64Data = await compressImage(file);
      } else {
        base64Data = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = (e) => res(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }

      const imageId = Math.random().toString(36).substr(2, 9);
      const chunkSize = 200000; // ~200KB chunks (well under 1MB limit)
      const totalChunks = Math.ceil(base64Data.length / chunkSize);

      channelRef.current.send({
        type: 'broadcast',
        event: 'image_start',
        payload: { imageId, senderId: userId, senderName: userName, text, totalChunks, timestamp: Date.now() }
      });

      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64Data.slice(i * chunkSize, (i + 1) * chunkSize);
        channelRef.current.send({
          type: 'broadcast',
          event: 'image_chunk',
          payload: { imageId, chunkIndex: i, data: chunk }
        });
        await new Promise(r => setTimeout(r, 10)); // small delay to prevent buffer overflow
      }

      const newMessage: ChatMessage = {
        id: imageId,
        senderId: userId,
        senderName: userName,
        text,
        timestamp: Date.now(),
        imageUrl: base64Data
      };

      if (isDirect && recipientId) {
        addEphemeralMessage(recipientId, newMessage);
      } else {
        setLocalMessages(prev => [...prev, newMessage]);
      }
    } catch (err) {
      console.error('Failed to send image', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setStagedImage(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setStagedImage(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  return (
    <>
      {/* Toggle Button — only in non-embedded mode */}
      {!embedded && (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`absolute right-3 top-[60px] sm:right-4 sm:top-[70px] z-30 p-2 sm:p-2.5 rounded-full border shadow-xl transition-all duration-300
            ${isOpen ? 'bg-orange-500 border-orange-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}
          `}
          title="Live Chat"
        >
          <MessageCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${isOpen ? 'text-white' : 'text-slate-300'}`} />
          {hasNewMessage && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
              !
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      <div className={`${embedded ? 'relative w-full h-full' : 'fixed sm:absolute inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-80'} bg-slate-900/98 backdrop-blur-xl ${!embedded ? 'border-l border-slate-700' : ''} flex flex-col shadow-2xl z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {!embedded && (
          <div className="flex justify-between items-center p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <h3 className="text-base font-bold text-white tracking-tight">Live Chat</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-50">
              <MessageCircle className="w-10 h-10 mb-2" />
              <p className="text-xs italic text-center px-4">No messages yet. Say hi!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] ${msg.senderId === userId ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <span className="text-[10px] text-slate-500 mb-1 px-1">
                  {msg.senderId === userId ? 'Me' : msg.senderName}
                </span>
                <div className={`px-3 py-2 rounded-2xl text-sm shadow-sm ${
                  msg.senderId === userId 
                    ? 'bg-orange-500 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                }`}>
                  {msg.imageUrl ? (
                    <img 
                      src={msg.imageUrl} 
                      alt="Shared attachment" 
                      className="max-w-full rounded-xl cursor-zoom-in hover:opacity-90 transition-opacity"
                      style={{ maxHeight: '200px', objectFit: 'contain' }}
                      onClick={() => setFullScreenImage(msg.imageUrl || null)}
                    />
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-slate-800/50 border-t border-slate-800 flex flex-col">
          {/* Staged Image Preview */}
          {stagedImage && (
            <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded bg-slate-900 border border-slate-600 overflow-hidden flex-shrink-0">
                  <img src={URL.createObjectURL(stagedImage)} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-white font-bold truncate">{stagedImage.name || 'Pasted image'}</span>
                  <span className="text-[10px] text-slate-400">{(stagedImage.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
              <button 
                onClick={() => setStagedImage(null)}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded-full transition-colors flex-shrink-0"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isOffline && (
            <div className="bg-red-500/10 border-b border-red-500/20 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[10px] text-red-400 font-medium">
              <AlertTriangle className="w-3 h-3" />
              This user is offline. They will not receive these messages.
            </div>
          )}

          <div className="p-3">
            <div className="flex gap-2 bg-slate-900 rounded-xl p-1.5 border border-slate-700 focus-within:border-orange-500/50 transition-colors">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                onPaste={handlePaste}
                placeholder={stagedImage ? "Add a caption..." : "Type or paste an image..."}
                className="flex-1 bg-transparent border-none outline-none text-white text-sm px-2 py-1 placeholder:text-slate-600 min-w-0"
              />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-50 transition-colors flex-shrink-0"
              title="Attach Image"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <button 
              onClick={sendMessage}
              disabled={(!inputText.trim() && !stagedImage) || isUploading}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white p-2 rounded-lg transition-all flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[8px] text-slate-600 text-center mt-1.5 uppercase tracking-widest">Ephemeral • No History Saved</p>
        </div>
      </div>
      </div>
      {/* Full Screen Image Overlay */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setFullScreenImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
            onClick={() => setFullScreenImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={fullScreenImage} 
            alt="Expanded view" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-zoom-out"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
});

export default LiveChat;
