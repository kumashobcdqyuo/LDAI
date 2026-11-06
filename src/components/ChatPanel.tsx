import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Loader2, MessageCircle, Trash2, Plus, MessageSquare, Clock, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StudyRecord, StudyPlan } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatPanelProps {
  records: StudyRecord[];
  userName?: string;
  plans?: StudyPlan[];
  initialPrompt?: string | null;
  onConsumePrompt?: () => void;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'こんにちは！学習に関する相談なら何でも聞いてください。\n\nできること：\n・学習計画の相談（目標や状況を詳しく聞いてから提案します）\n・学習計画のフィードバック（ペース・時間・感想を聞いて改善）\n・科目バランスの分析\n・モチベーション維持のコツ\n・問題の解答・解説\n・効果的な学習方法\n\nこれまでの会話から学習者の状況を記憶し、一人ひとりに合わせたアドバイスをします。\n\nお気軽に質問してください！',
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

function makeTitle(text: string): string {
  const t = text.trim();
  if (t.length <= 20) return t;
  return t.slice(0, 20) + '...';
}

export function ChatPanel({ records, userName, plans = [], initialPrompt = null, onConsumePrompt }: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load conversations:', error.message);
      setLoaded(true);
      return;
    }

    const convs = (data ?? []) as Conversation[];
    setConversations(convs);

    if (convs.length > 0) {
      const latest = convs[0];
      setActiveConversationId(latest.id);
      await loadMessages(latest.id);
    } else {
      setLoaded(true);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_memories')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Failed to load messages:', error.message);
      setMessages([INITIAL_MESSAGE]);
      setLoaded(true);
      return;
    }

    if (data && data.length > 0) {
      const pastMessages: ChatMessage[] = (data as { role: string; content: string }[]).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      setMessages(pastMessages);
    } else {
      setMessages([INITIAL_MESSAGE]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const createConversation = useCallback(async (title: string): Promise<string> => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ title })
      .select('id, title, created_at, updated_at')
      .single();

    if (error) {
      console.error('Failed to create conversation:', error.message);
      throw error;
    }

    const conv = data as Conversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
    setMessages([INITIAL_MESSAGE]);
    return conv.id;
  }, []);

  const saveMessages = async (conversationId: string, userText: string, aiReply: string) => {
    const rows = [
      { conversation_id: conversationId, role: 'user', content: userText },
      { conversation_id: conversationId, role: 'assistant', content: aiReply },
    ];
    const { error } = await supabase.from('chat_memories').insert(rows);
    if (error) console.error('Failed to save memories:', error.message);
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ title })
      .eq('id', conversationId);
    if (error) console.error('Failed to update title:', error.message);
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title } : c)),
    );
  };

  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);
    if (error) {
      console.error('Failed to delete conversation:', error.message);
      return;
    }

    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== conversationId);
      if (activeConversationId === conversationId) {
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
          loadMessages(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([INITIAL_MESSAGE]);
        }
      }
      return remaining;
    });
  };

  const fetchAllMemories = async (): Promise<{ role: string; content: string }[]> => {
    const { data, error } = await supabase
      .from('chat_memories')
      .select('role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(40);
    if (error || !data) return [];
    return (data as { role: string; content: string; created_at: string }[])
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || busy) return;

    let conversationId = activeConversationId;
    const isFirstMessage = !conversationId || messages.length <= 1;

    if (!conversationId) {
      try {
        conversationId = await createConversation(makeTitle(text));
      } catch {
        return;
      }
    }

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setBusy(true);

    // Update title on first real message
    if (isFirstMessage && conversationId) {
      await updateConversationTitle(conversationId, makeTitle(text));
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const cutoff = twoWeeksAgo.toISOString().slice(0, 10);
      const recentRecords = records.filter((r) => r.date >= cutoff);

      const memories = await fetchAllMemories();

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

      await saveMessages(conversationId!, text.trim(), reply);
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

  // Handle initial prompt from outside (e.g. plan feedback)
  useEffect(() => {
    if (initialPrompt && loaded && !busy) {
      sendMessage(initialPrompt);
      onConsumePrompt?.();
    }
  }, [initialPrompt, loaded]);

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([INITIAL_MESSAGE]);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setLoaded(false);
    loadMessages(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[400px]">
      {/* Sidebar overlay (mobile) — tap to close */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'fixed left-0 top-0 bottom-0 z-40 w-72 lg:static lg:z-auto lg:w-64' : 'hidden lg:block'} lg:shrink-0`}>
        <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-xl lg:shadow-none">
          {/* Sidebar header */}
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                <span className="font-bold text-gray-800 text-sm">チャット履歴</span>
              </div>
              {sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-xl py-2.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新規チャットを始める
            </button>
          </div>
          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {conversations.length === 0 ? (
              <div className="text-center py-8 px-3">
                <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">チャット履歴がありません</p>
                <p className="text-xs text-gray-300 mt-1">新規チャットから始めましょう</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                const updated = new Date(conv.updated_at);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - updated.getTime()) / 86400000);
                const dateLabel = diffDays === 0 ? '今日' : diffDays === 1 ? '昨日' : `${diffDays}日前`;
                return (
                  <div
                    key={conv.id}
                    className={`group flex items-start gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                      isActive ? 'bg-teal-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <MessageSquare
                      className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-teal-600' : 'text-gray-300'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm block truncate ${
                          isActive ? 'text-teal-700 font-medium' : 'text-gray-600'
                        }`}
                      >
                        {conv.title}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {dateLabel}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-1 text-gray-500 hover:text-teal-600 transition-colors"
            title="チャット履歴を開く"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">履歴</span>
          </button>
          <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-sm">AI学習アドバイザー</h3>
            <p className="text-xs text-gray-400">学習相談・計画フィードバック・問題の解説</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {!loaded ? (
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
    </div>
  );
}
