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

function getThemeColors(): { isDark: boolean; bg: string; cardBg: string; text: string; textSec: string; textMuted: string; primary: string; primaryLight: string; success: string; successLight: string; warning: string; warningLight: string; border: string; surface: string; accent: string } {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    return {
      isDark: true,
      bg: '#0e1017',
      cardBg: '#151821',
      text: '#ebedf2',
      textSec: '#a0a4b0',
      textMuted: '#6b6f7e',
      primary: '#4d7cfa',
      primaryLight: 'rgba(77,124,250,0.12)',
      success: '#34c88a',
      successLight: 'rgba(52,200,138,0.12)',
      warning: '#f5a623',
      warningLight: 'rgba(245,166,35,0.12)',
      border: '#1f2230',
      surface: '#1a1d28',
      accent: '#4d7cfa',
    };
  }
  return {
    isDark: false,
    bg: '#f5f6fa',
    cardBg: '#ffffff',
    text: '#1a1e2e',
    textSec: '#5a5f72',
    textMuted: '#8a8e9e',
    primary: '#3b6ef5',
    primaryLight: 'rgba(59,110,245,0.1)',
    success: '#2aaa72',
    successLight: 'rgba(42,170,114,0.1)',
    warning: '#d4901a',
    warningLight: 'rgba(212,144,26,0.1)',
    border: '#e2e5ee',
    surface: '#eef0f5',
    accent: '#3b6ef5',
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fillColor: string) {
  ctx.fillStyle = fillColor;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function drawRoundedRectStroke(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, strokeColor: string, lineWidth: number = 1) {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function getConfidenceInfo(confidence: string, c: ReturnType<typeof getThemeColors>): { label: string; color: string; bgColor: string } {
  switch (confidence) {
    case 'very_high': return { label: 'Très sûr', color: c.success, bgColor: c.successLight };
    case 'high': return { label: 'Sûr', color: c.primary, bgColor: c.primaryLight };
    default: return { label: 'Modéré', color: c.warning, bgColor: c.warningLight };
  }
}

export function BettingPosterDownload(props: BettingPosterProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generatePoster = async () => {
    setLoading(true);
    try {
      const c = getThemeColors();
      const W = 1080;
      const PAD = 60;
      const CONTENT_W = W - PAD * 2;

      // Pre-calculate height
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      ctx.font = '500 24px "DM Sans", sans-serif';

      // Calculate bet cards total height
      let betsHeight = 0;
      for (const bet of props.suggestedBets) {
        const reasonLines = wrapText(ctx, bet.reasoning, CONTENT_W - 80);
        betsHeight += 80 + reasonLines.length * 30 + 20;
      }

      const headerHeight = 340;
      const probsHeight = 130;
      const betsHeaderHeight = 70;
      const footerHeight = 80;
      const H = headerHeight + probsHeight + betsHeaderHeight + betsHeight + footerHeight + 40;

      canvas.width = W;
      canvas.height = H;

      // Background
      drawRoundedRect(ctx, 0, 0, W, H, 0, c.bg);

      // Subtle gradient overlay
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, c.isDark ? 'rgba(77,124,250,0.04)' : 'rgba(59,110,245,0.03)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      let y = PAD;

      // ANAP branding
      ctx.font = '900 28px "Nunito", sans-serif';
      ctx.fillStyle = c.primary;
      ctx.textAlign = 'center';
      ctx.fillText('ANAP', W / 2, y + 22);
      y += 16;

      // League info
      ctx.font = '600 22px "DM Sans", sans-serif';
      ctx.fillStyle = c.textMuted;
      ctx.fillText(props.leagueName, W / 2, y + 40);
      y += 50;

      // Date
      const date = new Date(props.kickoff);
      const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      ctx.font = '500 20px "DM Sans", sans-serif';
      ctx.fillStyle = c.textMuted;
      ctx.fillText(`${dateStr} · ${timeStr}`, W / 2, y + 24);
      y += 50;

      // Teams section with card background
      const teamsCardY = y;
      const teamsCardH = 170;
      drawRoundedRect(ctx, PAD, teamsCardY, CONTENT_W, teamsCardH, 24, c.cardBg);
      drawRoundedRectStroke(ctx, PAD, teamsCardY, CONTENT_W, teamsCardH, 24, c.border);

      const teamCenterY = teamsCardY + teamsCardH / 2;
      const logoSize = 72;

      // Load logos
      let homeLogo: HTMLImageElement | null = null;
      let awayLogo: HTMLImageElement | null = null;
      try { if (props.homeTeamLogo) homeLogo = await loadImage(props.homeTeamLogo); } catch { }
      try { if (props.awayTeamLogo) awayLogo = await loadImage(props.awayTeamLogo); } catch { }

      // Home team logo + name
      const homeX = W / 2 - 180;
      if (homeLogo) {
        const logoX = homeX - logoSize / 2;
        const logoY = teamCenterY - logoSize / 2 - 10;
        drawRoundedRect(ctx, logoX - 8, logoY - 8, logoSize + 16, logoSize + 16, 16, c.surface);
        ctx.drawImage(homeLogo, logoX, logoY, logoSize, logoSize);
      } else {
        ctx.font = '900 32px "Nunito", sans-serif';
        ctx.fillStyle = c.text;
        ctx.textAlign = 'center';
        ctx.fillText(props.homeTeamName.slice(0, 3).toUpperCase(), homeX, teamCenterY - 8);
      }
      ctx.font = '700 20px "Nunito", sans-serif';
      ctx.fillStyle = c.text;
      ctx.textAlign = 'center';
      ctx.fillText(props.homeTeamName, homeX, teamCenterY + logoSize / 2 + 14);

      // VS / Score
      ctx.font = '900 36px "Nunito", sans-serif';
      ctx.fillStyle = c.primary;
      ctx.textAlign = 'center';
      if (props.predictedScoreHome != null && props.predictedScoreAway != null) {
        ctx.fillText(`${props.predictedScoreHome} - ${props.predictedScoreAway}`, W / 2, teamCenterY + 4);
        ctx.font = '500 14px "DM Sans", sans-serif';
        ctx.fillStyle = c.textMuted;
        ctx.fillText('Score prédit', W / 2, teamCenterY + 24);
      } else {
        ctx.fillText('VS', W / 2, teamCenterY + 8);
      }

      // Away team logo + name
      const awayX = W / 2 + 180;
      if (awayLogo) {
        const logoX = awayX - logoSize / 2;
        const logoY = teamCenterY - logoSize / 2 - 10;
        drawRoundedRect(ctx, logoX - 8, logoY - 8, logoSize + 16, logoSize + 16, 16, c.surface);
        ctx.drawImage(awayLogo, logoX, logoY, logoSize, logoSize);
      } else {
        ctx.font = '900 32px "Nunito", sans-serif';
        ctx.fillStyle = c.text;
        ctx.textAlign = 'center';
        ctx.fillText(props.awayTeamName.slice(0, 3).toUpperCase(), awayX, teamCenterY - 8);
      }
      ctx.font = '700 20px "Nunito", sans-serif';
      ctx.fillStyle = c.text;
      ctx.textAlign = 'center';
      ctx.fillText(props.awayTeamName, awayX, teamCenterY + logoSize / 2 + 14);

      y = teamsCardY + teamsCardH + 24;

      // Probabilities row
      if (props.homeWinProb != null) {
        const probW = (CONTENT_W - 24) / 3;
        const probH = 80;
        const probs = [
          { label: props.homeTeamName, value: `${Math.round(props.homeWinProb)}%` },
          { label: 'Nul', value: `${Math.round(props.drawProb || 0)}%` },
          { label: props.awayTeamName, value: `${Math.round(props.awayWinProb || 0)}%` },
        ];
        const maxProb = Math.max(props.homeWinProb, props.drawProb || 0, props.awayWinProb || 0);

        probs.forEach((p, i) => {
          const px = PAD + i * (probW + 12);
          const isMax = parseFloat(p.value) === Math.round(maxProb);
          drawRoundedRect(ctx, px, y, probW, probH, 16, isMax ? c.primaryLight : c.cardBg);
          drawRoundedRectStroke(ctx, px, y, probW, probH, 16, isMax ? c.primary + '40' : c.border);

          ctx.font = '500 14px "DM Sans", sans-serif';
          ctx.fillStyle = c.textMuted;
          ctx.textAlign = 'center';
          const labelText = p.label.length > 12 ? p.label.slice(0, 11) + '…' : p.label;
          ctx.fillText(labelText, px + probW / 2, y + 28);

          ctx.font = '900 28px "Nunito", sans-serif';
          ctx.fillStyle = isMax ? c.primary : c.text;
          ctx.fillText(p.value, px + probW / 2, y + 60);
        });
        y += probH + 24;
      }

      // Bets header
      ctx.font = '800 26px "Nunito", sans-serif';
      ctx.fillStyle = c.success;
      ctx.textAlign = 'left';
      ctx.fillText('🛡️  Paris suggérés', PAD + 8, y + 28);
      y += 50;

      // Bet cards
      for (const bet of props.suggestedBets) {
        const conf = getConfidenceInfo(bet.confidence, c);
        ctx.font = '500 24px "DM Sans", sans-serif';
        const reasonLines = wrapText(ctx, bet.reasoning, CONTENT_W - 80);
        const cardH = 80 + reasonLines.length * 30;

        drawRoundedRect(ctx, PAD, y, CONTENT_W, cardH, 20, c.cardBg);
        drawRoundedRectStroke(ctx, PAD, y, CONTENT_W, cardH, 20, c.border);

        // Left accent stripe
        ctx.fillStyle = conf.color;
        roundRect(ctx, PAD, y, 5, cardH, 20);
        ctx.fill();
        // Redraw the card to clip the stripe properly
        ctx.save();
        roundRect(ctx, PAD, y, 6, cardH, 0);
        ctx.clip();
        ctx.fillStyle = conf.color;
        ctx.fillRect(PAD, y, 6, cardH);
        ctx.restore();

        // Selection name
        ctx.font = '700 22px "Nunito", sans-serif';
        ctx.fillStyle = c.text;
        ctx.textAlign = 'left';
        ctx.fillText(bet.selection, PAD + 24, y + 30);

        // Badges
        const probText = `${Math.round(bet.probability)}%`;
        ctx.font = '700 16px "DM Sans", sans-serif';
        const probW = ctx.measureText(probText).width + 20;
        const badgeX = W - PAD - probW - 16;
        drawRoundedRect(ctx, badgeX, y + 14, probW, 28, 14, conf.bgColor);
        ctx.fillStyle = conf.color;
        ctx.textAlign = 'center';
        ctx.fillText(probText, badgeX + probW / 2, y + 33);

        // Bet type + confidence label
        ctx.font = '600 16px "DM Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = c.textMuted;
        const typeText = `${bet.bet_type} · ${conf.label}`;
        ctx.fillText(typeText, PAD + 24, y + 56);

        // Reasoning
        ctx.font = '500 18px "DM Sans", sans-serif';
        ctx.fillStyle = c.textSec;
        let rY = y + 76;
        for (const line of reasonLines) {
          ctx.fillText(line, PAD + 24, rY);
          rY += 28;
        }

        y += cardH + 14;
      }

      y += 10;

      // Footer
      ctx.font = '500 16px "DM Sans", sans-serif';
      ctx.fillStyle = c.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ Analyse statistique · Pariez de manière responsable', W / 2, y + 16);

      ctx.font = '600 14px "DM Sans", sans-serif';
      ctx.fillStyle = c.primary + '80';
      ctx.fillText('Généré par ANAP · anap.lovable.app', W / 2, y + 42);

      // Download
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
