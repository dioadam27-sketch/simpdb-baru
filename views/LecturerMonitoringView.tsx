
import React, { useMemo } from 'react';
import { BarChart3, Clock, CheckCircle, Calendar, Layers, BookOpen, AlertCircle, Info } from 'lucide-react';
import { ScheduleItem, Course, Lecturer, TeachingLog } from '../types';
import StatCard from '../components/StatCard';

interface LecturerMonitoringViewProps {
  currentLecturerId: string;
  schedule: ScheduleItem[];
  courses: Course[];
  teachingLogs: TeachingLog[];
}

const LecturerMonitoringView: React.FC<LecturerMonitoringViewProps> = ({
  currentLecturerId,
  schedule,
  courses,
  teachingLogs
}) => {
  const getCourse = (id: string) => courses.find(c => String(c.id) === String(id));

  // --- CALCULATION LOGIC ---
  const monitoringData = useMemo(() => {
    // 1. Filter schedule where I am a lecturer
    const myClasses = schedule.filter(s => (s.lecturerIds || []).includes(currentLecturerId));

    // 2. Map data per class
    const classDetails = myClasses.map(item => {
      const course = getCourse(item.courseId);
      const teamSize = (item.lecturerIds || []).length;
      
      // Potential SKS (Total SKS / Team Size)
      const plannedSKS = course && teamSize > 0 ? (course.credits / teamSize) : 0;
      
      // Actual Logs (Attendance count for this specific schedule & lecturer)
      const logs = teachingLogs.filter(l => 
        l.scheduleId === item.id && 
        l.lecturerId === currentLecturerId
      );
      
      const attendanceCount = logs.length;
      
      // Realized SKS (Rumus Baru: SKS MK * (Attendance / 16))
      // Menggunakan SKS MK asli, bukan Planned SKS.
      const realizedSKS = course ? (course.credits * attendanceCount) / 16 : 0;

      return {
        scheduleItem: item,
        course,
        teamSize,
        plannedSKS,
        attendanceCount,
        realizedSKS,
        logs
      };
    });

    // 3. Summaries
    const totalClasses = classDetails.length;
    const totalPlannedSKS = classDetails.reduce((acc, curr) => acc + curr.plannedSKS, 0);
    const totalRealizedSKS = classDetails.reduce((acc, curr) => acc + curr.realizedSKS, 0);
    const totalAttendance = classDetails.reduce((acc, curr) => acc + curr.attendanceCount, 0);
    const maxAttendance = totalClasses * 16;
    const overallPercentage = maxAttendance > 0 ? (totalAttendance / maxAttendance) * 100 : 0;

    return {
      classDetails,
      summary: {
        totalClasses,
        totalPlannedSKS,
        totalRealizedSKS,
        overallPercentage
      }
    };
  }, [schedule, courses, teachingLogs, currentLecturerId]);

  if (!currentLecturerId) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
            <AlertCircle size={48} className="mb-4 opacity-20" />
            <p>Identitas dosen tidak ditemukan.</p>
        </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Monitoring Kehadiran & SKS</h2>
        <p className="text-slate-500">Laporan realisasi SKS berdasarkan kehadiran mengajar Anda.</p>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Kelas Diampu" 
            value={monitoringData.summary.totalClasses} 
            icon={Layers} 
            color="text-blue-500" 
          />
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Rencana SKS (Target)</p>
                <h3 className="text-2xl font-bold text-slate-800">{monitoringData.summary.totalPlannedSKS.toFixed(2)}</h3>
            </div>
            <div className="p-4 rounded-full bg-orange-100 text-orange-500">
                <BookOpen size={24} />
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl shadow-lg shadow-emerald-100 flex items-center justify-between text-white">
            <div>
                <p className="text-emerald-100 text-sm font-medium mb-1">SKS Terealisasi</p>
                <h3 className="text-3xl font-bold">{monitoringData.summary.totalRealizedSKS.toFixed(2)}</h3>
            </div>
            <div className="p-4 rounded-full bg-white/20">
                <CheckCircle size={24} />
            </div>
          </div>
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Persentase Kehadiran</p>
                <h3 className="text-2xl font-bold text-slate-800">{monitoringData.summary.overallPercentage.toFixed(1)}%</h3>
            </div>
            <div className="p-4 rounded-full bg-indigo-100 text-indigo-500">
                <BarChart3 size={24} />
            </div>
          </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
         <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
         <div className="text-sm text-blue-800">
            <strong>Cara Perhitungan Realisasi SKS:</strong><br/>
            <code>Realisasi = (SKS MK × Jumlah Kehadiran) / 16</code>
            <br/>
            <span className="text-xs text-blue-600 mt-1 block">Rencana SKS didapat dari beban SKS mata kuliah dibagi jumlah tim pengajar.</span>
         </div>
      </div>

      {/* DETAILED TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-lg">Rincian Per Kelas</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Mata Kuliah</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-24 text-center">Kelas</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Rencana SKS</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-48">Progress Kehadiran</th>
                     <th className="px-6 py-4 text-xs font-bold text-emerald-700 bg-emerald-50/50 uppercase tracking-widest text-right">SKS Terealisasi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {monitoringData.classDetails.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                           Anda belum memiliki jadwal kelas.
                        </td>
                     </tr>
                  ) : (
                     monitoringData.classDetails.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{item.course?.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                 <span className="font-mono">{item.course?.code}</span>
                                 <span>•</span>
                                 <span>{item.course?.credits} SKS (Asli)</span>
                                 {item.teamSize > 1 && <span className="text-amber-600 font-bold bg-amber-50 px-1.5 rounded text-[10px]">Team Teaching ({item.teamSize})</span>}
                              </div>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-black text-xs uppercase">{item.scheduleItem.className}</span>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className="font-bold text-slate-600">{item.plannedSKS.toFixed(2)}</span>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                 <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className={item.attendanceCount >= 16 ? "text-emerald-600" : "text-slate-600"}>{item.attendanceCount} Hadir</span>
                                    <span className="text-slate-400">dari 16</span>
                                 </div>
                                 <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                       className={`h-full rounded-full transition-all duration-500 ${item.attendanceCount >= 16 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                       style={{ width: `${Math.min((item.attendanceCount / 16) * 100, 100)}%` }}
                                    ></div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right bg-emerald-50/30">
                              <span className="text-xl font-black text-emerald-600">{item.realizedSKS.toFixed(2)}</span>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default LecturerMonitoringView;
