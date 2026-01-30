import React, { useState } from 'react';
import { Lock, User, ShieldCheck, CalendarClock, AlertTriangle, RefreshCw, Loader2, ArrowRight, LayoutGrid } from 'lucide-react';
import { Lecturer, UserRole } from '../types';

interface LoginViewProps {
  lecturers: Lecturer[];
  onLogin: (id: string, name: string, role: UserRole) => void;
  onSync?: () => void;
  sessionMessage?: string | null;
}

const LoginView: React.FC<LoginViewProps> = ({ lecturers, onLogin, onSync, sessionMessage }) => {
  const [roleTab, setRoleTab] = useState<UserRole>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (roleTab === 'admin') {
      if (username === 'admin' && password === 'admin') {
        onLogin('admin-1', 'Administrator', 'admin');
      } else {
        setError('Username atau password salah.');
      }
    } else {
      const lecturer = lecturers.find(l => 
        String(l.nip) === username || 
        l.name.toLowerCase().trim() === username.toLowerCase().trim()
      );

      if (lecturer) {
        const correctPassword = (lecturer.password && String(lecturer.password).trim() !== '') 
          ? String(lecturer.password) 
          : String(lecturer.nip);

        if (password === correctPassword) {
           onLogin(String(lecturer.id), lecturer.name, 'lecturer');
           return;
        }
      }
      setError('NIP atau Password tidak ditemukan.');
    }
  };

  const handleManualSync = async () => {
    if (onSync) {
      setIsRefreshing(true);
      setError('');
      try {
        await onSync();
        setTimeout(() => setIsRefreshing(false), 1000);
      } catch (e) {
        setIsRefreshing(false);
      }
    }
  };

  const switchTab = (tab: UserRole) => {
    setRoleTab(tab);
    setUsername('');
    setPassword('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[100px] animate-float"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[80px]" style={{animationDelay: '2s'}}></div>

      <div className="bg-white/80 backdrop-blur-xl w-full max-w-5xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden flex flex-col md:flex-row relative z-10">
        
        {/* Left Side - Hero */}
        <div className="md:w-5/12 bg-gradient-to-br from-primary-900 to-primary-700 p-10 flex flex-col justify-between text-white relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
           
           <div className="relative z-10">
             <div className="flex items-center gap-3 font-bold text-xl tracking-tight mb-8">
               <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                 <CalendarClock size={22} className="text-white" />
               </div>
               SIMPDB
             </div>
             <h1 className="text-4xl font-bold leading-tight mb-4">Sistem Manajemen <br/><span className="text-primary-100">Penjadwalan Kuliah</span></h1>
             <p className="text-primary-100/80 text-sm leading-relaxed max-w-sm">
               Platform untuk pengelolaan jadwal kuliah, plotting dosen, ruang kelas, dan presensi.
             </p>
           </div>

           <div className="relative z-10 mt-12 space-y-4">
             <div className="flex items-center gap-3 text-sm text-primary-100/90">
                <div className="bg-white/10 p-2 rounded-lg"><LayoutGrid size={16}/></div>
                <span>Manajemen Ruang & Kelas</span>
             </div>
             <div className="flex items-center gap-3 text-sm text-primary-100/90">
                <div className="bg-white/10 p-2 rounded-lg"><ShieldCheck size={16}/></div>
                <span>Portal Dosen</span>
             </div>
           </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="md:w-7/12 p-10 md:p-14 bg-white relative">
           {onSync && (
            <button 
              onClick={handleManualSync}
              disabled={isRefreshing}
              className="absolute top-6 right-6 text-slate-400 hover:text-primary-600 transition-colors p-2 rounded-full hover:bg-slate-50"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
           )}

           <div className="max-w-sm mx-auto">
             <div className="mb-8">
               <h2 className="text-2xl font-bold text-slate-800">Selamat Datang</h2>
               <p className="text-slate-500 text-sm mt-1">Silakan masuk untuk mengakses dashboard.</p>
             </div>

             {sessionMessage && (
                <div className="bg-amber-50 text-amber-700 text-xs p-4 rounded-xl flex items-start gap-3 mb-6 border border-amber-100">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{sessionMessage}</span>
                </div>
              )}

             {/* Modern Tabs */}
             <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl mb-8">
               <button
                 onClick={() => switchTab('admin')}
                 className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                   roleTab === 'admin' 
                   ? 'bg-white text-primary-700 shadow-sm' 
                   : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 Admin
               </button>
               <button
                 onClick={() => switchTab('lecturer')}
                 className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                   roleTab === 'lecturer' 
                   ? 'bg-white text-primary-700 shadow-sm' 
                   : 'text-slate-500 hover:text-slate-700'
                 }`}
               >
                 Dosen
               </button>
             </div>

             <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {roleTab === 'admin' ? 'Username' : 'Nama Lengkap / NIP'}
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-800"
                      placeholder={roleTab === 'admin' ? 'Masukkan username' : 'Contoh: 198501...'}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <User size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Password
                  </label>
                  <div className="relative group">
                    <input
                      type="password"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-800"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Lock size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  {roleTab === 'lecturer' && <p className="text-[10px] text-slate-400 text-right">Default: NIP Anda</p>}
                </div>

                {error && (
                  <div className="text-red-600 text-xs bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2">
                    <AlertTriangle size={14}/> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRefreshing}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary-200 disabled:opacity-70 disabled:shadow-none flex justify-center items-center gap-2 group mt-2"
                >
                  {isRefreshing ? <Loader2 size={20} className="animate-spin" /> : (
                    <>
                      {roleTab === 'admin' ? 'Masuk Dashboard' : 'Masuk Portal'}
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform opacity-80" />
                    </>
                  )}
                </button>
             </form>
           </div>
        </div>
      </div>
      
      <div className="absolute bottom-6 text-center w-full text-slate-400 text-xs font-medium">
        &copy; {new Date().getFullYear()} Pembelajaran Dasar Bersama • Sistem Penjadwalan Terpadu
      </div>
    </div>
  );
};

export default LoginView;
