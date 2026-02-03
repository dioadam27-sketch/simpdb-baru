
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Calendar, Trash2, Plus, AlertCircle, Check, Search, UserMinus, X, Building2, Clock, CalendarPlus, FileSpreadsheet, Upload, RefreshCw, Users, BookOpen, AlertTriangle, Lock, Unlock, ToggleLeft, ToggleRight, Edit2, ChevronDown, CheckCircle, ArrowUpDown, Save } from 'lucide-react';
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

// --- INTERNAL COMPONENT: SEARCHABLE SELECT ---
const SearchableSelect = ({ label, options, value, onChange, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Normalize Options
    const normalizedOptions = useMemo(() => {
        return options.map((opt: any) => {
            if (typeof opt === 'string') return { value: opt, label: opt };
            return opt;
        });
    }, [options]);

    const selectedLabel = useMemo(() => {
        const found = normalizedOptions.find((o: any) => String(o.value) === String(value));
        return found ? found.label : value || '';
    }, [value, normalizedOptions]);

    const filteredOptions = useMemo(() => {
        return normalizedOptions.filter((o: any) => 
            o.label.toLowerCase().includes(search.toLowerCase())
        );
    }, [normalizedOptions, search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-1.5 group relative" ref={containerRef}>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider group-focus-within:text-blue-600 transition-colors ml-1">{label}</label>
            <div 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer flex justify-between items-center hover:border-blue-300 transition-colors shadow-sm"
                onClick={() => { setIsOpen(!isOpen); if(!isOpen) setSearch(''); }}
            >
                <span className={`text-sm font-medium ${value ? 'text-slate-800' : 'text-slate-400'}`}>
                    {selectedLabel || placeholder || `Pilih ${label}`}
                </span>
                <ChevronDown size={16} className="text-slate-400" />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-zoom-in max-h-60 flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                autoFocus
                                type="text" 
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Cari..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt: any) => (
                                <div 
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between hover:bg-blue-50 transition-colors ${String(value) === String(opt.value) ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}`}
                                >
                                    {opt.label}
                                    {String(value) === String(opt.value) && <Check size={14} className="text-blue-600"/>}
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-center text-xs text-slate-400 italic">Tidak ditemukan.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INTERNAL COMPONENT: EDIT FORM ---
const EditForm = ({ 
    editModal, 
    setEditModal, 
    handleSaveEdit, 
    editConflicts, 
    courses, 
    classNames, 
    rooms, 
    lecturers, 
    isPopover, 
    courseOptions, 
    lecturerOptions, 
    roomOptions, 
    classOptions 
}: any) => {
    
    const update = (key: string, value: any) => {
        setEditModal((prev: any) => ({ ...prev, [key]: value }));
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600"><Edit2 size={16}/></div>
                   Edit Jadwal
                </h3>
                <button onClick={() => setEditModal({...editModal, isOpen: false})} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className={`p-6 flex-1 ${isPopover ? 'overflow-y-auto custom-scrollbar' : ''}`}>
                <div className="space-y-4">
                     <div>
                        <SearchableSelect 
                            label="Mata Kuliah"
                            options={courseOptions}
                            value={editModal.courseId}
                            onChange={(val: string) => update('courseId', val)}
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect 
                            label="Kelas"
                            options={classOptions}
                            value={editModal.className}
                            onChange={(val: string) => update('className', val)}
                        />
                         <SearchableSelect 
                            label="Ruangan"
                            options={roomOptions}
                            value={editModal.roomId}
                            onChange={(val: string) => update('roomId', val)}
                        />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <SearchableSelect 
                            label="Dosen PJMK"
                            options={[{value: '', label: '-- Open Slot --'}, ...lecturerOptions]}
                            value={editModal.lecturerId}
                            onChange={(val: string) => update('lecturerId', val)}
                        />
                        <SearchableSelect 
                            label="Dosen Anggota"
                            options={[{value: '', label: '-- Kosong --'}, ...lecturerOptions]}
                            value={editModal.teamLecturerId}
                            onChange={(val: string) => update('teamLecturerId', val)}
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hari</label>
                          <select 
                            value={editModal.day} 
                            onChange={(e) => update('day', e.target.value)} 
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <option value="">Hari</option>
                            {Object.values(DayOfWeek).map((d: any) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam</label>
                          <select 
                            value={editModal.time} 
                            onChange={(e) => update('time', e.target.value)} 
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <option value="">Jam</option>
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                     </div>
                     
                     {editConflicts.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl animate-pulse">
                            <div className="flex items-center gap-2 text-red-700 font-bold mb-1 text-xs">
                                <AlertTriangle size={14} />
                                <span>Konflik Jadwal</span>
                            </div>
                            <ul className="space-y-1">
                                {editConflicts.map((c: string, i: number) => (
                                    <li key={i} className="text-[10px] text-red-600 flex items-start gap-1">
                                        <div className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0" />
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        </div>
                     )}
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0 rounded-b-2xl">
                <button onClick={() => setEditModal({...editModal, isOpen: false})} className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors">Batal</button>
                <button 
                    onClick={handleSaveEdit}
                    disabled={editConflicts.length > 0}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${editConflicts.length > 0 ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`}
                >
                    <Save size={16} /> Simpan
                </button>
            </div>
        </div>
    );
};

const ScheduleView: React.FC<ScheduleViewProps> = ({
  courses, lecturers, rooms, classNames, schedule, setSchedule, onAddSchedule, onEditSchedule, onDeleteSchedule, onImportSchedule, onSync, isLocked = false, onToggleLock
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add Form State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(''); // PJMK
  const [selectedTeamLecturerId, setSelectedTeamLecturerId] = useState<string>(''); // Team Member
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | ''>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  const [sortBy, setSortBy] = useState<'time' | 'course' | 'class' | 'room'>('time');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Edit Modal State
  const [editModal, setEditModal] = useState<{
      isOpen: boolean;
      item: ScheduleItem | null;
      courseId: string;
      lecturerId: string;
      teamLecturerId: string;
      roomId: string;
      className: string;
      day: DayOfWeek | '';
      time: string;
  }>({
      isOpen: false,
      item: null,
      courseId: '',
      lecturerId: '',
      teamLecturerId: '',
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

  const getCourse = (id: string) => courses.find(c => c.id === id);
  const getCourseName = (id: string) => getCourse(id)?.name || id;
  const getRoomName = (id: string) => rooms.find(r => r.id === id)?.name || id;
  const getLecturerName = (id: string) => lecturers.find(l => l.id === id)?.name || id;

  // Option Mappers for Searchable Select (SORTED A-Z)
  const courseOptions = useMemo(() => courses
    .map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label)), 
  [courses]);

  const lecturerOptions = useMemo(() => lecturers
    .map(l => ({ value: l.id, label: l.name }))
    .sort((a, b) => a.label.localeCompare(b.label)), 
  [lecturers]);

  const roomOptions = useMemo(() => rooms
    .map(r => ({ value: r.id, label: `${r.name} ${r.building ? `(${r.building})` : ''}` }))
    .sort((a, b) => a.label.localeCompare(b.label)), 
  [rooms]);

  const classOptions = useMemo(() => classNames
    .map(c => ({ value: c.name, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label)), 
  [classNames]);

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

    // 3. Cek Dosen (PJMK dan Team)
    const activeLecturers = [selectedLecturerId, selectedTeamLecturerId].filter(id => id && id !== '');
    activeLecturers.forEach(lid => {
        const lecturerConflict = schedule.find(s => 
            s.day === selectedDay && 
            s.timeSlot === selectedTime && 
            (s.lecturerIds || []).includes(lid)
        );
        if (lecturerConflict) conflicts.push(`DOSEN: ${getLecturerName(lid)} sedang mengajar di kelas ${lecturerConflict.className}`);
    });

    return conflicts;
  }, [selectedDay, selectedTime, selectedRoomId, selectedClassName, selectedLecturerId, selectedTeamLecturerId, schedule, rooms, courses, lecturers]);

  // --- CONFLICT LOGIC (Used for Edit - Excludes current item) ---
  const editConflicts = useMemo(() => {
    const conflicts: string[] = [];
    if (!editModal.isOpen || !editModal.item || !editModal.day || !editModal.time) return conflicts;

    const { day, time, roomId, className, lecturerId, teamLecturerId, item } = editModal;

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

    // 3. Cek Dosen (PJMK dan Team)
    const activeLecturers = [lecturerId, teamLecturerId].filter(id => id && id !== '');
    activeLecturers.forEach(lid => {
        const lecturerConflict = schedule.find(s => 
            s.id !== item.id &&
            s.day === day && 
            s.timeSlot === time && 
            (s.lecturerIds || []).includes(lid)
        );
        if (lecturerConflict) conflicts.push(`DOSEN: ${getLecturerName(lid)} sedang mengajar`);
    });

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
      setErrorMsg("Mohon lengkapi data wajib (MK, Kelas, Ruang, Hari, Jam).");
      return;
    }

    // Validate Lecturer Dupes
    if (selectedLecturerId && selectedTeamLecturerId && selectedLecturerId === selectedTeamLecturerId) {
        setErrorMsg("Dosen Utama dan Dosen Anggota tidak boleh sama.");
        return;
    }

    const lecturerIds = [selectedLecturerId, selectedTeamLecturerId].filter(id => id && id !== '');

    const newItem: ScheduleItem = {
      id: `sch-${Date.now()}`,
      courseId: selectedCourseId,
      lecturerIds: lecturerIds,
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
    setSelectedTeamLecturerId('');
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
        
        const modalWidth = 600; 
        const modalHeightEstimate = 500;
        
        let top = buttonRect.top - containerRect.top;
        let left = buttonRect.left - containerRect.left - modalWidth - 16;
        
        if (buttonRect.left - modalWidth < 20) {
            left = buttonRect.left - containerRect.left + buttonRect.width + 16;
             if (left + modalWidth > containerRect.width) {
                 left = containerRect.width - modalWidth - 20; 
             }
        }

        const spaceBelow = window.innerHeight - buttonRect.bottom;
        if (spaceBelow < modalHeightEstimate && buttonRect.top > modalHeightEstimate) {
            top = top - modalHeightEstimate + buttonRect.height;
        }

        setPopoverStyle({
            position: 'absolute',
            left: `${left}px`,
            top: `${top}px`,
            margin: 0,
            zIndex: 70
        });
    } else {
        setPopoverStyle({}); 
    }

    // Parse Lecturers: PJMK is Main, other is Team
    const currentLecturerIds = item.lecturerIds || [];
    let mainLec = item.pjmkLecturerId || '';
    let teamLec = '';

    // If no PJMK marked, try to guess or use order
    if (!mainLec && currentLecturerIds.length > 0) {
        mainLec = currentLecturerIds[0];
    }

    // Find the team member (someone who is in list but not main)
    const teamMember = currentLecturerIds.find(id => id !== mainLec);
    if (teamMember) teamLec = teamMember;

    setEditModal({
          isOpen: true,
          item: item,
          courseId: item.courseId,
          lecturerId: mainLec,
          teamLecturerId: teamLec,
          roomId: item.roomId,
          className: item.className,
          day: item.day,
          time: item.timeSlot
      });
  };

  const handleSaveEdit = () => {
      if (!editModal.item || !onEditSchedule) return;
      
      if (editModal.lecturerId && editModal.teamLecturerId && editModal.lecturerId === editModal.teamLecturerId) {
          alert("Dosen Utama dan Team tidak boleh sama.");
          return;
      }

      const newLecturerIds = [editModal.lecturerId, editModal.teamLecturerId].filter(id => id && id !== '');

      const updatedItem: ScheduleItem = {
          ...editModal.item,
          courseId: editModal.courseId,
          roomId: editModal.roomId,
          className: editModal.className,
          day: editModal.day as DayOfWeek,
          timeSlot: editModal.time,
          lecturerIds: newLecturerIds, 
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

  const handleLockToggle = () => {
    if (onToggleLock) {
        onToggleLock();
        const msg = !isLocked 
            ? 'Sistem Penjadwalan BERHASIL DIKUNCI. Dosen tidak dapat mengubah jadwal.' 
            : 'Sistem Penjadwalan BERHASIL DIBUKA. Dosen dapat mengakses kembali.';
        setToast({ message: msg, type: 'success' });
        setTimeout(() => setToast(null), 4000);
    }
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
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 right-6 z-[100] bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl animate-slide-down flex items-center gap-4 border border-slate-700">
            <div className="bg-emerald-500/20 p-2 rounded-full">
                <CheckCircle className="text-emerald-400" size={24} />
            </div>
            <div>
                <h4 className="font-bold text-sm text-white">Notifikasi Sistem</h4>
                <p className="text-xs text-slate-300 mt-0.5">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
        </div>
      )}

      {/* Header and Actions (Sync, Import, Export) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-800">Penjadwalan Kuliah</h2>
          <div className="flex items-center gap-2 text-sm">
             <span className="text-slate-500">Kelola jadwal kuliah per sesi.</span>
             <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${isLocked ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                {isLocked ? 'STATUS: TERKUNCI' : 'STATUS: TERBUKA'}
             </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* SORT CONTROL */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm h-[42px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline"><ArrowUpDown size={12} className="inline mr-1"/>Urutkan:</span>
              <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)} 
                  className="text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                  <option value="time">Waktu</option>
                  <option value="course">Mata Kuliah</option>
                  <option value="class">Kelas</option>
                  <option value="room">Ruangan</option>
              </select>
          </div>

          {onToggleLock && (
             <button 
                onClick={handleLockToggle} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border shadow-sm transition-all active:scale-95 group ${
                    isLocked 
                    ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 shadow-red-200' 
                    : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                }`}
             >
                {isLocked ? <ToggleRight size={22} className="text-white" /> : <ToggleLeft size={22} />}
                {isLocked ? 'Buka Jadwal' : 'Kunci Jadwal'}
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

      {/* Add Schedule Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
           <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Plus size={16}/></div>
           Tambah Jadwal Baru
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <SearchableSelect 
                label="Mata Kuliah"
                options={courseOptions}
                value={selectedCourseId}
                onChange={setSelectedCourseId}
                placeholder="-- Pilih Mata Kuliah --"
              />
            </div>
            <div>
              <SearchableSelect 
                label="Kelas"
                options={classOptions}
                value={selectedClassName}
                onChange={setSelectedClassName}
                placeholder="-- Pilih Kelas --"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <SearchableSelect 
                label="Ruangan"
                options={roomOptions}
                value={selectedRoomId}
                onChange={setSelectedRoomId}
                placeholder="-- Pilih Ruangan --"
              />
            </div>
            {/* Split Dosen Section */}
            <div className="grid grid-cols-1 gap-2">
                <div>
                    <SearchableSelect 
                        label="Dosen Inisiator (PJMK)"
                        options={[{value: '', label: '-- Open Slot --'}, ...lecturerOptions]}
                        value={selectedLecturerId}
                        onChange={setSelectedLecturerId}
                        placeholder="-- Open Slot --"
                    />
                </div>
                <div>
                    <SearchableSelect 
                        label="Dosen Anggota (Team)"
                        options={[{value: '', label: '-- Kosong --'}, ...lecturerOptions]}
                        value={selectedTeamLecturerId}
                        onChange={setSelectedTeamLecturerId}
                        placeholder="-- Kosong --"
                    />
                </div>
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

      {/* Schedule List */}
      <div className="space-y-8">
        {Object.values(DayOfWeek).map((day) => {
          const dayItems = schedule
            .filter((s) => s.day === day)
            .sort((a, b) => {
               // --- SORTING LOGIC ---
               if (sortBy === 'course') {
                   const cmp = getCourseName(a.courseId).localeCompare(getCourseName(b.courseId));
                   if (cmp !== 0) return cmp;
               } else if (sortBy === 'class') {
                   const cmp = a.className.localeCompare(b.className);
                   if (cmp !== 0) return cmp;
               } else if (sortBy === 'room') {
                   const cmp = getRoomName(a.roomId).localeCompare(getRoomName(b.roomId));
                   if (cmp !== 0) return cmp;
               }
               
               // Default Secondary Sort: Time
               const timeCompare = TIME_SLOTS.indexOf(a.timeSlot) - TIME_SLOTS.indexOf(b.timeSlot);
               if (timeCompare !== 0) return timeCompare;
               
               // Tertiary: Course Name
               const nameA = getCourseName(a.courseId).toLowerCase();
               const nameB = getCourseName(b.courseId).toLowerCase();
               const courseCompare = nameA.localeCompare(nameB);
               if (courseCompare !== 0) return courseCompare;
               
               return a.className.localeCompare(b.className);
            });

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
                           courseOptions={courseOptions}
                           lecturerOptions={lecturerOptions}
                           roomOptions={roomOptions}
                           classOptions={classOptions}
                        />
                   </div>
                )}
            </div>

            {/* Popover Absolute Modal for Desktop (Scrolls with container) */}
            {isPopover && (
                <div 
                   className="absolute bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-down border border-slate-100"
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
                        courseOptions={courseOptions}
                        lecturerOptions={lecturerOptions}
                        roomOptions={roomOptions}
                        classOptions={classOptions}
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

export default ScheduleView;
