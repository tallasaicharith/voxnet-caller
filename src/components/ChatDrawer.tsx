import React, { useState, useRef } from 'react';
import { X, Send, Paperclip, FileText, Download, Image as ImageIcon } from 'lucide-react';
import { ChatMessagePayload, FileAssetPayload } from '../types/signaling';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserId: string;
  currentUserName: string;
  messages: ChatMessagePayload[];
  files: FileAssetPayload[];
  onSendMessage: (content: string) => void;
  onUploadFile: (file: File) => Promise<void>;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  currentUserId,
  messages,
  files,
  onSendMessage,
  onUploadFile,
}) => {
  const [inputContent, setInputContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    onSendMessage(inputContent.trim());
    setInputContent('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);
      await onUploadFile(file);
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 glass-panel border-l border-white/10 z-40 flex flex-col shadow-2xl bg-[#0B0D12]/95 backdrop-blur-2xl">
      {/* Drawer Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">In-Meeting Chat</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && files.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <p className="text-xs">No messages yet. Send a message to start the conversation.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-[11px] font-medium text-slate-400">{msg.senderName}</span>
                <span className="text-[10px] text-slate-600">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/10'
                    : 'bg-slate-800/80 text-slate-200 rounded-bl-none border border-white/5'
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Files Section */}
        {files.map((file) => (
          <div key={file.id} className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                {file.mimeType.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                )}
                <span className="text-xs text-slate-200 truncate font-medium">{file.fileName}</span>
              </div>
              <a
                href={file.url}
                download
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Shared by {file.uploadedBy}</span>
              <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex items-center space-x-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Share File"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-xs text-white focus:outline-none placeholder-slate-500"
        />

        <button
          type="submit"
          disabled={!inputContent.trim()}
          className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
