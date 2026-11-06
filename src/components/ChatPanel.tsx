import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StudyRecord, StudyPlan } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  records: StudyRecord[];
  userName?: string;
  plans?: StudyPlan[];
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'こんにちは！学習に関する相談なら何でも聞いてください。\n\nできること：\n・学習計画の相談（目標や状況を詳しく聞いてから提案します）\n・科目バランスの分析\n・モチベーション維持のコツ\n・問題の解答・解説\n・効果的な学習方法\n\nお気軽に質問してください！',
};

const QUICK_QUESTIONS = [
  '今の学習ペースはどう？',
  '科目のバランスを教えて',
  'モチベーションが続かない',
  '学習計画を立てたい',
  '効果的な勉強法を教えて',
  'この問題を解いて: 12 × 8',
];

const MAX_CONTENT_LENGTH = 2000;

export function ChatPanel({ records, userName, plans = [] }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const loadMemories = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_memories')
      .select('role, content')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Failed to load chat memories:', error.message);
      setMemoryLoaded(true);
      return;
    }

    if (data && data.length > 0) {
      const pastMessages: ChatMessage[] = data.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      setMessages([INITIAL_MESSAGE, ...pastMessages]);
    }
    setMemoryLoaded(true);
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const saveMemory = async (role: 'user' | 'assistant', content: string) => {
    const { error } = await supabase.from('chat_memories').insert({ role, content });
    if (error) console.error('Failed to save chat memory:', error.message);
  };

  const clearMemories = async () => {
    const { error } = await supabase.from('chat_memories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error('Failed to clear memories:', error.message);
      return;
    }
    setMessages([INITIAL_MESSAGE]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || busy) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      // Send last 2 weeks of records as context
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const cutoff = twoWeeksAgo.toISOString().slice(0, 10);
      const recentRecords = records.filter((r) => r.date >= cutoff);

      // Load recent memories for context (last 20)
      const { data: memoryData } = await supabase
        .from('chat_memories')
        .select('role, content')
        .order('created_at', { ascending: false })
        .limit(20);
      const memories = (memoryData ?? []).reverse().map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          records: recentRecords.map((r) => ({
            date: r.date,
            subject: r.subject,
            minutes: r.minutes,
            memo: r.memo,
          })),
          userName,
          plans: plans.map((p) => ({
            title: p.title,
            goal: p.goal,
            startDate: p.startDate,
            endDate: p.endDate,
            tasks: p.tasks.map((t) => ({
              subject: t.subject,
              targetMinutes: t.targetMinutes,
              done: t.done,
            })),
          })),
          memories,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed (${response.status})`);
      }

      const data = await response.json();
      const reply = data.reply ?? 'すみません、回答できませんでした。';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);

      // Save both messages to memory
      await saveMemory('user', text.trim());
      await saveMemory('assistant', reply);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'すみません、通信エラーが発生しました。もう一度お試しください。',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-180px)] min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">AI学習アドバイザー</h3>
            <p className="text-xs text-gray-400">学習相談・問題の解説まで</p>
          </div>
        </div>
        {messages.length > 1 && (
          <button
            onClick={clearMemories}
            disabled={busy}
            className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
            title="会話履歴をクリア"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!memoryLoaded ? (
          <div className="flex justify-center">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-700 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-400">考え中...</span>
                </div>
              </div>
            )}

            {/* Quick questions when only the initial message exists */}
            {messages.length === 1 && !busy && (
              <div className="pt-2">
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  こんなことが聞けます
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="bg-teal-50 hover:bg-teal-100 text-teal-700 text-sm font-medium px-3 py-1.5 rounded-full transition-colors border border-teal-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="質問や問題を入力..."
            maxLength={MAX_CONTENT_LENGTH}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            disabled={busy}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={busy || !input.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl px-4 transition-colors flex items-center justify-center gap-1.5 shrink-0 min-w-[90px]"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">送信中...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">送信</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
