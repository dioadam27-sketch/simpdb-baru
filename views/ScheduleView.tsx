
import React, { useState, useRef, useMemo } from 'react';
import { Calendar, Trash2, Plus, AlertCircle, Check, Search, UserMinus, X, Building2, Clock, Layers, CalendarPlus, FileSpreadsheet, Upload, RefreshCw, Users, MoreVertical, BookOpen, AlertTriangle, Lock, Unlock, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';
import { Course, Lecturer, Room, ScheduleItem, DayOfWeek, TIME_SLOTS, ClassName } from '../types';
import * as XLSX from 'xlsx';

interface ScheduleViewProps {
  courses: Course[];
  lecturers: Lecturer[];
  rooms: Room[];
  classNames: ClassName[];
  schedule: ScheduleItem[];
  setSchedule: (schedule: ScheduleItem[]) => void;
  onAddSchedule?: (item: ScheduleItem) => void;
  onEditSchedule?: (item: ScheduleItem) => void;
  onDeleteSchedule?: (id: string) => void;
  onImportSchedule?: (items: ScheduleItem[]) => void;
  onSync?: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({
  courses, lecturers, rooms, classNames, schedule, setSchedule, onAddSchedule, onEditSchedule, onDeleteSchedule, onImportSchedule, onSync, isLocked = false, onToggleLock
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add Form State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | ''>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Modal State
  const [editModal, setEditModal] = useState<{
      isOpen: boolean;
      item: ScheduleItem | null;
      courseId: string;
      lecturerId: string;
      roomId: string;
      className: string;
      day: DayOfWeek | '';
      time: string;
  }>({
      isOpen: false,
      item: null,
      courseId: '',
      lecturerId: '',
      roomId: '',
      className: '',
      day: '',
      time: ''
  });

  // Dynamic Position State
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    itemId: string | null;
  }>({
    isOpen: false,
    itemId: null
  });

  const [lockConfirmModal, setLockConfirmModal] = useState(false);

  const getCourse = (id: string) => courses.find(c => c.id === id);
  const getCourseName = (id: string) => getCourse(id)?.name || id;
  const getRoomName = (id: string) => rooms.find(r => r.id === id)?.name || id;
  const getLecturerName = (id: string) => lecturers.find(l => l.id === id)?.name || id;

  // --- CONFLICT LOGIC (Used for Add) ---
  const currentConflicts = useMemo(() => {
    const conflicts: string[] = [];
    if (!selectedDay || !selectedTime) return conflicts;

    // 1. Cek Ruangan
    if (selectedRoomId) {
      const roomConflict = schedule.find(s => 
        s.day === selectedDay && 
        s.timeSlot === selectedTime && 
        s.roomId === selectedRoomId
      );
      if (roomConflict) conflicts.push(`RUANGAN: ${getRoomName(selectedRoomId)} terisi ${roomConflict.className}`);
    }

    // 2. Cek Kelas (PDB)
    if (selectedClassName) {
      const classConflict = schedule.find(s => 
        s.day === selectedDay && 
        s.timeSlot === selectedTime && 
        s.className === selectedClassName
      );
      if (classConflict) conflicts.push(`KELAS: ${selectedClassName} ada jadwal lain`);
    }

    // 3. Cek Dosen
    if (selectedLecturerId) {
      const lecturerConflict = schedule.find(s => 
        s.day === selectedDay && 
        s.timeSlot === selectedTime && 
        (s.lecturerIds || []).includes(selectedLecturerId)
      );
      if (lecturerConflict) conflicts.push(`DOSEN: ${getLecturerName(selectedLecturerId)} sedang mengajar`);
    }

    return conflicts;
  }, [selectedDay, selectedTime, selectedRoomId, selectedClassName, selectedLecturerId, schedule, rooms, courses, lecturers]);

  // --- CONFLICT LOGIC (Used for Edit - Excludes current item) ---
  const editConflicts = useMemo(() => {
    const conflicts: string[] = [];
    if (!editModal.isOpen || !editModal.item || !editModal.day || !editModal.time) return conflicts;

    const { day, time, roomId, className, lecturerId, item } = editModal;

    // 1. Cek Ruangan
    if (roomId) {
      const roomConflict = schedule.find(s => 
        s.id !== item.id && // EXCLUDE SELF
        s.day === day && 
        s.timeSlot === time && 
        s.roomId === roomId
      );
      if (roomConflict) conflicts.push(`RUANGAN: ${getRoomName(roomId)} terisi ${roomConflict.className}`);
    }

    // 2. Cek Kelas
    if (className) {
      const classConflict = schedule.find(s => 
        s.id !== item.id && 
        s.day === day && 
        s.timeSlot === time && 
        s.className === className
      );
      if (classConflict) conflicts.push(`KELAS: ${className} ada jadwal lain`);
    }

    // 3. Cek Dosen
    if (lecturerId) {
      const lecturerConflict = schedule.find(s => 
        s.id !== item.id &&
        s.day === day && 
        s.timeSlot === time && 
        (s.lecturerIds || []).includes(lecturerId)
      );
      if (lecturerConflict) conflicts.push(`DOSEN: ${getLecturerName(lecturerId)} sedang mengajar`);
    }

    return conflicts;
  }, [editModal, schedule]);

  const validateAndAdd = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (currentConflicts.length > 0) {
      setErrorMsg("Tidak dapat menyimpan karena terdeteksi bentrok jadwal.");
      return;
    }

    if (!selectedDay || !selectedTime || !selectedRoomId || !selectedCourseId || !selectedClassName) {
      setErrorMsg("Mohon lengkapi semua data jadwal.");
      return;
    }

    const newItem: ScheduleItem = {
      id: `sch-${Date.now()}`,
      courseId: selectedCourseId,
      lecturerIds: selectedLecturerId ? [selectedLecturerId] : [],
      pjmkLecturerId: selectedLecturerId || undefined,
      roomId: selectedRoomId,
      className: selectedClassName,
      day: selectedDay as DayOfWeek,
      timeSlot: selectedTime
    };

    if (onAddSchedule) {
        onAddSchedule(newItem);
    } else {
        setSchedule([...schedule, newItem]);
    }

    // Reset Form
    setSelectedCourseId('');
    setSelectedLecturerId('');
    setSelectedRoomId('');
    setSelectedClassName('');
    setSelectedDay('');
    setSelectedTime('');
    
    setSuccessMsg(`Berhasil menambahkan jadwal ${newItem.className}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleOpenEdit = (e: React.MouseEvent<HTMLButtonElement>, item: ScheduleItem) => {
    const isDesktop = window.innerWidth >= 768;

    if (isDesktop && containerRef.current) {
        const buttonRect = e.currentTarget.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        const modalWidth = 600; // max-w-2xl
        const modalHeightEstimate = 500;
        
        // Calculate Top relative to CONTAINER (so it scrolls with it)
        let top = buttonRect.top - containerRect.top;
        let left = buttonRect.left - containerRect.left - modalWidth - 16;
        
        // 1. Flip Left/Right
        if (buttonRect.left - modalWidth < 20) {
            left = buttonRect.left - containerRect.left + buttonRect.width + 16;
            // Ensure right overflow
             if (left + modalWidth > containerRect.width) {
                 left = containerRect.width - modalWidth - 20; // Force fit inside container
             }
        }

        // 2. Flip Up/Down
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        if (spaceBelow < modalHeightEstimate && buttonRect.top > modalHeightEstimate) {
            top = top - modalHeightEstimate + buttonRect.height;
        }

        setPopoverStyle({
            position: 'absolute',
            left: `${left}px`,
            top: `${top}px`,
            margin: 0
        });
    } else {
        setPopoverStyle({}); // Reset for center modal on mobile
    }

    setEditModal({
          isOpen: true,
          item: item,
          courseId: item.courseId,
          lecturerId: (item.lecturerIds && item.lecturerIds.length > 0) ? item.lecturerIds[0] : '',
          roomId: item.roomId,
          className: item.className,
          day: item.day,
          time: item.timeSlot
      });
  };

  const handleSaveEdit = () => {
      if (!editModal.item || !onEditSchedule) return;
      
      const updatedItem: ScheduleItem = {
          ...editModal.item,
          courseId: editModal.courseId,
          roomId: editModal.roomId,
          className: editModal.className,
          day: editModal.day as DayOfWeek,
          timeSlot: editModal.time,
          // Special logic: If changing lecturer in edit, we assume it's the primary (first slot) or creating new array
          lecturerIds: editModal.lecturerId ? [editModal.lecturerId] : [], 
          pjmkLecturerId: editModal.lecturerId || undefined
      };

      onEditSchedule(updatedItem);
      setEditModal({ ...editModal, isOpen: false });
  };

  const handleDeleteClick = (id: string) => {
    setDeleteModal({ isOpen: true, itemId: id });
  };

  const confirmDelete = () => {
    if (deleteModal.itemId) {
        if (onDeleteSchedule) {
            onDeleteSchedule(deleteModal.itemId);
        } else {
            setSchedule(schedule.filter(s => s.id !== deleteModal.itemId));
        }
    }
    setDeleteModal({ isOpen: false, itemId: null });
  };

  const confirmLockAction = () => {
    if (onToggleLock) onToggleLock();
    setLockConfirmModal(false);
  };

  const exportScheduleExcel = () => {
    if (schedule.length === 0) return;
    const excelData = schedule.map(s => {
      const course = getCourse(s.courseId);
      const room = rooms.find(r => r.id === s.roomId);
      const lecturerNames = (s.lecturerIds || []).map(id => getLecturerName(id)).join(', ');
      return {
        "Hari": s.day,
        "Waktu": s.timeSlot,
        "Nama Kelas": s.className,
        "Mata Kuliah": course?.name || s.courseId,
        "Kode MK": course?.code || '-',
        "Dosen": lecturerNames || 'Open Slot',
        "Ruangan": room?.name || s.roomId
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jadwal Kuliah");
    XLSX.writeFile(workbook, `Jadwal_Kuliah_SIMPDB.xlsx`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        if (jsonData.length === 0) { setErrorMsg("File Excel kosong."); return; }
        const newItems: ScheduleItem[] = [];
        jsonData.forEach((row: any) => {
          const day = row['Hari'] || row['Day'];
          const time = row['Waktu'] || row['Time'];
          const className = row['Nama Kelas'] || row['Class'];
          const course = courses.find(c => c.name.toLowerCase() === String(row['Mata Kuliah'] || '').toLowerCase());
          const room = rooms.find(r => r.name.toLowerCase() === String(row['Ruangan'] || '').toLowerCase());
          if (day && time && className && course && room) {
             newItems.push({
               id: `sch-imp-${Date.now()}-${Math.random()}`,
               day: day as DayOfWeek,
               timeSlot: time,
               className: String(className),
               courseId: course.id,
               lecturerIds: [],
               roomId: room.id
             });
          }
        });
        if (onImportSchedule) onImportSchedule(newItems);
        setSuccessMsg(`Berhasil mengimpor ${newItems.length} jadwal.`);
      } catch (error) { setErrorMsg("Gagal membaca file Excel."); }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const itemToDelete = deleteModal.itemId ? schedule.find(s => s.id === deleteModal.itemId) : null;
  const isPopover = Object.keys(popoverStyle).length > 0;

  return (
    <div ref={containerRef} className="space-y-8 relative animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-800">Penjadwalan Kuliah</h2>
          <div className="flex items-center gap-2 text-sm">
             <span className="text-slate-500">Kelola jadwal kuliah per sesi.</span>
             <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${isLocked ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                {isLocked ? 'STATUS: TERKUNCI (AKTIF)' : 'STATUS: TERBUKA (NON-AKTIF)'}
             </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {onToggleLock && (
             <button 
                onClick={() => setLockConfirmModal(true)} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border shadow-sm transition-all group ${
                    isLocked 
                    ? 'bg-red-600 text-white border-red-700 hover:bg-red-700' 
                    : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                }`}
             >
                {isLocked ? <ToggleRight size={22} className="text-white" /> : <ToggleLeft size={22} />}
                {isLocked ? 'Kunci: Aktif' : 'Kunci: Non-Aktif'}
             </button>
          )}
          {onSync && (
            <button onClick={onSync} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 shadow-sm"><RefreshCw size={18} /> Sync</button>
          )}
          {onImportSchedule && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".xlsx, .xls" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-indigo-200 shadow-sm"><Upload size={18} /> Import</button>
            </>
          )}
          <button onClick={exportScheduleExcel} disabled={schedule.length === 0} className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-emerald-200 shadow-sm disabled:opacity-50"><FileSpreadsheet size={18} /> Export</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
           <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Plus size={16}/></div>
           Tambah Jadwal Baru
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mata Kuliah</label>
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="">-- Pilih Mata Kuliah --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kelas</label>
              <select value={selectedClassName} onChange={(e) => setSelectedClassName(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="">-- Pilih Kelas --</option>
                {classNames.map(cls => <option key={cls.id} value={cls.name}>{cls.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ruangan</label>
              <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm`}>
                <option value="">-- Pilih Ruangan --</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dosen Inisiator</label>
              <select value={selectedLecturerId} onChange={(e) => setSelectedLecturerId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="">-- Open Slot --</option>
                {lecturers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
             <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hari</label>
                  <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm">
                    <option value="">Hari</option>
                    {Object.values(DayOfWeek).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam</label>
                  <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm">
                    <option value="">Jam</option>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
             </div>
             <button 
                onClick={validateAndAdd}
                disabled={currentConflicts.length > 0}
                className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${currentConflicts.length > 0 ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'}`}
              >
                <CalendarPlus size={18} /> Simpan Jadwal
              </button>
          </div>
        </div>

        {/* REAL-TIME CONFLICT NOTIFICATION */}
        {currentConflicts.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl animate-shake">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
              <AlertTriangle size={18} />
              <span className="text-sm">Terdeteksi Bentrok Jadwal!</span>
            </div>
            <ul className="space-y-1">
              {currentConflicts.map((c, i) => (
                <li key={i} className="text-xs text-red-600 flex items-start gap-2">
                  <div className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-shake">
          <AlertCircle size={20} />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <Check size={20} />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      <div className="space-y-8">
        {Object.values(DayOfWeek).map((day) => {
          const dayItems = schedule.filter((s) => s.day === day).sort((a, b) => TIME_SLOTS.indexOf(a.timeSlot) - TIME_SLOTS.indexOf(b.timeSlot));
          return (
             <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><Calendar className="text-blue-600" size={20}/> {day}</h3>
                   <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full">{dayItems.length} Kelas</span>
                </div>
                <div className="divide-y divide-slate-100">
                   {dayItems.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2"><Calendar className="opacity-20" size={48} /><span className="text-sm">Kosong.</span></div>
                   ) : (
                      dayItems.map(item => (
                        <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center gap-4 group">
                           <div className="md:w-1/4 flex items-start gap-4">
                              <div className="bg-blue-50 text-blue-700 p-2.5 rounded-xl font-bold text-xs text-center min-w-[80px]"><Clock size={16} className="mx-auto mb-1 opacity-70"/>{item.timeSlot}</div>
                              <div><div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Kelas</div><div className="text-lg font-black text-slate-800">{item.className}</div></div>
                           </div>
                           <div className="md:w-1/3">
                              <div className="flex items-center gap-2 mb-1"><BookOpen size={14} className="text-slate-400" /><span className="font-bold text-slate-800 text-sm line-clamp-1">{getCourseName(item.courseId)}</span></div>
                              <div className="flex items-center gap-2 text-xs text-slate-500"><Building2 size={12}/><span>Ruang <span className="font-bold text-slate-700">{getRoomName(item.roomId)}</span></span></div>
                           </div>
                           <div className="md:flex-1">
                              <div className="flex flex-col gap-1">
                                {(item.lecturerIds || []).length > 0 ? (
                                  (item.lecturerIds || []).map(lid => (
                                    <div key={lid} className="flex items-center gap-2 text-sm text-slate-600">
                                      <Users size={14} className={lid === item.pjmkLecturerId ? "text-amber-500" : "text-slate-400"} />
                                      <span className={lid === item.pjmkLecturerId ? "font-semibold text-slate-800" : ""}>{getLecturerName(lid)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="flex items-center gap-2 text-amber-600 italic text-sm"><UserMinus size={16} /> Open Slot</div>
                                )}
                              </div>
                           </div>
                           <div className="md:w-auto flex justify-end gap-2">
                              {onEditSchedule && (
                                <button onClick={(e) => handleOpenEdit(e, item)} className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all">
                                    <Edit2 size={18} />
                                </button>
                              )}
                              <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                           </div>
                        </div>
                      ))
                   )}
                </div>
             </div>
          );
        })}
      </div>

      {/* EDIT MODAL SYSTEM */}
      {editModal.isOpen && editModal.item && (
        <>
            {/* Backdrop */}
            <div className={`fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm animate-fade-in ${isPopover ? 'cursor-default' : 'flex items-center justify-center'}`} onClick={() => setEditModal({...editModal, isOpen: false})}>
                
                {/* Fallback Fixed Modal for Mobile */}
                {!isPopover && (
                   <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden animate-slide-down border border-slate-100 mx-4" onClick={e => e.stopPropagation()}>
                        <EditForm 
                           editModal={editModal} 
                           setEditModal={setEditModal} 
                           handleSaveEdit={handleSaveEdit} 
                           editConflicts={editConflicts} 
                           courses={courses} 
                           classNames={classNames} 
                           rooms={rooms} 
                           lecturers={lecturers}
                           isPopover={false}
                        />
                   </div>
                )}
            </div>

            {/* Popover Absolute Modal for Desktop (Scrolls with container) */}
            {isPopover && (
                <div 
                   className="absolute z-[70] bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-down border border-slate-100"
                   style={popoverStyle}
                >
                     <EditForm 
                        editModal={editModal} 
                        setEditModal={setEditModal} 
                        handleSaveEdit={handleSaveEdit} 
                        editConflicts={editConflicts} 
                        courses={courses} 
                        classNames={classNames} 
                        rooms={rooms} 
                        lecturers={lecturers}
                        isPopover={true}
                     />
                </div>
            )}
        </>
      )}

      {deleteModal.isOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}></div>
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-slide-down">
              <div className="bg-red-50 p-6 flex items-center justify-between border-b border-red-100">
                 <h3 className="text-lg font-bold text-slate-800">Hapus Jadwal?</h3>
                 <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })} className="text-slate-400"><X size={24} /></button>
              </div>
              <div className="p-8">
                <p className="text-slate-600 text-sm">Hapus jadwal <strong>{getCourseName(itemToDelete.courseId)}</strong> untuk kelas <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-800">{itemToDelete.className}</span>?</p>
              </div>
              <div className="p-6 bg-slate-50 flex gap-4 border-t border-slate-100">
                 <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })} className="flex-1 px-4 py-3 rounded-2xl text-slate-600 font-bold text-sm">Batal</button>
                 <button onClick={confirmDelete} className="flex-1 px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm">Hapus</button>
              </div>
           </div>
        </div>
      )}

      {lockConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setLockConfirmModal(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-slide-down">
             <div className={`p-6 flex items-center justify-between border-b ${isLocked ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <h3 className="text-lg font-bold text-slate-800">{isLocked ? 'Non-Aktifkan Kunci?' : 'Aktifkan Kunci?'}</h3>
                <button onClick={() => setLockConfirmModal(false)} className="text-slate-400"><X size={24} /></button>
             </div>
             <div className="p-8">
               <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isLocked ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                   {isLocked ? <Unlock size={32} /> : <Lock size={32} />}
               </div>
               <p className="text-slate-600 text-sm text-center">
                 {isLocked 
                   ? 'Anda akan mengubah status Kunci Jadwal menjadi NON-AKTIF (Terbuka). Dosen dapat kembali mengubah jadwal.' 
                   : 'Anda akan mengubah status Kunci Jadwal menjadi AKTIF (Terkunci). Dosen tidak akan bisa lagi mengubah jadwal.'}
               </p>
             </div>
             <div className="p-6 bg-slate-50 flex gap-4 border-t border-slate-100">
                <button onClick={() => setLockConfirmModal(false)} className="flex-1 px-4 py-3 rounded-2xl text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>
                <button 
                  onClick={confirmLockAction} 
                  className={`flex-1 px-4 py-3 rounded-2xl text-white font-bold text-sm shadow-lg transition-all ${isLocked ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                >
                  Ya, {isLocked ? 'Buka (Non-Aktif)' : 'Kunci (Aktif)'}
                </button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

// Extracted EditForm to reduce repetition
const EditForm = ({ editModal, setEditModal, handleSaveEdit, editConflicts, courses, classNames, rooms, lecturers, isPopover }: any) => (
   <>
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Edit2 size={18} className="text-amber-500"/> Edit Jadwal</h3>
          <button onClick={() => setEditModal({...editModal, isOpen: false})}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
      </div>
      <div className="p-6">
          {editConflicts.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2 text-red-600 font-bold mb-1 text-sm"><AlertTriangle size={14} /> Konflik Terdeteksi</div>
                <ul className="space-y-1">
                    {editConflicts.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-red-600 flex items-start gap-2">
                        <div className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0" />
                        {c}
                        </li>
                    ))}
                </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Mata Kuliah</label>
                  <select 
                    value={editModal.courseId} 
                    onChange={(e) => setEditModal({...editModal, courseId: e.target.value})} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                      {courses.map((c: Course) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Kelas</label>
                  <select 
                    value={editModal.className} 
                    onChange={(e) => setEditModal({...editModal, className: e.target.value})} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                      {classNames.map((c: ClassName) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ruangan</label>
                  <select 
                    value={editModal.roomId} 
                    onChange={(e) => setEditModal({...editModal, roomId: e.target.value})} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                      {rooms.map((r: Room) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Dosen Utama (PJMK)</label>
                  <select 
                    value={editModal.lecturerId} 
                    onChange={(e) => setEditModal({...editModal, lecturerId: e.target.value})} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="">-- Open Slot --</option>
                      {lecturers.map((l: Lecturer) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Hari</label>
                  <select 
                    value={editModal.day} 
                    onChange={(e) => setEditModal({...editModal, day: e.target.value as DayOfWeek})} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                      {Object.values(DayOfWeek).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Jam</label>
                  <select 
                    value={editModal.time} 
                    onChange={(e) => setEditModal({...editModal, time: e.target.value})} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
              </div>
          </div>

          <div className="flex gap-3 border-t border-slate-100 pt-5">
              <button onClick={() => setEditModal({...editModal, isOpen: false})} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">Batal</button>
              <button 
                onClick={handleSaveEdit}
                disabled={editConflicts.length > 0}
                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white ${editConflicts.length > 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200'}`}
              >
                  Simpan Perubahan
              </button>
          </div>
      </div>
   </>
);

export default ScheduleView;
