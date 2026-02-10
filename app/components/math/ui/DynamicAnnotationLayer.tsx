"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

// Anchor data structure (coordinates in 0-1000 system)
export interface AnnotationAnchor {
    id: string;
    x: number;      // 0-1000
    y: number;      // 0-1000
    width: number;  // 0-1000
    height: number; // 0-1000
    label: string;
    color?: string;
}

interface DynamicAnnotationLayerProps {
    activeAnchors: AnnotationAnchor[];
    containerRef: React.RefObject<HTMLDivElement | null>;
}

// Pen Cursor SVG Component - hotspot at bottom-left (pen tip)
const PenCursor = ({ isWriting = false }: { isWriting?: boolean }) => (
    <motion.div
        className="absolute pointer-events-none"
        style={{
            // Position correction: pen tip should be at (0,0) of this div
            transform: "translate(-4px, -42px)",
            zIndex: 100,
        }}
        animate={{
            scale: isWriting ? 1.0 : 1.1,
            filter: isWriting
                ? "drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
                : "drop-shadow(0 8px 16px rgba(0,0,0,0.3))",
        }}
        transition={{ duration: 0.15 }}
    >
        <motion.svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            animate={isWriting ? {
                x: [0, 0.5, -0.5, 0.3, 0],
                y: [0, 0.3, -0.3, 0.5, 0],
            } : {}}
            transition={{
                duration: 0.1,
                repeat: Infinity,
                repeatType: "mirror",
            }}
        >
            {/* Pen body */}
            <path
                d="M15.5 3.5L20.5 8.5L8 21H3V16L15.5 3.5Z"
                fill="#F8FAFC"
                stroke="#4F46E5"
                strokeWidth="2"
            />
            {/* Pen decoration line */}
            <path
                d="M13 6L18 11"
                stroke="#4F46E5"
                strokeWidth="2"
            />
            {/* Pen tip ink */}
            <path
                d="M3 21L5 19"
                stroke="#4F46E5"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            {/* Extra flourish */}
            <circle
                cx="4"
                cy="20"
                r="1"
                fill="#4F46E5"
            />
        </motion.svg>
    </motion.div>
);

// Generate a hand-drawn circle path with slight irregularity
function generateSketchedCircle(cx: number, cy: number, radius: number, seed: number): string {
    const points: string[] = [];
    const segments = 12;

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const jitter = Math.sin(seed * 7 + i * 3) * (radius * 0.08);
        const r = radius + jitter;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) {
            points.push(`M ${x} ${y}`);
        } else {
            const prevAngle = ((i - 1) / segments) * Math.PI * 2;
            const midAngle = (angle + prevAngle) / 2;
            const ctrlJitter = Math.sin(seed * 11 + i * 5) * (radius * 0.12);
            const ctrlR = radius + ctrlJitter;
            const ctrlX = cx + Math.cos(midAngle) * ctrlR * 1.05;
            const ctrlY = cy + Math.sin(midAngle) * ctrlR * 1.05;
            points.push(`Q ${ctrlX} ${ctrlY} ${x} ${y}`);
        }
    }

    return points.join(" ");
}

// Generate a hand-drawn underline
function generateSketchedUnderline(x: number, y: number, width: number, seed: number): string {
    const wobble1 = Math.sin(seed * 3) * 2;
    const wobble2 = Math.sin(seed * 7) * 2;
    const midX = x + width / 2;
    const endX = x + width;

    return `M ${x} ${y + wobble1} Q ${midX} ${y + wobble2 + 3} ${endX} ${y - wobble1}`;
}

// Generate leader line path from target to label
function generateLeaderLine(
    startX: number, startY: number,
    endX: number, endY: number,
    seed: number
): string {
    const midX = (startX + endX) / 2 + Math.sin(seed * 5) * 8;
    const midY = (startY + endY) / 2 + Math.cos(seed * 3) * 5;

    return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
}

// Calculate path length for duration
function estimatePathLength(pathD: string): number {
    // Simple estimation based on path string length and type
    const isCircle = pathD.includes("Q") && (pathD.match(/Q/g)?.length || 0) > 4;
    if (isCircle) return 150; // circles take longer
    return Math.min(200, pathD.length / 2);
}

export default function DynamicAnnotationLayer({
    activeAnchors,
    containerRef,
}: DynamicAnnotationLayerProps) {
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [currentAnimatingIndex, setCurrentAnimatingIndex] = useState(-1);
    const [penPosition, setPenPosition] = useState({ x: -50, y: -50 });
    const [isWriting, setIsWriting] = useState(false);
    const [animationPhase, setAnimationPhase] = useState<"idle" | "approach" | "draw" | "lift">("idle");
    const animationQueue = useRef<number[]>([]);
    const isAnimating = useRef(false);

    // Observe container size changes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });

        observer.observe(container);
        setContainerSize({
            width: container.clientWidth,
            height: container.clientHeight,
        });

        return () => observer.disconnect();
    }, [containerRef]);

    const scaleX = containerSize.width / 1000;
    const scaleY = containerSize.height / 1000;

    // Process anchors with animation data
    const annotationData = useMemo(() => {
        return activeAnchors.map((anchor, index) => {
            const centerX = (anchor.x + anchor.width / 2) * scaleX;
            const centerY = (anchor.y + anchor.height / 2) * scaleY;
            const pixelWidth = anchor.width * scaleX;
            const pixelHeight = anchor.height * scaleY;

            const isPoint = anchor.width < 80 && anchor.height < 80;
            const radius = isPoint
                ? Math.max(12, Math.min(pixelWidth, pixelHeight) / 2 + 8)
                : Math.max(pixelWidth, pixelHeight) / 2 + 5;

            const isInTopHalf = anchor.y < 500;
            const labelOffsetY = isInTopHalf ? radius + 35 : -(radius + 15);
            const labelX = centerX;
            const labelY = centerY + labelOffsetY;

            const leaderStartX = centerX + (isInTopHalf ? 5 : -5);
            const leaderStartY = centerY + (isInTopHalf ? radius + 2 : -(radius + 2));
            const leaderEndX = labelX;
            const leaderEndY = isInTopHalf ? labelY - 12 : labelY + 12;

            const seed = index + anchor.x * 0.01 + anchor.y * 0.01;

            const circlePath = generateSketchedCircle(centerX, centerY, radius, seed);
            const underlinePath = !isPoint
                ? generateSketchedUnderline(centerX - pixelWidth / 2, centerY + pixelHeight / 2 + 3, pixelWidth, seed)
                : "";
            const mainPath = isPoint ? circlePath : (underlinePath || circlePath);

            // Get first point of path for pen starting position
            const pathMatch = mainPath.match(/M\s*([\d.]+)\s*([\d.]+)/);
            const pathStartX = pathMatch ? parseFloat(pathMatch[1]) : centerX;
            const pathStartY = pathMatch ? parseFloat(pathMatch[2]) : centerY;

            return {
                ...anchor,
                centerX,
                centerY,
                radius,
                isPoint,
                pixelWidth,
                pixelHeight,
                labelX,
                labelY,
                isInTopHalf,
                leaderPath: generateLeaderLine(leaderStartX, leaderStartY, leaderEndX, leaderEndY, seed),
                mainPath,
                pathStartX,
                pathStartY,
                seed,
                drawDuration: estimatePathLength(mainPath) / 150, // normalized duration
            };
        });
    }, [activeAnchors, scaleX, scaleY]);

    // Animation sequencer
    useEffect(() => {
        if (annotationData.length === 0) {
            setCurrentAnimatingIndex(-1);
            setAnimationPhase("idle");
            return;
        }

        // Queue all anchors for animation
        animationQueue.current = annotationData.map((_, i) => i);

        const animateNext = async () => {
            if (animationQueue.current.length === 0 || isAnimating.current) return;

            isAnimating.current = true;
            const index = animationQueue.current.shift()!;
            const data = annotationData[index];

            if (!data) {
                isAnimating.current = false;
                return;
            }

            // Phase 1: Approach
            setAnimationPhase("approach");
            setPenPosition({ x: data.pathStartX, y: data.pathStartY });
            await new Promise(r => setTimeout(r, 300));

            // Phase 2: Draw
            setAnimationPhase("draw");
            setIsWriting(true);
            setCurrentAnimatingIndex(index);
            await new Promise(r => setTimeout(r, data.drawDuration * 1000 + 200));

            // Phase 3: Lift
            setAnimationPhase("lift");
            setIsWriting(false);
            await new Promise(r => setTimeout(r, 200));

            isAnimating.current = false;

            // Animate next if queue not empty
            if (animationQueue.current.length > 0) {
                animateNext();
            } else {
                setAnimationPhase("idle");
                setPenPosition({ x: -100, y: -100 }); // Move pen off screen
            }
        };

        animateNext();
    }, [annotationData]);

    if (containerSize.width === 0) return null;

    return (
        <div
            className="absolute inset-0 pointer-events-none overflow-visible"
            style={{ zIndex: 20 }}
        >
            {/* SVG Layer for paths */}
            <svg
                width="100%"
                height="100%"
                className="absolute inset-0"
                style={{ overflow: "visible" }}
            >
                <defs>
                    <filter id="sketch-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="0.8" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <AnimatePresence mode="popLayout">
                    {annotationData.map((data, index) => {
                        const shouldAnimate = index <= currentAnimatingIndex;
                        const isCurrentlyDrawing = index === currentAnimatingIndex && animationPhase === "draw";

                        return (
                            <motion.g
                                key={data.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: shouldAnimate ? 1 : 0 }}
                                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            >
                                {/* Main path (circle or underline) */}
                                <motion.path
                                    d={data.mainPath}
                                    fill="none"
                                    stroke={data.color || "#7C3AED"}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    filter="url(#sketch-glow)"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={shouldAnimate ? {
                                        pathLength: 1,
                                        opacity: 0.85
                                    } : {
                                        pathLength: 0,
                                        opacity: 0
                                    }}
                                    transition={{
                                        pathLength: {
                                            duration: data.drawDuration,
                                            ease: "easeInOut"
                                        },
                                        opacity: { duration: 0.1 },
                                    }}
                                />

                            </motion.g>
                        );
                    })}
                </AnimatePresence>
            </svg>

            {/* Phantom Pen - follows path as it draws */}
            <AnimatePresence>
                {animationPhase !== "idle" && (
                    <motion.div
                        className="absolute"
                        initial={{
                            x: penPosition.x,
                            y: penPosition.y,
                            opacity: 0,
                            scale: 0.5
                        }}
                        animate={{
                            x: penPosition.x,
                            y: penPosition.y,
                            opacity: 1,
                            scale: animationPhase === "lift" ? 1.2 : 1
                        }}
                        exit={{
                            opacity: 0,
                            scale: 0.3,
                            y: penPosition.y - 20
                        }}
                        transition={{
                            x: { duration: 0.25, ease: "easeOut" },
                            y: { duration: 0.25, ease: "easeOut" },
                            opacity: { duration: 0.15 },
                            scale: { duration: 0.2 }
                        }}
                        style={{ zIndex: 50 }}
                    >
                        <PenCursor isWriting={isWriting} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
