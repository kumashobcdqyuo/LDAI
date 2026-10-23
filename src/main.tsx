import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { Loader2 } from 'lucide-react';
import './index.css';

function Root() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-gray-50 to-sky-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
          <p className="text-gray-400 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>
);
