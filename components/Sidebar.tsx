
import React from 'react';
import { LayoutDashboard, BookOpen, Users, Building2, Calendar, Menu, X, UserCheck, LogOut, CalendarClock, Activity, Settings, Layers, Key, ClipboardCheck, BarChart3, Banknote, ChevronRight, RefreshCw } from 'lucide-react';
import { ViewState, UserRole } from '../types';

interface SidebarProps {
  currentView: ViewState;
  userRole: UserRole;
  onChangeView: (view: ViewState) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
  onChangePassword?: () => void;
  onSync?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, userRole, onChangeView, isOpen, toggleSidebar, onLogout, onChangePassword, onSync }) => {
  const adminMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'attendance', label: 'Presensi Dosen', icon: ClipboardCheck },
    { id: 'honor', label: 'Honor Mengajar', icon: Banknote },
    { id: 'schedule', label: 'Jadwal Kuliah', icon: Calendar },
    { id: 'courses', label: 'Mata Kuliah', icon: BookOpen },
    { id: 'lecturers', label: 'Dosen', icon: Users },
    { id: 'rooms', label: 'Ruangan', icon: Building2 },
    { id: 'classes', label: 'Data Kelas', icon: Layers },
    { id: 'settings', label: 'Konfigurasi', icon: Settings },
  ];

  const lecturerMenu = [
     { id: 'portal', label: 'Portal Dosen', icon: UserCheck },
     { id: 'lecturer_monitoring', label: 'Monitoring Kehadiran', icon: BarChart3 },
  ];

  const activeMenu = userRole === 'admin' ? adminMenu : lecturerMenu;

  const navClass = (id: string) => {
    const isActive = currentView === id;
    return `
      group flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer mb-1 no-underline relative overflow-hidden w-full text-left
      ${isActive 
        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
      }
    `;
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-[260px] bg-[#0f172a] text-white flex flex-col border-r border-slate-800
        transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
              <CalendarClock size={20} className="text-white" />
            </div>
            <div>
              <span className="block leading-none">SIMPDB</span>
              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide leading-tight block mt-0.5">Pembelajaran Dasar Bersama</span>
            </div>
            <button onClick={toggleSidebar} className="md:hidden text-slate-400 ml-auto">
              <X size={24} />
            </button>
          </div>
          
          <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">
            Main Menu
          </div>
          <div className="space-y-1">
            {activeMenu.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  onChangeView(item.id as ViewState);
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={navClass(item.id)}
              >
                <item.icon size={20} className={`transition-colors ${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                <span className="font-medium text-sm flex-1">{item.label}</span>
                {currentView === item.id && <ChevronRight size={14} className="opacity-80" />}
              </button>
            ))}
          </div>

          {userRole === 'admin' && (
             <div className="mt-8">
               <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">
                External
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onChangeView('portal');
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={navClass('portal')}
              >
                <UserCheck size={20} className={`transition-colors ${currentView === 'portal' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                <span className="font-medium text-sm flex-1">Portal Dosen</span>
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="space-y-1">
            {onSync && (
              <button 
                type="button"
                onClick={() => {
                  onSync();
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all text-left group"
              >
                <RefreshCw size={18} className="group-hover:text-emerald-400 transition-colors" />
                <span className="font-medium text-sm">Sync Database</span>
              </button>
            )}

            {userRole === 'lecturer' && onChangePassword && (
               <button 
                type="button"
                onClick={() => {
                  onChangePassword();
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all text-left group"
              >
                <Key size={18} className="group-hover:text-primary-400 transition-colors" />
                <span className="font-medium text-sm">Ganti Password</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all text-left group"
            >
              <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
              <span className="font-medium text-sm">Keluar Sesi</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
