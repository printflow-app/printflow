import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Sparkles, Bot, User, CheckCircle2,
  Loader2, Package, Zap, ShieldCheck,
  Plus, Settings
} from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

// =============================================
// PRINTFLOW AI COPILOT (PRO ARCHITECT VERSION)
// Handles: Orders, Services, and Service Options.
// Features: Generative UI, Tool Confirmations, Auto-Refresh.
// =============================================

const STARTER_SUGGESTIONS = [
  'Yangi buyurtma yaratish',
  "Yangi xizmat qo'shish (masalan: Vizitka)",
  'Xizmat uchun yangi narx qoidasi',
];

// Build chat URL the same way as the main axios client (api/index.ts):
// - dev: '/api/ai/chat' (Vite proxy → localhost:4000)
// - prod: '<VITE_API_URL>/api/ai/chat' (Railway backend)
const rawApiUrl = (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
const API_BASE = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api') : '/api';

const chatTransport = new DefaultChatTransport({
  api: `${API_BASE}/ai/chat`,
  credentials: 'include', // send httpOnly auth cookie
  headers: () => {
    const h: Record<string, string> = {};
    try {
      const raw = localStorage.getItem('pf_user_info') || sessionStorage.getItem('pf_user_info');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.tenantId) h['X-Tenant-Id'] = u.tenantId;
      }
      const bearer = localStorage.getItem('pf_token');
      if (bearer) h['Authorization'] = `Bearer ${bearer}`;
    } catch {}
    return h;
  },
});

// ── UI Components ──────────────────────────────────────────────────

const SuccessBadge: React.FC<{ text: string }> = ({ text }) => (
  <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex items-center gap-3 text-emerald-700">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
        <ShieldCheck size={18} strokeWidth={2.5} />
      </div>
      <div>
         <p className="text-[11px] font-bold uppercase tracking-widest leading-none">Muvaffaqiyatli</p>
         <p className="text-[10px] font-bold text-emerald-600/80 mt-0.5">{text}</p>
      </div>
    </div>
  </div>
);

const CardWrapper: React.FC<{ title: string; subtitle: string; icon: any; children: React.ReactNode; onConfirm: () => void }> = ({ title, subtitle, icon: Icon, children, onConfirm }) => (
  <div className="mt-3 rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
    <div className="flex items-center justify-between px-6 py-5 bg-slate-50/50 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{subtitle}</p>
          <p className="text-[14px] font-bold text-slate-900 tracking-tight">{title}</p>
        </div>
      </div>
    </div>
    <div className="p-6 space-y-4">
      {children}
      <button
        onClick={onConfirm}
        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
      >
        <CheckCircle2 size={16} strokeWidth={2.5} />
        Tasdiqlash
      </button>
    </div>
  </div>
);

// ── Main Copilot Component ──────────────────────────────────────────

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const AICopilot: React.FC<AICopilotProps> = ({ isOpen, onClose, onRefresh }) => {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status, addToolResult } = useChat({
    transport: chatTransport,
    onFinish: ({ message }) => {
      if (message.parts?.some(p => p.type !== 'text' && p.type !== 'step-start')) {
        onRefresh?.();
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm md:hidden animate-in fade-in duration-300" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-[70] w-full md:w-[460px] bg-white border-l border-slate-200 shadow-[-20px_0_50px_rgba(0,0,0,0.15)] flex flex-col animate-in slide-in-from-right duration-500 ease-out">

        {/* Header */}
        <div className="relative flex items-center gap-4 px-6 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-md flex-shrink-0">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/30">
              <Sparkles size={22} className="text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 uppercase">
              PrintFlow <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[9px] rounded-md shadow-sm">AI PRO</span>
            </h2>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Ready for 3 Workflows</p>
          </div>
          <button onClick={onClose} className="ml-auto w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth custom-scroll bg-slate-50/30">
          {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                <Bot size={48} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Qanday yordam bera olaman?</p>
             </div>
          )}

          {messages.map((msg) => {
            const textContent = msg.parts
              .filter(p => p.type === 'text')
              .map(p => (p as { type: 'text'; text: string }).text)
              .join('');

            const toolParts = msg.parts.filter(p =>
              p.type === 'dynamic-tool' || p.type.startsWith('tool-')
            ) as any[];

            return (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <div className={`w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-md ${
                  msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
                }`}>
                  {msg.role === 'user' ? <User size={16} strokeWidth={2.5} /> : <Bot size={16} strokeWidth={2.5} />}
                </div>

                <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                  {textContent && (
                    <div className={`px-5 py-4 rounded-[26px] text-[13px] leading-[1.6] font-semibold shadow-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'
                        : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-tl-sm'
                    }`}>
                      {textContent}
                    </div>
                  )}

                  {toolParts.map((part: any) => {
                    const toolCallId = part.toolCallId;
                    const toolName: string = part.type === 'dynamic-tool' ? part.toolName : part.type.slice(5);
                    const state: string = part.state;

                    if (state === 'output-available') {
                      if (toolName === 'createOrder') return <SuccessBadge key={toolCallId} text="Buyurtma yaratildi" />;
                      if (toolName === 'createService') return <SuccessBadge key={toolCallId} text="Xizmat qo'shildi" />;
                      if (toolName === 'createServiceOption') return <SuccessBadge key={toolCallId} text="Optsiya saqlandi" />;
                      return null;
                    }

                    if (state !== 'input-available' && state !== 'approval-requested') return null;

                    const onConfirm = () => addToolResult({ toolCallId, output: 'confirmed' } as any);
                    const args = part.input;

                    if (toolName === 'createOrder') {
                      return (
                        <CardWrapper key={toolCallId} title="Buyurtmani Tasdiqlash" subtitle="Yangi Buyurtma" icon={Package} onConfirm={onConfirm}>
                           <div className="space-y-3">
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nomi</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.orderName}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                 <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Miqdor</p>
                                    <p className="text-[12px] font-bold text-slate-800">{args?.quantity}</p>
                                 </div>
                                 <div className="p-3 rounded-2xl bg-slate-900 text-white text-center">
                                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Jami</p>
                                    <p className="text-[12px] font-bold">{args?.totalAmount?.toLocaleString()} UZS</p>
                                 </div>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    if (toolName === 'createService') {
                      return (
                        <CardWrapper key={toolCallId} title="Xizmatni Tasdiqlash" subtitle="Yangi Xizmat" icon={Plus} onConfirm={onConfirm}>
                           <div className="space-y-3">
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Xizmat nomi</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.name}</p>
                              </div>
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Narxi / Birlik</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.basePrice?.toLocaleString()} UZS / {args?.unit}</p>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    if (toolName === 'createServiceOption') {
                      return (
                        <CardWrapper key={toolCallId} title="Optsiya Tasdiqlash" subtitle="Yangi Optsiya" icon={Settings} onConfirm={onConfirm}>
                           <div className="space-y-3">
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Xizmat va Optsiya</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.targetServiceName} - {args?.optionName}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                 <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Eski narx</p>
                                    <p className="text-[12px] font-bold text-slate-400 line-through">{args?.oldPrice?.toLocaleString()}</p>
                                 </div>
                                 <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Yangi narx</p>
                                    <p className="text-[12px] font-bold text-emerald-700">{args?.newPrice?.toLocaleString()}</p>
                                  </div>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    return null;
                  })}

                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2">{msg.role === 'user' ? 'Siz' : 'Assistant'}</span>
                </div>
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-4">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg"><Bot size={16} className="text-white" strokeWidth={2.5} /></div>
              <div className="px-6 py-4 rounded-3xl rounded-tl-sm bg-orange-400 text-white flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-[11px] font-bold uppercase tracking-widest">O'ylayapman...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-6 bg-white border-t border-slate-100">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {STARTER_SUGGESTIONS.map((suggestion, i) => (
                <button key={i} onClick={() => setInput(suggestion)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl hover:border-orange-500 hover:text-orange-600 transition-all uppercase tracking-tight group">
                  <Zap size={10} className="text-orange-400" /> {suggestion}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-[32px] blur opacity-0 group-focus-within:opacity-10 transition duration-500" />
            <div className="relative flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-[28px] p-2 pl-6 focus-within:bg-white focus-within:border-orange-500 transition-all duration-300">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Xabar yozing..."
                rows={1}
                className="flex-1 bg-transparent resize-none text-[14px] text-slate-800 placeholder:text-slate-400 font-semibold focus:outline-none py-3 min-h-[44px] max-h-[150px]"
                onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFormSubmit(e as any); } }}
                disabled={isLoading}
              />
              <button type="submit" disabled={!input.trim() || isLoading} className="w-11 h-11 flex-shrink-0 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white flex items-center justify-center transition-all shadow-xl shadow-orange-500/25 active:scale-90 mb-0.5">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              System Active
            </div>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Vercel AI SDK • Anthropic</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AICopilot;
