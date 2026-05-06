import { LucideIcon, MessageCircle, Send } from 'lucide-react';
import { motion } from 'motion/react';

interface FloatingChatProps {
  whatsapp: string;
  telegram: string;
}

export const FloatingChat = ({ whatsapp, telegram }: FloatingChatProps) => {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-50">
      <motion.a
        href={`https://t.me/${telegram.replace('@', '')}`}
        target="_blank"
        rel="noreferrer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-14 h-14 bg-[#0088cc] rounded-full flex items-center justify-center shadow-xl text-white"
        title="Chat on Telegram"
      >
        <Send size={28} />
      </motion.a>
      
      <motion.a
        href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
        target="_blank"
        rel="noreferrer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-xl text-white"
        title="Chat on WhatsApp"
      >
        <MessageCircle size={28} />
      </motion.a>
    </div>
  );
};
