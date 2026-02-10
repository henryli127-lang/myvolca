"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import VisualExplainer from "./ui/VisualExplainer";
import SolutionBlackboard from "./ui/SolutionBlackboard";
import type { AnnotationAnchor } from "./ui/DynamicAnnotationLayer";

// Animation phases for the dual-pen relay
type AnimationPhase =
    | "idle"
    | "visual_explaining"
    | "handover"
    | "board_writing"
    | "waiting";

interface StepData {
    boardContent: string;
    anchors: AnnotationAnchor[];
}

interface DualCanvasTutorProps {
    imageUrl: string | null;
    currentStep: StepData | null;
    stepIndex: number;
    historicalBoardContents: string[];
    onStepComplete?: () => void;
    // For image upload
    onImageUpload?: (imageBase64: string, mimeType?: string) => void;
    onClearImage?: () => void;
    isAnalyzing?: boolean;
}

export default function DualCanvasTutor({
    imageUrl,
    currentStep,
    stepIndex,
    historicalBoardContents,
    onStepComplete,
    onImageUpload,
    onClearImage,
    isAnalyzing = false,
}: DualCanvasTutorProps) {
    const [phase, setPhase] = useState<AnimationPhase>("idle");
    const [boardPenVisible, setBoardPenVisible] = useState(false);
    const [isBoardWriting, setIsBoardWriting] = useState(false);
    const [lastProcessedStep, setLastProcessedStep] = useState(-1);

    // Debug logging
    useEffect(() => {
        console.log("[DualCanvasTutor] Props Update:", {
            hasImageUrl: !!imageUrl,
            currentStep: currentStep ? {
                boardContent: currentStep.boardContent?.slice(0, 50) + "...",
                anchorsCount: currentStep.anchors?.length || 0,
            } : null,
            stepIndex,
            lastProcessedStep,
            phase,
            historicalCount: historicalBoardContents.length,
        });
    }, [imageUrl, currentStep, stepIndex, lastProcessedStep, phase, historicalBoardContents]);

    // Start animation sequence when step changes
    useEffect(() => {
        console.log("[DualCanvasTutor] Animation Check:", {
            hasCurrentStep: !!currentStep,
            stepIndex,
            lastProcessedStep,
            shouldTrigger: currentStep && stepIndex !== lastProcessedStep,
        });

        if (!currentStep || stepIndex === lastProcessedStep) {
            return;
        }

        // New step - start the relay animation
        const startStepAnimation = async () => {
            console.log("[DualCanvasTutor] Starting animation for step:", stepIndex);
            setLastProcessedStep(stepIndex);

            // Phase 1: Visual Explaining (if there are anchors)
            if (currentStep.anchors && currentStep.anchors.length > 0) {
                console.log("[DualCanvasTutor] Phase: visual_explaining (anchors:", currentStep.anchors.length, ")");
                setPhase("visual_explaining");
                setBoardPenVisible(false);
                setIsBoardWriting(false);
                // Wait for visual explanation to complete (handled by callback)
            } else {
                // No anchors - skip to board writing
                console.log("[DualCanvasTutor] No anchors, skipping directly to board writing");
                handleExplainComplete();
            }
        };

        startStepAnimation();
    }, [currentStep, stepIndex, lastProcessedStep]);

    // Handle when visual explanation completes
    const handleExplainComplete = useCallback(() => {
        console.log("[DualCanvasTutor] handleExplainComplete called - transitioning to handover");
        // Phase 2: Handover - brief pause
        setPhase("handover");

        setTimeout(() => {
            // Phase 3: Board Writing
            console.log("[DualCanvasTutor] Handover complete - starting board_writing");
            setPhase("board_writing");
            setBoardPenVisible(true);
            setIsBoardWriting(true);
        }, 300); // 300ms handover delay
    }, []);

    // Handle when board writing completes
    const handleWritingComplete = useCallback(() => {
        console.log("[DualCanvasTutor] handleWritingComplete called - transitioning to waiting");
        // Phase 4: Waiting for user interaction
        setPhase("waiting");
        setIsBoardWriting(false);
        // Keep pen visible but static

        // Notify parent
        if (onStepComplete) {
            onStepComplete();
        }
    }, [onStepComplete]);

    // Reset when no step
    useEffect(() => {
        if (!currentStep) {
            setPhase("idle");
            setBoardPenVisible(false);
            setIsBoardWriting(false);
        }
    }, [currentStep]);

    return (
        <div className="w-full h-full flex flex-col gap-4 overflow-hidden">
            {/* Top Section: Math Problem Zone */}
            <div className="h-1/2 flex flex-col bg-white rounded-[2rem] border-4 border-[#FF80AB] shadow-sm overflow-hidden z-10">
                {/* Pink Header */}
                <div className="px-6 py-2 bg-[#FF80AB] flex items-center justify-between">
                    <h3 className="text-white font-black text-lg tracking-wide">Math Problem Zone</h3>
                    <span className="text-xl">🌸</span>
                </div>

                {/* Image Area */}
                <motion.div
                    className="flex-1 relative overflow-hidden"
                    initial={false}
                    animate={{
                        opacity: isAnalyzing ? 0.7 : 1,
                    }}
                >
                    {!imageUrl ? (
                        // Image Upload Area
                        <ImageUploadArea
                            onUpload={onImageUpload}
                            isAnalyzing={isAnalyzing}
                        />
                    ) : (
                        <VisualExplainer
                            imageUrl={imageUrl}
                            activeAnchors={
                                // Keep anchors visible during and after explanation (handover, board_writing, waiting)
                                // Only clear when idle (no step) or when explicitly cleared
                                phase !== "idle" ? currentStep?.anchors || [] : []
                            }
                            isExplaining={phase === "visual_explaining"}
                            onExplainComplete={handleExplainComplete}
                        />
                    )}

                    {/* Clear Image Button */}
                    {imageUrl && !isAnalyzing && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onClearImage}
                            className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-white rounded-full text-slate-500 hover:text-red-500 shadow-sm border border-slate-200 z-30 transition-colors"
                            title="Clear Image"
                        >
                            <X className="w-4 h-4" />
                        </motion.button>
                    )}

                    {/* Scanning overlay - constrained to image area only */}
                    <AnimatePresence>
                        {isAnalyzing && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 pointer-events-none"
                            >
                                <motion.div
                                    className="absolute left-0 w-full h-1 bg-pink-500 shadow-[0_0_15px_2px_rgba(236,72,153,0.8)]"
                                    initial={{ top: "0%" }}
                                    animate={{ top: "100%" }}
                                    transition={{
                                        duration: 1.8,
                                        repeat: Infinity,
                                        ease: "linear",
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Center Robot Sticker */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                <motion.div
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="w-24 h-24 drop-shadow-xl"
                >
                    {/* Robot with Party Hat SVG/Emoji */}
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=party-robot" alt="Cute Robot" className="w-full h-full" />
                </motion.div>
            </div>

            {/* Bottom Section: Sketchpad */}
            <div className="h-1/2 flex flex-col bg-white rounded-[2rem] border-4 border-[#FF80AB] shadow-sm overflow-hidden z-10">
                {/* Pink Header */}
                <div className="px-6 py-2 bg-[#FF80AB] flex items-center justify-between">
                    <h3 className="text-white font-black text-lg tracking-wide">Sketchpad</h3>
                    <div className="flex items-center gap-2">
                        {currentStep && (
                            <span className="bg-white/20 px-3 py-0.5 rounded-full text-white text-xs font-bold">Step {stepIndex + 1}</span>
                        )}
                        <span className="text-xl">✏️</span>
                    </div>
                </div>

                {/* Sketchpad Content */}
                <motion.div
                    className="flex-1 overflow-hidden"
                    initial={false}
                    animate={{
                        opacity: phase === "idle" && !currentStep ? 0.6 : 1,
                    }}
                >
                    <SolutionBlackboard
                        content={currentStep?.boardContent || ""}
                        isWriting={isBoardWriting}
                        penVisible={boardPenVisible}
                        onWritingComplete={handleWritingComplete}
                        historicalSteps={historicalBoardContents}
                    />
                </motion.div>
            </div>
        </div>
    );
}

// Image Upload Sub-component
interface ImageUploadAreaProps {
    onUpload?: (imageBase64: string, mimeType?: string) => void;
    isAnalyzing: boolean;
}

function ImageUploadArea({ onUpload, isAnalyzing }: ImageUploadAreaProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isConverting, setIsConverting] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUpload) return;

        setIsConverting(true);
        let processedFile = file;

        // HEIC conversion logic
        if (
            file.type === "image/heic" ||
            file.type === "image/heif" ||
            file.name.toLowerCase().endsWith(".heic") ||
            file.name.toLowerCase().endsWith(".heif")
        ) {
            try {
                const heic2any = (await import("heic2any")).default;
                const convertedBlob = await heic2any({
                    blob: file,
                    toType: "image/jpeg",
                    quality: 0.8,
                });
                const blob = Array.isArray(convertedBlob)
                    ? convertedBlob[0]
                    : convertedBlob;
                processedFile = new File(
                    [blob],
                    file.name.replace(/\.heic$/i, ".jpg"),
                    { type: "image/jpeg" }
                );
            } catch (error) {
                console.warn("HEIC conversion failed:", error);
            }
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setIsConverting(false);
            onUpload(base64, processedFile.type);
        };
        reader.readAsDataURL(processedFile);
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-4">
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full max-w-md aspect-[4/3] rounded-xl border-2 border-dashed border-slate-300 bg-white shadow-lg flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors hover:border-indigo-400 hover:bg-indigo-50/30"
                onClick={() => fileInputRef.current?.click()}
            >
                {isConverting || isAnalyzing ? (
                    <div className="flex flex-col items-center gap-3">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full"
                        />
                        <span className="text-sm text-slate-500">
                            {isConverting ? "处理图片中..." : "分析题目中..."}
                        </span>
                    </div>
                ) : (
                    <>
                        <div className="p-4 rounded-full bg-indigo-50 text-indigo-500">
                            <svg
                                className="w-10 h-10"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium text-slate-700">
                                点击或拖拽上传题目照片
                            </p>
                            <p className="text-sm text-slate-500">支持 HEIC, JPG, PNG 格式</p>
                        </div>
                    </>
                )}
            </motion.div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/*"
            />
        </div>
    );
}
