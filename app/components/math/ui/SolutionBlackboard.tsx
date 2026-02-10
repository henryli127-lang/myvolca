"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Chalk Pen Cursor SVG - positioned at the tip
const ChalkPen = ({ isWriting = false }: { isWriting?: boolean }) => (
    <motion.span
        className="inline-block align-middle pointer-events-none"
        style={{
            marginLeft: "2px",
            marginBottom: "-4px",
        }}
        animate={
            isWriting
                ? {
                    x: [0, 1, -1, 0.5, 0],
                    y: [0, -1, 0.5, -0.5, 0],
                    rotate: [0, 3, -2, 4, 0],
                }
                : {}
        }
        transition={{
            duration: 0.1,
            repeat: Infinity,
            repeatType: "mirror",
        }}
    >
        <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            style={{
                filter: isWriting
                    ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                    : "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
                transform: "rotate(-45deg)",
            }}
        >
            {/* Chalk stick body */}
            <rect
                x="8"
                y="2"
                width="8"
                height="18"
                rx="2"
                fill="#F5F5DC"
                stroke="#DDD8C4"
                strokeWidth="1"
            />
            {/* Chalk tip */}
            <path
                d="M8 20 L12 24 L16 20"
                fill="#F5F5DC"
                stroke="#DDD8C4"
                strokeWidth="1"
            />
            {/* Chalk dust effect */}
            {isWriting && (
                <>
                    <circle cx="12" cy="23" r="1" fill="#F5F5DC" opacity="0.6" />
                    <circle cx="10" cy="22" r="0.5" fill="#F5F5DC" opacity="0.4" />
                    <circle cx="14" cy="22" r="0.5" fill="#F5F5DC" opacity="0.4" />
                </>
            )}
        </svg>
    </motion.span>
);

interface SolutionBlackboardProps {
    content: string; // Current step's board_content
    isWriting: boolean; // Is currently writing
    penVisible: boolean; // Is pen visible
    onWritingComplete: () => void; // Writing complete callback
    historicalSteps: string[]; // Historical step contents (dimmed)
}

export default function SolutionBlackboard({
    content,
    isWriting,
    penVisible,
    onWritingComplete,
    historicalSteps,
}: SolutionBlackboardProps) {
    const [displayedCharCount, setDisplayedCharCount] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const contentEndRef = useRef<HTMLDivElement>(null);
    const [isTyping, setIsTyping] = useState(false);

    // Typewriter effect
    useEffect(() => {
        if (!isWriting || !content) {
            return;
        }

        setDisplayedCharCount(0);
        setIsTyping(true);

        const charDelay = 50; // 50ms per character
        let currentIndex = 0;

        const typeNextChar = () => {
            if (currentIndex < content.length) {
                currentIndex++;
                setDisplayedCharCount(currentIndex);

                // Auto-scroll to bottom
                if (contentEndRef.current) {
                    contentEndRef.current.scrollIntoView({ behavior: "smooth" });
                }
            } else {
                setIsTyping(false);
                onWritingComplete();
            }
        };

        const intervalId = setInterval(typeNextChar, charDelay);

        return () => {
            clearInterval(intervalId);
        };
    }, [content, isWriting, onWritingComplete]);

    // Get displayed text (for typewriter)
    const displayedText = useMemo(() => {
        if (!content) return "";
        return content.slice(0, displayedCharCount);
    }, [content, displayedCharCount]);

    // Check if currently at a LaTeX block for syntax-aware display
    const getDisplayedContent = useMemo(() => {
        if (!content) return "";

        // For LaTeX formulas, we need to ensure complete $..$ or $$...$$ blocks
        let text = displayedText;

        // Count open $ signs to check if we're in the middle of a formula
        const dollarMatches = text.match(/\$+/g) || [];
        let openDouble = 0;
        let openSingle = 0;

        for (const match of dollarMatches) {
            if (match === "$$") {
                openDouble++;
            } else if (match === "$") {
                openSingle++;
            }
        }

        // If odd number of $$ or $, we're in an incomplete formula - don't show partial
        if (openDouble % 2 !== 0) {
            // Find last complete formula position
            const lastComplete = text.lastIndexOf("$$");
            if (lastComplete > 0) {
                const beforeLast = text.slice(0, lastComplete).lastIndexOf("$$");
                if (beforeLast >= 0) {
                    text = text.slice(0, lastComplete);
                }
            }
        }

        return text;
    }, [displayedText, content]);

    return (
        <div className="w-full h-full flex flex-col bg-[#2e3440] overflow-hidden no-scrollbar">
            {/* Content Area - Blackboard Style */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 scroll-smooth no-scrollbar"
                style={{
                    backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
                    backgroundSize: "20px 20px"
                }}
            >
                {/* Historical Steps (dimmed) */}
                {historicalSteps.map((step, index) => (
                    <div
                        key={`history-${index}`}
                        className="mb-4 text-gray-400 font-handwriting text-sm leading-relaxed"
                    >
                        <div className="flex items-start gap-2 mb-1">
                            <span className="text-gray-500 text-xs font-bold">Step {index + 1}</span>
                        </div>
                        <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                        >
                            {step}
                        </ReactMarkdown>
                    </div>
                ))}

                {/* Current Step Being Written */}
                {content && (
                    <div className="text-[#ECEFF4] font-handwriting text-base leading-relaxed tracking-wide">
                        {historicalSteps.length > 0 && (
                            <div className="flex items-start gap-2 mb-1">
                                <span className="text-yellow-200/80 text-xs font-bold">
                                    Step {historicalSteps.length + 1}
                                </span>
                            </div>
                        )}

                        {/* Flow layout container - pen follows text naturally */}
                        <div className="inline">
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    // Ensure paragraphs are inline to allow pen to follow
                                    p: ({ children }) => (
                                        <span className="inline">{children}</span>
                                    ),
                                }}
                            >
                                {getDisplayedContent}
                            </ReactMarkdown>

                            {/* Inline Pen - follows text naturally */}
                            <AnimatePresence>
                                {penVisible && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5, y: 10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChalkPen isWriting={isTyping} />
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Blinking cursor when typing */}
                        {isTyping && (
                            <motion.span
                                className="inline-block w-0.5 h-5 bg-white/70 ml-1 align-middle"
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                            />
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!content && historicalSteps.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-gray-600 font-handwriting text-lg">
                            Ready to solve...
                        </span>
                    </div>
                )}

                {/* Scroll anchor */}
                <div ref={contentEndRef} />
            </div>
        </div>
    );
}
