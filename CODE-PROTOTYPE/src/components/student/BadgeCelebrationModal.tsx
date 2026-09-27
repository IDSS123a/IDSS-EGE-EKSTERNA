import React from 'react';
import { StudentBadge } from '../../types/index.ts';
import { useTranslation } from '../../i18n/index.tsx';
import {
  Trophy,
  Flame,
  Calculator,
  Languages,
  BookMarked,
  Compass,
  Target,
  CheckCheck,
  Sparkles,
  Zap,
  Award,
  X,
  ArrowRight,
} from 'lucide-react';

interface BadgeCelebrationModalProps {
  badges: StudentBadge[];
  onClose: () => void;
  onViewAllBadges: () => void;
}

export const BadgeCelebrationModal: React.FC<BadgeCelebrationModalProps> = ({
  badges,
  onClose,
  onViewAllBadges,
}) => {
  const { language } = useTranslation();

  if (!badges || badges.length === 0) return null;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame':
        return <Flame className="w-10 h-10 text-amber-500 animate-bounce" />;
      case 'Calculator':
        return <Calculator className="w-10 h-10 text-indigo-500" />;
      case 'Languages':
        return <Languages className="w-10 h-10 text-amber-600" />;
      case 'BookMarked':
        return <BookMarked className="w-10 h-10 text-emerald-600" />;
      case 'Compass':
        return <Compass className="w-10 h-10 text-blue-500" />;
      case 'Target':
        return <Target className="w-10 h-10 text-rose-500" />;
      case 'CheckCheck':
        return <CheckCheck className="w-10 h-10 text-emerald-500" />;
      case 'Sparkles':
        return <Sparkles className="w-10 h-10 text-amber-400" />;
      case 'Zap':
        return <Zap className="w-10 h-10 text-amber-500" />;
      default:
        return <Trophy className="w-10 h-10 text-amber-500" />;
    }
  };

  const getTierDetails = (tier: string) => {
    switch (tier) {
      case 'diamond':
        return {
          label: language === 'de' ? 'Diamant-Stufe' : language === 'en' ? 'Diamond Tier' : 'Dijamantski rang',
          bg: 'from-cyan-500/20 via-blue-500/20 to-indigo-500/20 border-cyan-400 text-cyan-800',
          badgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-300',
        };
      case 'gold':
        return {
          label: language === 'de' ? 'Gold-Stufe' : language === 'en' ? 'Gold Tier' : 'Zlatni rang',
          bg: 'from-amber-500/20 via-yellow-500/20 to-orange-500/20 border-amber-400 text-amber-900',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'silver':
        return {
          label: language === 'de' ? 'Silber-Stufe' : language === 'en' ? 'Silver Tier' : 'Srebrni rang',
          bg: 'from-slate-300/30 via-slate-400/20 to-slate-200/30 border-slate-300 text-slate-800',
          badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
        };
      default:
        return {
          label: language === 'de' ? 'Bronze-Stufe' : language === 'en' ? 'Bronze Tier' : 'Bronzani rang',
          bg: 'from-amber-700/15 via-orange-600/15 to-amber-800/15 border-amber-600/40 text-amber-950',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
        };
    }
  };

  const getTitle = (b: StudentBadge) => {
    if (language === 'de' && b.titleDe) return b.titleDe;
    if (language === 'en' && b.titleEn) return b.titleEn;
    return b.title;
  };

  const getDescription = (b: StudentBadge) => {
    if (language === 'de' && b.descriptionDe) return b.descriptionDe;
    if (language === 'en' && b.descriptionEn) return b.descriptionEn;
    return b.description;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-amber-200/80 overflow-hidden text-center">
        {/* Confetti & Glow Header background */}
        <div className="h-28 bg-gradient-to-r from-amber-500 via-indigo-600 to-amber-600 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 text-white hover:bg-black/30 transition-colors cursor-pointer"
            aria-label="Zatvori"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-white text-xs font-bold uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full backdrop-blur-xs border border-white/20">
            {language === 'de'
              ? '🎉 Neues Abzeichen freigeschaltet!'
              : language === 'en'
              ? '🎉 New Badge Unlocked!'
              : '🎉 Otključano novo postignuće!'}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 -mt-12 relative z-10 space-y-6">
          <div className="space-y-4">
            {badges.map((badge) => {
              const tierInfo = getTierDetails(badge.tier);
              return (
                <div
                  key={badge.badgeId}
                  className={`p-6 rounded-2xl border bg-gradient-to-b ${tierInfo.bg} shadow-md space-y-3 relative overflow-hidden`}
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-white shadow-lg border-2 border-amber-300 flex items-center justify-center">
                    {getIcon(badge.iconName)}
                  </div>

                  <div>
                    <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider mb-1.5">
                      {tierInfo.label}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {getTitle(badge)}
                    </h3>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 leading-relaxed">
                      {getDescription(badge)}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 bg-white/70 py-1.5 px-3 rounded-lg border border-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {language === 'de'
                        ? 'Herzlichen Glückwunsch! Du machst großartige Fortschritte!'
                        : language === 'en'
                        ? 'Congratulations! You are excelling in your exam prep!'
                        : 'Čestitamo! Tvoj trud i kontinuitet daju sjajne rezultate!'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                onClose();
                onViewAllBadges();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {language === 'de'
                  ? 'Alle Abzeichen ansehen'
                  : language === 'en'
                  ? 'View All Badges'
                  : 'Pogledaj sve značke'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              {language === 'de'
                ? 'Weiter üben'
                : language === 'en'
                ? 'Continue Practicing'
                : 'Nastavi sa radom'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
