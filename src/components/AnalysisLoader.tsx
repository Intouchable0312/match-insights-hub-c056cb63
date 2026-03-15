import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, AlertCircle, Info } from 'lucide-react';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export function AnalysisLoader({ steps, progress }: { steps: Step[]; progress: number }) {
  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-display font-semibold text-sm">Analyse en cours…</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{progress}%</p>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3"
          >
            {step.status === 'done' && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
            {step.status === 'active' && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
            {step.status === 'pending' && <div className="h-4 w-4 rounded-full border border-border shrink-0" />}
            {step.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
            <span className={`text-sm ${step.status === 'active' ? 'text-foreground font-medium' : step.status === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
