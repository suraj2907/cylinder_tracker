import React from 'react';
import { useUser } from '../context/UserContext';

export function PartnerActivityFeed({ activities = [], onClose }) {
  const { currentUser } = useUser();

  const partnerName = currentUser === 'Suraj' ? 'Shivam' : 'Suraj';

  return (
    <div className="bg-white rounded-2xl border border-customBorder shadow-soft p-5 space-y-4 fade">
      <div className="flex items-center justify-between border-b border-customBorder pb-3">
        <div>
          <h3 className="text-sm font-bold text-textSlate flex items-center gap-2">
            <span>⚡ Partner Live Activity Log</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
              Suraj ↔ Shivam
            </span>
          </h3>
          <p className="text-xs text-mutedSlate mt-0.5">
            Real-time feed of changes made by you ({currentUser}) and {partnerName}.
          </p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs px-2 py-1 rounded-lg hover:bg-slate-100"
          >
            ✕ Close
          </button>
        )}
      </div>

      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <div className="text-center py-6 text-xs text-mutedSlate font-semibold">
            No recent activity recorded in this session.
          </div>
        ) : (
          activities.map((act, index) => {
            const isCurrentUser = act.user === currentUser;
            return (
              <div 
                key={act.id || index}
                className={`p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 ${
                  isCurrentUser 
                    ? 'bg-slate-50 border-slate-200' 
                    : 'bg-sky-50/60 border-sky-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                    act.user === 'Suraj' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                  }`}>
                    {act.user === 'Suraj' ? '👨‍💼 S' : '👨‍💻 Sh'}
                  </div>
                  <div>
                    <div className="font-bold text-textSlate flex items-center gap-1.5 flex-wrap">
                      <span className={act.user === currentUser ? 'text-slate-900' : 'text-sky-900 font-extrabold'}>
                        {act.user}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-white border border-slate-200 text-slate-600">
                        {act.actionType}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-1 font-medium leading-relaxed">
                      {act.details}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-semibold text-slate-400 shrink-0 self-end sm:self-start">
                  {act.timestamp}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
