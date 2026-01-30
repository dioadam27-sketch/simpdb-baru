
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, BookOpen, Clock, Building2, Calendar, CheckCircle, AlertTriangle, X, Filter, Layers, ChevronLeft, ArrowRight, RefreshCw, Loader2, Users, Star, Search, ChevronDown, MapPin, ShieldCheck, UserPlus, Info, Lock, Activity, BarChart3, LayoutDashboard, Key, CheckSquare, Square, ClipboardCheck, Eye, Save, Trash2 } from 'lucide-react';
import { Course, Lecturer, Room, ScheduleItem, TeachingLog, UserRole } from '../types';
import StatCard from '../components/StatCard';

interface LecturerPortalProps {
  currentLecturerId?: string;
  userRole?: UserRole; // To check if admin or lecturer
  courses: Course[];
  lecturers: Lecturer[];
  rooms: Room[];
  schedule: ScheduleItem[];
  setSchedule: (schedule: ScheduleItem[]) => void;
  onUpdateLecturer?: (scheduleId: string, lecturerIds: string[], pjmkId?: string) => void;
  onSync?: () => void;
  isLocked?: boolean;
  teachingLogs?: TeachingLog[];
  onAddLog?: (log: TeachingLog) => void;
  onRemoveLog?: (scheduleId: string, lecturerId: string, week: number) => void;
}

const LecturerPortal: React.FC<LecturerPortalProps> = ({
  currentLecturerId,
  userRole = 'lecturer',
  courses,
  lecturers,
  rooms,
  schedule,
  setSchedule,
  onUpdateLecturer,
  onSync,
  isLocked = false,
  teachingLogs = [],
  onAddLog,
  onRemoveLog
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(currentLecturerId || '');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  
  // Search states for custom dropdown
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'claim_pjmk' | 'join_team' | 'release';
    item: ScheduleItem | null;
  }>({
    isOpen: false,
    type: 'claim_pjmk',
    item: null
  });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Modal Presensi List
  const [attendanceModal, setAttendanceModal] = useState<{
     isOpen: boolean;
     item: ScheduleItem | null;
  }>({ isOpen: false, item: null });

  // Modal Presensi Detail (Date Input) - Only for Admin in this view context, or read-only details
  const [detailModal, setDetailModal] = useState<{
     isOpen: boolean;
     week: number;
     existingLog?: TeachingLog;
  } | null>(null);
  
  const [inputDate, setInputDate] = useState<string>('');

  // Calculate Used Rooms (Global Stats)
  const usedRoomCount = useMemo(() => new Set(schedule.map(s => s.roomId)).size, [schedule]);

  // Is Attendance Editable? Only if user is ADMIN.
  const isAttendanceEditable = userRole === 'admin';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentLecturerId) {
      setSelectedLecturerId(currentLecturerId);
    }
  }, [currentLecturerId]);

  // SORTED LECTURERS (A-Z)
  const sortedLecturers = useMemo(() => {
    return [...lecturers].sort((a, b) => a.name.localeCompare(b.name));
  }, [lecturers]);

  // FILTERED LECTURERS based on search term
  const filteredLecturerOptions = useMemo(() => {
    if (!searchTerm.trim()) return sortedLecturers;
    const term = searchTerm.toLowerCase();
    return sortedLecturers.filter(l => 
      l.name.toLowerCase().includes(term) || 
      String(l.nip).includes(term)
    );
  }, [sortedLecturers, searchTerm]);

  const lecturerObj = useMemo(() => lecturers.find(l => String(l.id) === String(selectedLecturerId)), [lecturers, selectedLecturerId]);
  const currentLecturerName = lecturerObj?.name || 'Dosen';
  const currentLecturerNIP = lecturerObj?.nip || '';

  const getCourse = (id: string) => courses.find(c => String(c.id) === String(id));
  const getRoom = (id: string) => rooms.find(r => String(r.id) === String(id));
  const getRoomName = (id: string) => getRoom(id)?.name || id;

  const availableSchedules = useMemo(() => {
    return schedule.filter(s => {
       const ids = s.lecturerIds || [];
       // LIMIT CHANGED: Max 2 lecturers per class
       const isFull = ids.length >= 2;
       const isAlreadyJoined = ids.includes(selectedLecturerId);
       return !isFull && !isAlreadyJoined;
    });
  }, [schedule, selectedLecturerId]);

  const coursesWithOpenSlots = useMemo(() => {
    return courses.filter(course => 
      availableSchedules.some(s => String(s.courseId) === String(course.id))
    );
  }, [courses, availableSchedules]);

  const availableSessionsForSelectedCourse = useMemo(() => 
    availableSchedules.filter(s => String(s.courseId) === String(selectedCourseId)),
  [availableSchedules, selectedCourseId]);

  const mySchedules = useMemo(() => 
    schedule.filter(s => (s.lecturerIds || []).includes(selectedLecturerId)),
  [schedule, selectedLecturerId]);

  // --- WORKLOAD STATS CALCULATION ---
  const lecturerStats = useMemo(() => {
    let totalPlannedSKS = 0;
    let totalRealizedSKS = 0;

    mySchedules.forEach(item => {
        const course = getCourse(item.courseId);
        const teamSize = item.lecturerIds?.length || 0;
        if (course && teamSize > 0) {
            // Rencana SKS (Target)
            totalPlannedSKS += (course.credits / teamSize);

            // Realisasi SKS (Capaian)
            // Rumus: (SKS MK * Kehadiran) / 16
            const attendanceCount = teachingLogs.filter(l => 
                l.scheduleId === item.id && 
                l.lecturerId === selectedLecturerId
            ).length;
            
            const realized = (course.credits * attendanceCount) / 16;
            totalRealizedSKS += realized;
        }
    });
    return {
        planned: totalPlannedSKS,
        realized: totalRealizedSKS,
        count: mySchedules.length
    };
  }, [mySchedules, courses, teachingLogs, selectedLecturerId]);

  const initiateClaim = (item: ScheduleItem) => {
    if (isLocked) {
        setAlertModal({
            isOpen: true,
            title: 'Jadwal Terkunci',
            message: 'Maaf, periode pengambilan jadwal telah ditutup dan diverifikasi oleh Admin. Anda tidak dapat mengambil jadwal baru.'
        });
        return;
    }

    // Check for max 2 concurrent classes
    const conflicts = mySchedules.filter(s => 
      s.day === item.day && 
      s.timeSlot === item.timeSlot
    );

    // LIMIT CHECK: If already have 2 classes at this time
    if (conflicts.length >= 2) {
      const conflictDetails = conflicts.map(c => 
         `${c.className} (${getCourse(c.courseId)?.name})`
      ).join(', ');

      setAlertModal({
        isOpen: true,
        title: 'Batas Jadwal Tercapai',
        message: `Anda tidak dapat mengambil jadwal ini karena sudah memiliki 2 kelas lain di waktu yang sama.`,
        details: `Jadwal Bentrok: ${item.day}, ${item.timeSlot} — ${conflictDetails}`
      });
      return;
    }

    const currentTeam = item.lecturerIds || [];
    if (currentTeam.length === 0) {
        setConfirmModal({ isOpen: true, type: 'claim_pjmk', item: item });
    } else {
        setConfirmModal({ isOpen: true, type: 'join_team', item: item });
    }
  };

  const initiateRelease = (item: ScheduleItem) => {
    if (isLocked) {
        setAlertModal({
            isOpen: true,
            title: 'Jadwal Terkunci',
            message: 'Maaf, periode jadwal telah dikunci oleh Admin. Anda tidak dapat melepas jadwal yang sudah diambil. Silakan hubungi Admin jika ada perubahan mendesak.'
        });
        return;
    }
    setConfirmModal({ isOpen: true, type: 'release', item: item });
  };

  const handleConfirmAction = (asPjmk: boolean = false) => {
    const { type, item } = confirmModal;
    if (!item) return;

    if (type === 'claim_pjmk' || type === 'join_team') {
       const currentIds = item.lecturerIds || [];
       const newIds = [...currentIds, selectedLecturerId];
       let pjmkId = item.pjmkLecturerId;
       
       if (type === 'claim_pjmk') {
           if (asPjmk) {
               pjmkId = selectedLecturerId;
           }
       } else if (type === 'join_team') {
           // Auto-assign PJMK if none exists in the class yet
           if (!pjmkId) {
               pjmkId = selectedLecturerId;
           }
       }
       
       if (onUpdateLecturer) {
          onUpdateLecturer(item.id, newIds, pjmkId);
       } else {
          const updatedSchedule = schedule.map(s => s.id === item.id ? { ...s, lecturerIds: newIds, pjmkLecturerId: pjmkId } : s);
          setSchedule(updatedSchedule);
       }
    } else if (type === 'release') {
       const currentIds = item.lecturerIds || [];
       const newIds = currentIds.filter(id => id !== selectedLecturerId);
       let pjmkId = item.pjmkLecturerId;
       if (pjmkId === selectedLecturerId) {
           pjmkId = newIds.length > 0 ? newIds[0] : '';
       }
       if (onUpdateLecturer) {
          onUpdateLecturer(item.id, newIds, pjmkId);
       } else {
          const updatedSchedule = schedule.map(s => s.id === item.id ? { ...s, lecturerIds: newIds, pjmkLecturerId: pjmkId } : s);
          setSchedule(updatedSchedule);
       }
    }
    setConfirmModal({ isOpen: false, type: 'claim_pjmk', item: null });
  };

  // --- ATTENDANCE HANDLERS ---
  const handleSlotClick = (week: number) => {
     if (!attendanceModal.item) return;
     
     const existingLog = teachingLogs.find(l => l.scheduleId === attendanceModal.item!.id && l.lecturerId === selectedLecturerId && l.week === week);
     
     // If not admin and log exists, just show detail
     // If admin, open edit modal
     
     setDetailModal({
         isOpen: true,
         week,
         existingLog
     });
     
     if (isAttendanceEditable) {
         setInputDate(existingLog?.date || new Date().toISOString().split('T')[0]);
     }
  };

  const saveAttendance = () => {
    if (!attendanceModal.item || !onAddLog || !detailModal) return;
    
    onAddLog({
        id: '',
        scheduleId: attendanceModal.item.id,
        lecturerId: selectedLecturerId,
        week: detailModal.week,
        timestamp: new Date().toISOString(),
        date: inputDate
    });
    setDetailModal(null);
  };

  const removeAttendance = () => {
     if (!attendanceModal.item || !onRemoveLog || !detailModal) return;
     onRemoveLog(attendanceModal.item.id, selectedLecturerId, detailModal.week);
     setDetailModal(null);
  };

  const getAttendanceCount = (scheduleId: string) => {
     return teachingLogs.filter(l => l.scheduleId === scheduleId && l.lecturerId === selectedLecturerId).length;
  };

  const getTeamDisplay = (ids: string[], pjmkId?: string) => {
     if (!ids || ids.length === 0) return <span className="text-slate-400 italic">Kosong</span>;
     return (
        <div className="flex flex-col gap-1">
            {ids.map((id, idx) => {
                const lec = lecturers.find(l => l.id === id);
                const isPjmk = id === pjmkId;
                return (
                    <div key={idx} className="flex items-center gap-1.5 text-xs">
                        <User size={12} className={isPjmk ? "text-amber-500" : "text-slate-400"} />
                        <span className={isPjmk ? "font-bold text-slate-800" : "text-slate-600"}>{lec?.name || 'Unknown'}</span>
                        {isPjmk && <Star size={10} className="text-amber-500 fill-amber-500" />}
                    </div>
                )
            })}
        </div>
     );
  };

  return (
    <div className="space-y-6 relative pb-12">
      {/* ... (Previous Header and Stat Code same as before) ... */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 shadow-sm"><User size={28} /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Portal Dosen</h2>
            <p className="text-slate-500 text-sm">Selamat datang, <span className="font-semibold text-blue-600">{currentLecturerName}</span> {currentLecturerNIP && <span className="text-xs text-slate-400">({currentLecturerNIP})</span>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {onSync && (
            <button 
                onClick={onSync}
                className="flex items-center gap-2 bg-white text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm font-bold text-sm transition-all active:scale-95 w-fit"
            >
                <RefreshCw size={16} /> Sync
            </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-fade-in">
         <StatCard title="Mata Kuliah" value={courses.length} icon={BookOpen} color="text-blue-500" />
         <StatCard title="Total Dosen" value={lecturers.length} icon={Users} color="text-emerald-500" />
         <StatCard title="Ruangan" value={rooms.length} icon={Building2} color="text-orange-500" />
         <StatCard title="Ruangan Terpakai" value={usedRoomCount} icon={LayoutDashboard} color="text-indigo-500" />
         <StatCard title="Total Jadwal" value={schedule.length} icon={Calendar} color="text-purple-500" />
      </div>
      
      {/* ... (Existing logic for Lock, Simulation Mode, Stats etc.) ... */}
      
      {!currentLecturerId && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center gap-4 animate-fade-in shadow-sm relative mt-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-700 shrink-0"><AlertTriangle size={20} /></div>
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">Simulasi Mode Admin</p>
              <p className="text-[11px] text-amber-700">Pilih identitas dosen untuk mencoba fitur klaim jadwal.</p>
            </div>
          </div>
          
          <div className="relative w-full md:w-80" ref={dropdownRef}>
            <div 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center justify-between bg-white border border-amber-300 rounded-xl px-4 py-2.5 cursor-pointer shadow-sm hover:border-amber-400 transition-all"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Search size={16} className="text-amber-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 truncate">
                  {selectedLecturerId ? currentLecturerName : '-- Pilih Dosen (Cari Nama/NIP) --'}
                </span>
              </div>
              <ChevronDown size={18} className={`text-amber-500 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
            </div>

            {isSearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-zoom-in">
                <div className="p-3 border-b border-slate-100">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Ketik nama atau NIP..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {filteredLecturerOptions.length > 0 ? (
                    filteredLecturerOptions.map(l => (
                      <div 
                        key={l.id}
                        onClick={() => {
                          setSelectedLecturerId(l.id);
                          setSelectedCourseId(null);
                          setIsSearchOpen(false);
                          setSearchTerm('');
                        }}
                        className={`px-4 py-2.5 hover:bg-amber-50 cursor-pointer transition-colors border-l-4 ${selectedLecturerId === l.id ? 'border-amber-500 bg-amber-50/50' : 'border-transparent'}`}
                      >
                        <div className="text-sm font-bold text-slate-800">{l.name}</div>
                        <div className="text-[10px] text-slate-500">NIP: {l.nip} • {l.position}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-slate-400 text-xs italic">
                      Dosen tidak ditemukan...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedLecturerId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in mt-4">
          
          {/* Card 1: Rencana SKS */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200 relative overflow-hidden flex flex-col justify-between h-32">
             <div className="relative z-10">
                <p className="text-blue-100 text-xs font-bold uppercase tracking-wide mb-1">Total Rencana SKS</p>
                <h3 className="text-3xl font-bold">{lecturerStats.planned.toFixed(2)}</h3>
                <p className="text-[10px] text-blue-200 mt-1">Target beban mengajar</p>
             </div>
             <BarChart3 className="absolute right-[-10px] bottom-[-10px] text-white opacity-20" size={64} />
          </div>

          {/* Card 2: Realisasi SKS */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200 relative overflow-hidden flex flex-col justify-between h-32">
             <div className="relative z-10">
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-wide mb-1">Total Realisasi SKS</p>
                <h3 className="text-3xl font-bold">{lecturerStats.realized.toFixed(2)}</h3>
                <p className="text-[10px] text-emerald-200 mt-1">Berdasarkan presensi</p>
             </div>
             <CheckCircle className="absolute right-[-10px] bottom-[-10px] text-white opacity-20" size={64} />
          </div>

          {/* Card 3: Kelas Diampu */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
             <div className="relative z-10">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">Kelas Diampu</p>
                <h3 className="text-3xl font-bold text-slate-800">{lecturerStats.count}</h3>
                <p className="text-[10px] text-slate-400 mt-1">Total kelas aktif</p>
             </div>
             <Layers className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-100" size={48} />
          </div>
          
          {/* Card 4: Info */}
           <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-center gap-2 h-32">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                 <Info size={16} className="text-blue-600"/> Info Perhitungan
              </div>
              <div className="text-[10px] text-slate-600 leading-relaxed">
                 <strong>Rencana:</strong> SKS MK / Tim Pengajar.<br/>
                 <strong>Realisasi:</strong> (SKS MK x Kehadiran) / 16.
              </div>
           </div>
        </div>
      )}

      {!selectedLecturerId ? (
         <div className="bg-white rounded-2xl p-20 text-center shadow-sm border border-slate-200 mt-6">
           <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
             <User size={40} />
           </div>
           <h3 className="text-xl font-bold text-slate-700">Identitas Belum Dipilih</h3>
           <p className="text-slate-400 max-w-xs mx-auto mt-2">Silakan pilih nama dosen pada panel di atas untuk mengakses jadwal kuliah.</p>
         </div>
      ) : (
        <>
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit mt-4">
                <button 
                  onClick={() => setActiveTab('available')} 
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'available' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <BookOpen size={18} /> Jadwal Tersedia
                </button>
                <button 
                  onClick={() => setActiveTab('mine')} 
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'mine' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <CheckCircle size={18} /> Jadwal Saya
                  {mySchedules.length > 0 && <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'mine' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>{mySchedules.length}</span>}
                </button>
            </div>

            <div className="min-h-[500px] animate-fade-in mt-6">
                {activeTab === 'available' && (
                    <div className="space-y-6">
                         {/* ... (Existing code for Available Tab - No changes needed) ... */}
                        {!selectedCourseId ? (
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800">Pilih Mata Kuliah</h3>
                                    <p className="text-slate-500 text-sm">Klik pada salah satu mata kuliah untuk melihat jadwal kelas (PDB) yang tersedia.</p>
                                </div>
                                
                                {coursesWithOpenSlots.length === 0 ? (
                                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                                        <Layers size={40} className="mx-auto mb-4 opacity-20" />
                                        <p className="font-medium text-lg">Tidak ada jadwal tersedia untuk Anda.</p>
                                        <p className="text-sm">Mungkin semua kelas sudah penuh (max 2 dosen) atau Anda sudah mengambil semua opsi.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {coursesWithOpenSlots.map(course => {
                                            const availableCount = availableSchedules.filter(s => String(s.courseId) === String(course.id)).length;
                                            return (
                                                <div 
                                                  key={course.id} 
                                                  onClick={() => setSelectedCourseId(course.id)}
                                                  className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50 transition-all cursor-pointer group relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                        <BookOpen size={80} />
                                                    </div>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600"><Layers size={20} /></div>
                                                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">{availableCount} Opsi Tersedia</span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight group-hover:text-blue-600 transition-colors">{course.name}</h4>
                                                    <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{course.code} • {course.credits} SKS</p>
                                                    <div className="mt-6 flex items-center text-blue-600 font-bold text-xs gap-2">
                                                        Lihat Jadwal <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <button 
                                      onClick={() => setSelectedCourseId(null)}
                                      className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">{getCourse(selectedCourseId)?.name}</h3>
                                        <p className="text-slate-500 text-sm">Daftar kelas PDB yang tersedia untuk Anda.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {availableSessionsForSelectedCourse.map(item => {
                                        const teamCount = (item.lecturerIds || []).length;
                                        const room = getRoom(item.roomId);
                                        return (
                                          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all flex justify-between items-center group">
                                              <div>
                                                  <div className="flex items-center gap-2 mb-3">
                                                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-tight shadow-sm">{item.className}</span>
                                                      <span className="text-[11px] text-slate-400 font-bold tracking-widest uppercase">Ruang: {room?.name || item.roomId} {room?.building && `• Gedung ${room.building}`}</span>
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-2">
                                                      <div className="flex items-center gap-1.5"><Calendar size={16} className="text-blue-500"/> <span className="font-semibold">{item.day}</span></div>
                                                      <div className="flex items-center gap-1.5"><Clock size={16} className="text-blue-500"/> <span className="font-semibold">{item.timeSlot}</span></div>
                                                  </div>
                                                  {teamCount > 0 && (
                                                      <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                                                          <div className="flex items-center gap-1 font-bold mb-1 text-slate-700">
                                                              <Users size={12}/> Team Teaching ({teamCount}/2):
                                                          </div>
                                                          {getTeamDisplay(item.lecturerIds || [], item.pjmkLecturerId)}
                                                      </div>
                                                  )}
                                              </div>
                                              <button 
                                                onClick={() => initiateClaim(item)} 
                                                disabled={isLocked}
                                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 text-white ${isLocked ? 'bg-slate-300 cursor-not-allowed shadow-none' : teamCount === 0 ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                                              >
                                                {isLocked ? 'Terkunci' : teamCount === 0 ? 'Ambil Kelas' : 'Gabung Team'}
                                              </button>
                                          </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'mine' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800">Jadwal Mengajar Anda</h3>
                            <p className="text-slate-500 text-sm">Berikut adalah daftar kelas PDB yang telah Anda ambil.</p>
                        </div>
                        
                        {mySchedules.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                                <CheckCircle size={40} className="mx-auto mb-4 opacity-20" />
                                <p className="font-medium text-lg">Belum ada jadwal.</p>
                                <p className="text-sm">Silakan pilih kelas pada tab "Jadwal Tersedia".</p>
                            </div>
                        ) : (
                             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Kelas</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Mata Kuliah</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Ruangan & Gedung</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Waktu</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Team</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Presensi (16 TM)</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {mySchedules.map(item => {
                                                const course = getCourse(item.courseId);
                                                const room = getRoom(item.roomId);
                                                const isMePjmk = item.pjmkLecturerId === selectedLecturerId;
                                                const attendanceCount = getAttendanceCount(item.id);
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-4"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded font-black text-xs uppercase">{item.className}</span></td>
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-800 text-sm">{course?.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{course?.code}</div>
                                                            {isMePjmk && <span className="mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold"><Star size={8} /> Anda PJMK</span>}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2 text-slate-700 text-sm font-bold">
                                                                <Building2 size={14} className="text-blue-500" />
                                                                {room?.name || item.roomId}
                                                            </div>
                                                            {room?.building && (
                                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 uppercase tracking-tight">
                                                                    <MapPin size={10} />
                                                                    Gedung {room.building}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-slate-700 text-xs font-semibold leading-relaxed">{item.day}<br/>{item.timeSlot}</td>
                                                        <td className="p-4">
                                                            {getTeamDisplay(item.lecturerIds || [], item.pjmkLecturerId)}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button 
                                                                onClick={() => setAttendanceModal({isOpen: true, item: item})}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all mx-auto ${isAttendanceEditable ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'}`}
                                                            >
                                                                {isAttendanceEditable ? <ClipboardCheck size={14} /> : <Eye size={14} />}
                                                                {isAttendanceEditable ? `Isi Kehadiran (${attendanceCount}/16)` : `Lihat Kehadiran (${attendanceCount}/16)`}
                                                            </button>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <button 
                                                              onClick={() => initiateRelease(item)} 
                                                              disabled={isLocked}
                                                              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${isLocked ? 'text-slate-400 border-slate-200 cursor-not-allowed bg-slate-50' : 'text-red-500 hover:text-white hover:bg-red-500 border-red-200'}`}
                                                            >
                                                              {isLocked ? 'Terkunci' : 'Lepas'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
      )}

      {/* ATTENDANCE MODAL (LIST OF WEEKS) */}
      {attendanceModal.isOpen && attendanceModal.item && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-10 sm:pt-20">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setAttendanceModal({isOpen: false, item: null})}></div>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-slide-down">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><ClipboardCheck size={18} className="text-emerald-600"/> Kehadiran Mengajar</h3>
                        <p className="text-xs text-slate-500">Kelas {attendanceModal.item.className} - {getCourse(attendanceModal.item.courseId)?.name}</p>
                      </div>
                      <button onClick={() => setAttendanceModal({isOpen: false, item: null})}><X size={20} className="text-slate-400" /></button>
                  </div>
                  <div className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-slate-600">
                            {isAttendanceEditable 
                              ? 'Klik pada pertemuan untuk mengisi atau mengubah tanggal realisasi.' 
                              : 'Klik pada pertemuan untuk melihat detail tanggal kehadiran.'}
                        </p>
                        {!isAttendanceEditable && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold border border-slate-200 flex items-center gap-1">
                                <Lock size={10} /> View Only
                            </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                          {Array.from({length: 16}, (_, i) => i + 1).map(week => {
                              const isPresent = teachingLogs?.some(l => l.scheduleId === attendanceModal.item!.id && l.lecturerId === selectedLecturerId && l.week === week);
                              return (
                                  <button 
                                    key={week}
                                    onClick={() => handleSlotClick(week)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all relative ${
                                        isPresent 
                                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-md transform scale-105' 
                                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-blue-300'
                                    }`}
                                  >
                                      <span className="text-[10px] font-bold uppercase opacity-80">Mg</span>
                                      <span className="text-lg font-black">{week}</span>
                                      {isPresent ? <CheckCircle size={14} className="mt-1"/> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 mt-1"></div>}
                                  </button>
                              )
                          })}
                      </div>
                      <div className="mt-6 flex justify-end">
                          <button 
                            onClick={() => setAttendanceModal({isOpen: false, item: null})}
                            className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg"
                          >
                              Selesai
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* DETAIL MODAL (DATE INPUT) */}
      {detailModal && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-20 sm:pt-32">
           <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setDetailModal(null)}></div>
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-20 animate-slide-down">
              <div className="p-5 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-lg">Detail Kehadiran</h3>
                  <p className="text-sm text-slate-500">Pertemuan Ke-{detailModal.week}</p>
              </div>
              <div className="p-6 space-y-4">
                  {isAttendanceEditable ? (
                    <>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tanggal Realisasi</label>
                          <input 
                            type="date"
                            value={inputDate}
                            onChange={(e) => setInputDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                          />
                      </div>
                      <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                          <Calendar size={18} className="text-blue-500" />
                          <div className="text-sm">
                              <span className="text-slate-500">Hari:</span> <span className="font-bold text-blue-700">{inputDate ? new Date(inputDate).toLocaleDateString('id-ID', { weekday: 'long' }) : '-'}</span>
                          </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                       {detailModal.existingLog ? (
                          <>
                            <div className="text-4xl font-black text-slate-800 mb-2">
                               {new Date(detailModal.existingLog.date || '').getDate()}
                            </div>
                            <div className="text-lg font-bold text-blue-600 mb-1">
                               {new Date(detailModal.existingLog.date || '').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                            </div>
                            <div className="text-sm text-slate-500 uppercase font-bold tracking-widest">
                               {new Date(detailModal.existingLog.date || '').toLocaleDateString('id-ID', { weekday: 'long' })}
                            </div>
                          </>
                       ) : (
                          <p className="text-slate-400 italic">Belum ada data kehadiran.</p>
                       )}
                    </div>
                  )}
              </div>
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                 <button onClick={() => setDetailModal(null)} className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm">Tutup</button>
                 
                 {isAttendanceEditable && (
                    <>
                       {detailModal.existingLog && (
                         <button 
                            onClick={removeAttendance}
                            className="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
                         >
                            <Trash2 size={16} />
                         </button>
                       )}
                       <button 
                          onClick={saveAttendance}
                          className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                       >
                          <Save size={16} /> Simpan
                       </button>
                    </>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* CUSTOM ALERT MODAL */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setAlertModal({ ...alertModal, isOpen: false })}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-slide-down">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{alertModal.title}</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">
                {alertModal.message}
              </p>
              {alertModal.details && (
                <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-500 text-left">
                  <span className="font-bold block mb-1">Detail Konflik:</span>
                  {alertModal.details}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
               <button 
                 onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                 className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95"
               >
                 Mengerti
               </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Modal (Schedule) */}
      {confirmModal.isOpen && confirmModal.item && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-20">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-slide-down">
             {/* ... (Existing Confirmation Modal Content) ... */}
            <div className={`p-8 flex items-center gap-5 border-b ${confirmModal.type === 'release' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className={`p-4 rounded-2xl ${confirmModal.type === 'release' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`}>
                {confirmModal.type === 'release' ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {confirmModal.type === 'claim_pjmk' && 'Konfirmasi Jadwal'}
                  {confirmModal.type === 'join_team' && 'Gabung Team Teaching'}
                  {confirmModal.type === 'release' && 'Lepas Jadwal'}
                </h3>
                <p className="text-slate-500 text-xs font-medium">Kelas {confirmModal.item.className}</p>
              </div>
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-8">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6">
                <div className="font-black text-slate-800 text-xl mb-4 leading-tight">{getCourse(confirmModal.item.courseId)?.name}</div>
                <div className="space-y-3">
                   <div className="flex items-center gap-3 text-sm text-slate-600 font-bold"><Calendar size={18} className="text-blue-500" /> <span>{confirmModal.item.day}</span></div>
                   <div className="flex items-center gap-3 text-sm text-slate-600 font-bold"><Clock size={18} className="text-blue-500" /> <span>{confirmModal.item.timeSlot}</span></div>
                   <div className="flex items-center gap-3 text-sm text-slate-600 font-bold"><Building2 size={18} className="text-blue-500" /> <span>{getRoomName(confirmModal.item.roomId)} {getRoom(confirmModal.item.roomId)?.building && `(Gedung ${getRoom(confirmModal.item.roomId)?.building})`}</span></div>
                </div>
              </div>

              {confirmModal.type === 'claim_pjmk' && (
                 <div className="space-y-4">
                   <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                      <Star size={20} className="shrink-0 text-blue-600" />
                      <div>
                          <strong>Anda adalah Dosen Pertama!</strong><br/>
                          Silakan pilih peran Anda dalam kelas ini:
                          <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-blue-700">
                              <li><strong>PJMK:</strong> Mengajar Sebelum UTS (Pertemuan 1-7)</li>
                              <li><strong>Team:</strong> Mengajar Setelah UTS (Pertemuan 8-14)</li>
                          </ul>
                      </div>
                   </div>
                 </div>
              )}

              {confirmModal.type === 'join_team' && (
                 <div className="space-y-3">
                     {!confirmModal.item.pjmkLecturerId ? (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-900 text-sm">
                            <Star size={20} className="shrink-0 text-amber-600" />
                            <div>
                                <strong>Anda Otomatis Menjadi PJMK</strong><br/>
                                <span className="text-xs">Dosen pertama memilih sebagai Team, sehingga Anda otomatis menjadi PJMK.</span>
                                <div className="mt-2 bg-white/60 p-2 rounded-lg border border-amber-100">
                                    <ul className="space-y-1 list-disc list-inside text-xs text-amber-800 font-medium">
                                        <li><strong>Role:</strong> PJMK (Koordinator)</li>
                                        <li><strong>Jadwal:</strong> Mengajar Sebelum UTS (1-7)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                     ) : (
                        <>
                             <p className="text-center text-sm text-slate-500">
                                Anda akan bergabung sebagai anggota tim pengajar (Team Teaching). Slot tersisa: {2 - (confirmModal.item.lecturerIds?.length || 0)} orang.
                             </p>
                             <div className="bg-slate-100 p-3 rounded-xl flex gap-2 text-xs text-slate-600">
                                 <Info size={16} className="shrink-0 mt-0.5 text-slate-400" />
                                 <span>Sebagai <strong>Team Teaching</strong>, Anda dijadwalkan mengajar 7 pertemuan <strong>setelah UTS</strong>.</span>
                             </div>
                        </>
                     )}
                 </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="px-4 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-200 transition-colors text-sm">Batal</button>
              
              {confirmModal.type === 'claim_pjmk' ? (
                 <div className="flex-1 flex gap-2">
                    <button 
                      onClick={() => handleConfirmAction(false)} 
                      className="flex-1 px-4 py-3 rounded-2xl bg-white border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-800 transition-all text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2"
                    >
                      <UserPlus size={16} /> Team Saja
                    </button>
                    <button 
                      onClick={() => handleConfirmAction(true)} 
                      className="flex-1 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-200 transition-all active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                      <Star size={16} className="fill-white" /> Jadi PJMK
                    </button>
                 </div>
              ) : (
                <button 
                  onClick={() => handleConfirmAction(false)} 
                  className={`flex-1 px-4 py-3 rounded-2xl text-white font-bold shadow-lg transition-all transform active:scale-95 ${confirmModal.type === 'release' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                >
                  {confirmModal.type === 'release' ? 'Lepas Jadwal' : 'Konfirmasi'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerPortal;
