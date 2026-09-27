import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { StudentAttempt } from '../../types/index.ts';
import { TrendingUp, Award, CheckCircle, XCircle, Info, Filter, Sparkles } from 'lucide-react';

interface SubjectMasteryD3ChartProps {
  attempts: StudentAttempt[];
  className?: string;
  onOpenPracticeForSubject?: (subjectId: string) => void;
}

interface SessionDataPoint {
  sessionIndex: number;
  sessionLabel: string;
  dateLabel: string;
  attemptId: string;
  subjectId: string;
  subjectName: string;
  score: number;
  isPassed: boolean;
  durationMinutes: number;
  completedAt: string;
  reviewNotes?: string;
}

const SUBJECT_COLORS: Record<string, { stroke: string; fill: string; lightBg: string; name: string }> = {
  'sub-mat': { stroke: '#d97706', fill: '#f59e0b', lightBg: 'bg-amber-50 text-amber-800 border-amber-200', name: 'Matematika' },
  'sub-bhs': { stroke: '#059669', fill: '#10b981', lightBg: 'bg-emerald-50 text-emerald-800 border-emerald-200', name: 'B/H/S jezik' },
  'sub-deu': { stroke: '#4f46e5', fill: '#6366f1', lightBg: 'bg-indigo-50 text-indigo-800 border-indigo-200', name: 'Njemački jezik (DSD I)' },
  'sub-eng': { stroke: '#7c3aed', fill: '#8b5cf6', lightBg: 'bg-purple-50 text-purple-800 border-purple-200', name: 'Engleski jezik' },
  'sub-fiz': { stroke: '#0891b2', fill: '#06b6d4', lightBg: 'bg-cyan-50 text-cyan-800 border-cyan-200', name: 'Fizika' },
};

const DEFAULT_COLOR = { stroke: '#64748b', fill: '#94a3b8', lightBg: 'bg-slate-50 text-slate-800 border-slate-200', name: 'Ostali predmeti' };

export const SubjectMasteryD3Chart: React.FC<SubjectMasteryD3ChartProps> = ({
  attempts,
  className = '',
  onOpenPracticeForSubject,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    data: SessionDataPoint;
  } | null>(null);

  // Prepare and normalize last 10 chronological practice/simulation sessions
  const chronologicalAttempts = [...attempts]
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .slice(-10);

  const sessionPoints: SessionDataPoint[] = chronologicalAttempts.map((att, idx) => {
    const d = new Date(att.completedAt);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
    return {
      sessionIndex: idx + 1,
      sessionLabel: `S${idx + 1}`,
      dateLabel: dateStr,
      attemptId: att.id,
      subjectId: att.subjectId,
      subjectName: att.subjectName,
      score: att.percentage,
      isPassed: att.isPassed,
      durationMinutes: Math.round((att.durationSeconds || 1800) / 60),
      completedAt: att.completedAt,
      reviewNotes: att.reviewNotes,
    };
  });

  // Calculate high-level progression metrics over the 10 sessions
  const firstScore = sessionPoints[0]?.score ?? 0;
  const lastScore = sessionPoints[sessionPoints.length - 1]?.score ?? 0;
  const delta = lastScore - firstScore;
  const highestPoint = sessionPoints.reduce(
    (max, cur) => (cur.score > (max?.score ?? 0) ? cur : max),
    sessionPoints[0]
  );
  const avgScore = sessionPoints.length > 0
    ? Math.round(sessionPoints.reduce((acc, cur) => acc + cur.score, 0) / sessionPoints.length)
    : 0;

  // Distinct subjects in dataset
  const distinctSubjects = Array.from(new Set(sessionPoints.map((p) => p.subjectId)));

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || sessionPoints.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 750;
    const height = 340;

    const margin = { top: 28, right: 32, bottom: 44, left: 48 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('style', 'max-width: 100%; height: auto;');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Discrete session labels S1..S10 with dates
    const xLabels = sessionPoints.map((p) => p.sessionLabel);
    const xScale = d3.scalePoint<string>()
      .domain(xLabels)
      .range([0, innerWidth])
      .padding(0.2);

    // Y Scale: Percentage 0 to 100
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines for Y
    const yGrid = d3.axisLeft(yScale)
      .tickValues([25, 50, 75, 100])
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.12)
      .call(yGrid)
      .select('.domain')
      .remove();

    // 50% Threshold Reference Line (Matura Passing Standard)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(50))
      .attr('y2', yScale(50))
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.85);

    g.append('text')
      .attr('x', innerWidth - 6)
      .attr('y', yScale(50) - 6)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', '#e11d48')
      .text('Prag prolaznosti (50%)');

    // 75% High Mastery Reference Line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(75))
      .attr('y2', yScale(75))
      .attr('stroke', '#10b981')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.8);

    g.append('text')
      .attr('x', innerWidth - 6)
      .attr('y', yScale(75) - 6)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', '#059669')
      .text('Ciljna zona visoke pripremljenosti (75%)');

    // X-Axis
    const xAxis = d3.axisBottom(xScale);
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', '#cbd5e1');
    xAxisG.selectAll('.tick line').attr('stroke', '#cbd5e1');
    xAxisG.selectAll('.tick text')
      .attr('fill', '#475569')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .each(function (d, i) {
        const point = sessionPoints[i];
        if (point) {
          d3.select(this).text('');
          d3.select(this)
            .append('tspan')
            .attr('x', 0)
            .attr('dy', '1em')
            .attr('font-weight', 'bold')
            .text(point.sessionLabel);
          d3.select(this)
            .append('tspan')
            .attr('x', 0)
            .attr('dy', '1.1em')
            .attr('font-size', '9px')
            .attr('fill', '#94a3b8')
            .text(point.dateLabel);
        }
      });

    // Y-Axis
    const yAxis = d3.axisLeft(yScale)
      .tickValues([0, 25, 50, 75, 100])
      .tickFormat((d) => `${d}%`);

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').attr('stroke', '#cbd5e1');
    yAxisG.selectAll('.tick line').attr('stroke', '#cbd5e1');
    yAxisG.selectAll('.tick text')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-mono', 'true');

    // Group points by subject for multi-line rendering
    const pointsBySubject: Record<string, SessionDataPoint[]> = {};
    sessionPoints.forEach((p) => {
      if (!pointsBySubject[p.subjectId]) {
        pointsBySubject[p.subjectId] = [];
      }
      pointsBySubject[p.subjectId].push(p);
    });

    // Draw progression lines per subject
    Object.entries(pointsBySubject).forEach(([subId, pts]) => {
      const isHighlighted = selectedSubject === 'all' || selectedSubject === subId;
      const opacity = isHighlighted ? 1 : 0.15;
      const color = SUBJECT_COLORS[subId] || DEFAULT_COLOR;

      // Line generator
      const lineGen = d3.line<SessionDataPoint>()
        .x((d) => xScale(d.sessionLabel) || 0)
        .y((d) => yScale(d.score))
        .curve(d3.curveMonotoneX);

      // Line path
      const path = g.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', color.stroke)
        .attr('stroke-width', isHighlighted ? (selectedSubject === subId ? 3.5 : 2.5) : 1.5)
        .attr('stroke-opacity', opacity)
        .attr('d', lineGen);

      // Path entrance animation
      const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || 1000;
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    });

    // Draw interactive circular nodes for each data point
    sessionPoints.forEach((pt) => {
      const isHighlighted = selectedSubject === 'all' || selectedSubject === pt.subjectId;
      const color = SUBJECT_COLORS[pt.subjectId] || DEFAULT_COLOR;
      const cx = xScale(pt.sessionLabel) || 0;
      const cy = yScale(pt.score);

      const circle = g.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', isHighlighted ? 5.5 : 3.5)
        .attr('fill', pt.isPassed ? '#ffffff' : '#ffe4e6')
        .attr('stroke', color.stroke)
        .attr('stroke-width', 2.5)
        .attr('opacity', isHighlighted ? 1 : 0.2)
        .attr('cursor', 'pointer')
        .style('transition', 'r 0.15s ease, stroke-width 0.15s ease');

      // Invisible wider hit area for smooth touch/mouse hover
      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 18)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseenter', (event) => {
          circle.attr('r', 8).attr('stroke-width', 3.5);
          const rect = container.getBoundingClientRect();
          setHoveredPoint({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            data: pt,
          });
        })
        .on('mouseleave', () => {
          circle.attr('r', isHighlighted ? 5.5 : 3.5).attr('stroke-width', 2.5);
          setHoveredPoint(null);
        });
    });
  }, [attempts, selectedSubject, sessionPoints.length]);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6 ${className}`}>
      {/* Header with Title and Subject Filter Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Historijska progresija savladanosti ispitnih predmeta
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            D3.js prikaz uspješnosti kroz zadnjih 10 praćenih sesija u odnosu na zakonski prag (50%) i zonu izvrsnosti (75%)
          </p>
        </div>

        {/* Subject Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-auto">
          <button
            onClick={() => setSelectedSubject('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              selectedSubject === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Svi predmeti ({sessionPoints.length})
          </button>
          {distinctSubjects.map((subId) => {
            const conf = SUBJECT_COLORS[subId] || DEFAULT_COLOR;
            const isSelected = selectedSubject === subId;
            return (
              <button
                key={subId}
                onClick={() => setSelectedSubject(subId)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isSelected
                    ? `${conf.lightBg} border-current ring-1 ring-current`
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: conf.stroke }}
                />
                <span>{conf.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Progression Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Ukupan trend (Sesija 1 → 10)</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-base font-extrabold font-mono tabular-nums ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {delta >= 0 ? `+${delta}%` : `${delta}%`}
              </span>
              <span className="text-xs text-slate-500">
                ({firstScore}% → {lastScore}%)
              </span>
            </div>
          </div>
          <div className="text-xl">{delta >= 0 ? '📈' : '📉'}</div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Najviši ostvareni rezultat</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-base font-extrabold text-indigo-600 font-mono tabular-nums">
                {highestPoint?.score ?? 0}%
              </span>
              <span className="text-xs text-slate-600 truncate max-w-[130px]">
                ({highestPoint?.subjectName || '—'})
              </span>
            </div>
          </div>
          <Award className="w-5 h-5 text-amber-500 shrink-0" />
        </div>

        <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Prosjek zadnjih 10 sesija</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                {avgScore}%
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-sm ${
                avgScore >= 75 ? 'bg-emerald-100 text-emerald-800' : avgScore >= 50 ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {avgScore >= 75 ? 'Visoka sprema' : avgScore >= 50 ? 'Zadovoljava' : 'Rizično'}
              </span>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-indigo-500 shrink-0" />
        </div>
      </div>

      {/* D3 SVG Chart Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden bg-slate-50/50 rounded-xl border border-slate-100 p-2">
        <svg ref={svgRef} className="w-full select-none" />

        {/* Interactive Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 transition-transform duration-75"
            style={{
              left: `${hoveredPoint.x}px`,
              top: `${hoveredPoint.y}px`,
            }}
          >
            <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs w-64 backdrop-blur-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                <span className="font-bold text-amber-400">
                  {hoveredPoint.data.sessionLabel} · {new Date(hoveredPoint.data.completedAt).toLocaleDateString('bs')}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${
                  hoveredPoint.data.isPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {hoveredPoint.data.isPassed ? 'Položio ✓' : 'Ispod praga ✗'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="font-medium text-white">{hoveredPoint.data.subjectName}</span>
                <span className="text-base font-extrabold font-mono text-emerald-400">
                  {hoveredPoint.data.score}%
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Trajanje simulacije:</span>
                <span className="font-mono text-slate-200">{hoveredPoint.data.durationMinutes} min</span>
              </div>

              {hoveredPoint.data.reviewNotes && (
                <div className="text-[11px] text-slate-300 italic pt-1 border-t border-slate-800/80 line-clamp-2">
                  "{hoveredPoint.data.reviewNotes}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Chart Legend and Action Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-500 border-dashed" />
            <span>50% Zakonski prag prolaza</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 border-dashed" />
            <span>75% Cilj visoke pripremljenosti</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
            <span>Pojedinačna ispitna sesija</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Ažurirano u realnom vremenu · D3 v7 & SVG rendering
        </div>
      </div>
    </div>
  );
};
