
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { syncService } from '../services/sync';
import { authService } from '../services/auth';
import { 
  LogOut, Cloud, CheckCircle2, AlertTriangle, 
  Loader2, XCircle, Wifi 
} from 'lucide-react';

export const ExitApp = () => {
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<'CHECKING' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('CHECKING');
  const [progress, setProgress] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>('...');

  // Triggered when user clicks "Exit System"
  const initiateExit = async () => {
    setShowModal(true);
    setStatus('CHECKING');
    
    // Check Pending Queue
    const count = await db.queue.where('status').equals('PENDING').count();
    
    if (count === 0) {
      // Nothing to sync
      setStatus('SUCCESS');
      setTimeout(() => performLogout(), 800);
    } else {
      // Pending items found
      setPendingCount(count);
      setTotalItems(count);
      setStatus('SYNCING');
      syncService.sync(); // Force sync start
    }
  };

  // Monitor Progress
  useEffect(() => {
    let interval: any;

    if (showModal && status === 'SYNCING') {
      interval = setInterval(async () => {
        const remaining = await db.queue.where('status').equals('PENDING').count();
        const failed = await db.queue.where('status').equals('FAILED').count();

        // Calculate Percentage
        const done = totalItems - remaining;
        const percent = totalItems > 0 ? Math.min(100, Math.round((done / totalItems) * 100)) : 0;
        
        setProgress(percent);
        setPendingCount(remaining);

        // Calculate Estimated Time (Assuming ~0.8s per item avg)
        const seconds = Math.ceil(remaining * 0.8);
        setTimeLeft(seconds > 60 ? `${Math.ceil(seconds/60)} min` : `${seconds} sec`);

        if (remaining === 0) {
          setStatus('SUCCESS');
          clearInterval(interval);
          setTimeout(() => performLogout(), 1000);
        } else if (failed > 0 && remaining === failed) {
            // Stuck on failed items
            setStatus('ERROR');
            clearInterval(interval);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [showModal, status, totalItems]);

  const performLogout = () => {
    authService.logout();
  };

  return (
    <>
      {/* Sidebar Button */}
      <button 
        onClick={initiateExit}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" /> Close System
      </button>

      {/* Sync Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
               
               <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 ring-4 ring-slate-800 shadow-lg relative z-10">
                  {status === 'CHECKING' && <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />}
                  {status === 'SYNCING' && <Wifi className="w-8 h-8 text-amber-400 animate-pulse" />}
                  {status === 'SUCCESS' && <CheckCircle2 className="w-8 h-8 text-emerald-400" />}
                  {status === 'ERROR' && <AlertTriangle className="w-8 h-8 text-red-500" />}
               </div>
               
               <h2 className="text-xl font-bold text-white tracking-tight">
                  {status === 'CHECKING' && 'Checking System State...'}
                  {status === 'SYNCING' && 'Syncing with Cloud...'}
                  {status === 'SUCCESS' && 'Safe to Close'}
                  {status === 'ERROR' && 'Sync Incomplete'}
               </h2>
               <p className="text-slate-400 text-xs mt-2 font-medium uppercase tracking-wider">
                  {status === 'SYNCING' 
                    ? `Please wait (${pendingCount} items remaining)` 
                    : status === 'SUCCESS' ? 'Closing application...' : ''}
               </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
               
               {/* Progress Bar */}
               {status === 'SYNCING' && (
                 <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                       <span>Progress: {progress}%</span>
                       <span>Est. Time: {timeLeft}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                       <div 
                         className="h-full bg-blue-600 transition-all duration-500 ease-out relative"
                         style={{ width: `${progress}%` }}
                       >
                           <div className="absolute inset-0 bg-white/30 animate-[shimmer_1s_infinite]"></div>
                       </div>
                    </div>
                    <p className="text-[10px] text-center text-slate-400 mt-3">Do not close your browser while syncing.</p>
                 </div>
               )}

               {/* Error State */}
               {status === 'ERROR' && (
                 <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                    <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div>
                       <h4 className="font-bold text-red-800 text-sm">Cloud Connection Failed</h4>
                       <p className="text-xs text-red-600 mt-1 leading-relaxed">
                          We couldn't upload some pending data. Check your internet connection. You can force exit, but locally stored data might be lost if you clear your browser cache.
                       </p>
                    </div>
                 </div>
               )}

               {/* Buttons */}
               <div className="flex gap-3 pt-2">
                  {status === 'ERROR' ? (
                     <>
                        <button 
                          onClick={() => setShowModal(false)} 
                          className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 text-sm transition-colors"
                        >
                           Cancel & Stay
                        </button>
                        <button 
                          onClick={performLogout} 
                          className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 text-sm transition-colors shadow-lg shadow-red-500/30"
                        >
                           Force Exit
                        </button>
                     </>
                  ) : (
                     status === 'SUCCESS' ? (
                         <div className="w-full text-center text-emerald-600 font-bold text-sm bg-emerald-50 py-3 rounded-xl border border-emerald-100">
                             Session Closed Successfully
                         </div>
                     ) : (
                        <button 
                          onClick={() => setShowModal(false)}
                          className="w-full py-3 text-slate-400 font-medium text-xs hover:text-slate-600"
                        >
                           Hide window (Sync continues in background)
                        </button>
                     )
                  )}
               </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
};
