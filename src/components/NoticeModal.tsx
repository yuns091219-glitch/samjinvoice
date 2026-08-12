import React from 'react';
import { Notice } from '../types';
import { X, Bell, Calendar, User } from 'lucide-react';

interface NoticeModalProps {
  notice: Notice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ notice, isOpen, onClose }) => {
  if (!isOpen || !notice) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-base text-white">학생회 공지사항</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            {notice.isImportant && (
              <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2.5 py-0.5 rounded-md mb-2 inline-block">
                [중요 공지]
              </span>
            )}
            <h3 className="font-extrabold text-slate-900 text-lg leading-snug">{notice.title}</h3>

            <div className="flex items-center space-x-3 text-xs text-slate-400 mt-2 pb-3 border-b border-slate-100">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <User className="w-3.5 h-3.5" /> {notice.author}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {notice.date}
              </span>
            </div>
          </div>

          <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            {notice.content}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              닫기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
