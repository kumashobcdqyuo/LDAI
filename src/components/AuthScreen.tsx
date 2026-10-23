import { useState } from 'react';
import { BarChart3, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setDone(false);

    if (mode === 'signup' && !name.trim()) {
      setError('名前を入力してください');
      setBusy(false);
      return;
    }

    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, name.trim());

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-gray-50 to-sky-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-teal-200">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-bold text-gray-800 text-xl">学習ダッシュボード</h1>
          <p className="text-sm text-gray-400 mt-1">仲間と一緒に学習を可視化</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setMode('signin'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                mode === 'signin' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                mode === 'signup' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'
              }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
                  <UserIcon className="w-4 h-4 text-teal-600" />
                  名前
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="表示名"
                  maxLength={20}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
                <Mail className="w-4 h-4 text-teal-600" />
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
                <Lock className="w-4 h-4 text-teal-600" />
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                minLength={6}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  処理中...
                </>
              ) : done ? (
                <>完了</>
              ) : (
                <>{mode === 'signin' ? 'ログイン' : 'アカウント作成'}</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          アカウントを作成して学習を始めましょう
        </p>
      </div>
    </div>
  );
}
