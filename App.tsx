
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Menu, BookOpen, Users, Building2, Calendar, LayoutDashboard, CalendarClock, Loader2, Settings, RefreshCw, AlertCircle, CheckCircle2, Lock, Key, X, CheckCircle, AlertTriangle, PieChart, UserCheck, UserMinus, Flag, List, XCircle, Clock, MapPin, FileSpreadsheet, Wifi } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import DataManager from './views/DataManager';
import ScheduleView from './views/ScheduleView';
import MonitoringView from './views/MonitoringView';
import LecturerPortal from './views/LecturerPortal';
import LecturerMonitoringView from './views/LecturerMonitoringView'; 
import HonorView from './views/HonorView'; 
import LoginView from './views/LoginView';
import SettingsView from './views/SettingsView';
import AttendanceAdminView from './views/AttendanceAdminView'; 
import { Course, Lecturer, Room, ScheduleItem, ViewState, User, UserRole, ClassName, AppSetting, TeachingLog } from './types';
import * as XLSX from 'xlsx';

// UPDATED BACKEND URL (PHP API)
const DEFAULT_SHEET_URL = 'https://pkkii.pendidikan.unair.ac.id/simpdbapi/api.php';
const CACHE_KEY = 'simpdb_data_cache_v5_api_php'; // Updated cache key
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 Minutes
const POLLING_INTERVAL = 3000; // Poll every 3 seconds for real-time sync

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // --- ROUTING LOGIC (HASH BASED) ---
  const getViewFromHash = (): ViewState => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash) return hash as ViewState;
    }
    return 'dashboard';
  };

  const [currentView, setCurrentView] = useState<ViewState>(getViewFromHash);

  // --- DOCUMENT TITLE UPDATE ---
  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      schedule: 'Jadwal Kuliah',
      courses: 'Mata Kuliah',
      lecturers: 'Data Dosen',
      rooms: 'Data Ruangan',
      classes: 'Data Kelas',
      monitoring: 'Monitoring',
      attendance: 'Presensi Dosen',
      honor: 'Honor Mengajar',
      portal: 'Portal Dosen',
      lecturer_monitoring: 'Monitoring Saya',
      settings: 'Pengaturan'
    };
    
    document.title = `${titles[currentView] || 'Aplikasi'} - SIMPDB`;
  }, [currentView]);

  // --- HASH LISTENER ---
  useEffect(() => {
    const handleHashChange = () => {
      const newView = getViewFromHash();
      setCurrentView(newView);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [errorSync, setErrorSync] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [realtimeNotification, setRealtimeNotification] = useState<boolean>(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [classNames, setClassNames] = useState<ClassName[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [teachingLogs, setTeachingLogs] = useState<TeachingLog[]>([]);

  // Refs for State Comparison (Optimized Realtime)
  const previousDataRef = useRef<string>('');

  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passForm, setPassForm] = useState({ old: '', new: '', confirm: '' });
  const [passMsg, setPassMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isScheduleLocked = settings.some(s => s.key === 'schedule_lock' && String(s.value).toLowerCase() === 'true');

  // Dashboard Stats Toggle State
  const [statsMode, setStatsMode] = useState<'all' | 'active'>('active');
  const [coordDetailOpen, setCoordDetailOpen] = useState(false);

  // Initialize URL - Force update if it doesn't match the new default
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    const stored = localStorage.getItem('simpdb_api_url');
    // If stored is old google script or empty, update to new API
    if (!stored || stored.includes('script.google.com')) {
       localStorage.setItem('simpdb_api_url', DEFAULT_SHEET_URL);
       return DEFAULT_SHEET_URL;
    }
    return stored;
  });

  // --- AUTO POLLING FOR REAL-TIME SYNC ---
  useEffect(() => {
    if (!sheetUrl) return;

    const intervalId = setInterval(() => {
      // Only poll if window is visible (save resources) and not currently syncing manually
      // We pass 'silent=true' to avoid showing the loading spinner constantly
      if (!document.hidden && !isSyncing) {
         fetchFromSheets(sheetUrl, true, true); 
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [sheetUrl, isSyncing]);

  // --- STATS & DATA CALCULATION ---
  const lecturerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    const total = lecturers.length;
    
    lecturers.forEach(l => {
      let pos = l.position && l.position.trim() !== '' ? l.position.trim() : 'Lainnya';
      if (pos.toLowerCase() === 'belum punya jabfung') pos = 'Belum Punya Jabfung';
      stats[pos] = (stats[pos] || 0) + 1;
    });

    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => {
         let colorClass = 'bg-slate-400';
         if (label.includes('Guru Besar')) colorClass = 'bg-purple-500';
         else if (label.includes('Lektor Kepala')) colorClass = 'bg-indigo-500';
         else if (label.includes('Lektor')) colorClass = 'bg-blue-500';
         else if (label.includes('Asisten')) colorClass = 'bg-emerald-500';
         else if (label.includes('LB') || label.includes('Praktisi')) colorClass = 'bg-amber-500';
         else if (label.includes('Belum Punya')) colorClass = 'bg-slate-500';
         
         return { label, count, percentage: total > 0 ? (count / total) * 100 : 0, colorClass };
      });
  }, [lecturers]);

  const activeLecturerStats = useMemo(() => {
    const plottedIds = new Set<string>();
    schedule.forEach(s => {
       if (s.lecturerIds && Array.isArray(s.lecturerIds)) s.lecturerIds.forEach(id => plottedIds.add(id));
    });

    const stats: Record<string, number> = {};
    let totalActive = 0;
    
    lecturers.forEach(l => {
       if (plottedIds.has(l.id)) {
           let pos = l.position && l.position.trim() !== '' ? l.position.trim() : 'Lainnya';
           if (pos.toLowerCase() === 'belum punya jabfung') pos = 'Belum Punya Jabfung';
           stats[pos] = (stats[pos] || 0) + 1;
           totalActive++;
       }
    });

    return Object.entries(stats)
     .sort((a, b) => b[1] - a[1])
     .map(([label, count]) => {
        let colorClass = 'bg-slate-400';
        if (label.includes('Guru Besar')) colorClass = 'bg-purple-500';
        else if (label.includes('Lektor Kepala')) colorClass = 'bg-indigo-500';
        else if (label.includes('Lektor')) colorClass = 'bg-blue-500';
        else if (label.includes('Asisten')) colorClass = 'bg-emerald-500';
        else if (label.includes('LB') || label.includes('Praktisi')) colorClass = 'bg-amber-500';
        else if (label.includes('Belum Punya')) colorClass = 'bg-slate-500';
        return { label, count, percentage: totalActive > 0 ? (count / totalActive) * 100 : 0, colorClass };
     });
 }, [lecturers, schedule]);

  const coordinatorStats = useMemo(() => {
    const uniqueCoordinatorIds = Array.from(new Set(courses.map(c => c.coordinatorId).filter(id => id && id.trim() !== '')));
    const details = uniqueCoordinatorIds.map(coordId => {
        const lecturer = lecturers.find(l => l.id === coordId);
        const name = lecturer?.name || 'Unknown';
        const mySchedules = schedule.filter(s => (s.lecturerIds || []).includes(coordId!));
        const scheduleDetails = mySchedules.map(s => {
            const course = courses.find(c => c.id === s.courseId);
            const room = rooms.find(r => r.id === s.roomId);
            const teamNames = (s.lecturerIds || []).map(lid => lecturers.find(lx => lx.id === lid)?.name || lid);
            const isCoordinatedByMe = course?.coordinatorId === coordId;
            return {
                id: s.id,
                className: s.className,
                courseName: course?.name || s.courseId,
                courseCode: course?.code || '',
                day: s.day,
                time: s.timeSlot,
                room: room?.name || s.roomId,
                building: room?.building || '',
                team: teamNames,
                isCoordinatedByMe
            };
        }).sort((a, b) => a.className.localeCompare(b.className));

        return {
            id: coordId,
            name: name,
            scheduleCount: scheduleDetails.length,
            schedules: scheduleDetails,
            isTeachingAnything: scheduleDetails.length > 0
        };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const totalCoordinators = uniqueCoordinatorIds.length;
    const activeCoordinators = details.filter(d => d.isTeachingAnything).length;
    const inactiveCoordinators = totalCoordinators - activeCoordinators;
    const percentageTeaching = totalCoordinators > 0 ? (activeCoordinators / totalCoordinators) * 100 : 0;

    return { totalCoordinators, activeCoordinators, inactiveCoordinators, percentageTeaching, details };
  }, [courses, schedule, lecturers, rooms]);

  const plottingStats = useMemo(() => {
     const plottedIds = new Set<string>();
     schedule.forEach(s => {
        if (s.lecturerIds && Array.isArray(s.lecturerIds)) s.lecturerIds.forEach(id => plottedIds.add(id));
     });
     const total = lecturers.length;
     const plotted = plottedIds.size;
     const unplotted = total - plotted;
     const percentage = total > 0 ? (plotted / total) * 100 : 0;
     return { total, plotted, unplotted, percentage };
  }, [lecturers, schedule]);

  const downloadCoordinatorReport = () => {
    if (!coordinatorStats.details || coordinatorStats.details.length === 0) return;
    try {
        const data: any[] = [];
        coordinatorStats.details.forEach(coord => {
            if (coord.schedules.length === 0) {
                data.push({ "Nama Koordinator": coord.name, "Status Mengajar": "Tidak Mengajar", "Mata Kuliah": "-", "Kelas": "-", "Hari": "-", "Jam": "-", "Ruangan": "-", "Tim Pengajar": "-", "Posisi di MK": "-" });
            } else {
                coord.schedules.forEach(sch => {
                    data.push({ "Nama Koordinator": coord.name, "Status Mengajar": "Aktif", "Mata Kuliah": sch.courseName, "Kelas": sch.className, "Hari": sch.day, "Jam": sch.time, "Ruangan": sch.room, "Tim Pengajar": sch.team.join(", "), "Posisi di MK": sch.isCoordinatedByMe ? "Koordinator (PJMK)" : "Dosen Pengajar" });
                });
            }
        });
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sebaran Koordinator");
        XLSX.writeFile(workbook, "Laporan_Sebaran_Koordinator.xlsx");
    } catch (e) { console.error("Download failed", e); }
  };

  const handleViewChange = (view: ViewState) => { window.location.hash = view; };

  const saveToCache = (data: any) => {
    const cacheData = { timestamp: new Date().toISOString(), data: data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    setLastSyncTime(new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}));
  };

  const loadFromCache = useCallback(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const data = parsed.data;
        if (data.courses) setCourses(data.courses);
        if (data.lecturers) setLecturers(data.lecturers);
        if (data.rooms) setRooms(data.rooms);
        if (data.schedule) setSchedule(data.schedule);
        if (data.classes) setClassNames(data.classes);
        if (data.settings) setSettings(data.settings);
        if (data.teaching_logs) setTeachingLogs(data.teaching_logs);
        if (parsed.timestamp) setLastSyncTime(new Date(parsed.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}));
        
        // Initialize Ref with cached data to prevent initial reload trigger
        previousDataRef.current = JSON.stringify(data);
        return true; 
      } catch (e) { return false; }
    }
    return false;
  }, []);

  const fetchFromSheets = async (url: string, forceRefresh = false, silent = false) => {
    if (!url) return;
    if (!silent) setIsSyncing(true);
    if (!silent) setErrorSync(null); 
    
    try {
      let cleanUrl = url.trim();
      const separator = cleanUrl.includes('?') ? '&' : '?';
      const nocacheParam = forceRefresh ? '&nocache=true' : '';
      const fetchUrl = `${cleanUrl}${separator}t=${new Date().getTime()}${nocacheParam}`;
      
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`Server error: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      
      if (data) {
        const normalizedData = {
          courses: data.courses?.map((c: any) => ({ ...c, id: String(c.id), credits: Number(c.credits) || 0, coordinatorId: String(c.coordinatorId || '') })) || [],
          lecturers: data.lecturers?.map((l: any) => ({ ...l, id: String(l.id), nip: String(l.nip) })) || [],
          rooms: data.rooms?.map((r: any) => ({ ...r, id: String(r.id), capacity: Number(r.capacity) || 0 })) || [],
          schedule: data.schedule?.map((s: any) => {
            let parsedIds: string[] = [];
            try {
              if (Array.isArray(s.lecturerIds)) { parsedIds = s.lecturerIds.map(String); } 
              else if (s.lecturerIds && typeof s.lecturerIds === 'string') {
                 try { const raw = JSON.parse(s.lecturerIds); if (Array.isArray(raw)) parsedIds = raw.map(String); else parsedIds = [String(s.lecturerIds)]; } 
                 catch { if (s.lecturerIds.includes(',')) parsedIds = s.lecturerIds.split(',').map((i: string) => i.trim()); else parsedIds = [s.lecturerIds]; }
              } else if (s.lecturerIds) { parsedIds = [String(s.lecturerIds)]; } 
              else if (s.lecturerId) { parsedIds = [String(s.lecturerId)]; }
            } catch(e) { if (typeof s.lecturerIds === 'string') parsedIds = [s.lecturerIds]; }

            return { 
              ...s, 
              id: String(s.id), 
              lecturerIds: parsedIds,
              pjmkLecturerId: String(s.pjmkLecturerId || ''),
              courseId: String(s.courseId).trim(), 
              roomId: String(s.roomId).trim(),
              className: String(s.className || '').trim(),
              timeSlot: String(s.timeSlot || '').trim()
            };
          }) || [],
          classes: data.classes || [],
          settings: data.settings || [],
          teaching_logs: data.teaching_logs?.map((l: any) => ({
             id: String(l.id),
             scheduleId: String(l.scheduleId),
             lecturerId: String(l.lecturerId),
             week: Number(l.week) || 0,
             timestamp: String(l.timestamp || ''),
             date: String(l.date || '')
          })) || []
        };

        // --- REALTIME OPTIMIZATION: DEEP COMPARISON ---
        // Only update state if data physically changed to avoid re-renders
        const currentString = JSON.stringify(normalizedData);
        if (currentString !== previousDataRef.current) {
            
            // If it's a silent poll (auto-refresh) and data changed, show toast
            if (silent && previousDataRef.current !== '') {
                setRealtimeNotification(true);
                setTimeout(() => setRealtimeNotification(false), 4000);
            }

            setCourses(normalizedData.courses);
            setLecturers(normalizedData.lecturers);
            setRooms(normalizedData.rooms);
            setSchedule(normalizedData.schedule);
            setSettings(normalizedData.settings);
            setTeachingLogs(normalizedData.teaching_logs);
            if (normalizedData.classes.length > 0) setClassNames(normalizedData.classes);
            
            previousDataRef.current = currentString;
            saveToCache(normalizedData);
        }
        
        setApiConnected(true);
        if (!silent) setErrorSync(null);
      }
    } catch (error: any) {
      if (!silent) {
          setApiConnected(false);
          let msg = error.message === 'Failed to fetch' ? "Koneksi internet bermasalah." : error.message;
          setErrorSync(msg);
      }
    } finally {
      if (!silent) setIsSyncing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const defaultClasses = Array.from({ length: 125 }, (_, i) => ({ id: `cls-${i+1}`, name: `PDB${(i+1).toString().padStart(2, '0')}` }));
    setClassNames(defaultClasses);

    const hasCache = loadFromCache();
    if (hasCache) setIsLoading(false);

    if (sheetUrl) {
       setTimeout(() => fetchFromSheets(sheetUrl, true), 100);
    } else {
      setIsLoading(false);
    }

    const storedSession = localStorage.getItem('simpdb_session');
    if (storedSession) {
      try {
        const user = JSON.parse(storedSession);
        setCurrentUser(user);
        if (!window.location.hash) {
            window.location.hash = user.role === 'admin' ? 'dashboard' : 'portal';
        }
      } catch (e) {
        localStorage.removeItem('simpdb_session');
      }
    }
  }, [loadFromCache]);

  const handleSaveSheetUrl = (url: string) => {
    setSheetUrl(url);
    localStorage.setItem('simpdb_api_url', url);
    fetchFromSheets(url, true);
  };

  const handleLogin = (id: string, name: string, role: UserRole) => {
    const user = { id: String(id), name, role };
    setCurrentUser(user);
    setSessionMessage(null);
    localStorage.setItem('simpdb_session', JSON.stringify(user));
    window.location.hash = role === 'admin' ? 'dashboard' : 'portal';
  };

  const handleLogout = useCallback((isAutoLogout = false) => {
    setCurrentUser(null);
    localStorage.removeItem('simpdb_session');
    window.location.hash = ''; 
    if (isAutoLogout) setSessionMessage("Sesi Anda telah berakhir karena tidak ada aktivitas selama 10 menit.");
    else setSessionMessage(null);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const resetTimer = () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = setTimeout(() => handleLogout(true), INACTIVITY_TIMEOUT);
    };
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [currentUser, handleLogout]);

  const syncData = async (action: 'add' | 'delete' | 'update' | 'clear', table: string, payload: any) => {
    if (apiConnected && sheetUrl) {
      setIsSyncing(true); 
      try {
        const response = await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, table, data: payload, id: payload.id })
        });
        if (response.ok) {
            // Updated to perform a silent refresh after sync to keep UI updated without re-triggering loading bar
            setTimeout(() => fetchFromSheets(sheetUrl, true, true), 1000); 
        }
      } catch(e) { console.error("Sync Error", e); } 
      finally {
        setIsSyncing(false); // FIXED: Turn off loading state regardless of outcome
      }
    }
  };

  const bulkSyncData = async (table: string, items: any[]) => {
    if (!apiConnected || !sheetUrl) return;
    setIsSyncing(true);
    try {
        const response = await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk_add', table, data: items })
        });
        if (response.ok) {
            setTimeout(() => fetchFromSheets(sheetUrl, true, true), 2000); 
        }
    } catch(e) { console.error("Bulk Sync Error", e); } finally { setIsSyncing(false); }
  };

  const getSnapshot = () => ({ courses, lecturers, rooms, schedule, classes: classNames, settings, teaching_logs: teachingLogs });
  
  // --- DATA HANDLERS ---
  const handleAddCourse = (item: Omit<Course, 'id'>) => { const newItem = { ...item, id: `c-${Date.now()}`, coordinatorId: item.coordinatorId || '' }; setCourses(prev => { const n = [...prev, newItem]; saveToCache({...getSnapshot(), courses: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), courses: n}); return n; }); syncData('add', 'courses', newItem); };
  const handleEditCourse = (item: Course) => { setCourses(prev => { const n = prev.map(i => i.id === item.id ? item : i); saveToCache({...getSnapshot(), courses: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), courses: n}); return n; }); syncData('update', 'courses', item); };
  const handleDeleteCourse = (id: string) => { setCourses(prev => { const n = prev.filter(i => i.id !== id); saveToCache({...getSnapshot(), courses: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), courses: n}); return n; }); syncData('delete', 'courses', { id }); };
  const handleImportCourses = (items: Omit<Course, 'id'>[]) => { const newItems = items.map((item, index) => ({ ...item, id: `c-imp-${Date.now()}-${index}`, coordinatorId: item.coordinatorId || '' })); setCourses(prev => { const n = [...prev, ...newItems]; saveToCache({...getSnapshot(), courses: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), courses: n}); return n; }); bulkSyncData('courses', newItems); };
  const handleClearCourses = () => { setCourses([]); saveToCache({...getSnapshot(), courses: []}); previousDataRef.current = JSON.stringify({...getSnapshot(), courses: []}); syncData('clear', 'courses', {}); };

  const handleAddLecturer = (item: Omit<Lecturer, 'id'>) => { const newItem = { ...item, id: `l-${Date.now()}`, nip: String(item.nip) }; setLecturers(prev => { const n = [...prev, newItem]; saveToCache({...getSnapshot(), lecturers: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), lecturers: n}); return n; }); syncData('add', 'lecturers', newItem); };
  const handleEditLecturer = (item: Lecturer) => { setLecturers(prev => { const n = prev.map(i => i.id === item.id ? item : i); saveToCache({...getSnapshot(), lecturers: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), lecturers: n}); return n; }); syncData('update', 'lecturers', item); };
  const handleDeleteLecturer = (id: string) => { setLecturers(prev => { const n = prev.filter(i => i.id !== id); saveToCache({...getSnapshot(), lecturers: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), lecturers: n}); return n; }); syncData('delete', 'lecturers', { id }); };
  const handleImportLecturers = (items: Omit<Lecturer, 'id'>[]) => { const newItems = items.map((item, index) => ({ ...item, id: `l-imp-${Date.now()}-${index}`, nip: String(item.nip) })); setLecturers(prev => { const n = [...prev, ...newItems]; saveToCache({...getSnapshot(), lecturers: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), lecturers: n}); return n; }); bulkSyncData('lecturers', newItems); };
  const handleClearLecturers = () => { setLecturers([]); saveToCache({...getSnapshot(), lecturers: []}); previousDataRef.current = JSON.stringify({...getSnapshot(), lecturers: []}); syncData('clear', 'lecturers', {}); };

  const handleAddRoom = (item: Omit<Room, 'id'>) => { const newItem = { ...item, id: `r-${Date.now()}` }; setRooms(prev => { const n = [...prev, newItem]; saveToCache({...getSnapshot(), rooms: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), rooms: n}); return n; }); syncData('add', 'rooms', newItem); };
  const handleEditRoom = (item: Room) => { setRooms(prev => { const n = prev.map(i => i.id === item.id ? item : i); saveToCache({...getSnapshot(), rooms: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), rooms: n}); return n; }); syncData('update', 'rooms', item); };
  const handleDeleteRoom = (id: string) => { setRooms(prev => { const n = prev.filter(i => i.id !== id); saveToCache({...getSnapshot(), rooms: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), rooms: n}); return n; }); syncData('delete', 'rooms', { id }); };
  const handleImportRooms = (items: Omit<Room, 'id'>[]) => { const newItems = items.map((item, index) => ({ ...item, id: `r-imp-${Date.now()}-${index}` })); setRooms(prev => { const n = [...prev, ...newItems]; saveToCache({...getSnapshot(), rooms: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), rooms: n}); return n; }); bulkSyncData('rooms', newItems); };
  const handleClearRooms = () => { setRooms([]); saveToCache({...getSnapshot(), rooms: []}); previousDataRef.current = JSON.stringify({...getSnapshot(), rooms: []}); syncData('clear', 'rooms', {}); };

  const handleAddClass = (item: Omit<ClassName, 'id'>) => { const newItem = { ...item, id: `cls-${Date.now()}` }; setClassNames(prev => { const n = [...prev, newItem]; saveToCache({...getSnapshot(), classes: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), classes: n}); return n; }); syncData('add', 'classes', newItem); };
  const handleEditClass = (item: ClassName) => { setClassNames(prev => { const n = prev.map(i => i.id === item.id ? item : i); saveToCache({...getSnapshot(), classes: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), classes: n}); return n; }); syncData('update', 'classes', item); };
  const handleDeleteClass = (id: string) => { setClassNames(prev => { const n = prev.filter(i => i.id !== id); saveToCache({...getSnapshot(), classes: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), classes: n}); return n; }); syncData('delete', 'classes', { id }); };
  const handleImportClasses = (items: Omit<ClassName, 'id'>[]) => { const newItems = items.map((item, index) => ({ ...item, id: `cls-imp-${Date.now()}-${index}` })); setClassNames(prev => { const n = [...prev, ...newItems]; saveToCache({...getSnapshot(), classes: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), classes: n}); return n; }); bulkSyncData('classes', newItems); };
  const handleClearClasses = () => { setClassNames([]); saveToCache({...getSnapshot(), classes: []}); previousDataRef.current = JSON.stringify({...getSnapshot(), classes: []}); syncData('clear', 'classes', {}); };

  const syncAddSchedule = (item: ScheduleItem) => { setSchedule(prev => { const n = [...prev, item]; saveToCache({...getSnapshot(), schedule: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), schedule: n}); return n; }); syncData('add', 'schedule', item); };
  const syncEditSchedule = (item: ScheduleItem) => { setSchedule(prev => { const n = prev.map(s => s.id === item.id ? item : s); saveToCache({...getSnapshot(), schedule: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), schedule: n}); return n; }); syncData('update', 'schedule', item); };
  const syncDeleteSchedule = (id: string) => { setSchedule(prev => { const n = prev.filter(s => s.id !== id); saveToCache({...getSnapshot(), schedule: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), schedule: n}); return n; }); syncData('delete', 'schedule', { id }); };
  const handleImportSchedule = (items: ScheduleItem[]) => { setSchedule(prev => { const n = [...prev, ...items]; saveToCache({...getSnapshot(), schedule: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), schedule: n}); return n; }); bulkSyncData('schedule', items); };
  
  const handleTeamTeachingUpdate = (scheduleId: string, newLecturerIds: string[], pjmkId?: string) => {
    const item = schedule.find(s => s.id === scheduleId);
    if (item) {
        const updatedItem = { ...item, lecturerIds: newLecturerIds, pjmkLecturerId: pjmkId || item.pjmkLecturerId };
        setSchedule(prev => { const n = prev.map(s => s.id === scheduleId ? updatedItem : s); saveToCache({...getSnapshot(), schedule: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), schedule: n}); return n; });
        syncData('update', 'schedule', updatedItem);
    }
  };

  const handleToggleLock = () => {
    const newStatus = !isScheduleLocked;
    const existingSetting = settings.find(s => s.key === 'schedule_lock');
    const settingId = existingSetting ? existingSetting.id : 'lock_setting';
    const settingItem = { id: settingId, key: 'schedule_lock', value: newStatus ? 'true' : 'false' };
    setSettings(prev => { const n = [...prev.filter(s => s.key !== 'schedule_lock'), settingItem]; saveToCache({...getSnapshot(), settings: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), settings: n}); return n; });
    syncData('update', 'settings', settingItem);
  };

  const handleLecturerPasswordChange = (lecturerId: string, newPass: string) => {
    const lecturer = lecturers.find(l => l.id === lecturerId);
    if (lecturer) {
        const updatedLecturer = { ...lecturer, password: newPass };
        setLecturers(prev => { const n = prev.map(l => l.id === lecturerId ? updatedLecturer : l); saveToCache({...getSnapshot(), lecturers: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), lecturers: n}); return n; });
        syncData('update', 'lecturers', updatedLecturer);
    }
  };

  const handleAddLog = (log: TeachingLog) => {
     // FIX: Generate MySQL compatible timestamp (YYYY-MM-DD HH:MM:SS) using local time
     const now = new Date();
     const pad = (num: number) => num.toString().padStart(2, '0');
     const formattedTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

     const existingLog = teachingLogs.find(l => l.scheduleId === log.scheduleId && l.lecturerId === log.lecturerId && l.week === log.week);
     if (existingLog) {
        const updatedLog = { ...existingLog, date: log.date, timestamp: formattedTimestamp };
        setTeachingLogs(prev => { const n = prev.map(l => l.id === existingLog.id ? updatedLog : l); saveToCache({...getSnapshot(), teaching_logs: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), teaching_logs: n}); return n; });
        syncData('update', 'teaching_logs', updatedLog);
     } else {
        const newLog = { ...log, id: `log-${Date.now()}-${Math.random()}`, timestamp: formattedTimestamp };
        setTeachingLogs(prev => { const n = [...prev, newLog]; saveToCache({...getSnapshot(), teaching_logs: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), teaching_logs: n}); return n; });
        syncData('add', 'teaching_logs', newLog);
     }
  };

  const handleRemoveLog = (scheduleId: string, lecturerId: string, week: number) => {
     const logToRemove = teachingLogs.find(l => l.scheduleId === scheduleId && l.lecturerId === lecturerId && l.week === week);
     if (logToRemove) {
        setTeachingLogs(prev => { const n = prev.filter(l => l.id !== logToRemove.id); saveToCache({...getSnapshot(), teaching_logs: n}); previousDataRef.current = JSON.stringify({...getSnapshot(), teaching_logs: n}); return n; });
        syncData('delete', 'teaching_logs', { id: logToRemove.id });
     }
  };

  const handleSubmitPassword = (e: React.FormEvent) => {
     e.preventDefault();
     setPassMsg(null);
     if (passForm.new !== passForm.confirm) { setPassMsg({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' }); return; }
     if (passForm.new.length < 4) { setPassMsg({ type: 'error', text: 'Password minimal 4 karakter.' }); return; }
     if (!currentUser) return;
     const currentLecturer = lecturers.find(l => l.id === currentUser.id);
     if (!currentLecturer) return;
     const currentRealPass = (currentLecturer.password && String(currentLecturer.password).trim() !== '') ? currentLecturer.password : String(currentLecturer.nip);
     if (passForm.old !== currentRealPass) { setPassMsg({ type: 'error', text: 'Password lama salah.' }); return; }
     handleLecturerPasswordChange(currentUser.id, passForm.new);
     setPassMsg({ type: 'success', text: 'Password berhasil diubah!' });
     setPassForm({ old: '', new: '', confirm: '' });
     setTimeout(() => { setPassModalOpen(false); setPassMsg(null); }, 2000);
  };

  const handleManualSync = async () => {
    if (sheetUrl) await fetchFromSheets(sheetUrl, true);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col h-full items-center justify-center text-slate-500 gap-6 animate-fade-in">
          <img src="https://ppk2ipe.unair.ac.id/gambar/UNAIR_BRANDMARK_2025-02.png" alt="Logo" className="w-32 h-auto animate-pulse" />
          <div className="flex items-center gap-3">
             <Loader2 className="animate-spin text-primary-600" size={24} />
             <p className="font-medium text-lg">Memuat Sistem...</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        const usedRoomCount = new Set(schedule.map(s => s.roomId)).size;
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard</h2>
                <p className="text-slate-500 mt-1">
                   Status Database: <span className={`font-bold ${apiConnected ? 'text-emerald-600' : 'text-amber-600'}`}>{apiConnected ? 'Terhubung (Online)' : 'Mode Cache (Offline)'}</span>
                   {lastSyncTime && <span className="text-xs ml-2 bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-400">Sync: {lastSyncTime}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={() => fetchFromSheets(sheetUrl, true)} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-all flex items-center gap-2 shadow-sm active:scale-95 group">
                    <RefreshCw size={20} className={`group-hover:text-primary-600 transition-colors ${isSyncing ? 'animate-spin text-primary-600' : ''}`} />
                 </button>
                 {errorSync && (
                  <div className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} /> {errorSync}
                  </div>
                 )}
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-primary-600 to-indigo-700 p-8 rounded-3xl shadow-xl shadow-primary-900/10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10 flex items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className={`p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg ${isScheduleLocked ? 'bg-red-500/20 text-red-100' : 'bg-emerald-500/20 text-emerald-100'}`}>
                          {isScheduleLocked ? <Lock size={32} /> : <CheckCircle2 size={32} />}
                      </div>
                      <div>
                          <h3 className="font-bold text-xl text-white">Status Penjadwalan</h3>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold mt-2 border ${isScheduleLocked ? 'bg-red-500/20 border-red-400/30 text-red-100' : 'bg-emerald-500/20 border-emerald-400/30 text-emerald-100'}`}>
                             {isScheduleLocked ? 'SISTEM TERKUNCI' : 'PERIODE AKTIF'}
                          </div>
                          <p className="text-primary-100 text-sm mt-2 opacity-90 max-w-lg leading-relaxed">
                             {isScheduleLocked 
                                ? 'Akses perubahan jadwal untuk dosen telah dinonaktifkan. Hubungi admin untuk pembukaan akses darurat.' 
                                : 'Dosen dapat melakukan klaim kelas, team teaching, dan perubahan jadwal secara mandiri.'}
                          </p>
                      </div>
                   </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard title="Mata Kuliah" value={courses.length} icon={BookOpen} color="text-blue-500" />
              <StatCard title="Dosen Aktif" value={lecturers.length} icon={Users} color="text-emerald-500" />
              <StatCard title="Ruangan" value={rooms.length} icon={Building2} color="text-orange-500" />
              <StatCard title="Ruang Terpakai" value={usedRoomCount} icon={LayoutDashboard} color="text-indigo-500" />
              <StatCard title="Total Sesi" value={schedule.length} icon={Calendar} color="text-purple-500" />
            </div>

            {/* NEW: LECTURER POSITION STATISTICS & COORDINATOR STATS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Distribusi Jabatan Dosen</h3>
                            <p className="text-slate-500 text-sm">
                                {statsMode === 'all' ? 'Statistik seluruh data dosen.' : 'Statistik dosen yang aktif mengajar (terplot).'}
                            </p>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                           <button 
                             onClick={() => setStatsMode('active')}
                             className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statsMode === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                             Aktif Mengajar
                           </button>
                           <button 
                             onClick={() => setStatsMode('all')}
                             className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statsMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                             Semua Dosen
                           </button>
                        </div>
                    </div>
                    <div className="space-y-5">
                        {(statsMode === 'all' ? lecturerStats : activeLecturerStats).map((stat, idx) => (
                            <div key={idx} className="group">
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="font-bold text-slate-700">{stat.label}</span>
                                    <span className="text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded text-xs">
                                        {stat.count} Dosen ({stat.percentage.toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className={`${stat.colorClass} h-3 rounded-full transition-all duration-1000 ease-out group-hover:opacity-80`}
                                        style={{ width: `${stat.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {(statsMode === 'all' ? lecturerStats : activeLecturerStats).length === 0 && (
                            <div className="text-center py-8 text-slate-400 italic">Belum ada data dosen {statsMode === 'active' ? 'aktif' : ''}.</div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800 text-lg">Ringkasan</h3>
                        <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                             <PieChart size={20} />
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center gap-4">
                        {/* Status Plotting Stats */}
                        <div className="mb-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-slate-600">Status Plotting</span>
                                <span className="text-xl font-black text-blue-600">{plottingStats.plotted}<span className="text-xs text-slate-400 font-normal ml-1">/ {plottingStats.total}</span></span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2.5 mb-2 overflow-hidden">
                                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${plottingStats.percentage}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                                <div className="flex items-center gap-1 text-emerald-600">
                                   <UserCheck size={12} /> {plottingStats.plotted} Terplot
                                </div>
                                <div className="flex items-center gap-1 text-red-500">
                                   <UserMinus size={12} /> {plottingStats.unplotted} Belum
                                </div>
                            </div>
                        </div>

                        {/* Coordinator Stats */}
                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 relative group">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                    <Flag size={14} className="text-indigo-500" /> Koordinator MK
                                </span>
                                <span className="text-xs font-bold bg-white px-2 py-0.5 rounded text-indigo-600 border border-indigo-100">
                                    {coordinatorStats.totalCoordinators} Koordinator
                                </span>
                             </div>
                             
                             {coordinatorStats.totalCoordinators > 0 ? (
                                 <>
                                    <div className="flex justify-between items-end mb-1">
                                         <span className="text-xs text-slate-500">Turun Mengajar</span>
                                         <span className="text-lg font-black text-indigo-600">{coordinatorStats.percentageTeaching.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-indigo-200 rounded-full h-2 mb-2 overflow-hidden">
                                         <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${coordinatorStats.percentageTeaching}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
                                        <span className="text-emerald-600">{coordinatorStats.activeCoordinators} Mengajar</span>
                                        <span className="text-red-500">{coordinatorStats.inactiveCoordinators} Tidak</span>
                                    </div>
                                    <button 
                                      onClick={() => setCoordDetailOpen(true)}
                                      className="w-full py-1.5 bg-white border border-indigo-200 text-indigo-600 text-[10px] font-bold rounded-lg hover:bg-indigo-50 transition-colors uppercase tracking-wide"
                                    >
                                      Lihat Sebaran MK
                                    </button>
                                 </>
                             ) : (
                                 <div className="text-xs text-slate-400 italic">Belum ada koordinator ditentukan.</div>
                             )}
                        </div>

                         <div className="grid grid-cols-2 gap-3">
                             <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dosen Tetap</span>
                                 <div className="text-xl font-black text-slate-800 mt-1">
                                    {lecturerStats.filter(s => !s.label.includes('LB') && !s.label.includes('Praktisi')).reduce((acc, curr) => acc + curr.count, 0)}
                                 </div>
                             </div>
                             <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                 <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Dosen LB</span>
                                 <div className="text-xl font-black text-amber-700 mt-1">
                                    {lecturerStats.filter(s => s.label.includes('LB') || s.label.includes('Praktisi')).reduce((acc, curr) => acc + curr.count, 0)}
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* MODAL DETAIL KOORDINATOR */}
            {coordDetailOpen && (
              <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-10 sm:pt-20">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setCoordDetailOpen(false)}></div>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden animate-slide-down flex flex-col max-h-[85vh]">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                        <div>
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Flag size={18} className="text-indigo-600"/> Sebaran Koordinator MK</h3>
                          <p className="text-xs text-slate-500">Jadwal mengajar para koordinator pada mata kuliah yang diampunya.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={downloadCoordinatorReport}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-100"
                                title="Download Excel"
                            >
                                <FileSpreadsheet size={16} /> Export
                            </button>
                            <button onClick={() => setCoordDetailOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                    </div>
                    <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50">
                        {/* Grouped Lists */}
                        {coordinatorStats.details.length > 0 ? (
                            coordinatorStats.details.map((coordinator, gIdx) => (
                                <div key={gIdx} className="mb-8 last:mb-0">
                                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-3 mb-3 border-b border-slate-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700">
                                                <UserCheck size={18} />
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-lg">{coordinator.name}</h4>
                                        </div>
                                        <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200">
                                            {coordinator.scheduleCount} Kelas
                                        </span>
                                    </div>
                                    
                                    {coordinator.scheduleCount > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {coordinator.schedules.map((sch, j) => (
                                                <div key={`${gIdx}-${j}`} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col justify-between h-full">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <span className="inline-block bg-blue-50 text-blue-700 font-black text-xs px-2.5 py-1 rounded-lg uppercase tracking-wide mb-1.5 shadow-sm border border-blue-100">
                                                                    {sch.className}
                                                                </span>
                                                                <div className="font-bold text-slate-800 leading-tight">{sch.courseName}</div>
                                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{sch.courseCode}</div>
                                                                {sch.isCoordinatedByMe && (
                                                                    <div className="mt-2 inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[9px] font-bold border border-amber-100">
                                                                        <Flag size={8} className="fill-amber-700" /> Anda PJMK
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2 mb-4">
                                                            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <MapPin size={14} className="text-slate-400 shrink-0"/>
                                                                <div>
                                                                    <span className="font-semibold block">{sch.room}</span>
                                                                    {sch.building && <span className="text-[10px] text-slate-400 block">{sch.building}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                <Clock size={14} className="text-slate-400 shrink-0"/>
                                                                <span className="font-semibold">{sch.day}, {sch.time}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-100">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Tim Pengajar</div>
                                                        <div className="flex flex-col gap-1.5">
                                                            {sch.team.map((t, k) => (
                                                                <div key={k} className={`text-xs flex items-center gap-1.5 ${t === coordinator.name ? 'font-bold text-indigo-700' : 'text-slate-500'}`}>
                                                                    {t === coordinator.name ? <CheckCircle size={12} className="text-indigo-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1"></div>}
                                                                    {t}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-700">
                                            <XCircle size={20} />
                                            <span className="text-sm font-bold uppercase tracking-wide">Koordinator Tidak Mengajar (0 MK)</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <List size={48} className="opacity-20 mb-4" />
                                <p className="font-medium">Belum ada data koordinator.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                        <button onClick={() => setCoordDetailOpen(false)} className="px-8 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-slate-900 transition-all active:scale-95">
                            Tutup
                        </button>
                    </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'settings': return <SettingsView sheetUrl={sheetUrl} onSaveUrl={handleSaveSheetUrl} />;
      case 'monitoring': return <MonitoringView rooms={rooms} courses={courses} lecturers={lecturers} schedule={schedule} teachingLogs={teachingLogs} />;
      case 'courses': return <DataManager<Course> title="Mata Kuliah" data={courses} columns={[
          {key: 'code', label: 'Kode MK'}, 
          {key: 'name', label: 'Nama MK'}, 
          {key: 'credits', label: 'SKS'},
          // Flagging Coordinator: Uses dynamic options from lecturers list
          // FIXED: Safe sort comparison to avoid crashes if name is undefined
          {
              key: 'coordinatorId', 
              label: 'Koordinator MK', 
              type: 'select', 
              options: lecturers.map(l => ({ value: l.id, label: l.name })).sort((a,b) => (a.label || '').localeCompare(b.label || ''))
          }
        ]} onAdd={handleAddCourse} onEdit={handleEditCourse} onDelete={handleDeleteCourse} onImport={handleImportCourses} onSync={() => fetchFromSheets(sheetUrl, true)} onClear={handleClearCourses} />;
      case 'lecturers': return <DataManager<Lecturer> title="Dosen" data={lecturers} columns={[{key: 'name', label: 'Nama'}, {key: 'nip', label: 'NIP'}, {key: 'position', label: 'Status', type: 'select', options: ['Belum Punya Jabfung', 'Asisten Ahli','Lektor','Lektor Kepala','Guru Besar','LB','Praktisi']}]} onAdd={handleAddLecturer} onEdit={handleEditLecturer} onDelete={handleDeleteLecturer} onImport={handleImportLecturers} onSync={() => fetchFromSheets(sheetUrl, true)} onClear={handleClearLecturers} />;
      case 'rooms': return <DataManager<Room> title="Ruangan" data={rooms} columns={[{key: 'building', label: 'Gedung'}, {key: 'name', label: 'Ruangan'}, {key: 'capacity', label: 'Kapasitas'}, {key: 'location', label: 'Lokasi'}]} onAdd={handleAddRoom} onEdit={handleEditRoom} onDelete={handleDeleteRoom} onImport={handleImportRooms} onSync={() => fetchFromSheets(sheetUrl, true)} onClear={handleClearRooms} />;
      case 'classes': return <DataManager<ClassName> title="Kelas (PDB)" data={classNames} columns={[{key: 'name', label: 'Nama Kelas'}]} onAdd={handleAddClass} onEdit={handleEditClass} onDelete={handleDeleteClass} onImport={handleImportClasses} onSync={() => fetchFromSheets(sheetUrl, true)} onClear={handleClearClasses} />;
      case 'schedule': return <ScheduleView courses={courses} lecturers={lecturers} rooms={rooms} classNames={classNames} schedule={schedule} setSchedule={setSchedule} onAddSchedule={syncAddSchedule} onEditSchedule={syncEditSchedule} onDeleteSchedule={syncDeleteSchedule} onImportSchedule={handleImportSchedule} onSync={() => fetchFromSheets(sheetUrl, true)} isLocked={isScheduleLocked} onToggleLock={handleToggleLock} />;
      case 'attendance': return <AttendanceAdminView schedule={schedule} courses={courses} lecturers={lecturers} rooms={rooms} teachingLogs={teachingLogs} onAddLog={handleAddLog} onRemoveLog={handleRemoveLog} onSync={() => fetchFromSheets(sheetUrl, true)} />;
      case 'honor': return <HonorView lecturers={lecturers} schedule={schedule} courses={courses} teachingLogs={teachingLogs} />;
      case 'portal': return <LecturerPortal currentLecturerId={currentUser?.role === 'lecturer' ? currentUser.id : undefined} userRole={currentUser?.role || 'lecturer'} courses={courses} lecturers={lecturers} rooms={rooms} schedule={schedule} setSchedule={setSchedule} onUpdateLecturer={handleTeamTeachingUpdate} onSync={() => fetchFromSheets(sheetUrl, true)} isLocked={isScheduleLocked} teachingLogs={teachingLogs} onAddLog={handleAddLog} onRemoveLog={handleRemoveLog} />;
      case 'lecturer_monitoring': return <LecturerMonitoringView currentLecturerId={currentUser?.role === 'lecturer' ? currentUser.id : ''} schedule={schedule} courses={courses} teachingLogs={teachingLogs} />;
      default: return <div>Not Found</div>;
    }
  };

  if (!currentUser) return <LoginView lecturers={lecturers} onLogin={handleLogin} onSync={() => fetchFromSheets(sheetUrl, true)} sessionMessage={sessionMessage} />;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden font-sans text-slate-800">
      <Sidebar 
        currentView={currentView} 
        userRole={currentUser.role} 
        onChangeView={handleViewChange} 
        isOpen={sidebarOpen} 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        onLogout={() => handleLogout(false)} 
        onChangePassword={() => setPassModalOpen(true)}
        onSync={handleManualSync}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300">
        <div className={`absolute top-0 left-0 w-full h-1 bg-primary-100 z-50 overflow-hidden transition-opacity duration-500 ${isSyncing ? 'opacity-100' : 'opacity-0'}`}>
           <div className="h-full bg-primary-600 animate-subtle-progress"></div>
        </div>
        
        <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 flex items-center justify-between z-10 sticky top-0">
          <div className="font-bold text-slate-800 flex items-center gap-3">
            <img src="https://ppk2ipe.unair.ac.id/gambar/UNAIR_BRANDMARK_2025-02.png" alt="Logo" className="w-8 h-8 object-contain" />
            SIMPDB
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600"><Menu size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <div key={currentView} className="animate-enter w-full">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* REALTIME TOAST NOTIFICATION */}
        {realtimeNotification && (
            <div className="fixed top-24 right-6 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl animate-slide-down flex items-center gap-3 border border-slate-700">
                <div className="bg-emerald-500/20 p-1.5 rounded-full relative">
                    <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></span>
                    <Wifi className="text-emerald-400 relative z-10" size={18} />
                </div>
                <div>
                    <h4 className="font-bold text-xs text-white">Sinkronisasi Otomatis</h4>
                    <p className="text-[10px] text-slate-300">Data diperbarui dari server.</p>
                </div>
            </div>
        )}

        {passModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-10 sm:pt-20">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setPassModalOpen(false)}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden animate-slide-down border border-slate-100">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Key size={18} className="text-primary-600"/> Ganti Password</h3>
                  <button onClick={() => setPassModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
              </div>
              <form onSubmit={handleSubmitPassword} className="p-6 space-y-4">
                  {passMsg && (
                      <div className={`text-xs p-3 rounded-lg flex items-start gap-2 ${passMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {passMsg.type === 'error' ? <AlertTriangle size={14} className="mt-0.5"/> : <CheckCircle size={14} className="mt-0.5"/>}
                          {passMsg.text}
                      </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Password Lama</label>
                    <input 
                        type="password" 
                        required
                        value={passForm.old}
                        onChange={e => setPassForm({...passForm, old: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Password Baru</label>
                    <input 
                        type="password" 
                        required
                        value={passForm.new}
                        onChange={e => setPassForm({...passForm, new: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Konfirmasi Password</label>
                    <input 
                        type="password" 
                        required
                        value={passForm.confirm}
                        onChange={e => setPassForm({...passForm, confirm: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    />
                  </div>
                  <button type="submit" className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-200 transition-all mt-2 active:scale-95">
                      Simpan Password
                  </button>
              </form>
            </div>
          </div>
        )}

      </main>
      <style>{`
        .animate-subtle-progress { width: 30%; animation: slide 1s infinite linear; } 
        @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default App;
