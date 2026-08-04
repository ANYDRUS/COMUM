import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { ChatMessage, FullDataset } from '../types';
import { Bot, Send, Sparkles, X, Copy, Check, MessageSquare, AlertCircle, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface GeminiChatSidebarProps {
  dataset: FullDataset;
  selectedIds: Set<string>;
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
}

export const GeminiChatSidebar: React.FC<GeminiChatSidebarProps> = ({
  dataset,
  selectedIds,
  isOpen,
  onClose,
  onOpen,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá! Sou o assistente de **Inteligência Comum**.\n\nSelecione uma ou mais comunidades no mapa ou lista à esquerda para habilitar minha análise técnica em linguagem natural sobre os dados relacionais.',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMsg, setInputMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const sendMessage = async (overrideText?: string) => {
    const textToSend = overrideText || inputMsg;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      selectedCommunitiesCount: selectedIds.size,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInputMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: textToSend,
          selectedIds: Array.from(selectedIds),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na comunicação com Gemini.');

      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'error',
          content: '❌ ' + err.message,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onOpen}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-2 rounded-l-xl shadow-xl border-l border-t border-b border-blue-500/40 flex flex-col items-center gap-2 transition-all hover:pr-3 group cursor-pointer"
        title="Abrir Apoio I.A. (Chat de Inteligência Comum na Lateral)"
      >
        <Bot className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
        <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] font-bold tracking-wider uppercase">
          Apoio I.A.
        </span>
        <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-pulse" />
      </button>
    );
  }

  return (
    <aside className="w-full sm:w-[400px] md:w-[440px] flex-none bg-white border-l border-slate-200 flex flex-col z-30 shadow-xl text-slate-800 h-full">
      {/* Header */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs">
            IC
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900">Inteligência Comum</h2>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              IA de Análise Territorial • {selectedIds.size > 0 ? `${selectedIds.size} comunidade(s)` : 'Toda a base'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold transition-colors shadow-2xs"
          title="Ocultar coluna de chat"
        >
          <PanelRightClose className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-[11px]">Ocultar</span>
        </button>
      </div>

      {/* Preset Deep Analysis Action Bar */}
      <div className="p-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap gap-1.5 text-[11px]">
        <span className="w-full text-[9px] text-slate-400 font-bold uppercase tracking-wider px-0.5">Atalhos de Análise IA:</span>
        <button
          onClick={() => sendMessage('Opção 1: Síntese')}
          disabled={isLoading}
          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium border border-blue-200 px-2.5 py-1 rounded-lg text-[10px] transition-colors shadow-2xs"
        >
          1. Síntese
        </button>
        <button
          onClick={() => sendMessage('Opção 2: Detalhamento por Comunidade e Cronologia')}
          disabled={isLoading}
          className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium border border-purple-200 px-2.5 py-1 rounded-lg text-[10px] transition-colors shadow-2xs"
        >
          2. Detalhamento & Cronologia
        </button>
        <button
          onClick={() => sendMessage('Opção 3: Análise Exploratória')}
          disabled={isLoading}
          className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium border border-amber-200 px-2.5 py-1 rounded-lg text-[10px] transition-colors shadow-2xs"
        >
          3. Análise Exploratória
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar bg-slate-50/40 text-xs">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`p-3.5 rounded-2xl max-w-[92%] shadow-2xs leading-relaxed border ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none'
                  : m.role === 'error'
                  ? 'bg-red-50 text-red-800 border-red-200 rounded-tl-none'
                  : 'bg-white text-slate-800 border-slate-200 rounded-tl-none'
              }`}
            >
              {/* Message Content formatted with Markdown support */}
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap font-sans text-xs">
                  {m.content}
                </div>
              ) : (
                <div className="text-xs leading-relaxed font-sans text-slate-800 space-y-2 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:my-1.5 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:my-1.5 [&>li]:mb-1 [&>h1]:font-bold [&>h1]:text-sm [&>h1]:text-slate-900 [&>h1]:mt-2 [&>h1]:mb-1 [&>h2]:font-bold [&>h2]:text-xs [&>h2]:text-slate-900 [&>h2]:mt-2 [&>h2]:mb-1 [&>h3]:font-bold [&>h3]:text-xs [&>h3]:text-slate-900 [&>h3]:mt-1.5 [&>h3]:mb-1 [&>strong]:font-semibold [&>strong]:text-blue-900 [&>blockquote]:border-l-2 [&>blockquote]:border-blue-400 [&>blockquote]:pl-2.5 [&>blockquote]:italic [&>blockquote]:text-slate-600 [&>blockquote]:my-2 [&>code]:bg-slate-100 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-[11px] [&>code]:text-blue-800">
                  <Markdown>{m.content}</Markdown>
                </div>
              )}

              {/* Message Footer */}
              <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-100 text-[9px] opacity-75">
                <span className="font-medium text-slate-400">{m.timestamp}</span>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(m.content, m.id)}
                    className="hover:text-blue-600 flex items-center gap-1 transition-colors"
                    title="Copiar resposta"
                  >
                    {copiedId === m.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-blue-700 font-medium animate-pulse bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
            <span>Consultando base e processando análise com Gemini IA...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            disabled={isLoading}
            placeholder={
              selectedIds.size > 0
                ? `Perguntar sobre ${selectedIds.size} comunidade(s)...`
                : 'Fazer pergunta sobre todas as comunidades...'
            }
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />

          <button
            type="submit"
            disabled={isLoading || !inputMsg.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl p-2 transition-all shadow-2xs flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
};
