import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export function AnalysisLoader({ steps, progress }: { steps: Step[]; progress: number }) {
  return (
    <div className="glass rounded-3xl p-6 space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-display font-bold text-sm">Analyse en cours…</span>
        </div>
        <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-muted-foreground font-semibold">{progress}%</p>
      </div>

      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3"
          >
            {step.status === 'done' && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
            {step.status === 'active' && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
            {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />}
            {step.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
            <span className={`text-sm font-medium ${
              step.status === 'active' ? 'text-foreground' : 
              step.status === 'done' ? 'text-muted-foreground' : 
              'text-muted-foreground/40'
            }`}>
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
