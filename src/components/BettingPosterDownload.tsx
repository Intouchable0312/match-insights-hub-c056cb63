import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BetItem {
  selection: string;
  bet_type: string;
  probability: number;
  confidence: string;
  reasoning: string;
}

interface BettingPosterProps {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  leagueName: string;
  leagueLogo?: string | null;
  kickoff: string;
  suggestedBets: BetItem[];
  predictedScoreHome?: number;
  predictedScoreAway?: number;
  homeWinProb?: number;
  drawProb?: number;
  awayWinProb?: number;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function getThemeColors() {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    return {
      isDark: true,
      bg: '#0d0f14',
      bgGradTop: '#101320',
      bgGradBottom: '#080a10',
      cardBg: '#14171f',
      cardBgAlt: '#181c26',
      text: '#ebedf4',
      textSec: '#a3a8b8',
      textMuted: '#5e6378',
      primary: '#5b8aff',
      primaryGlow: 'rgba(91,138,255,0.18)',
      primarySoft: 'rgba(91,138,255,0.08)',
      success: '#3dd89c',
      successGlow: 'rgba(61,216,156,0.18)',
      successSoft: 'rgba(61,216,156,0.06)',
      warning: '#ffb347',
      warningGlow: 'rgba(255,179,71,0.18)',
      border: '#1e2232',
      borderLight: '#252a3a',
      surface: '#191d28',
      glow: 'rgba(91,138,255,0.06)',
    };
  }
  return {
    isDark: false,
    bg: '#f0f2f8',
    bgGradTop: '#f5f7fc',
    bgGradBottom: '#e8eaf2',
    cardBg: '#ffffff',
    cardBgAlt: '#f8f9fc',
    text: '#141828',
    textSec: '#4a5068',
    textMuted: '#7e8498',
    primary: '#3b6ef5',
    primaryGlow: 'rgba(59,110,245,0.14)',
    primarySoft: 'rgba(59,110,245,0.06)',
    success: '#22a86e',
    successGlow: 'rgba(34,168,110,0.14)',
    successSoft: 'rgba(34,168,110,0.06)',
    warning: '#d99418',
    warningGlow: 'rgba(217,148,24,0.14)',
    border: '#dde0ea',
    borderLight: '#e8ebf2',
    surface: '#eaecf4',
    glow: 'rgba(59,110,245,0.04)',
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, lw = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function confInfo(confidence: string, c: ReturnType<typeof getThemeColors>) {
  switch (confidence) {
    case 'very_high': return { label: '★★★ Très sûr', color: c.success, glow: c.successGlow, soft: c.successSoft };
    case 'high': return { label: '★★ Sûr', color: c.primary, glow: c.primaryGlow, soft: c.primarySoft };
    default: return { label: '★ Modéré', color: c.warning, glow: c.warningGlow, soft: c.primarySoft };
  }
}

export function BettingPosterDownload(props: BettingPosterProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generatePoster = async () => {
    setLoading(true);
    try {
      const c = getThemeColors();
      // 9:16 format
      const W = 1080;
      const H = 1920;
      const PAD = 56;
      const CW = W - PAD * 2;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // ─── Background gradient ───
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, c.bgGradTop);
      bgGrad.addColorStop(0.5, c.bg);
      bgGrad.addColorStop(1, c.bgGradBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle radial glow behind teams
      const radGrad = ctx.createRadialGradient(W / 2, 420, 50, W / 2, 420, 500);
      radGrad.addColorStop(0, c.primaryGlow);
      radGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, W, H);

      // ─── Top bar ───
      let y = 56;
      // "By ANAP"
      ctx.font = '600 20px "DM Sans", sans-serif';
      ctx.fillStyle = c.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('By', W / 2 - 40, y + 18);
      ctx.font = '900 26px "Nunito", sans-serif';
      ctx.fillStyle = c.primary;
      ctx.fillText('ANAP', W / 2 + 8, y + 18);

      y += 50;

      // League pill
      const leagueText = props.leagueName.toUpperCase();
      ctx.font = '700 16px "DM Sans", sans-serif';
      const leagueW = ctx.measureText(leagueText).width + 40;
      fillRR(ctx, (W - leagueW) / 2, y, leagueW, 34, 17, c.primarySoft);
      strokeRR(ctx, (W - leagueW) / 2, y, leagueW, 34, 17, c.primary + '30');
      ctx.fillStyle = c.primary;
      ctx.textAlign = 'center';
      ctx.fillText(leagueText, W / 2, y + 23);
      y += 56;

      // Date
      const date = new Date(props.kickoff);
      const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      ctx.font = '500 22px "DM Sans", sans-serif';
      ctx.fillStyle = c.textMuted;
      ctx.fillText(`${dateStr}  ·  ${timeStr}`, W / 2, y + 18);
      y += 54;

      // ─── Teams hero section ───
      const heroY = y;
      const heroH = 260;
      fillRR(ctx, PAD, heroY, CW, heroH, 32, c.cardBg);
      strokeRR(ctx, PAD, heroY, CW, heroH, 32, c.border);

      // Subtle inner gradient
      const innerGrad = ctx.createLinearGradient(PAD, heroY, PAD + CW, heroY + heroH);
      innerGrad.addColorStop(0, c.glow);
      innerGrad.addColorStop(0.5, 'transparent');
      innerGrad.addColorStop(1, c.glow);
      ctx.save();
      roundRect(ctx, PAD, heroY, CW, heroH, 32);
      ctx.clip();
      ctx.fillStyle = innerGrad;
      ctx.fillRect(PAD, heroY, CW, heroH);
      ctx.restore();

      const teamCY = heroY + heroH / 2;
      const logoSize = 88;
      const logoPad = 12;

      // Load logos
      let homeLogo: HTMLImageElement | null = null;
      let awayLogo: HTMLImageElement | null = null;
      try { if (props.homeTeamLogo) homeLogo = await loadImage(props.homeTeamLogo); } catch { }
      try { if (props.awayTeamLogo) awayLogo = await loadImage(props.awayTeamLogo); } catch { }

      // Home team
      const homeX = W / 2 - 190;
      if (homeLogo) {
        const lx = homeX - logoSize / 2;
        const ly = teamCY - logoSize / 2 - 16;
        fillRR(ctx, lx - logoPad, ly - logoPad, logoSize + logoPad * 2, logoSize + logoPad * 2, 24, c.surface);
        ctx.drawImage(homeLogo, lx, ly, logoSize, logoSize);
      } else {
        fillRR(ctx, homeX - 48, teamCY - 48 - 16, 96, 96, 24, c.surface);
        ctx.font = '900 38px "Nunito", sans-serif';
        ctx.fillStyle = c.text;
        ctx.textAlign = 'center';
        ctx.fillText(props.homeTeamName.slice(0, 3).toUpperCase(), homeX, teamCY - 4);
      }
      ctx.font = '700 22px "Nunito", sans-serif';
      ctx.fillStyle = c.text;
      ctx.textAlign = 'center';
      const homeName = props.homeTeamName.length > 14 ? props.homeTeamName.slice(0, 13) + '…' : props.homeTeamName;
      ctx.fillText(homeName, homeX, teamCY + logoSize / 2 + 20);

      // Score prédit au centre
      if (props.predictedScoreHome != null && props.predictedScoreAway != null) {
        // Score glow
        const scoreGrad = ctx.createRadialGradient(W / 2, teamCY - 4, 10, W / 2, teamCY - 4, 80);
        scoreGrad.addColorStop(0, c.primaryGlow);
        scoreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = scoreGrad;
        ctx.fillRect(W / 2 - 80, teamCY - 50, 160, 80);

        ctx.font = '900 52px "Nunito", sans-serif';
        ctx.fillStyle = c.primary;
        ctx.textAlign = 'center';
        ctx.fillText(`${props.predictedScoreHome} - ${props.predictedScoreAway}`, W / 2, teamCY + 8);
        ctx.font = '600 15px "DM Sans", sans-serif';
        ctx.fillStyle = c.textMuted;
        ctx.fillText('SCORE PRÉDIT', W / 2, teamCY + 32);
      } else {
        ctx.font = '900 44px "Nunito", sans-serif';
        ctx.fillStyle = c.primary;
        ctx.textAlign = 'center';
        ctx.fillText('VS', W / 2, teamCY + 12);
      }

      // Away team
      const awayX = W / 2 + 190;
      if (awayLogo) {
        const lx = awayX - logoSize / 2;
        const ly = teamCY - logoSize / 2 - 16;
        fillRR(ctx, lx - logoPad, ly - logoPad, logoSize + logoPad * 2, logoSize + logoPad * 2, 24, c.surface);
        ctx.drawImage(awayLogo, lx, ly, logoSize, logoSize);
      } else {
        fillRR(ctx, awayX - 48, teamCY - 48 - 16, 96, 96, 24, c.surface);
        ctx.font = '900 38px "Nunito", sans-serif';
        ctx.fillStyle = c.text;
        ctx.textAlign = 'center';
        ctx.fillText(props.awayTeamName.slice(0, 3).toUpperCase(), awayX, teamCY - 4);
      }
      ctx.font = '700 22px "Nunito", sans-serif';
      ctx.fillStyle = c.text;
      ctx.textAlign = 'center';
      const awayName = props.awayTeamName.length > 14 ? props.awayTeamName.slice(0, 13) + '…' : props.awayTeamName;
      ctx.fillText(awayName, awayX, teamCY + logoSize / 2 + 20);

      y = heroY + heroH + 28;

      // ─── Probabilities ───
      if (props.homeWinProb != null) {
        const probGap = 14;
        const probW = (CW - probGap * 2) / 3;
        const probH = 90;
        const probs = [
          { label: props.homeTeamName, value: props.homeWinProb },
          { label: 'Nul', value: props.drawProb || 0 },
          { label: props.awayTeamName, value: props.awayWinProb || 0 },
        ];
        const maxProb = Math.max(...probs.map(p => p.value));

        probs.forEach((p, i) => {
          const px = PAD + i * (probW + probGap);
          const isMax = p.value === maxProb;

          fillRR(ctx, px, y, probW, probH, 20, isMax ? c.primaryGlow : c.cardBg);
          strokeRR(ctx, px, y, probW, probH, 20, isMax ? c.primary + '50' : c.border);

          if (isMax) {
            // Glow effect
            const gGrad = ctx.createRadialGradient(px + probW / 2, y + probH / 2, 10, px + probW / 2, y + probH / 2, probW / 2);
            gGrad.addColorStop(0, c.primaryGlow);
            gGrad.addColorStop(1, 'transparent');
            ctx.save();
            roundRect(ctx, px, y, probW, probH, 20);
            ctx.clip();
            ctx.fillStyle = gGrad;
            ctx.fillRect(px, y, probW, probH);
            ctx.restore();
          }

          ctx.font = '500 15px "DM Sans", sans-serif';
          ctx.fillStyle = c.textMuted;
          ctx.textAlign = 'center';
          const lbl = p.label.length > 12 ? p.label.slice(0, 11) + '…' : p.label;
          ctx.fillText(lbl, px + probW / 2, y + 30);

          ctx.font = '900 32px "Nunito", sans-serif';
          ctx.fillStyle = isMax ? c.primary : c.text;
          ctx.fillText(`${Math.round(p.value)}%`, px + probW / 2, y + 68);
        });
        y += probH + 28;
      }

      // ─── Separator line ───
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD + 40, y);
      ctx.lineTo(W - PAD - 40, y);
      ctx.stroke();
      y += 28;

      // ─── Bets header ───
      ctx.font = '900 30px "Nunito", sans-serif';
      ctx.fillStyle = c.success;
      ctx.textAlign = 'left';
      ctx.fillText('🎯  PARIS SUGGÉRÉS', PAD + 12, y + 28);
      y += 56;

      // ─── Bet cards ───
      ctx.font = '500 20px "DM Sans", sans-serif';
      for (const bet of props.suggestedBets) {
        const conf = confInfo(bet.confidence, c);
        ctx.font = '500 20px "DM Sans", sans-serif';
        const reasonLines = wrapText(ctx, bet.reasoning, CW - 72);
        const hasReasoning = reasonLines.length > 0 && reasonLines[0].length > 0;
        const cardH = hasReasoning ? 100 + reasonLines.length * 26 : 92;

        // Card bg with subtle gradient
        fillRR(ctx, PAD, y, CW, cardH, 24, c.cardBg);

        // Left accent bar (clipped)
        ctx.save();
        roundRect(ctx, PAD, y, 7, cardH, 24);
        ctx.clip();
        ctx.fillStyle = conf.color;
        ctx.fillRect(PAD, y, 7, cardH);
        ctx.restore();
        // Also fill the non-rounded part
        ctx.fillStyle = conf.color;
        ctx.fillRect(PAD, y + 12, 7, cardH - 24);

        // Outer glow border
        strokeRR(ctx, PAD, y, CW, cardH, 24, conf.color + '25', 1.5);

        // Top row: selection + probability pill
        const innerLeft = PAD + 28;
        ctx.font = '800 22px "Nunito", sans-serif';
        ctx.fillStyle = c.text;
        ctx.textAlign = 'left';
        ctx.fillText(bet.selection, innerLeft, y + 34);

        // Probability pill (right side)
        const probText = `${Math.round(bet.probability)}%`;
        ctx.font = '800 18px "Nunito", sans-serif';
        const pillTextW = ctx.measureText(probText).width;
        const pillW = pillTextW + 28;
        const pillH = 32;
        const pillX = W - PAD - pillW - 18;
        const pillY = y + 14;
        fillRR(ctx, pillX, pillY, pillW, pillH, pillH / 2, conf.glow);
        strokeRR(ctx, pillX, pillY, pillW, pillH, pillH / 2, conf.color + '40');
        ctx.fillStyle = conf.color;
        ctx.textAlign = 'center';
        ctx.fillText(probText, pillX + pillW / 2, pillY + 22);

        // Second row: bet type + confidence badge
        ctx.font = '600 16px "DM Sans", sans-serif';
        ctx.textAlign = 'left';

        // Bet type chip
        const btText = bet.bet_type;
        ctx.font = '600 15px "DM Sans", sans-serif';
        const btW = ctx.measureText(btText).width + 20;
        fillRR(ctx, innerLeft, y + 48, btW, 26, 13, c.surface);
        ctx.fillStyle = c.textSec;
        ctx.fillText(btText, innerLeft + 10, y + 66);

        // Confidence chip
        const confText = conf.label;
        ctx.font = '700 14px "DM Sans", sans-serif';
        const confW = ctx.measureText(confText).width + 20;
        fillRR(ctx, innerLeft + btW + 8, y + 48, confW, 26, 13, conf.glow);
        ctx.fillStyle = conf.color;
        ctx.fillText(confText, innerLeft + btW + 18, y + 66);

        // Reasoning text
        if (hasReasoning) {
          ctx.font = '500 18px "DM Sans", sans-serif';
          ctx.fillStyle = c.textSec;
          let rY = y + 92;
          for (const line of reasonLines) {
            ctx.fillText(line, innerLeft, rY);
            rY += 26;
          }
        }

        y += cardH + 16;
      }

      // ─── Footer ───
      y = Math.max(y + 20, H - 90);

      // Disclaimer
      ctx.font = '500 17px "DM Sans", sans-serif';
      ctx.fillStyle = c.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('⚠️  Analyse statistique · Pariez de manière responsable', W / 2, y + 20);

      // ─── Download ───
      const link = document.createElement('a');
      link.download = `ANAP_${props.homeTeamName}_vs_${props.awayTeamName}.png`.replace(/\s+/g, '_');
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({ title: 'Affiche téléchargée', description: 'L\'image a été enregistrée.' });
    } catch (err) {
      console.error('Poster generation error:', err);
      toast({ title: 'Erreur', description: 'Impossible de générer l\'affiche.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={generatePoster}
      disabled={loading}
      className="w-full h-12 rounded-2xl gap-2 font-display font-bold text-base bg-success/15 text-success hover:bg-success/25 border border-success/30"
      variant="ghost"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
      {loading ? 'Génération...' : 'Télécharger l\'affiche des paris'}
    </Button>
  );
}
