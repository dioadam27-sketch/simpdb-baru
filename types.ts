
export enum DayOfWeek {
  SENIN = 'Senin',
  SELASA = 'Selasa',
  RABU = 'Rabu',
  KAMIS = 'Kamis',
  JUMAT = 'Jumat',
  SABTU = 'Sabtu'
}

export const TIME_SLOTS = [
  '07:00 - 08:40', 
  '09:00 - 10:40', 
  '11:00 - 12:40', 
  '13:00 - 14:40', 
  '15:00 - 16:40'
];

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  coordinatorId?: string; // New field for Coordinator Flagging
}

export interface Lecturer {
  id: string;
  name: string;
  nip: string;
  position: string;
  expertise: string;
  username?: string;
  password?: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  building?: string;
  location?: string;
}

export interface ClassName {
  id: string;
  name: string;
  // Optional property just in case needed for UI, though not in DB schema explicitly
}

export interface ScheduleItem {
  id: string;
  courseId: string;
  lecturerIds: string[]; // Changed from single ID to Array for Team Teaching
  pjmkLecturerId?: string; // ID of the coordinator (PJMK)
  roomId: string;
  className: string; 
  day: DayOfWeek;
  timeSlot: string;
  
  // Deprecated but kept for temporary compatibility if needed, though logic will use lecturerIds
  lecturerId?: string; 
}

export interface TeachingLog {
  id: string;
  scheduleId: string;
  lecturerId: string;
  week: number; // 1 to 14
  timestamp?: string;
  date?: string; // YYYY-MM-DD format for attendance date
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
}

export type UserRole = 'admin' | 'lecturer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type ViewState = 'dashboard' | 'courses' | 'lecturers' | 'rooms' | 'classes' | 'schedule' | 'portal' | 'monitoring' | 'settings' | 'attendance' | 'lecturer_monitoring' | 'honor';
