import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Edit2, Trash2, Upload, RefreshCw, X, Search, 
  FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Column<T> {
  key: keyof T | string;
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: (string | { value: string; label: string })[];
}

interface DataManagerProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  onAdd: (item: any) => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onImport?: (items: any[]) => void;
  onSync?: () => void;
  onClear?: () => void;
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
        <div className="space-y-2 group relative" ref={containerRef}>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider group-focus-within:text-primary-600 transition-colors ml-1">{label}</label>
            <div 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer flex justify-between items-center hover:border-primary-300 transition-colors"
                onClick={() => { setIsOpen(!isOpen); if(!isOpen) setSearch(''); }}
            >
                <span className={`text-sm font-medium ${value ? 'text-slate-700' : 'text-slate-400'}`}>
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
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between hover:bg-primary-50 transition-colors ${String(value) === String(opt.value) ? 'bg-primary-50 text-primary-700 font-bold' : 'text-slate-700'}`}
                                >
                                    {opt.label}
                                    {String(value) === String(opt.value) && <Check size={14} className="text-primary-600"/>}
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

const DataManager = <T extends { id: string }>({ 
  title, 
  data, 
  columns, 
  onAdd, 
  onEdit, 
  onDelete, 
  onImport, 
  onSync, 
  onClear 
}: DataManagerProps<T>) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>, item: T) => {
    e.stopPropagation(); 
    setEditingItem(item);
    setFormData(item);
    setModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingItem(null);
    setFormData({});
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      onEdit({ ...editingItem, ...formData });
    } else {
      onAdd(formData);
    }
    setModalOpen(false);
    setFormData({});
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImport) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        if (jsonData.length > 0) {
            onImport(jsonData);
        }
      } catch (error) {
        console.error("Import Error", error);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title);
    XLSX.writeFile(workbook, `${title}_Data.xlsx`);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    // 1. Filter
    let processed = data.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    // 2. Sort
    if (sortConfig) {
      processed.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
             return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        const aString = String(aValue || '').toLowerCase();
        const bString = String(bValue || '').toLowerCase();

        if (aString < bString) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aString > bString) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return processed;
  }, [data, searchTerm, sortConfig]);

  return (
    <div ref={containerRef} className="space-y-6 animate-fade-in relative pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Manajemen {title}</h2>
           <p className="text-slate-500 text-sm">Kelola data {title.toLowerCase()} dalam sistem.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
            {onSync && (
                <button onClick={onSync} className="flex items-center gap-2 bg-white text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm font-bold text-sm transition-all active:scale-95">
                    <RefreshCw size={18} /> Sync
                </button>
            )}
            {onImport && (
                <>
                    <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".xlsx, .xls" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2.5 rounded-xl border border-indigo-200 shadow-sm font-bold text-sm transition-all active:scale-95">
                        <Upload size={18} /> Import
                    </button>
                </>
            )}
            <button onClick={exportExcel} disabled={data.length === 0} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2.5 rounded-xl border border-emerald-200 shadow-sm font-bold text-sm transition-all active:scale-95 disabled:opacity-50">
                <FileSpreadsheet size={18} /> Export
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50">
             <div className="relative w-full md:w-auto">
                 <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                   type="text" 
                   placeholder={`Cari ${title}...`} 
                   className="w-full md:w-80 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
             </div>
             <div className="flex gap-2 w-full md:w-auto">
                {onClear && (
                    <button onClick={onClear} className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 text-sm font-bold transition-all">
                        <Trash2 size={16} /> Reset
                    </button>
                )}
                <button onClick={handleAddClick} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl shadow-lg shadow-blue-100 font-bold text-sm transition-all active:scale-95 flex-1 md:flex-none justify-center">
                    <Plus size={18} /> Tambah {title}
                </button>
             </div>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-16 text-center">No</th>
                        {columns.map(col => (
                            <th 
                                key={String(col.key)} 
                                onClick={() => handleSort(String(col.key))}
                                className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                            >
                                <div className="flex items-center gap-2">
                                    {col.label}
                                    <span className="text-slate-300 group-hover:text-blue-500 transition-colors">
                                        {sortConfig?.key === col.key ? (
                                            sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
                                        ) : (
                                            <ArrowUpDown size={14} />
                                        )}
                                    </span>
                                </div>
                            </th>
                        ))}
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedData.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length + 2} className="p-12 text-center text-slate-400">
                                Data tidak ditemukan.
                            </td>
                        </tr>
                    ) : (
                        filteredAndSortedData.map((item, index) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-center text-xs font-bold text-slate-400">{index + 1}</td>
                                {columns.map(col => {
                                    const val = item[col.key as keyof T];
                                    let displayVal: React.ReactNode = String(val);
                                    if(col.type === 'select' && col.options) {
                                       const opt = col.options.find(o => (typeof o === 'string' ? o : o.value) === String(val));
                                       displayVal = typeof opt === 'object' ? opt?.label : opt;
                                    }
                                    return <td key={String(col.key)} className="p-4 text-sm font-medium text-slate-700">{displayVal}</td>
                                })}
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={(e) => handleEditClick(e, item)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"><Edit2 size={18}/></button>
                                        <button onClick={() => onDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {/* MODAL SYSTEM - MOVED TO PORTAL */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-transparent flex items-center justify-center p-4 animate-fade-in" onClick={() => setModalOpen(false)}>
           <div 
             className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden animate-slide-down border border-white/50 ring-4 ring-slate-50 transition-all duration-300"
             onClick={e => e.stopPropagation()} 
           >
             <ModalContent 
                title={title} 
                editingItem={editingItem} 
                setModalOpen={setModalOpen} 
                handleSubmit={handleSubmit} 
                columns={columns} 
                formData={formData} 
                handleInputChange={handleInputChange} 
             />
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const ModalContent = ({ title, editingItem, setModalOpen, handleSubmit, columns, formData, handleInputChange }: any) => (
    <>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-md">
            <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                {editingItem ? <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600"><Edit2 size={18} /></div> : <div className="bg-primary-100 p-1.5 rounded-lg text-primary-600"><Plus size={18} /></div>}
                {editingItem ? `Edit ${title}` : `Tambah ${title}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 ml-1">Lengkapi data di bawah ini</p>
            </div>
            <button type="button" onClick={() => setModalOpen(false)} className="bg-white p-1.5 rounded-full shadow-sm text-slate-400 hover:text-slate-600 transition-colors border border-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-2 gap-5">
            {columns.map((col: any) => (
                <div key={String(col.key)}>
                    {col.type === 'select' && col.options ? (
                        <SearchableSelect 
                            label={col.label}
                            options={col.options}
                            value={formData[col.key] || ''}
                            onChange={(val: string) => handleInputChange(col.key, val)}
                            placeholder={`-- Pilih ${col.label} --`}
                        />
                    ) : (
                        <div className="space-y-2 group">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider group-focus-within:text-primary-600 transition-colors ml-1">{col.label}</label>
                            <input
                                type={col.type === 'number' || (!col.type && (col.key === 'credits' || col.key === 'capacity')) ? 'number' : 'text'}
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                value={formData[col.key as string] || ''}
                                onChange={e => handleInputChange(col.key as string, e.target.value)}
                                placeholder={`Masukkan ${col.label}...`}
                            />
                        </div>
                    )}
                </div>
            ))}
            </div>
            <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Batal</button>
                <button type="submit" className={`flex-[2] px-4 py-3 text-white rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 ${editingItem ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-200'}`}>
                    {editingItem ? 'Simpan Perubahan' : 'Simpan Data Baru'}
                </button>
            </div>
        </form>
    </>
);

export default DataManager;