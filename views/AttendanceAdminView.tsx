
import React, { useState, useMemo } from 'react';
import { Search, ClipboardCheck, Users, Calendar, Clock, MapPin, X, CheckCircle, AlertCircle, Building2, User, Save, Trash2, CalendarDays, ChevronDown } from 'lucide-react';
import { ScheduleItem, Course, Lecturer, Room, TeachingLog, DayOfWeek } from '../types';

interface AttendanceAdminViewProps {
  schedule: ScheduleItem[];
  courses: Course[];
  lecturers: Lecturer[];
  rooms: Room[];
  teachingLogs: TeachingLog[];
  onAddLog: (log: TeachingLog) => void;
  onRemoveLog: (scheduleId: string, lecturerId: string, week: number) => void;
  onSync?: () => void;
}

const AttendanceAdminView: React.FC<AttendanceAdminViewProps> = ({
  schedule,
  courses,
  lecturers,
  rooms,
  teachingLogs,
  onAddLog,
  onRemoveLog,
  onSync
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  
  // Default active day: Monday or based on current day if needed, here strict to enum
  const [activeDay, setActiveDay] = useState<DayOfWeek>(DayOfWeek.SENIN);

  // State for the Detail Modal (Date Input & Lecturer Selection)
  const [editLogModal, setEditLogModal] = useState<{
    isOpen: boolean;
    week: number;
    existingLog?: TeachingLog;
  } | null>(null);

  // Form State
  const [inputDate, setInputDate] = useState<string>('');
  const [selectedLecturerForSlot, setSelectedLecturerForSlot] = useState<string>('');

  const getCourse = (id: string) => courses.find(c => String(c.id) === String(id));
  const getRoom = (id: string) => rooms.find(r => String(r.id) === String(id));
  const getLecturer = (id: string) => lecturers.find(l => String(l.id) === String(id));

  const filteredSchedule = useMemo(() => {
    // 1. Filter by Active Day
    let data = schedule.filter(s => s.day === activeDay);

    // 2. Filter by Search Term if exists
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter(item => {
        const courseName = getCourse(item.courseId)?.name.toLowerCase() || '';
        const className = item.className.toLowerCase();
        const lecturerNames = (item.lecturerIds || []).map(id => getLecturer(id)?.name.toLowerCase() || '').join(' ');
        
        return courseName.includes(term) || className.includes(term) || lecturerNames.includes(term);
        });
    }

    // 3. Sort by Time Slot
    return data.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  }, [schedule, searchTerm, activeDay, courses, lecturers]);

  // Open the detail modal
  const openAttendanceDetail = (week: number) => {
    if (!selectedSchedule) return;
    
    // Find if ANY lecturer has taught this week for this schedule
    // Because it's a single card, we look for *any* log matching the scheduleId and week
    const existingLog = teachingLogs.find(l => 
        l.scheduleId === selectedSchedule.id && 
        l.week === week
    );

    // Setup defaults
    const defaultDate = existingLog?.date || new Date().toISOString().split('T')[0];
    
    // Default lecturer: 
    // 1. Existing log lecturer
    // 2. Or PJMK
    // 3. Or first lecturer in list
    const defaultLecturer = existingLog?.lecturerId || selectedSchedule.pjmkLecturerId || (selectedSchedule.lecturerIds && selectedSchedule.lecturerIds[0]) || '';

    setEditLogModal({
        isOpen: true,
        week,
        existingLog
    });
    setInputDate(defaultDate);
    setSelectedLecturerForSlot(defaultLecturer);
  };

  const handleSaveLog = () => {
     if (!selectedSchedule || !editLogModal || !selectedLecturerForSlot) return;

     // If there was an existing log and the lecturer changed, we might need to handle that.
     // The current backend logic (GoogleAppsScript) uses upsert based on (ScheduleId + LecturerId + Week).
     // BUT, in a single card view, Week X should only have ONE log total (conceptually).
     // However, the system supports multiple lecturers per schedule.
     // To prevent duplicates for the same week (e.g. Lecturer A and Lecturer B both claimed Week 1),
     // we should ideally remove any other logs for this week/schedule if we want strictly 1 teacher per session.
     // For now, we will just Save/Add the log for the selected lecturer.
     
     // *Optional Improvement*: If changing lecturer, remove the old log for the previous lecturer?
     if (editLogModal.existingLog && editLogModal.existingLog.lecturerId !== selectedLecturerForSlot) {
         onRemoveLog(selectedSchedule.id, editLogModal.existingLog.lecturerId, editLogModal.week);
     }

     onAddLog({
         id: '', 
         scheduleId: selectedSchedule.id,
         lecturerId: selectedLecturerForSlot,
         week: editLogModal.week,
         timestamp: new Date().toISOString(),
         date: inputDate
     });

     setEditLogModal(null);
  };

  const handleDeleteLog = () => {
    if (!selectedSchedule || !editLogModal || !editLogModal.existingLog) return;
    onRemoveLog(selectedSchedule.id, editLogModal.existingLog.lecturerId, editLogModal.week);
    setEditLogModal(null);
  };

  const getLogCountTotal = (scheduleId: string) => {
      // Count unique weeks that have a log for this schedule
      const logs = teachingLogs.filter(l => l.scheduleId === scheduleId);
      const weeks = new Set(logs.map(l => l.week));
      return weeks.size;
  };

  const getDayName = (dateStr: string) => {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', { weekday: 'long' });
  };

  return (
    <div className="space-y-6 animate-fade-in relative pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manajemen Presensi Dosen</h2>
          <p className="text-slate-500">Kelola kehadiran mengajar (jurnal) berdasarkan jadwal per hari.</p>
        </div>
        <div className="relative w-full md:w-auto">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text"
               placeholder="Cari Mata Kuliah / Dosen..."
               className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
        </div>
      </div>

      {/* DAY TABS */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {Object.values(DayOfWeek).map((day) => (
              <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                      activeDay === day 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                  }`}
              >
                  <CalendarDays size={16} className={activeDay === day ? 'opacity-100' : 'opacity-70'} />
                  {day}
              </button>
          ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-20">Kelas</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Waktu & Info</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Dosen Pengampu</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredSchedule.length === 0 ? (
                      <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                              <div className="flex flex-col items-center gap-2">
                                  <ClipboardCheck size={40} className="opacity-20" />
                                  <span className="font-medium">Tidak ada jadwal kuliah pada hari {activeDay}.</span>
                              </div>
                          </td>
                      </tr>
                  ) : (
                      filteredSchedule.map(item => {
                          const course = getCourse(item.courseId);
                          const room = getRoom(item.roomId);
                          const lecturerCount = item.lecturerIds?.length || 0;
                          const totalLogs = getLogCountTotal(item.id);

                          return (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 align-top">
                                      <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-black text-sm uppercase">{item.className}</span>
                                  </td>
                                  <td className="px-6 py-4 align-top">
                                      <div className="font-bold text-slate-800 text-base">{course?.name}</div>
                                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-1.5">
                                          {/* Removed Day display since we filter by day now, redundant visually but good for confirm */}
                                          <div className="flex items-center gap-1.5 font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded"><Clock size={14}/> {item.timeSlot}</div>
                                          <div className="flex items-center gap-1.5 font-medium"><MapPin size={14} className="text-slate-400"/> {room?.name || item.roomId}</div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 align-top">
                                      {lecturerCount > 0 ? (
                                          <div className="flex flex-col gap-1.5">
                                              {item.lecturerIds.map((lid, idx) => {
                                                  const lec = getLecturer(lid);
                                                  return (
                                                      <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                                          <User size={14} className={lid === item.pjmkLecturerId ? "text-amber-500" : "text-slate-400"} />
                                                          <span className={lid === item.pjmkLecturerId ? "font-bold text-slate-800" : "text-slate-600"}>{lec?.name}</span>
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      ) : (
                                          <div className="text-amber-500 text-sm italic flex items-center gap-1"><AlertCircle size={14}/> Belum ada dosen</div>
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-center align-middle">
                                      <button 
                                        onClick={() => setSelectedSchedule(item)}
                                        disabled={lecturerCount === 0}
                                        className={`px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all border flex items-center justify-center gap-2 mx-auto ${lecturerCount === 0 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 active:scale-95'}`}
                                      >
                                          <ClipboardCheck size={16} /> 
                                          <span>{totalLogs > 0 ? `${totalLogs}/16 Hadir` : 'Input Presensi'}</span>
                                      </button>
                                  </td>
                              </tr>
                          )
                      })
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* MODAL INPUT KEHADIRAN (SINGLE CARD PER CLASS) */}
      {selectedSchedule && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-10 sm:pt-20">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedSchedule(null)}></div>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden animate-slide-down flex flex-col max-h-[85vh]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                      <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><ClipboardCheck size={20} className="text-emerald-600"/> Input Kehadiran Mengajar</h3>
                        <p className="text-sm text-slate-500 mt-0.5 font-medium">{getCourse(selectedSchedule.courseId)?.name} <span className="mx-1">•</span> Kelas {selectedSchedule.className}</p>
                      </div>
                      <button onClick={() => setSelectedSchedule(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto custom-scrollbar">
                      
                      {/* Class Information / Header */}
                      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-6">
                           <div className="flex items-start gap-4">
                               <div className="bg-white p-3 rounded-full shadow-sm text-blue-600"><Users size={24}/></div>
                               <div>
                                   <div className="text-xs font-bold text-slate-500 uppercase mb-1">Tim Dosen Pengampu</div>
                                   <div className="flex flex-wrap gap-2">
                                       {(selectedSchedule.lecturerIds || []).map(lid => {
                                           const lec = getLecturer(lid);
                                           const isPjmk = lid === selectedSchedule.pjmkLecturerId;
                                           return (
                                               <span key={lid} className={`text-sm px-2 py-1 rounded-lg border flex items-center gap-1 ${isPjmk ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-slate-200 text-slate-700'}`}>
                                                   {isPjmk && <span className="text-[10px] bg-amber-500 text-white px-1 rounded font-bold">PJMK</span>}
                                                   {lec?.name}
                                               </span>
                                           )
                                       })}
                                   </div>
                               </div>
                           </div>
                      </div>

                      {/* Unified Grid */}
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                          {Array.from({length: 16}, (_, i) => i + 1).map(week => {
                              // Find if ANY lecturer taught this week
                              const log = teachingLogs.find(l => 
                                  l.scheduleId === selectedSchedule.id && 
                                  l.week === week
                              );
                              const isPresent = !!log;
                              const teacherName = log ? getLecturer(log.lecturerId)?.name.split(' ')[0] : ''; // Get First Name

                              return (
                                  <button 
                                    key={week}
                                    onClick={() => openAttendanceDetail(week)}
                                    className={`flex flex-col items-center justify-between p-2 rounded-xl border transition-all relative h-24 active:scale-95 group ${
                                        isPresent 
                                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' 
                                            : 'bg-white text-slate-400 border-slate-200 hover:border-blue-400 hover:shadow-sm'
                                    }`}
                                  >
                                      <div className="flex justify-between w-full">
                                        <span className={`text-[10px] font-bold uppercase ${isPresent ? 'opacity-80' : 'opacity-70'}`}>TM</span>
                                        <span className="text-lg font-black leading-none">{week}</span>
                                      </div>
                                      
                                      {isPresent ? (
                                        <div className="flex flex-col items-center w-full">
                                           <div className="text-[9px] font-medium bg-black/20 px-1.5 py-0.5 rounded-full mb-1 truncate max-w-full">
                                              {teacherName}
                                           </div>
                                           {log.date && <span className="text-[9px] opacity-80">{log.date.split('-').slice(1).join('/')}</span>}
                                        </div>
                                      ) : (
                                        <div className="mt-2">
                                           <div className="w-8 h-8 rounded-full border-2 border-slate-100 bg-slate-50 flex items-center justify-center group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors">
                                              <div className="w-2 h-2 bg-slate-300 rounded-full group-hover:bg-blue-400"></div>
                                           </div>
                                        </div>
                                      )}
                                  </button>
                              )
                          })}
                      </div>
                  </div>

                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                      <button 
                        onClick={() => setSelectedSchedule(null)}
                        className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-900 transition-all active:scale-95"
                      >
                          Selesai
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL INPUT TANGGAL & PILIH DOSEN */}
      {editLogModal && selectedSchedule && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-20 sm:pt-32">
           <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setEditLogModal(null)}></div>
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-20 animate-slide-down">
              <div className="p-5 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-lg">Input Kehadiran</h3>
                  <p className="text-sm text-slate-500">Pertemuan Ke-{editLogModal.week}</p>
              </div>
              <div className="p-6 space-y-4">
                  
                  {/* Pilihan Dosen (If Team Teaching) */}
                  {(selectedSchedule.lecturerIds || []).length > 1 && (
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dosen Pengajar</label>
                          <div className="relative">
                            <select
                                value={selectedLecturerForSlot}
                                onChange={(e) => setSelectedLecturerForSlot(e.target.value)}
                                className="w-full pl-4 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800 appearance-none"
                            >
                                {(selectedSchedule.lecturerIds || []).map(lid => (
                                    <option key={lid} value={lid}>
                                        {getLecturer(lid)?.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                      </div>
                  )}

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
                          <span className="text-slate-500">Hari:</span> <span className="font-bold text-blue-700">{getDayName(inputDate)}</span>
                      </div>
                  </div>
              </div>
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                 {editLogModal.existingLog ? (
                    <>
                      <button 
                        onClick={handleDeleteLog}
                        className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                         <Trash2 size={16} /> Hapus
                      </button>
                      <button 
                        onClick={handleSaveLog}
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                         <Save size={16} /> Update
                      </button>
                    </>
                 ) : (
                    <>
                      <button onClick={() => setEditLogModal(null)} className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm">Batal</button>
                      <button 
                        onClick={handleSaveLog}
                        className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                         <CheckCircle size={16} /> Simpan
                      </button>
                    </>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceAdminView;
