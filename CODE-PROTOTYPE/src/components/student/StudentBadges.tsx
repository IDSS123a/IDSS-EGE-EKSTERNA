import React, { useState, useEffect } from 'react';
import { User, StudentBadge, StudentBadgeSummary } from '../../types/index.ts';
import { api } from '../../services/api.ts';
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
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  RotateCw,
  BookOpen,
  Play,
  Filter,
} from 'lucide-react';

interface StudentBadgesProps {
  currentUser: User;
  onStartSimulation: (subjectId: string) => void;
  onOpenPractice: (subjectId?: string) => void;
}

export const StudentBadges: React.FC<StudentBadgesProps> = ({
  currentUser,
  onStartSimulation,
  onOpenPractice,
}) => {
  const { language } = useTranslation();
  const [badgeSummary, setBadgeSummary] = useState<StudentBadgeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const loadBadges = async () => {
    try {
      setLoading(true);
      const data = await api.getBadges(currentUser.id);
      setBadgeSummary(data);
    } catch (err) {
      console.error('Greška pri dohvatanju znački:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBadges();
  }, [currentUser.id]);

  const getIcon = (iconName: string, isUnlocked: boolean) => {
    const iconClass = isUnlocked ? 'w-7 h-7' : 'w-7 h-7 opacity-40';
    switch (iconName) {
      case 'Flame':
        return <Flame className={`${iconClass} ${isUnlocked ? 'text-amber-500' : 'text-slate-400'}`} />;
      case 'Calculator':
        return <Calculator className={`${iconClass} ${isUnlocked ? 'text-indigo-600' : 'text-slate-400'}`} />;
      case 'Languages':
        return <Languages className={`${iconClass} ${isUnlocked ? 'text-amber-600' : 'text-slate-400'}`} />;
      case 'BookMarked':
        return <BookMarked className={`${iconClass} ${isUnlocked ? 'text-emerald-600' : 'text-slate-400'}`} />;
      case 'Compass':
        return <Compass className={`${iconClass} ${isUnlocked ? 'text-blue-600' : 'text-slate-400'}`} />;
      case 'Target':
        return <Target className={`${iconClass} ${isUnlocked ? 'text-rose-600' : 'text-slate-400'}`} />;
      case 'CheckCheck':
        return <CheckCheck className={`${iconClass} ${isUnlocked ? 'text-emerald-600' : 'text-slate-400'}`} />;
      case 'Sparkles':
        return <Sparkles className={`${iconClass} ${isUnlocked ? 'text-amber-500' : 'text-slate-400'}`} />;
      case 'Zap':
        return <Zap className={`${iconClass} ${isUnlocked ? 'text-amber-500' : 'text-slate-400'}`} />;
      case 'Award':
        return <Award className={`${iconClass} ${isUnlocked ? 'text-purple-600' : 'text-slate-400'}`} />;
      default:
        return <Trophy className={`${iconClass} ${isUnlocked ? 'text-amber-500' : 'text-slate-400'}`} />;
    }
  };

  const getTierVisuals = (tier: string) => {
    switch (tier) {
      case 'diamond':
        return {
          label: language === 'de' ? 'Diamant' : language === 'en' ? 'Diamond' : 'Dijamant',
          badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300',
          borderClass: 'border-cyan-300 ring-1 ring-cyan-100',
          gradientBg: 'bg-gradient-to-br from-cyan-50/70 via-white to-sky-50/40',
          barColor: 'bg-gradient-to-r from-cyan-500 to-blue-600',
          medal: '💎',
        };
      case 'gold':
        return {
          label: language === 'de' ? 'Gold' : language === 'en' ? 'Gold' : 'Zlato',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
          borderClass: 'border-amber-300 ring-1 ring-amber-100',
          gradientBg: 'bg-gradient-to-br from-amber-50/60 via-white to-yellow-50/30',
          barColor: 'bg-gradient-to-r from-amber-500 to-yellow-500',
          medal: '🥇',
        };
      case 'silver':
        return {
          label: language === 'de' ? 'Silber' : language === 'en' ? 'Silver' : 'Srebro',
          badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
          borderClass: 'border-slate-300',
          gradientBg: 'bg-gradient-to-br from-slate-50 via-white to-slate-100/50',
          barColor: 'bg-gradient-to-r from-slate-400 to-slate-600',
          medal: '🥈',
        };
      default:
        return {
          label: language === 'de' ? 'Bronze' : language === 'en' ? 'Bronze' : 'Bronza',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
          borderClass: 'border-amber-200',
          gradientBg: 'bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30',
          barColor: 'bg-gradient-to-r from-amber-600 to-orange-600',
          medal: '🥉',
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

  const getActionForBadge = (badge: StudentBadge) => {
    if (badge.subjectId) {
      return (
        <button
          onClick={() => onStartSimulation(badge.subjectId!)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>
            {language === 'de'
              ? 'Prüfung starten'
              : language === 'en'
              ? 'Start Simulation'
              : 'Pokreni ispit'}
          </span>
          <ArrowRight className="w-3 h-3" />
        </button>
      );
    }
    if (badge.category === 'practice' || badge.category === 'streak') {
      return (
        <button
          onClick={() => onOpenPractice()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>
            {language === 'de'
              ? 'Im Übungsbereich lösen'
              : language === 'en'
              ? 'Go to Practice Bank'
              : 'Vježbaj zadatke'}
          </span>
          <ArrowRight className="w-3 h-3" />
        </button>
      );
    }
    return (
      <button
        onClick={() => onStartSimulation('sub-mat')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>
          {language === 'de'
            ? 'Simulation starten'
            : language === 'en'
            ? 'Launch Exam'
            : 'Pokreni simulaciju'}
        </span>
        <ArrowRight className="w-3 h-3" />
      </button>
    );
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Učitavanje znački i postignuća...</div>;
  }

  const allBadges = badgeSummary?.badges || [];

  const filteredBadges = allBadges.filter((b) => {
    // category filter
    if (selectedCategory !== 'all' && b.category !== selectedCategory) {
      return false;
    }
    // status filter
    if (statusFilter === 'unlocked' && !b.isUnlocked) return false;
    if (statusFilter === 'locked' && b.isUnlocked) return false;
    return true;
  });

  const tierCounts = {
    diamond: allBadges.filter((b) => b.isUnlocked && b.tier === 'diamond').length,
    gold: allBadges.filter((b) => b.isUnlocked && b.tier === 'gold').length,
    silver: allBadges.filter((b) => b.isUnlocked && b.tier === 'silver').length,
    bronze: allBadges.filter((b) => b.isUnlocked && b.tier === 'bronze').length,
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              IDSS Motivacijski sistem · IX razred
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-mono">Lernfortschritt & Abzeichen</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {language === 'de'
              ? 'Abzeichen & Erfolge'
              : language === 'en'
              ? 'Badges & Milestone Achievements'
              : 'Značke & Postignuća za eksternu maturu'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {language === 'de'
              ? 'Sammle Abzeichen durch kontinuierliches Üben, hohe Testergebnisse und Engagement in allen Prüfungsfächern.'
              : language === 'en'
              ? 'Earn badges through steady practice streaks, high simulation scores, and subject mastery.'
              : 'Osvajajte priznanja kroz redovno vježbanje zadataka, visoke rezultate na simulacijama i ovladavanje gradivom.'}
          </p>
        </div>

        <button
          onClick={loadBadges}
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Osvježi napredak</span>
        </button>
      </div>

      {/* Hero Stats Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Streak Section */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-xs">
            <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Flame className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-300 font-bold">
                {language === 'de' ? 'Aktuelle Serie' : language === 'en' ? 'Current Streak' : 'Niz učenja'}
              </div>
              <div className="text-3xl font-black font-mono text-white mt-0.5">
                {badgeSummary?.currentStreakDays ?? 1}{' '}
                <span className="text-sm font-normal text-slate-300">
                  {language === 'de' ? 'Tage' : language === 'en' ? 'days' : 'dana'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {badgeSummary?.currentStreakDays && badgeSummary.currentStreakDays >= 7
                  ? '🔥 Zlatni šampionski tempo pripreme!'
                  : '🔥 Vježbajte svakodnevno za brže napredovanje!'}
              </div>
            </div>
          </div>

          {/* Unlocked Progress Section */}
          <div className="space-y-2 bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                {language === 'de' ? 'Freigeschaltet' : language === 'en' ? 'Badges Unlocked' : 'Otključane značke'}
              </span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {badgeSummary?.unlockedCount} / {badgeSummary?.totalBadges} ({badgeSummary?.unlockedPercent}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${badgeSummary?.unlockedPercent ?? 0}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{allBadges.length - (badgeSummary?.unlockedCount || 0)} preostalo za otključati</span>
              <span>{badgeSummary?.totalQuestionsPracticed} vježbanih zadataka</span>
            </div>
          </div>

          {/* Medals Breakdown */}
          <div className="flex items-center justify-around bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-xs text-center">
            <div>
              <div className="text-xl">💎</div>
              <div className="text-base font-extrabold text-cyan-300 font-mono">{tierCounts.diamond}</div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Dijamant</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-xl">🥇</div>
              <div className="text-base font-extrabold text-amber-300 font-mono">{tierCounts.gold}</div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Zlato</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-xl">🥈</div>
              <div className="text-base font-extrabold text-slate-200 font-mono">{tierCounts.silver}</div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Srebro</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-xl">🥉</div>
              <div className="text-base font-extrabold text-amber-500 font-mono">{tierCounts.bronze}</div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Bronza</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Category Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: language === 'de' ? 'Alle' : language === 'en' ? 'All Badges' : 'Sve značke' },
            { id: 'streak', label: '🔥 ' + (language === 'de' ? 'Lernserien' : language === 'en' ? 'Streaks' : 'Kontinuitet & Nizovi') },
            { id: 'subject', label: '📚 ' + (language === 'de' ? 'Fachexperten' : language === 'en' ? 'Subject Experts' : 'Predmetni eksperti') },
            { id: 'practice', label: '🎯 ' + (language === 'de' ? 'Übungsbereich' : language === 'en' ? 'Practice Volume' : 'Vježbaonica') },
            { id: 'mastery', label: '🏆 ' + (language === 'de' ? 'Meisterschaft' : language === 'en' ? 'Mastery' : 'Izvrsnost & Matura') },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Sve ({allBadges.length})
          </button>
          <button
            onClick={() => setStatusFilter('unlocked')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'unlocked' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Otključano ({allBadges.filter((b) => b.isUnlocked).length})
          </button>
          <button
            onClick={() => setStatusFilter('locked')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              statusFilter === 'locked' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            U toku ({allBadges.filter((b) => !b.isUnlocked).length})
          </button>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBadges.map((badge) => {
          const visuals = getTierVisuals(badge.tier);
          const isUnlocked = badge.isUnlocked;

          return (
            <div
              key={badge.badgeId}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                isUnlocked
                  ? `${visuals.borderClass} ${visuals.gradientBg} shadow-xs hover:shadow-md`
                  : 'border-slate-200 bg-white/70 opacity-90'
              }`}
            >
              {/* Top Accent Ribbon */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                    isUnlocked
                      ? 'bg-white shadow-sm border-amber-200/80'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  {getIcon(badge.iconName, isUnlocked)}
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${visuals.badgeClass}`}
                  >
                    <span>{visuals.medal}</span>
                    <span>{visuals.label}</span>
                  </span>

                  <div className="mt-1.5">
                    {isUnlocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Otključano</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>U toku ({badge.percent}%)</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5 flex-1">
                <h3 className={`text-base font-bold tracking-tight ${isUnlocked ? 'text-slate-900' : 'text-slate-700'}`}>
                  {getTitle(badge)}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {getDescription(badge)}
                </p>
              </div>

              {/* Progress Bar & Target */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Napredak:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {badge.currentProgress} / {badge.maxProgress} {badge.unit}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isUnlocked ? visuals.barColor : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.max(badge.percent, 3)}%` }}
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {isUnlocked && badge.unlockedAt ? (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Otključano: {new Date(badge.unlockedAt).toLocaleDateString('bs')}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Još {Math.max(0, badge.maxProgress - badge.currentProgress)} {badge.unit} do cilja
                    </span>
                  )}

                  {!isUnlocked && getActionForBadge(badge)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredBadges.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
          Nema znački za odabrane kriterije filtriranja.
        </div>
      )}
    </div>
  );
};
