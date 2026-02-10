"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DynamicAnnotationLayer, {
    type AnnotationAnchor,
} from "./DynamicAnnotationLayer";

interface VisualExplainerProps {
    imageUrl: string | null;
    activeAnchors: AnnotationAnchor[];
    isExplaining: boolean; // Whether currently doing visual explanation
    onExplainComplete: () => void; // Called when pen exits after explanation
}

// Pen Cursor for visual explanation - same as DynamicAnnotationLayer but with entry/exit animations
const ExplanationPen = ({ isWriting = false }: { isWriting?: boolean }) => (
    <motion.div
        className="absolute pointer-events-none"
        style={{
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
            animate={
                isWriting
                    ? {
                        x: [0, 0.5, -0.5, 0.3, 0],
                        y: [0, 0.3, -0.3, 0.5, 0],
                    }
                    : {}
            }
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
            <path d="M13 6L18 11" stroke="#4F46E5" strokeWidth="2" />
            {/* Pen tip ink */}
            <path
                d="M3 21L5 19"
                stroke="#4F46E5"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            {/* Extra flourish */}
            <circle cx="4" cy="20" r="1" fill="#4F46E5" />
        </motion.svg>
    </motion.div>
);

export default function VisualExplainer({
    imageUrl,
    activeAnchors,
    isExplaining,
    onExplainComplete,
}: VisualExplainerProps) {
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const [showPen, setShowPen] = useState(false);
    const [penPosition, setPenPosition] = useState({ x: -100, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [annotationComplete, setAnnotationComplete] = useState(false);
    const [isPenExiting, setIsPenExiting] = useState(false);

    // Handle explanation lifecycle
    useEffect(() => {
        if (!isExplaining || activeAnchors.length === 0) {
            setShowPen(false);
            setAnnotationComplete(false);
            setIsPenExiting(false);
            return;
        }

        // Start explanation sequence
        const startSequence = async () => {
            // Initial pen entry position (from left side)
            setPenPosition({ x: -50, y: 100 });
            setShowPen(true);
            setIsDrawing(false);

            // Wait for pen to appear
            await new Promise((r) => setTimeout(r, 300));

            // Move to first anchor position (approximate center of image)
            const containerWidth = imageContainerRef.current?.clientWidth || 400;
            const containerHeight = imageContainerRef.current?.clientHeight || 300;
            setPenPosition({
                x: containerWidth * 0.4,
                y: containerHeight * 0.4,
            });

            // Start drawing
            await new Promise((r) => setTimeout(r, 300));
            setIsDrawing(true);

            // Wait for annotation animation (based on number of anchors)
            const annotationDuration = activeAnchors.length * 1500;
            await new Promise((r) => setTimeout(r, annotationDuration));

            // Annotation complete - start pen exit
            setIsDrawing(false);
            setAnnotationComplete(true);
        };

        startSequence();
    }, [isExplaining, activeAnchors]);

    // Handle pen exit animation
    useEffect(() => {
        if (!annotationComplete) return;

        const exitSequence = async () => {
            setIsPenExiting(true);

            // Move pen down and fade out
            const containerHeight = imageContainerRef.current?.clientHeight || 300;
            setPenPosition((prev) => ({
                x: prev.x,
                y: containerHeight + 50, // Move below container
            }));

            // Wait for exit animation
            await new Promise((r) => setTimeout(r, 400));

            setShowPen(false);
            setIsPenExiting(false);

            // Notify parent that explanation is complete
            onExplainComplete();
        };

        exitSequence();
    }, [annotationComplete, onExplainComplete]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
            {/* Card container */}
            <div className="relative w-full h-full max-h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg flex items-center justify-center">
                {imageUrl ? (
                    <div
                        ref={imageContainerRef}
                        className="relative"
                        style={{
                            width: "fit-content",
                            height: "fit-content",
                            maxWidth: "100%",
                            maxHeight: "100%",
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt="Problem"
                            className="max-w-full max-h-[40vh] object-contain block"
                        />

                        {/* Annotation Layer */}
                        {activeAnchors.length > 0 && (
                            <DynamicAnnotationLayer
                                activeAnchors={activeAnchors}
                                containerRef={imageContainerRef}
                            />
                        )}

                        {/* Explanation Pen - controlled separately for entry/exit */}
                        <AnimatePresence>
                            {showPen && (
                                <motion.div
                                    className="absolute"
                                    initial={{
                                        x: -50,
                                        y: penPosition.y,
                                        opacity: 0,
                                        scale: 0.5,
                                    }}
                                    animate={{
                                        x: penPosition.x,
                                        y: penPosition.y,
                                        opacity: isPenExiting ? 0 : 1,
                                        scale: isPenExiting ? 0.3 : 1,
                                    }}
                                    exit={{
                                        opacity: 0,
                                        scale: 0.3,
                                        y: penPosition.y + 30,
                                    }}
                                    transition={{
                                        x: { duration: 0.3, ease: "easeOut" },
                                        y: { duration: 0.3, ease: "easeOut" },
                                        opacity: { duration: 0.2 },
                                        scale: { duration: 0.2 },
                                    }}
                                    style={{ zIndex: 50, pointerEvents: "none" }}
                                >
                                    <ExplanationPen isWriting={isDrawing} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ) : (
                    // Empty state
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <svg
                                className="w-8 h-8"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <span className="text-sm">题目图片区域</span>
                    </div>
                )}
            </div>
        </div>
    );
}
