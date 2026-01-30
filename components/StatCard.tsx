
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => {
  // Extract text color class (e.g. text-blue-500) to get bg class (bg-blue-50)
  const baseColor = color.replace('text-', '');
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 flex items-center justify-between hover:-translate-y-1 transition-transform duration-300">
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color.replace('text-', 'bg-')}/10`}>
        <Icon size={26} className={color} />
      </div>
    </div>
  );
};

export default StatCard;
