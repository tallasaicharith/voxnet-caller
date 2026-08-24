import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';

interface NotFoundScreenProps {
  onReturnHome: () => void;
}

export const NotFoundScreen: React.FC<NotFoundScreenProps> = ({ onReturnHome }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08090C] text-slate-100 p-6">
      <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-white/10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Meeting Not Found</h2>
          <p className="text-xs text-slate-400">
            The meeting room code you entered does not exist or has expired. Please check the room URL and try again.
          </p>
        </div>

        <button
          type="button"
          onClick={onReturnHome}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm text-white transition-all flex items-center justify-center space-x-2"
        >
          <Home className="w-4 h-4" />
          <span>Return to Home</span>
        </button>
      </div>
    </div>
  );
};
