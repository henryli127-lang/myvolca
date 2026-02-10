"use client";

import React, { useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
} from "recharts";
import confetti from "canvas-confetti";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { X, Trophy, Star, Sparkles, Medal } from "lucide-react";
import type { StepWithStatus, ChatMessage } from "@/hooks/use-tutor-chat";


// Props interface
interface ChallengeReportProps {
    isOpen: boolean;
    onClose: () => void;
    steps: StepWithStatus[];
    messages: ChatMessage[];
    problemSubject?: string;
    totalDifficulty?: number;
}

// Radar chart data interface
interface RadarDataPoint {
    subject: string;
    score: number;
    fullMark: 100;
}

// Calculate performance scores based on steps and conversation
function calculateScores(
    steps: StepWithStatus[],
    messages: ChatMessage[]
): RadarDataPoint[] {
    const studentMessages = messages.filter((m) => m.type === "student");
    const totalConversationRounds = studentMessages.length;
    const completedSteps = steps.filter((s) => s.status === "completed");
    const highDifficultySteps = steps.filter((s) => s.difficulty >= 7);

    // Calculate individual scores
    const avgDifficulty = steps.reduce((sum, s) => sum + s.difficulty, 0) / steps.length || 5;
    const avgHintsUsed = steps.reduce((sum, s) => sum + s.hintsUsed, 0) / steps.length || 0;
    const completionRate = completedSteps.length / steps.length;

    // 1. 逻辑推导 - Higher if low hints and high difficulty completed
    let logicScore = 60;
    if (avgHintsUsed < 1 && avgDifficulty >= 6) logicScore += 30;
    else if (avgHintsUsed < 2) logicScore += 15;
    if (highDifficultySteps.some((s) => s.status === "completed")) logicScore += 10;
    logicScore = Math.min(100, logicScore);

    // 2. 概念理解 - Based on completion rate and difficulty
    let conceptScore = Math.round(completionRate * 70 + 30);
    if (avgDifficulty >= 7 && completionRate > 0.8) conceptScore += 10;
    conceptScore = Math.min(100, conceptScore);

    // 3. 计算准确 - Based on hints usage (fewer hints = more accurate)
    let accuracyScore = 100 - avgHintsUsed * 15;
    accuracyScore = Math.max(50, Math.min(100, accuracyScore));

    // 4. 思维韧性 - Higher if many rounds but eventually completed
    let resilienceScore = 50;
    if (totalConversationRounds >= 5 && completionRate >= 0.8) {
        resilienceScore = 85 + Math.min(15, totalConversationRounds);
    } else if (totalConversationRounds >= 3) {
        resilienceScore = 65 + totalConversationRounds * 2;
    }
    resilienceScore = Math.min(100, resilienceScore);

    // 5. 解题速度 - Based on time spent (lower time = higher score)
    const avgTimePerStep = steps.reduce((sum, s) => sum + s.timeSpent, 0) / steps.length || 0;
    let speedScore = 80;
    if (avgTimePerStep < 30000) speedScore = 95; // < 30s per step
    else if (avgTimePerStep < 60000) speedScore = 85; // < 1 min
    else if (avgTimePerStep < 120000) speedScore = 70; // < 2 min
    else speedScore = 55;

    return [
        { subject: "逻辑推导", score: logicScore, fullMark: 100 },
        { subject: "概念理解", score: conceptScore, fullMark: 100 },
        { subject: "计算准确", score: accuracyScore, fullMark: 100 },
        { subject: "思维韧性", score: resilienceScore, fullMark: 100 },
        { subject: "解题速度", score: speedScore, fullMark: 100 },
    ];
}

// Generate warm closing message
function generateClosingMessage(
    scores: RadarDataPoint[],
    steps: StepWithStatus[]
): string {
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const bestSkill = scores.reduce((a, b) => (a.score > b.score ? a : b));
    const weakPoints = steps.filter((s) => s.isWeakPoint);

    if (avgScore >= 85) {
        return `太棒了！你今天的表现非常出色 ✨ 尤其是在「${bestSkill.subject}」方面展现了很强的能力！继续保持这种探索精神，你正在成为一个真正的数学思考者～`;
    } else if (avgScore >= 70) {
        return `你做得很好呀！能看到你一步步攻克这道题，真的很为你感到骄傲 💪 你在「${bestSkill.subject}」方面特别突出，${weakPoints.length > 0 ? `「${weakPoints[0].kc}」这个知识点我们下次可以多练习一下哦～` : "继续加油！"}`;
    } else {
        return `完成挑战本身就是一种勇气！这道题确实有难度，但你坚持到了最后 🌟 每一次尝试都是成长，我们下次再来一起探索更多有趣的数学问题吧！`;
    }
}

// Get breakthrough steps (high difficulty completed steps)
function getBreakthroughSteps(steps: StepWithStatus[]): StepWithStatus[] {
    return steps
        .filter((s) => s.status === "completed" && s.difficulty >= 6)
        .sort((a, b) => b.difficulty - a.difficulty)
        .slice(0, 3);
}

export default function ChallengeReport({
    isOpen,
    onClose,
    steps,
    messages,
    problemSubject = "数学",
    totalDifficulty = 5,
}: ChallengeReportProps) {
    // Calculate scores
    const radarData = useMemo(() => calculateScores(steps, messages), [steps, messages]);
    const avgScore = useMemo(
        () => Math.round(radarData.reduce((sum, s) => sum + s.score, 0) / radarData.length),
        [radarData]
    );
    const breakthroughSteps = useMemo(() => getBreakthroughSteps(steps), [steps]);
    const closingMessage = useMemo(
        () => generateClosingMessage(radarData, steps),
        [radarData, steps]
    );

    // Confetti trigger
    const triggerConfetti = useCallback(() => {
        const duration = 3000;
        const end = Date.now() + duration;

        const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

        (function frame() {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors,
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors,
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        })();
    }, []);

    const handleSaveMedal = () => {
        triggerConfetti();
        // Could add save logic here
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-white/60 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-full max-w-4xl"
                    >
                        <Card className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl border-0 overflow-hidden">
                            {/* Header */}
                            <div className="relative px-8 py-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20"
                                    onClick={onClose}
                                >
                                    <X className="w-5 h-5" />
                                </Button>

                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Avatar className="w-16 h-16 border-4 border-white/30">
                                            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=student" />
                                            <AvatarFallback>学</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                                            <Trophy className="w-4 h-4 text-amber-800" />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold flex items-center gap-2">
                                            🎉 挑战成功！
                                        </h2>
                                        <p className="text-white/80 text-sm mt-1">
                                            {problemSubject} · 难度 {totalDifficulty}/10
                                        </p>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <div className="text-4xl font-bold">{avgScore}</div>
                                        <div className="text-white/70 text-sm">综合评分</div>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-8">
                                <div className="flex gap-8">
                                    {/* Left: Radar Chart */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-indigo-500" />
                                            能力雷达图
                                        </h3>
                                        <div className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                                                    <PolarGrid stroke="#e2e8f0" />
                                                    <PolarAngleAxis
                                                        dataKey="subject"
                                                        tick={{ fill: "#64748b", fontSize: 12 }}
                                                    />
                                                    <PolarRadiusAxis
                                                        angle={30}
                                                        domain={[0, 100]}
                                                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                                                    />
                                                    <Radar
                                                        name="得分"
                                                        dataKey="score"
                                                        stroke="#6366f1"
                                                        fill="#6366f1"
                                                        fillOpacity={0.3}
                                                        strokeWidth={2}
                                                    />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Right: Breakthrough Points */}
                                    <div className="w-72">
                                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                            <Medal className="w-5 h-5 text-amber-500" />
                                            本次突破点
                                        </h3>
                                        {breakthroughSteps.length > 0 ? (
                                            <div className="space-y-3">
                                                {breakthroughSteps.map((step) => (
                                                    <motion.div
                                                        key={step.id}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: step.id * 0.1 }}
                                                        className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                                <Star className="w-4 h-4 text-indigo-600" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-slate-800 text-sm">
                                                                    {step.goal}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="text-xs rounded-full bg-indigo-100 text-indigo-700"
                                                                    >
                                                                        {step.kc}
                                                                    </Badge>
                                                                    <span className="text-xs text-slate-500">
                                                                        难度 {step.difficulty}/10
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-slate-400">
                                                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                                <p className="text-sm">完成更多高难度步骤解锁突破点</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Closing Message */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100"
                                >
                                    <p className="text-slate-700 leading-relaxed">{closingMessage}</p>
                                </motion.div>
                            </div>

                            {/* Footer */}
                            <div className="px-8 pb-8 flex justify-center gap-4">
                                <Button
                                    variant="outline"
                                    className="rounded-full px-6"
                                    onClick={onClose}
                                >
                                    返回
                                </Button>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Button
                                        className="rounded-full px-8 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg"
                                        onClick={handleSaveMedal}
                                    >
                                        <Trophy className="w-4 h-4 mr-2" />
                                        保存勋章
                                    </Button>
                                </motion.div>
                            </div>
                        </Card>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
