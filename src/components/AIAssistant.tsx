import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle, MessageCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { useAuth } from './AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export const AIAssistant: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { sendMessage, loading, error } = useAIAssistant();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);

    try {
      // Convert to Gemini format for context
      const history = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const response = await sendMessage(userMsg, profile?.injuryType, history);
      setMessages((prev) => [...prev, { role: 'assistant', text: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: t('assistant.errorResponse') || 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center z-40"
            title={t('assistant.open') || 'Open AI Assistant'}
          >
            <MessageCircle size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl flex flex-col z-40 border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-900">{t('assistant.title') || 'Rehab Assistant'}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                    <MessageCircle size={24} className="text-blue-600" />
                  </div>
                  <p className="text-sm text-slate-700 font-medium">
                    {t('assistant.welcome') || 'Hi! I\'m your rehab assistant'}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed px-2">
                    {t('assistant.description') ||
                      'Ask me about exercises, recovery, pain management, or rehabilitation tips.'}
                  </p>
                  <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2 mx-2">
                    ⚠️ {t('assistant.disclaimer') || 'Always consult your doctor for medical concerns.'}
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                    )}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700"
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="px-4 py-3 border-t border-slate-100 flex gap-2 bg-white">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('assistant.placeholder') || 'Ask a question...'}
                disabled={loading}
                maxLength={500}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-3.5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
