/* eslint-disable react-refresh/only-export-components */
// --- IMPORTS ---
import { useId, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

// --- HELPERS: ROLLING 7-DAY SLOTS (DAY -6 UP TO TODAY) ---
export const compute7DaySlots = (logs = []) => {
    const now = new Date();
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const slots = [];

    // Construct a rolling 7-day sequence ending today
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const isToday = i === 0;
        const dayLabel = daysOfWeek[d.getDay()];
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const fullDateStr = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const ymd = `${year}-${month}-${day}`;

        slots.push({
            index: 6 - i,
            dayLabel,
            dateStr,
            fullDateStr,
            ymd,
            isToday,
            isFuture: false,
            count: 0,
            uniqueActors: new Set(),
        });
    }

    if (Array.isArray(logs)) {
        logs.forEach((log) => {
            const rawDate = log?.createdAt || log?.timestamp || log?.readAt || log?.updatedAt;
            if (!rawDate) return;
            const logDate = new Date(rawDate);
            if (isNaN(logDate.getTime())) return;

            const year = logDate.getFullYear();
            const month = String(logDate.getMonth() + 1).padStart(2, '0');
            const day = String(logDate.getDate()).padStart(2, '0');
            const logYmd = `${year}-${month}-${day}`;

            const slot = slots.find((s) => s.ymd === logYmd);
            if (slot) {
                slot.count += 1;
                const actorId = log.actor?.id || log.actorId;
                if (actorId) slot.uniqueActors.add(actorId);
            }
        });
    }

    return slots;
};

// --- HELPERS: MONTHLY READERSHIP SLOTS (LAST 7 CALENDAR MONTHS) ---
export const computeMonthlySlots = (logs = []) => {
    const now = new Date();
    const slots = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const dayLabel = d.toLocaleDateString([], { month: 'short' }).toUpperCase();
        const dateStr = d.toLocaleDateString([], { month: 'short', year: 'numeric' });
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        slots.push({
            index: 6 - i,
            dayLabel,
            dateStr,
            fullDateStr: dateStr,
            yearMonth,
            isToday: i === 0,
            isFuture: false,
            count: 0,
            uniqueActors: new Set(),
        });
    }

    if (Array.isArray(logs)) {
        logs.forEach((log) => {
            const rawDate = log?.createdAt || log?.timestamp || log?.readAt || log?.updatedAt;
            if (!rawDate) return;
            const logDate = new Date(rawDate);
            if (isNaN(logDate.getTime())) return;

            const logYearMonth = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
            const slot = slots.find((s) => s.yearMonth === logYearMonth);
            if (slot) {
                slot.count += 1;
                const actorId = log.actor?.id || log.actorId;
                if (actorId) slot.uniqueActors.add(actorId);
            } else if (logDate < new Date(now.getFullYear(), now.getMonth() - 6, 1)) {
                // Reads older than the 6-month window roll into the oldest slot
                slots[0].count += 1;
                const actorId = log.actor?.id || log.actorId;
                if (actorId) slots[0].uniqueActors.add(actorId);
            }
        });
    }

    return slots;
};

// Backwards-compatibility alias
export const computeAllTimeSlots = computeMonthlySlots;

// Natural Catmull-Rom spline curve generator with boundary tension and baseline clamping
const getCatmullRomSplinePath = (points = [], tension = 0.2, baselineY) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

    let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

    for (let i = 0; i < points.length - 1; i++) {
        const pPrev = i > 0 ? points[i - 1] : points[i];
        const pCurr = points[i];
        const pNext = points[i + 1];
        const pAfter = i + 2 < points.length ? points[i + 2] : pNext;

        // If both points sit on the baseline (0 reads), draw a clean straight line along the baseline
        if (pCurr.y >= baselineY - 0.5 && pNext.y >= baselineY - 0.5) {
            path += ` L ${pNext.x.toFixed(2)},${baselineY.toFixed(2)}`;
            continue;
        }

        let cp1x = pCurr.x + (pNext.x - pPrev.x) * tension;
        let cp1y = pCurr.y + (pNext.y - pPrev.y) * tension;

        let cp2x = pNext.x - (pAfter.x - pCurr.x) * tension;
        let cp2y = pNext.y - (pAfter.y - pCurr.y) * tension;

        path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pNext.x.toFixed(2)},${pNext.y.toFixed(2)}`;
    }

    return path;
};

// --- COMPONENT: LINE GRAPH WITH DYNAMIC SPIKES & ABSOLUTE TREND SCALING ---
export const ReadershipChart = ({
    logs = [],
    precomputedSlots = null,
    compact = false,
    showLabels = true,
    showPeak = false,
    color = 'var(--color-accent)',
    className = '',
}) => {
    const slots = useMemo(() => {
        if (Array.isArray(precomputedSlots) && precomputedSlots.length > 0) {
            return precomputedSlots;
        }
        const weekSlots = compute7DaySlots(logs);
        const weekTotal = weekSlots.reduce((sum, s) => sum + s.count, 0);

        // If there are historical logs (like "jerry" with 2 reads), but none in the rolling 7-day window,
        // automatically fallback to monthly slots so the reads visibly spike on the chart!
        if (weekTotal === 0 && Array.isArray(logs) && logs.length > 0) {
            return computeMonthlySlots(logs);
        }

        return weekSlots;
    }, [logs, precomputedSlots]);

    const rawMax = useMemo(() => {
        const counts = slots.map((s) => s.count);
        return Math.max(...counts, 0);
    }, [slots]);

    // Absolute dynamic ceiling scaling: ensures spikes crest naturally with headroom
    const maxCount = useMemo(() => {
        if (rawMax === 0) return 4;
        return Math.max(Math.ceil(rawMax * 1.25), rawMax + 1);
    }, [rawMax]);

    const totalPeriodReads = useMemo(() => {
        return slots.reduce((acc, s) => acc + s.count, 0);
    }, [slots]);

    const [activeHoverIndex, setActiveHoverIndex] = useState(null);

    // Chart dimensions
    const width = compact ? 240 : 280;
    const height = compact ? 48 : 68;
    const paddingX = compact ? 14 : 18;
    const paddingTop = compact ? 8 : 12;
    const baselineY = compact ? 34 : 50;
    const availableHeight = baselineY - paddingTop;
    const slotCount = Math.max(slots.length, 2);
    const stepX = (width - 2 * paddingX) / (slotCount - 1);

    // Compute coordinate points
    const points = useMemo(() => {
        return slots.map((slot, i) => {
            const x = paddingX + i * stepX;
            const ratio = slot.count / maxCount;
            const y = baselineY - ratio * availableHeight;
            return { x, y, slot };
        });
    }, [slots, maxCount, paddingX, stepX, baselineY, availableHeight]);

    // Path strings with natural Catmull-Rom spline curves
    const linePathD = useMemo(() => getCatmullRomSplinePath(points, 0.22, baselineY), [points, baselineY]);
    const areaPathD = useMemo(() => {
        if (points.length === 0) return '';
        const first = points[0];
        const last = points[points.length - 1];
        return `${linePathD} L ${last.x},${baselineY} L ${first.x},${baselineY} Z`;
    }, [linePathD, points, baselineY]);

    const rawId = useId();
    const gradientId = `read-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const activeSlot = activeHoverIndex !== null ? slots[activeHoverIndex] : null;

    return (
        <div className={`flex flex-col gap-1 w-full select-none relative ${className}`}>
            {/* OPTIONAL PEAK SUMMARY */}
            {showPeak && (
                <div className="flex items-center justify-between text-[11px] text-text-muted px-0.5">
                    <span className="flex items-center gap-1 font-medium">
                        <Eye className="h-3 w-3 text-accent" />
                        <span>Activity: {totalPeriodReads} reads</span>
                    </span>
                    <span className="font-semibold text-text">
                        {rawMax > 0 ? `Peak: ${rawMax}/period` : 'Quiet'}
                    </span>
                </div>
            )}

            {/* SVG CONTAINER WITH ABSOLUTE TREND VISUALIZATION */}
            <div className="relative w-full flex items-center justify-center">
                {/* FLOATING HOVER TOOLTIP */}
                {activeSlot && (
                    <div
                        className="absolute -top-7 px-2.5 py-0.5 rounded-md bg-surface border border-surface-border shadow-xl text-[10px] whitespace-nowrap z-30 pointer-events-none flex items-center gap-1.5 transition-all duration-150"
                        style={{
                            left: `${(paddingX + activeHoverIndex * stepX) * (100 / width)}%`,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <span className="font-bold text-text">
                            {activeSlot.dayLabel} ({activeSlot.dateStr}):
                        </span>
                        <span className="font-semibold" style={{ color }}>
                            {activeSlot.count} {activeSlot.count === 1 ? 'read' : 'reads'}
                        </span>
                    </div>
                )}

                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full overflow-visible"
                    style={{ height: compact ? '42px' : '58px', maxHeight: compact ? '46px' : '62px' }}
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.38" />
                            <stop offset="60%" stopColor={color} stopOpacity="0.12" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                        </linearGradient>
                    </defs>

                    {/* BACKGROUND GRID LINES */}
                    <g className="opacity-40">
                        {/* Upper reference line */}
                        <line
                            x1={paddingX}
                            y1={paddingTop}
                            x2={width - paddingX}
                            y2={paddingTop}
                            stroke="var(--color-surface-border)"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                        {/* Midline reference */}
                        <line
                            x1={paddingX}
                            y1={paddingTop + availableHeight / 2}
                            x2={width - paddingX}
                            y2={paddingTop + availableHeight / 2}
                            stroke="var(--color-surface-border)"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                        {/* Baseline ground line */}
                        <line
                            x1={paddingX}
                            y1={baselineY}
                            x2={width - paddingX}
                            y2={baselineY}
                            stroke="var(--color-surface-border)"
                            strokeWidth="1"
                        />

                        {/* Vertical grid lines */}
                        {points.map((pt, i) => (
                            <line
                                key={`vgrid-${i}`}
                                x1={pt.x}
                                y1={paddingTop}
                                x2={pt.x}
                                y2={baselineY}
                                stroke="var(--color-surface-border)"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                            />
                        ))}
                    </g>

                    {/* HOVER HIGHLIGHT VERTICAL COLUMN & CROSSHAIR */}
                    {activeHoverIndex !== null && (
                        <g>
                            <rect
                                x={points[activeHoverIndex].x - stepX / 2}
                                y={paddingTop - 2}
                                width={stepX}
                                height={availableHeight + 4}
                                fill={color}
                                fillOpacity="0.08"
                                rx="2"
                            />
                            <line
                                x1={points[activeHoverIndex].x}
                                y1={paddingTop}
                                x2={points[activeHoverIndex].x}
                                y2={baselineY}
                                stroke={color}
                                strokeWidth="1.25"
                                strokeDasharray="2 2"
                                strokeOpacity="0.65"
                            />
                        </g>
                    )}

                    {/* OPAQUE GRADIENT AREA BELOW LINE */}
                    <path d={areaPathD} fill={`url(#${gradientId})`} />

                    {/* MAIN SMOOTH CURVE LINE WITH NATURAL SPIKES */}
                    <path
                        d={linePathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* VERTEX DATA POINTS */}
                    {points.map((pt, i) => {
                        const isHovered = activeHoverIndex === i;
                        const isToday = pt.slot.isToday;
                        const hasReads = pt.slot.count > 0;
                        const isPeak = pt.slot.count === rawMax && rawMax > 0;

                        return (
                            <g key={`point-${i}`}>
                                {isPeak && !isHovered && (
                                    <circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r="5.5"
                                        fill="none"
                                        stroke={color}
                                        strokeWidth="1"
                                        strokeOpacity="0.4"
                                    />
                                )}
                                <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={isHovered ? 4.75 : isPeak ? 4 : isToday || hasReads ? 3.5 : 2.5}
                                    style={{
                                        fill: isHovered || isPeak || isToday ? color : 'var(--color-surface)',
                                        stroke: color,
                                    }}
                                    className="transition-all duration-150"
                                    strokeWidth={isHovered || isPeak || isToday ? '2' : '1.75'}
                                />
                            </g>
                        );
                    })}

                    {/* DAY / MONTH LABELS */}
                    {showLabels && (
                        <g className="text-center font-mono">
                            {points.map((pt, i) => {
                                const isToday = pt.slot.isToday;
                                const isHovered = activeHoverIndex === i;

                                return (
                                    <text
                                        key={`label-${i}`}
                                        x={pt.x}
                                        y={compact ? 44 : 62}
                                        textAnchor="middle"
                                        className={`transition-colors ${
                                            compact ? 'text-[7.5px]' : 'text-[8.5px]'
                                        } ${
                                            isToday || isHovered
                                                ? 'fill-accent font-bold'
                                                : 'fill-text-muted font-semibold'
                                        }`}
                                    >
                                        {pt.slot.dayLabel}
                                    </text>
                                );
                            })}
                        </g>
                    )}

                    {/* INVISIBLE INTERACTIVE HOVER & TOUCH TRIGGER REGIONS */}
                    {points.map((pt, i) => (
                        <rect
                            key={`trigger-${i}`}
                            x={pt.x - stepX / 2}
                            y={0}
                            width={stepX}
                            height={height}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setActiveHoverIndex(i)}
                            onMouseLeave={() => setActiveHoverIndex(null)}
                            onTouchStart={(e) => {
                                e.stopPropagation();
                                setActiveHoverIndex(i);
                            }}
                            onTouchEnd={() => {
                                setTimeout(() => {
                                    setActiveHoverIndex((curr) => (curr === i ? null : curr));
                                }, 2200);
                            }}
                        />
                    ))}
                </svg>
            </div>
        </div>
    );
};

export default ReadershipChart;
