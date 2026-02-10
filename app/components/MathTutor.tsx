"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send,
    Mic,
    Sparkles,
    CheckCircle2,
    HelpCircle,
    Lightbulb,
    BookOpen,
    Loader2,
    Check,
    AlertTriangle,
    ChevronLeft,
} from "lucide-react";
import { Button } from "./math/ui/button";
import { Input } from "./math/ui/input";
import { Progress } from "./math/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "./math/ui/avatar";
import { Badge } from "./math/ui/badge";
import DualCanvasTutor from "./math/DualCanvasTutor";
import ChallengeReport from "./math/ChallengeReport";
import { useTutorChat, type StepStatus } from "@/hooks/use-tutor-chat";
import MathMarkdown from "./math/ui/MathMarkdown";
import type { User } from "@supabase/supabase-js";

interface MathTutorProps {
    user: User;
    userProfile: any;
    onBack: () => void;
}

export default function MathTutor({ user, userProfile, onBack }: MathTutorProps) {
    const {
        messages,
        currentStepIndex,
        problemSteps,
        isLoading,
        isAnalyzing,
        error,
        problemData,
        isComplete,
        weakPoints,
        analyzeProblem,
        sendMessage,
        sendQuickAction,
        currentGoal,
        currentKC,
        progress,
        logicMap,
        getStepLabel,
        activeAnchors,
    } = useTutorChat();

    const [inputValue, setInputValue] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showSuccessFlash, setShowSuccessFlash] = useState(false);
    const [showReport, setShowReport] = useState(false);

    // Auto-show report when challenge is complete
    useEffect(() => {
        if (isComplete && problemSteps.length > 0) {
            const timer = setTimeout(() => setShowReport(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [isComplete, problemSteps.length]);

    // Auto scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isLoading]);

    // Flash effect when step completes
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.isStepComplete) {
            setShowSuccessFlash(true);
            setTimeout(() => setShowSuccessFlash(false), 1000);
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;
        const message = inputValue;
        setInputValue("");
        await sendMessage(message);
    };

    const handleQuickAction = async (actionType: "hint" | "check" | "confused") => {
        await sendQuickAction(actionType);
    };

    const handleAnalyzeComplete = async (imageBase64: string, mimeType?: string) => {
        setImageUrl(imageBase64);
        await analyzeProblem(imageBase64, mimeType);
    };

    // Get status color for logic map
    const getStatusColor = (status: StepStatus, isWeakPoint: boolean) => {
        if (isWeakPoint) return "text-amber-600 bg-amber-50 border-amber-200";
        switch (status) {
            case "completed": return "text-emerald-600 bg-emerald-50 border-emerald-200";
            case "current": return "text-indigo-600 bg-indigo-50 border-indigo-200";
            case "pending": return "text-slate-400 bg-slate-50 border-slate-200";
        }
    };

    return (
        <div className="h-screen w-screen overflow-hidden bg-[#FFF9C4] flex flex-col no-scrollbar relative font-sans">
            {/* Decorative Stickers */}
            <div className="absolute top-20 left-10 pointer-events-none z-0 opacity-80">
                <svg width="60" height="60" viewBox="0 0 100 100" className="text-green-400 fill-current -rotate-12">
                    <path d="M20,20 L80,20 L80,30 L60,30 L60,80 L50,80 L50,30 L40,30 L40,70 Q40,80 30,80 L20,80 L20,20" />
                    <text x="50" y="80" fontSize="80" fontWeight="bold">π</text>
                </svg>
            </div>
            <div className="absolute bottom-10 right-20 pointer-events-none z-0 opacity-80">
                <span className="text-6xl -rotate-12 block">✏️</span>
            </div>
            <div className="absolute top-32 right-10 pointer-events-none z-0 opacity-60">
                <span className="text-5xl rotate-45 block">✨</span>
            </div>
            <div className="absolute bottom-40 left-5 pointer-events-none z-0 opacity-60">
                <span className="text-5xl -rotate-12 block">⭐</span>
            </div>

            {/* Header */}
            <header className="h-20 px-6 flex items-center justify-between bg-[#FFF9C4] z-10">
                <div className="flex items-center gap-3">
                    {/* Back Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onBack}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 border-2 border-slate-200 text-slate-600 text-sm font-bold shadow-sm hover:bg-white transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        返回
                    </motion.button>

                    <div className="bg-blue-400 p-2 rounded-full border-2 border-black/10">
                        <span className="text-3xl">🤖</span>
                    </div>
                    <span className="text-2xl font-black text-slate-800 tracking-tight">
                        数学家教 AI
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Progress Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#FFF59D] border-2 border-[#FBC02D] text-slate-700 text-sm font-bold shadow-[0_4px_0_#FBC02D] hover:translate-y-[2px] hover:shadow-[0_2px_0_#FBC02D] transition-all"
                    >
                        <span>📊</span>
                        Progress
                    </motion.button>
                    {/* Checkmark */}
                    <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="w-10 h-10 rounded-full bg-sky-300 border-2 border-sky-600 flex items-center justify-center shadow-[0_3px_0_#0284c7] cursor-pointer"
                    >
                        <Check className="w-5 h-5 text-white stroke-[3]" />
                    </motion.div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden p-4 pt-0 gap-6 z-10">
                {/* Left Panel - Dual Canvas */}
                <div className="w-[60%] h-full">
                    <DualCanvasTutor
                        imageUrl={imageUrl}
                        currentStep={
                            problemSteps[currentStepIndex]
                                ? {
                                    boardContent: problemSteps[currentStepIndex].board_content || "",
                                    anchors: activeAnchors,
                                }
                                : null
                        }
                        stepIndex={currentStepIndex}
                        historicalBoardContents={problemSteps
                            .slice(0, currentStepIndex)
                            .map((s) => s.board_content || "")
                            .filter(Boolean)}
                        isAnalyzing={isAnalyzing}
                        onImageUpload={handleAnalyzeComplete}
                        onClearImage={() => setImageUrl(null)}
                    />
                </div>

                {/* Right Panel - Chat & Help */}
                <div className="w-[40%] flex flex-col bg-white rounded-[2rem] border-4 border-[#FF80AB] shadow-lg overflow-hidden">
                    {/* Chat Header */}
                    <div className="px-6 py-4 bg-[#FF80AB] flex items-center gap-2">
                        <h2 className="text-xl font-black text-white tracking-wide">Chat & Help</h2>
                        <span className="text-2xl animate-bounce">💕</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="p-2 border-b border-pink-100/50 space-y-4">
                        <motion.div
                            className="relative px-4 pt-2"
                            animate={showSuccessFlash ? { scale: [1, 1.02, 1] } : {}}
                        >
                            <div className="bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                                <motion.div
                                    className="h-full bg-[#FF80AB]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                />
                            </div>
                        </motion.div>

                        {/* Current Goal Display */}
                        <div className="flex items-center justify-between px-4">
                            <div className="text-sm font-bold text-slate-500">
                                {problemSteps.length > 0 ? "Current Goal:" : "Ready to Start!"}
                            </div>
                            {problemSteps.length > 0 && (
                                <div className="px-3 py-1 bg-sky-100 text-sky-600 rounded-full text-xs font-bold border border-sky-200">
                                    Step {currentStepIndex + 1} / {problemSteps.length}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth" ref={scrollRef}>
                        {messages.length === 0 && !isAnalyzing && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="text-6xl mb-4"
                                >
                                    👋
                                </motion.div>
                                <p className="text-slate-400 font-medium">
                                    Upload a math problem to start!
                                </p>
                            </div>
                        )}

                        {/* Analyzing State */}
                        {isAnalyzing && (
                            <div className="flex justify-center py-8">
                                <div className="bg-white px-6 py-4 rounded-[2rem] border-2 border-pink-200 shadow-sm flex items-center gap-3">
                                    <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                                    <span className="text-pink-400 font-bold">Thinking super hard...</span>
                                </div>
                            </div>
                        )}

                        <AnimatePresence mode="popLayout">
                            {messages.map((message) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className={`flex gap-3 ${message.type === "student" ? "flex-row-reverse" : ""}`}
                                >
                                    {/* Avatar */}
                                    <Avatar className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden flex-shrink-0 bg-white z-10">
                                        <AvatarImage src={message.type === "ai" ? "https://api.dicebear.com/7.x/bottts/svg?seed=emilia-cute" : "https://api.dicebear.com/7.x/avataaars/svg?seed=student"} />
                                    </Avatar>

                                    {/* Bubble */}
                                    <div
                                        className={`relative max-w-[85%] px-6 py-4 text-sm font-medium shadow-sm
                        ${message.type === "ai"
                                                ? "bg-sky-50 text-slate-700 rounded-[2rem] rounded-tl-none border-2 border-sky-100"
                                                : "bg-amber-50 text-slate-700 rounded-[2rem] rounded-tr-none border-2 border-amber-100"
                                            }
                      `}
                                    >
                                        <MathMarkdown content={message.content} />
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Typing Indicator */}
                        <AnimatePresence>
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex gap-3"
                                >
                                    <Avatar className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden flex-shrink-0 bg-white z-10">
                                        <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=emilia-cute" />
                                    </Avatar>
                                    <div className="bg-sky-50 px-6 py-4 rounded-[2rem] rounded-tl-none border-2 border-sky-100 shadow-sm flex items-center gap-1">
                                        <motion.div
                                            className="w-2 h-2 bg-sky-400 rounded-full"
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                                        />
                                        <motion.div
                                            className="w-2 h-2 bg-sky-400 rounded-full"
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                                        />
                                        <motion.div
                                            className="w-2 h-2 bg-sky-400 rounded-full"
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-5 bg-slate-50/50 border-t border-slate-100 space-y-4">
                        {/* Quick Action Buttons */}
                        <div className="flex gap-3 justify-center">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleQuickAction("hint")}
                                disabled={problemSteps.length === 0 || isLoading}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-sky-600 bg-sky-100 border-b-4 border-sky-200 rounded-xl hover:bg-sky-200 transition-colors disabled:opacity-50"
                            >
                                <Lightbulb className="w-4 h-4" />
                                Hint
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleQuickAction("check")}
                                disabled={problemSteps.length === 0 || isLoading}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-600 bg-emerald-100 border-b-4 border-emerald-200 rounded-xl hover:bg-emerald-200 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Check My Step
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleQuickAction("confused")}
                                disabled={problemSteps.length === 0 || isLoading}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-pink-600 bg-pink-100 border-b-4 border-pink-200 rounded-xl hover:bg-pink-200 transition-colors disabled:opacity-50"
                            >
                                <HelpCircle className="w-4 h-4" />
                                I Don&apos;t Get It
                            </motion.button>
                        </div>

                        {/* Input Field */}
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                    placeholder="Type your answer here..."
                                    disabled={problemSteps.length === 0 || isLoading}
                                    className="h-12 rounded-2xl border-2 border-slate-200 bg-white focus:border-pink-300 focus:ring-pink-100 transition-all font-medium"
                                />
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim() || problemSteps.length === 0 || isLoading}
                                className="h-12 w-12 rounded-2xl bg-[#FF80AB] border-b-4 border-pink-600 flex items-center justify-center text-white shadow-sm hover:translate-y-[1px] hover:border-b-2 transition-all disabled:opacity-50 disabled:border-b-0"
                            >
                                <Send className="w-5 h-5" />
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Challenge Report Modal */}
            <ChallengeReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                steps={problemSteps}
                messages={messages}
                problemSubject={problemData?.subject}
                totalDifficulty={problemData?.totalDifficulty}
            />
        </div>
    );
}
