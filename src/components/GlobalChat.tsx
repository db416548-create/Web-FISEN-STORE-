import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ChatMessage, UserProfile } from '../types';
import { Send, MessageSquare, X, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const PROFANITY_LIST = [
  'anjing', 'babi', 'monyet', 'bangsat', 'tolol', 'goblok', 'idiot', 'piki', 'lonte', 'pelacur', 
  'kontol', 'memek', 'ngentot', 'asu', 'bajingan', 'typography', '18+', 'eksploitasi', 'porn'
];

const filterText = (text: string) => {
  let filtered = text.toLowerCase();
  PROFANITY_LIST.forEach(word => {
    const reg = new RegExp(word, 'gi');
    filtered = filtered.replace(reg, '***');
  });
  return filtered === text.toLowerCase() ? text : filtered;
};

interface GlobalChatProps {
  userProfile?: UserProfile | null;
}

export const GlobalChat: React.FC<GlobalChatProps> = ({ userProfile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      // Intentionally clear previous listener on any auth change
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (!u) {
        setMessages([]);
        return;
      }

      const path = 'chat';
      const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(50));
      unsubSnapshot = onSnapshot(q, (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)).reverse());
      }, (e) => {
        // Only log/throw if it's a genuine error while we think we are logged in
        if (auth.currentUser) {
          console.error('Chat access denied', e);
          handleFirestoreError(e, OperationType.LIST, path);
        }
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    const filtered = filterText(newMessage);
    const path = 'chat';
    
    try {
      await addDoc(collection(db, path), {
        userId: auth.currentUser.uid,
        userName: userProfile?.displayName || auth.currentUser.email?.split('@')[0] || 'User',
        text: filtered,
        createdAt: serverTimestamp(),
        role: userProfile?.role || 'customer',
        userCode: userProfile?.userCode || ''
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  return (
    <section className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[380px] h-[550px] glass-morphism rounded-3xl overflow-hidden border-neon-green/20 flex flex-col pointer-events-auto backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="p-6 bg-neon-green/10 border-b border-neon-green/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neon-green rounded-xl flex items-center justify-center neon-border-green">
                  <MessageSquare size={20} className="text-black" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-neon-green">Live Chat Community</h3>
                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest leading-none">FISEN STORE 555</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
            >
              <div className="p-4 bg-neon-green/5 border border-neon-green/20 rounded-2xl flex gap-3 text-[10px] text-neon-green/60 items-center">
                <ShieldAlert size={14} className="text-neon-green shrink-0" />
                <p className="font-bold uppercase tracking-tight">Gunakan bahasa yang sopan & hargai sesama.</p>
              </div>

              {messages.map((m, i) => {
                const isOwn = m.userId === auth.currentUser?.uid;
                const isAdmin = m.role === 'admin';
                const isPartner = m.role === 'partner';
                
                return (
                  <motion.div 
                    key={m.id || i}
                    initial={{ opacity: 0, x: isOwn ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        isAdmin ? 'text-neon-green' : isPartner ? 'text-neon-blue' : 'text-white/40'
                      }`}>
                        {isAdmin && '⭐ '}{isPartner && '💠 '}{m.userName}
                      </span>
                      <span className="text-[8px] text-white/20 font-mono italic">{m.userCode}</span>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${
                      isOwn ? 'bg-neon-green text-black font-medium' : 'bg-white/5 border border-white/10 text-white'
                    }`}>
                      {m.text}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="p-6 bg-white/[0.02] border-t border-white/5 shrink-0">
              {userProfile ? (
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tulis sesuatu..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-neon-green outline-none transition-all placeholder:text-white/20"
                  />
                  <button className="w-12 h-12 bg-neon-green rounded-xl flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-neon-green/20">
                    <Send size={20} />
                  </button>
                </form>
              ) : (
                <div className="text-center p-3 rounded-2xl bg-neon-green/5 border border-neon-green/10">
                  <p className="text-[10px] font-black text-neon-green uppercase tracking-widest">Login Untuk Berpartisipasi</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-2xl pointer-events-auto border-2 ${
          isOpen ? 'bg-black border-neon-green shadow-neon-green/10' : 'bg-neon-green border-neon-green shadow-neon-green/20'
        }`}
      >
        {isOpen ? <X className="text-neon-green" /> : <MessageSquare className="text-black" size={28} />}
      </motion.button>
    </section>
  );
};
