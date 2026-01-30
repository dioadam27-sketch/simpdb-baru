
import React, { useMemo, useState } from 'react';
import { Banknote, Search, FileSpreadsheet, Info, ArrowRight } from 'lucide-react';
import { Lecturer, ScheduleItem, TeachingLog, Course } from '../types';
import * as XLSX from 'xlsx';

interface HonorViewProps {
  lecturers: Lecturer[];
  schedule: ScheduleItem[];
  courses: Course[];
  teachingLogs: TeachingLog[];
}

const HonorView: React.FC<HonorViewProps> = ({ lecturers, schedule, courses, teachingLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // --- CALCULATION LOGIC ---
  const honorData = useMemo(() => {
    return lecturers.map(lecturer => {
      // 1. Find all classes taught by this lecturer
      const myClasses = schedule.filter(s => (s.lecturerIds || []).includes(lecturer.id));
      
      let totalPlannedSKS = 0;
      let totalRealizedSKS = 0;

      // 2. Calculate SKS per class
      myClasses.forEach(cls => {
        const course = courses.find(c => c.id === cls.courseId);
        if (course) {
           const teamSize = (cls.lecturerIds || []).length;
           
           // A. RENCANA SKS: Terdistribusi otomatis saat ambil jadwal (SKS MK / Jumlah Tim)
           // Ini hanya untuk referensi pembagian beban.
           const plannedSKS = teamSize > 0 ? (course.credits / teamSize) : 0;
           totalPlannedSKS += plannedSKS;
           
           // B. REALISASI SKS: Berdasarkan Input Presensi
           // Rumus Baru: (SKS Mata Kuliah * Jumlah Kehadiran) / 16
           const attendanceCount = teachingLogs.filter(l => 
             l.scheduleId === cls.id && 
             l.lecturerId === lecturer.id
           ).length;

           const realized = (course.credits * attendanceCount) / 16;
           totalRealizedSKS += realized;
        }
      });

      // 3. Calculate Honor based on Formula: Realized SKS * 14 * 100,000
      // Note: Angka 14 disini kemungkinan konstanta pertemuan efektif untuk pembayaran, bisa disesuaikan.
      const honorAmount = totalRealizedSKS * 14 * 100000;

      return {
        ...lecturer,
        totalPlannedSKS,
        totalRealizedSKS,
        honorAmount
      };
    })
    // Filter based on search
    .filter(l => 
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.nip.includes(searchTerm)
    )
    // Sort by Name
    .sort((a, b) => a.name.localeCompare(b.name));
  }, [lecturers, schedule, courses, teachingLogs, searchTerm]);

  // --- FORMATTER ---
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // --- EXPORT TO EXCEL ---
  const handleExportExcel = () => {
     if (honorData.length === 0) return;

     const excelData = honorData.map((item, index) => ({
        "No": index + 1,
        "NIP": item.nip,
        "Nama Dosen": item.name,
        "Jabatan": item.position,
        "Rencana SKS": Number(item.totalPlannedSKS.toFixed(3)),
        "SKS Terealisasi": Number(item.totalRealizedSKS.toFixed(3)),
        "Formula": "SKS Realisasi x 14 x 100.000",
        "Total Honor (Rp)": item.honorAmount
     }));

     const worksheet = XLSX.utils.json_to_sheet(excelData);
     const workbook = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(workbook, worksheet, "Honor Mengajar");
     XLSX.writeFile(workbook, `Rekap_Honor_Mengajar_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalHonorAll = honorData.reduce((acc, curr) => acc + curr.honorAmount, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Honor Mengajar</h2>
          <p className="text-slate-500">Perbandingan Rencana SKS vs Realisasi SKS berdasarkan kehadiran.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
           <div className="relative flex-1 md:flex-none">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Cari Dosen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              />
           </div>
           <button 
             onClick={handleExportExcel}
             disabled={honorData.length === 0}
             className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
           >
              <FileSpreadsheet size={18} /> Export Excel
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
                <strong>Rencana SKS (Target):</strong><br/>
                Total SKS yang didapat dosen saat mengambil jadwal (dibagi rata jika Team Teaching).<br/>
                <span className="text-xs opacity-75">Contoh: MK 3 SKS, Team 2 Orang = Rencana 1.5 SKS.</span>
            </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
            <Info size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800">
                <strong>Realisasi SKS (Capaian):</strong><br/>
                SKS yang diakui berdasarkan <strong>Input Presensi</strong>.<br/>
                <code>Realisasi = (SKS MK × Jumlah Hadir) / 16</code>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
               <Banknote size={20} className="text-emerald-600" /> Rekapitulasi Honor
            </h3>
            <div className="text-right">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Pengeluaran Honor</span>
               <span className="text-xl font-black text-emerald-600">{formatRupiah(totalHonorAll)}</span>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-12 text-center">No</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nama Dosen & NIP</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Rencana SKS</th>
                     <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center w-8"></th>
                     <th className="px-6 py-4 text-xs font-bold text-emerald-700 bg-emerald-50/50 uppercase tracking-widest text-right">SKS Terealisasi</th>
                     <th className="px-6 py-4 text-xs font-bold text-emerald-700 bg-emerald-50/50 uppercase tracking-widest text-right">Total Honor</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {honorData.length === 0 ? (
                     <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                           Tidak ada data dosen yang sesuai.
                        </td>
                     </tr>
                  ) : (
                     honorData.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4 text-center text-xs font-bold text-slate-400">{idx + 1}</td>
                           <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{item.name}</div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">{item.nip}</div>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className="font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{item.totalPlannedSKS.toFixed(3)}</span>
                           </td>
                           <td className="px-0 py-4 text-center text-slate-300">
                              <ArrowRight size={14} className="mx-auto" />
                           </td>
                           <td className="px-6 py-4 text-right bg-emerald-50/20">
                              <span className="font-black text-emerald-600 text-lg">{item.totalRealizedSKS.toFixed(3)}</span>
                           </td>
                           <td className="px-6 py-4 text-right bg-emerald-50/30">
                              <span className="font-bold text-slate-800">{formatRupiah(item.honorAmount)}</span>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
               <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                     <td colSpan={5} className="px-6 py-4 text-right font-bold text-slate-600 uppercase text-xs tracking-wider">Total Keseluruhan</td>
                     <td className="px-6 py-4 text-right font-black text-xl text-slate-800">{formatRupiah(totalHonorAll)}</td>
                  </tr>
               </tfoot>
            </table>
         </div>
      </div>
    </div>
  );
};

export default HonorView;
