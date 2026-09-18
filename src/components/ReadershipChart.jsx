// --- IMPORTS ---
import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

// --- HELPERS: CURRENT WEEK SLOTS (SUN TO SAT) ---
export const compute7DaySlots = (logs = []) => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - currentDay);
    sunday.setHours(0, 0, 0, 0);

    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const slots = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const isToday = d.toDateString() === now.toDateString();
        const isFuture = d > now && !isToday;
        const dayLabel = daysOfWeek[i];
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const fullDateStr = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const ymd = `${year}-${month}-${day}`;

        slots.push({
            index: i,
            dayLabel,
            dateStr,
            fullDateStr,
            ymd,
            isToday,
            isFuture,
            count: 0,
            uniqueActors: new Set(),
        });
    }

    if (Array.isArray(logs)) {
        logs.forEach((log) => {
            if (!log?.createdAt) return;
            const logDate = new Date(log.createdAt);
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

// Smooth cubic bezier path generator
const getSmoothLinePath = (points = []) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) * 0.45;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) * 0.55;
        const cpY2 = p1.y;
        d += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
    }
    return d;
};

// --- COMPONENT: LINE GRAPH WITH OPAQUE GRADIENT & GRID LINES ---
export const ReadershipChart = ({
    logs = [],
    precomputedSlots = null,
    compact = false,
    showLabels = true,
    showPeak = false,
    className = '',
}) => {
    const slots = useMemo(() => {
        if (Array.isArray(precomputedSlots) && precomputedSlots.length === 7) {
            return precomputedSlots;
        }
        return compute7DaySlots(logs);
    }, [logs, precomputedSlots]);

    const maxCount = useMemo(() => {
        const counts = slots.map((s) => s.count);
        return Math.max(...counts, 1);
    }, [slots]);

    const totalWeekReads = useMemo(() => {
        return slots.reduce((acc, s) => acc + s.count, 0);
    }, [slots]);

    const [activeHoverIndex, setActiveHoverIndex] = useState(null);

    // Chart dimensions (tuned for sleek horizontal proportions and cross-browser consistency)
    const width = compact ? 240 : 280;
    const height = compact ? 48 : 68;
    const paddingX = compact ? 14 : 18;
    const paddingTop = compact ? 6 : 10;
    const baselineY = compact ? 34 : 50;
    const availableHeight = baselineY - paddingTop;
    const stepX = (width - 2 * paddingX) / 6;

    // Compute coordinate points
    const points = useMemo(() => {
        return slots.map((slot, i) => {
            const x = paddingX + i * stepX;
            const ratio = slot.count / maxCount;
            const y = baselineY - ratio * availableHeight;
            return { x, y, slot };
        });
    }, [slots, maxCount, paddingX, stepX, baselineY, availableHeight]);

    // Path strings
    const linePathD = useMemo(() => getSmoothLinePath(points), [points]);
    const areaPathD = useMemo(() => {
        if (points.length === 0) return '';
        const first = points[0];
        const last = points[points.length - 1];
        return `${linePathD} L ${last.x},${baselineY} L ${first.x},${baselineY} Z`;
    }, [linePathD, points, baselineY]);

    const gradientId = useMemo(
        () => `read-grad-${Math.random().toString(36).substring(2, 8)}`,
        []
    );

    const activeSlot = activeHoverIndex !== null ? slots[activeHoverIndex] : null;

    return (
        <div className={`flex flex-col gap-1 w-full select-none relative ${className}`}>
            {/* OPTIONAL PEAK SUMMARY */}
            {showPeak && (
                <div className="flex items-center justify-between text-[11px] text-text-muted px-0.5">
                    <span className="flex items-center gap-1 font-medium">
                        <Eye className="h-3 w-3 text-accent" />
                        <span>This Week: {totalWeekReads} reads</span>
                    </span>
                    <span className="font-semibold text-text">
                        {maxCount > 1 ? `Peak: ${maxCount}/day` : 'Quiet week'}
                    </span>
                </div>
            )}

            {/* SVG CONTAINER WITH PROPORTIONATE HORIZONTAL ASPECT RATIO & GRID BACKGROUND */}
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
                        <span className="text-accent font-semibold">
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
                            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.04" />
                        </linearGradient>
                    </defs>

                    {/* BACKGROUND GRID LINES */}
                    <g className="opacity-40">
                        {/* Horizontal grid lines */}
                        <line
                            x1={paddingX}
                            y1={paddingTop}
                            x2={width - paddingX}
                            y2={paddingTop}
                            stroke="var(--color-surface-border)"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                        <line
                            x1={paddingX}
                            y1={paddingTop + availableHeight / 2}
                            x2={width - paddingX}
                            y2={paddingTop + availableHeight / 2}
                            stroke="var(--color-surface-border)"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                        />
                        <line
                            x1={paddingX}
                            y1={baselineY}
                            x2={width - paddingX}
                            y2={baselineY}
                            stroke="var(--color-surface-border)"
                            strokeWidth="1"
                        />

                        {/* Vertical day grid lines */}
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

                    {/* HOVER HIGHLIGHT COLUMN */}
                    {activeHoverIndex !== null && (
                        <rect
                            x={points[activeHoverIndex].x - stepX / 2}
                            y={paddingTop - 2}
                            width={stepX}
                            height={availableHeight + 4}
                            fill="var(--color-accent)"
                            fillOpacity="0.07"
                            rx="2"
                        />
                    )}

                    {/* OPAQUE GRADIENT AREA BELOW LINE */}
                    <path d={areaPathD} fill={`url(#${gradientId})`} />

                    {/* MAIN SMOOTH CURVE LINE */}
                    <path
                        d={linePathD}
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* VERTEX DATA POINTS */}
                    {points.map((pt, i) => {
                        const isHovered = activeHoverIndex === i;
                        const isToday = pt.slot.isToday;

                        return (
                            <g key={`point-${i}`}>
                                <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={isHovered ? 4.5 : isToday ? 4 : 2.75}
                                    className={`transition-all duration-150 ${
                                        isToday || isHovered
                                            ? 'fill-accent stroke-surface'
                                            : 'fill-surface stroke-accent'
                                    }`}
                                    strokeWidth={isToday || isHovered ? '2' : '1.75'}
                                />
                            </g>
                        );
                    })}

                    {/* DAY LABELS (S M T W T F S / SUN MON TUE WED THU FRI SAT) */}
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

                    {/* INVISIBLE INTERACTIVE HOVER TRIGGER REGIONS */}
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
                        />
                    ))}
                </svg>
            </div>
        </div>
    );
};

export default ReadershipChart;
