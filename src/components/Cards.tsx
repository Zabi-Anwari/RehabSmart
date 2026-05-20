import React from 'react';
import { cn } from '../lib/utils';
import { ArrowRight, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function Card({ children, className, title, subtitle, icon }: CardProps) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className)}>
      {(title || icon) && (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            {title && <h3 className="font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

export function StatCard({ label, value, trend, icon: Icon, color = 'blue' }: {
  label: string;
  value: string | number;
  trend?: string;
  icon: any;
  color?: 'blue' | 'green' | 'red' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
          {trend && (
            <p className={cn(
              "text-xs font-medium mt-1",
              trend.startsWith('+') ? "text-green-600" : "text-red-600"
            )}>
              {trend} from last week
            </p>
          )}
        </div>
        <div className={cn("p-2 rounded-xl", colors[color])}>
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );
}

export const FeatureCard: React.FC<{ title: string; desc: string; icon: any }> = ({ title, desc, icon: Icon }) => {
  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all group">
      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
        <Icon size={24} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed text-sm">{desc}</p>
    </div>
  );
};

export const ExerciseListItem: React.FC<{ title: string; details: string; status?: string; duration?: string }> = ({ title, details, status, duration }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          status === 'completed' ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
        )}>
          {status === 'completed' ? <CheckCircle2 size={20} /> : <ArrowRight size={20} />}
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{title}</h4>
          <p className="text-xs text-slate-500">{details}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-slate-700">{duration || '10 min'}</p>
        <ChevronRight size={16} className="text-slate-300 ml-auto" />
      </div>
    </div>
  );
};
