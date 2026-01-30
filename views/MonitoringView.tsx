
import React, { useState, useMemo } from 'react';
import { Building2, Clock, Calendar, CheckCircle, Info, Filter, Search, FileDown, X, AlertCircle, Download, FileSpreadsheet, User, Layers, BookOpen, Star, Users, BarChart3, LayoutList, ArrowRight } from 'lucide-react';
import { Course, Room, ScheduleItem, DayOfWeek, TIME_SLOTS, Lecturer, TeachingLog } from '../types';
import * as XLSX from 'xlsx';

interface MonitoringViewProps {
  rooms: Room[];
  courses: Course[];
  lecturers: Lecturer[];
  schedule: ScheduleItem[];
  teachingLogs?: TeachingLog[];
}

const MonitoringView: React.FC<MonitoringViewProps> = ({ rooms, courses, lecturers, schedule, teachingLogs = [] }) => {
  const [viewMode, setViewMode] = useState<'daily' | 'workload'>('daily');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(DayOfWeek.SENIN);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'pdf' | 'excel' | 'excel_workload' | null;
  }>({
    isOpen: false,
    type: null
  });

  const getCourse = (id: string) => courses.find(c => String(c.id) === String(id));
  const getRoom = (id: string) => rooms.find(r => String(r.id) === String(id));
  
  // Helper to get array of lecturer objects
  const getLecturers = (ids: string[]) => {
      if (!ids) return [];
      return ids.map(id => lecturers.find(l => String(l.id) === String(id))).filter(Boolean) as Lecturer[];
  };

  // --- LOGIC: DAILY SCHEDULE ---
  const filteredSchedule = useMemo(() => {
    const daySchedule = schedule.filter(s => s.day === selectedDay);
    
    // Detailed mapping
    const detailed = daySchedule.map(item => {
        const lecturerList = getLecturers(item.lecturerIds || []);
        return {
        ...item,
        course: getCourse(item.courseId),
        lecturers: lecturerList,
        lecturerNames: lecturerList.map(l => l.name).join(', '),
        room: getRoom(item.roomId)
        };
    });

    // Filtering
    const searched = detailed.filter(item => {
        const query = searchQuery.toLowerCase();
        return (
            item.course?.name.toLowerCase().includes(query) ||
            item.className.toLowerCase().includes(query) ||
            item.lecturerNames.toLowerCase().includes(query) ||
            item.room?.name.toLowerCase().includes(query)
        );
    });

    // Deduplication logic (Merge duplicate entries for same slot)
    const uniqueMap = new Map<string, typeof detailed[0]>();
    searched.forEach(item => {
        const timeKey = item.timeSlot?.trim();
        const roomKey = item.room?.name?.trim() || item.roomId; 
        const classKey = item.className?.trim();
        const courseKey = item.course?.name?.trim() || item.courseId;
        const uniqueKey = `${timeKey}::${roomKey}::${classKey}::${courseKey}`;
        
        if (uniqueMap.has(uniqueKey)) {
            const existing = uniqueMap.get(uniqueKey)!;
            const allLecturerIds = new Set([...(existing.lecturerIds || []), ...(item.lecturerIds || [])]);
            const mergedLecturerIds = Array.from(allLecturerIds);
            existing.lecturerIds = mergedLecturerIds;
            existing.lecturers = getLecturers(mergedLecturerIds);
            existing.lecturerNames = existing.lecturers.map(l => l.name).join(', ');
            if (!existing.pjmkLecturerId && item.pjmkLecturerId) existing.pjmkLecturerId = item.pjmkLecturerId;
        } else {
            uniqueMap.set(uniqueKey, { ...item });
        }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  }, [schedule, selectedDay, searchQuery, lecturers, courses, rooms]);

  // --- LOGIC: LECTURER WORKLOAD (REKAP SKS) ---
  const workloadData = useMemo(() => {
    return lecturers.map(lecturer => {
        let totalPlannedSKS = 0;
        let totalRealizedSKS = 0;
        const teachingClasses = schedule.filter(s => (s.lecturerIds || []).includes(lecturer.id));
        
        teachingClasses.forEach(s => {
            const course = getCourse(s.courseId);
            if (course) {
                const teamSize = s.lecturerIds.length;
                // RENCANA: Distribusi otomatis saat ambil jadwal
                const plannedSKS = teamSize > 0 ? (course.credits / teamSize) : 0;
                totalPlannedSKS += plannedSKS;

                // REALISASI: Berdasarkan presensi (Rumus Baru)
                const attendanceCount = teachingLogs.filter(l => l.scheduleId === s.id && l.lecturerId === lecturer.id).length;
                const realized = (course.credits * attendanceCount) / 16;
                totalRealizedSKS += realized;
            }
        });

        return {
            lecturer,
            totalPlannedSKS,
            totalRealizedSKS,
            classCount: teachingClasses.length,
            classes: teachingClasses
        };
    })
    .filter(d => d.totalPlannedSKS > 0 || searchQuery === '') // Show only active lecturers or all if no search
    .filter(d => d.lecturer.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.totalPlannedSKS - a.totalPlannedSKS); // Sort Descending by Planned SKS
  }, [lecturers, schedule, courses, searchQuery, teachingLogs]);


  // --- EXPORT FUNCTIONS ---
  const triggerExportPDF = () => {
    setConfirmModal({ isOpen: false, type: null });
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const triggerExportExcelDaily = () => {
    if (filteredSchedule.length === 0) return;
    const excelData = filteredSchedule.map(item => ({
      "Hari": item.day,
      "Jam": item.timeSlot,
      "Mata Kuliah": item.course?.name || "-",
      "SKS": item.course?.credits || 0,
      "Kelas": item.className,
      "Ruangan": item.room?.name || "-",
      "Dosen Team": item.lecturers.map(l => l.name + (l.id === item.pjmkLecturerId ? ' (PJMK)' : '')).join(', ') || "Open Slot"
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Jadwal_${selectedDay}`);
    XLSX.writeFile(workbook, `Monitoring_Jadwal_${selectedDay}.xlsx`);
    setConfirmModal({ isOpen: false, type: null });
  };

  const triggerExportExcelWorkload = () => {
    if (workloadData.length === 0) return;
    const excelData = workloadData.map(item => ({
        "NIP": item.lecturer.nip,
        "Nama Dosen": item.lecturer.name,
        "Jabatan": item.lecturer.position,
        "Jumlah Kelas": item.classCount,
        "Rencana SKS": Number(item.totalPlannedSKS.toFixed(2)),
        "SKS Terealisasi": Number(item.totalRealizedSKS.toFixed(2))
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Beban SKS");
    XLSX.writeFile(workbook, `Rekap_SKS_Dosen_${new Date().toISOString().split('T')[0]}.xlsx`);
    setConfirmModal({ isOpen: false, type: null });
  };

  const handleConfirm = () => {
    if (confirmModal.type === 'pdf') triggerExportPDF();
    if (confirmModal.type === 'excel') triggerExportExcelDaily();
    if (confirmModal.type === 'excel_workload') triggerExportExcelWorkload();
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Monitoring & Laporan</h2>
          <p className="text-slate-500">Pantau jadwal harian dan rekapitulasi beban kerja dosen.</p>
        </div>
        
        {/* VIEW TOGGLE */}
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm no-print">
            <button 
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'daily' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <LayoutList size={16} /> Jadwal Harian
            </button>
            <button 
                onClick={() => setViewMode('workload')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'workload' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <BarChart3 size={16} /> Rekap Beban SKS
            </button>
        </div>
      </div>

      {/* CONTROLS SECTION */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div className="flex-1 w-full md:w-auto relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder={viewMode === 'daily' ? "Cari mata kuliah, ruangan, dosen..." : "Cari nama dosen..."}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
             {viewMode === 'daily' && (
                <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                    {Object.values(DayOfWeek).map(day => (
                    <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                        selectedDay === day 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {day.substring(0, 3)}
                    </button>
                    ))}
                </div>
             )}

             <button
              onClick={() => setConfirmModal({ isOpen: true, type: viewMode === 'daily' ? 'excel' : 'excel_workload' })}
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-emerald-200 shadow-sm active:scale-95 shrink-0"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
            {viewMode === 'daily' && (
                <button
                onClick={() => setConfirmModal({ isOpen: true, type: 'pdf' })}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 border border-slate-700 shrink-0"
                >
                <FileDown size={18} />
                PDF
                </button>
            )}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none min-h-[400px]">
        
        {/* VIEW: DAILY SCHEDULE */}
        {viewMode === 'daily' && (
            <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-40">Waktu</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Mata Kuliah & Kelas</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-48">Ruangan</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Dosen Pengampu</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredSchedule.length === 0 ? (
                    <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                        <Calendar size={40} className="opacity-20" />
                        <span className="font-medium">Tidak ada jadwal kuliah untuk hari {selectedDay}.</span>
                        </div>
                    </td>
                    </tr>
                ) : (
                    filteredSchedule.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap align-top">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs"><Clock size={16} /></div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm">{item.day}</div>
                                <div className="text-xs text-slate-500 font-medium">{item.timeSlot}</div>
                            </div>
                        </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-3">
                            <div className="mt-1"><BookOpen size={16} className="text-slate-400" /></div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm">{item.course?.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide">
                                    KELAS {item.className}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase font-medium">{item.course?.code} • {item.course?.credits} SKS</span>
                                </div>
                            </div>
                        </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Building2 size={16} className="text-slate-400" />
                            {item.room?.name || 'Unknown Room'}
                        </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                            {item.lecturers.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                                {item.lecturers.map(lecturer => (
                                    <div key={lecturer.id} className="flex items-center gap-2">
                                        <User size={14} className={lecturer.id === item.pjmkLecturerId ? "text-amber-500" : "text-emerald-500"} />
                                        <span className={`font-medium text-sm ${lecturer.id === item.pjmkLecturerId ? "text-slate-800" : "text-slate-600"}`}>
                                            {lecturer.name}
                                        </span>
                                        {lecturer.id === item.pjmkLecturerId && (
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-bold border border-amber-200">PJMK</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            ) : (
                            <div className="flex items-center gap-2 text-amber-500 italic text-sm">
                                <AlertCircle size={16} />
                                <span>Open Slot (Belum ada dosen)</span>
                            </div>
                            )}
                        </td>
                    </tr>
                    ))
                )}
                </tbody>
            </table>
            </div>
        )}

        {/* VIEW: SKS WORKLOAD RECAP */}
        {viewMode === 'workload' && (
             <div className="overflow-x-auto custom-scrollbar">
                <div className="p-6 bg-blue-50 border-b border-blue-100 text-sm text-blue-800 flex items-start gap-3">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div>
                        <strong>Rencana vs Realisasi:</strong><br/>
                        <strong>Rencana SKS:</strong> Distribusi SKS otomatis saat jadwal diambil (SKS MK / Jumlah Tim).<br/>
                        <strong>Realisasi SKS:</strong> Dihitung dari <code>(SKS MK × Jumlah Presensi) / 16</code>.
                    </div>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-12 text-center">#</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nama Dosen</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Jumlah Kelas</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-40 text-center">Rencana SKS</th>
                            <th className="px-0 py-4 w-8"></th>
                            <th className="px-6 py-4 text-xs font-bold text-emerald-700 bg-emerald-50/50 uppercase tracking-widest w-40 text-right">SKS Terealisasi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {workloadData.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Belum ada data dosen atau jadwal.</td></tr>
                        ) : (
                            workloadData.map((item, index) => (
                                <tr key={item.lecturer.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-center text-xs font-bold text-slate-400">{index + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{item.lecturer.name}</div>
                                        <div className="text-xs text-slate-500">{item.lecturer.nip || '-'} • {item.lecturer.position || 'Dosen'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{item.classCount}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-bold text-slate-500">{item.totalPlannedSKS.toFixed(2)}</span>
                                    </td>
                                    <td className="px-0 py-4 text-center text-slate-300">
                                         <ArrowRight size={14} className="mx-auto" />
                                    </td>
                                    <td className="px-6 py-4 bg-emerald-50/30">
                                         <div className="flex items-center justify-end gap-3">
                                            <span className="font-black text-emerald-700 w-12 text-right">{item.totalRealizedSKS.toFixed(2)}</span>
                                            <div className="w-16 h-2 bg-emerald-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full bg-emerald-500"
                                                    style={{ width: `${item.totalPlannedSKS > 0 ? (item.totalRealizedSKS / item.totalPlannedSKS) * 100 : 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
        )}

      </div>
      
      <div className="hidden print:block text-center text-[10px] text-slate-400 mt-4">
        Dicetak dari SIMPDB pada {new Date().toLocaleString('id-ID')}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-20 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmModal({ isOpen: false, type: null })}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-slide-down">
            <div className={`p-6 text-center border-b border-slate-100 ${confirmModal.type?.includes('excel') ? 'bg-emerald-50' : 'bg-slate-50'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmModal.type?.includes('excel') ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                {confirmModal.type?.includes('excel') ? <FileSpreadsheet size={32} /> : <FileDown size={32} />}
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                Konfirmasi Export {confirmModal.type?.includes('excel') ? 'EXCEL' : 'PDF'}
              </h3>
              <p className="text-slate-500 text-sm mt-2">
                {confirmModal.type === 'excel_workload' 
                    ? 'Unduh rekapitulasi beban SKS dosen?' 
                    : `Unduh laporan jadwal hari ${selectedDay}?`
                }
              </p>
            </div>
            <div className="p-4 flex gap-3">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, type: null })}
                className="flex-1 px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Batal
              </button>
              <button 
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all transform active:scale-95 ${confirmModal.type?.includes('excel') ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-slate-800 hover:bg-slate-900 shadow-slate-200'}`}
              >
                Ya, Unduh
              </button>
            </div>
            <button 
              onClick={() => setConfirmModal({ isOpen: false, type: null })}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringView;
