import React from 'react';
import { Card } from '../components/Cards';
import { 
  Cpu, 
  Camera, 
  Activity, 
  Layers, 
  Zap, 
  Lock,
  ArrowRight,
  Database,
  CloudLightning
} from 'lucide-react';
import { motion } from 'motion/react';

const integrations = [
  {
    title: "IMU Sensor Hub",
    type: "Wearable Hardware",
    status: "Upcoming",
    desc: "Connection for high-fidelity IMU sensors for precise joint angle measurements (beyond camera visibility).",
    icon: Database
  },
  {
    title: "MediaPipe Pose Engine",
    type: "WebML Framework",
    status: "In Development",
    desc: "Browser-based movement analysis to track 33 body landmarks in real-time without specialized hardware.",
    icon: Camera
  },
  {
    title: "GaitML v2.0",
    type: "ML Model",
    status: "Testing",
    desc: "Specialized model for walking/gait analysis to identify asymmetries and pressure distributions.",
    icon: CloudLightning
  },
  {
    title: "Exercise Recognition",
    type: "Smart Logic",
    status: "Next Wave",
    desc: "Autonomous exercise detection and set-counting using temporal neural networks.",
    icon: Zap
  }
];

export function IntegrationPage() {
  return (
    <div className="space-y-12 pb-24">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
           <Cpu size={12} className="text-blue-400" /> Future Roadmap
        </div>
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight leading-none mb-6">Cutting-Edge <span className="text-blue-600">Integrations</span>.</h1>
        <p className="text-xl text-slate-500 font-medium leading-relaxed">
          The RehabSmart platform is architected to scale. Soon, these modules will connect directly to the patient experience to provide clinical-grade data.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {integrations.map((item, idx) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="h-full relative overflow-hidden group">
               <div className="absolute -top-12 -right-12 w-32 h-32 bg-slate-50 rounded-full group-hover:scale-150 transition-transform -z-0" />
               <div className="relative z-10">
                 <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                       <item.icon size={28} />
                    </div>
                    <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-100">
                       {item.status}
                    </span>
                 </div>
                 <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">{item.type}</p>
                 <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.title}</h3>
                 <p className="text-slate-600 leading-relaxed mb-8">{item.desc}</p>
                 
                 <div className="flex items-center gap-2 text-sm font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                    Preview Technical Docs <ArrowRight size={16} />
                 </div>
               </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-slate-900 border-none relative overflow-hidden p-12 text-center text-white">
          <div className="max-w-2xl mx-auto space-y-6">
             <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-500/20">
                <Lock size={24} />
             </div>
             <h2 className="text-3xl font-bold">Secure Data Backbone</h2>
             <p className="text-slate-400 font-medium leading-relaxed">
                All future integrations undergo rigorous HIPAA and GDPR compliance testing. Sensor data is end-to-end encrypted before being processed by our clinical ML models.
             </p>
             <div className="flex justify-center gap-6 pt-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-2 w-12 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full w-1/3 bg-blue-500 rounded-full" />
                  </div>
                ))}
             </div>
          </div>
      </Card>
    </div>
  );
}
