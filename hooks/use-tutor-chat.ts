"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalyzedProblem, ProblemStep } from "@/app/api/analyze-problem/route";
import type { ChatResponse } from "@/app/api/math-chat/route";
import type { AnnotationAnchor } from "@/app/components/math/ui/DynamicAnnotationLayer";

// Message type for the chat
export interface ChatMessage {
    id: string;
    type: "ai" | "student";
    content: string;
    timestamp: Date;
    isStepComplete?: boolean;
    stepIndex?: number;
}

// Step status for Logic Map
export type StepStatus = "completed" | "current" | "pending";

export interface StepWithStatus extends ProblemStep {
    status: StepStatus;
    timeSpent: number; // milliseconds spent on this step
    hintsUsed: number; // number of hints used
    isWeakPoint: boolean; // flagged as weak point
    attempts: number; // number of Q&A attempts on this step
}

// Weak point threshold (seconds at difficulty level)
const WEAK_POINT_THRESHOLD_BASE = 60000; // 60 seconds for difficulty 1
const WEAK_POINT_MULTIPLIER = 0.8; // Lower threshold for higher difficulty

// Hook state
interface TutorChatState {
    messages: ChatMessage[];
    problemSteps: StepWithStatus[];
    currentStepIndex: number;
    isLoading: boolean;
    isAnalyzing: boolean;
    error: string | null;
    problemData: AnalyzedProblem | null;
    isComplete: boolean;
    weakPoints: Array<{ kc: string; stepId: number }>;
    activeAnchors: AnnotationAnchor[];
}

// Hook return type
interface UseTutorChatReturn extends TutorChatState {
    analyzeProblem: (imageBase64: string, mimeType?: string) => Promise<boolean>;
    sendMessage: (message: string) => Promise<void>;
    sendQuickAction: (actionType: "hint" | "check" | "confused") => Promise<void>;
    reset: () => void;
    currentGoal: string;
    currentKC: string;
    progress: number;
    logicMap: StepWithStatus[];
    getStepLabel: (status: StepStatus) => string;
    setActiveAnchors: (anchors: AnnotationAnchor[]) => void;
}

const INITIAL_STATE: TutorChatState = {
    messages: [],
    problemSteps: [],
    currentStepIndex: 0,
    isLoading: false,
    isAnalyzing: false,
    error: null,
    problemData: null,
    isComplete: false,
    weakPoints: [],
    activeAnchors: [],
};

export function useTutorChat(): UseTutorChatReturn {
    const [state, setState] = useState<TutorChatState>(INITIAL_STATE);
    const conversationHistoryRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
    const stepStartTimeRef = useRef<number>(Date.now());

    // Track time spent when step changes
    useEffect(() => {
        stepStartTimeRef.current = Date.now();
    }, [state.currentStepIndex]);

    // Auto-sync visual anchors from current step
    useEffect(() => {
        const currentStep = state.problemSteps[state.currentStepIndex];
        console.log("[DEBUG] useEffect sync - currentStep:", currentStep);
        console.log("[DEBUG] useEffect sync - visual_anchor:", currentStep?.visual_anchor);

        if (currentStep?.visual_anchor && currentStep.visual_anchor.length > 0) {
            // Convert API format to AnnotationAnchor format
            const anchors: AnnotationAnchor[] = currentStep.visual_anchor.map((va, idx) => ({
                id: `step-${state.currentStepIndex}-anchor-${idx}`,
                x: va.x,
                y: va.y,
                width: va.w,
                height: va.h,
                label: va.label,
            }));
            console.log("[DEBUG] Setting activeAnchors:", anchors);
            setState(prev => ({ ...prev, activeAnchors: anchors }));
        } else {
            console.log("[DEBUG] No visual_anchor found, clearing activeAnchors");
            setState(prev => ({ ...prev, activeAnchors: [] }));
        }
    }, [state.currentStepIndex, state.problemSteps]);

    // Analyze a problem image
    const analyzeProblem = useCallback(async (imageBase64: string, mimeType = "image/jpeg"): Promise<boolean> => {
        setState((prev) => ({ ...prev, isAnalyzing: true, error: null }));

        try {
            const response = await fetch("/api/analyze-problem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64, mimeType }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "分析题目失败");
            }

            const problem: AnalyzedProblem = data.data;

            // Debug: Log raw API response to check visual_anchor
            console.log("[DEBUG] API Response - steps:", problem.steps);
            console.log("[DEBUG] First step visual_anchor:", problem.steps[0]?.visual_anchor);

            // Convert steps to StepWithStatus
            const stepsWithStatus: StepWithStatus[] = problem.steps.map((step, index) => ({
                ...step,
                status: index === 0 ? "current" : "pending",
                timeSpent: 0,
                hintsUsed: 0,
                isWeakPoint: false,
                attempts: 0,
            }));

            // Create initial AI message with the first probe
            const firstStep = stepsWithStatus[0];
            const difficultyLabel = problem.totalDifficulty <= 3 ? "基础"
                : problem.totalDifficulty <= 7 ? "进阶" : "挑战";

            const initialMessage: ChatMessage = {
                id: Date.now().toString(),
                type: "ai",
                content: `我已经分析好这道题啦！这是一道「${problem.subject}」的${difficultyLabel}题 (难度 ${problem.totalDifficulty}/10) 📚\n\n让我们分 ${problem.steps.length} 步来解决它～\n\n🎯 第一步目标：${firstStep.goal}\n\n${firstStep.probe}`,
                timestamp: new Date(),
                stepIndex: 0,
            };

            conversationHistoryRef.current = [
                { role: "assistant", content: initialMessage.content },
            ];

            stepStartTimeRef.current = Date.now();

            setState((prev) => ({
                ...prev,
                isAnalyzing: false,
                problemData: problem,
                problemSteps: stepsWithStatus,
                currentStepIndex: 0,
                messages: [initialMessage],
                isComplete: false,
                weakPoints: [],
            }));

            return true;
        } catch (error) {
            setState((prev) => ({
                ...prev,
                isAnalyzing: false,
                error: error instanceof Error ? error.message : "分析题目时出错",
            }));
            return false;
        }
    }, []);

    // Check and update weak points
    const checkWeakPoint = useCallback((stepIndex: number, timeSpent: number, hintsUsed: number) => {
        const step = state.problemSteps[stepIndex];
        if (!step) return false;

        // Calculate threshold based on difficulty (higher difficulty = lower threshold)
        const threshold = WEAK_POINT_THRESHOLD_BASE * (1 - (step.difficulty - 1) * 0.05);

        // Flag as weak point if time exceeded or too many hints used
        const isWeak = timeSpent > threshold * WEAK_POINT_MULTIPLIER || hintsUsed >= 2;

        return isWeak;
    }, [state.problemSteps]);

    // Send a message to the chat
    const sendMessage = useCallback(async (message: string) => {
        if (!message.trim() || state.problemSteps.length === 0) return;

        // Calculate time spent so far
        const timeSpent = Date.now() - stepStartTimeRef.current;

        // Add student message
        const studentMessage: ChatMessage = {
            id: Date.now().toString(),
            type: "student",
            content: message,
            timestamp: new Date(),
            stepIndex: state.currentStepIndex,
        };

        setState((prev) => ({
            ...prev,
            messages: [...prev.messages, studentMessage],
            isLoading: true,
            error: null,
        }));

        conversationHistoryRef.current.push({
            role: "user",
            content: message,
        });

        try {
            // Check if we should reveal answer (after 3 failed attempts)
            const currentStep = state.problemSteps[state.currentStepIndex];
            const shouldRevealAnswer = currentStep.attempts >= 3;

            const response = await fetch("/api/math-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message,
                    steps: state.problemSteps,
                    currentStepIndex: state.currentStepIndex,
                    conversationHistory: conversationHistoryRef.current,
                    shouldRevealAnswer, // Pass flag to API
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "发送消息失败");
            }

            const chatResponse: ChatResponse = data.data;

            // Update step status
            const updatedSteps = state.problemSteps.map((step, idx) => {
                if (idx < chatResponse.nextStepIndex) {
                    // Step completed - reset attempts
                    return { ...step, status: "completed" as StepStatus, attempts: 0 };
                } else if (idx === chatResponse.nextStepIndex) {
                    const newTimeSpent = idx === state.currentStepIndex ? step.timeSpent + timeSpent : 0;
                    const isWeak = checkWeakPoint(idx, newTimeSpent, step.hintsUsed + chatResponse.hintLevel);
                    // If still on same step and not complete, increment attempts
                    const newAttempts = (idx === state.currentStepIndex && !chatResponse.isStepComplete)
                        ? step.attempts + 1
                        : (idx === state.currentStepIndex ? step.attempts : 0);
                    return {
                        ...step,
                        status: "current" as StepStatus,
                        timeSpent: newTimeSpent,
                        hintsUsed: step.hintsUsed + (chatResponse.hintLevel > 0 ? 1 : 0),
                        isWeakPoint: isWeak,
                        attempts: newAttempts,
                    };
                }
                return { ...step, status: "pending" as StepStatus };
            });

            // Track weak points
            const newWeakPoints = [...state.weakPoints];
            if (chatResponse.isStepComplete) {
                const completedStep = state.problemSteps[state.currentStepIndex];
                const finalTimeSpent = timeSpent + (completedStep?.timeSpent || 0);
                if (checkWeakPoint(state.currentStepIndex, finalTimeSpent, completedStep?.hintsUsed || 0)) {
                    if (!newWeakPoints.find(wp => wp.stepId === completedStep.id)) {
                        newWeakPoints.push({ kc: completedStep.kc, stepId: completedStep.id });
                    }
                }
            }

            // Create AI response message
            const aiMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: "ai",
                content: chatResponse.reply,
                timestamp: new Date(),
                isStepComplete: chatResponse.isStepComplete,
                stepIndex: chatResponse.nextStepIndex,
            };

            // Add next step message if moved forward
            let nextStepMessage: ChatMessage | null = null;
            if (chatResponse.isStepComplete && chatResponse.nextStepIndex > state.currentStepIndex) {
                const nextStep = state.problemSteps[chatResponse.nextStepIndex];
                if (nextStep) {
                    nextStepMessage = {
                        id: (Date.now() + 2).toString(),
                        type: "ai",
                        content: `很棒！进入下一步 🎯\n\n**目标：${nextStep.goal}**\n\n${nextStep.probe}`,
                        timestamp: new Date(),
                        stepIndex: chatResponse.nextStepIndex,
                    };
                    // Reset step timer
                    stepStartTimeRef.current = Date.now();
                }
            }

            conversationHistoryRef.current.push({
                role: "assistant",
                content: chatResponse.reply + (nextStepMessage ? "\n" + nextStepMessage.content : ""),
            });

            const isComplete = chatResponse.nextStepIndex >= state.problemSteps.length - 1 && chatResponse.isStepComplete;

            setState((prev) => ({
                ...prev,
                isLoading: false,
                messages: [
                    ...prev.messages,
                    aiMessage,
                    ...(nextStepMessage ? [nextStepMessage] : []),
                ],
                problemSteps: updatedSteps,
                currentStepIndex: chatResponse.nextStepIndex,
                isComplete,
                weakPoints: newWeakPoints,
            }));
        } catch (error) {
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : "发送消息时出错",
            }));
        }
    }, [state.problemSteps, state.currentStepIndex, state.weakPoints, checkWeakPoint]);

    // Send quick action
    const sendQuickAction = useCallback(async (actionType: "hint" | "check" | "confused") => {
        const currentStep = state.problemSteps[state.currentStepIndex];
        if (!currentStep) return;

        const actionMessages = {
            hint: `我在这一步有点卡住了，能给我一点思路吗？（当前目标：${currentStep.goal}）`,
            check: `我想到了一些思路，你能帮我检查一下对不对？`,
            confused: `这一步我有点没看懂，${currentStep.probe} 这个问题是什么意思？`,
        };

        await sendMessage(actionMessages[actionType]);
    }, [state.problemSteps, state.currentStepIndex, sendMessage]);

    // Reset the chat
    const reset = useCallback(() => {
        conversationHistoryRef.current = [];
        stepStartTimeRef.current = Date.now();
        setState(INITIAL_STATE);
    }, []);

    // Get step label for display
    const getStepLabel = useCallback((status: StepStatus): string => {
        switch (status) {
            case "completed": return "已突破 ✓";
            case "current": return "正在挑战";
            case "pending": return "未开始";
        }
    }, []);

    // Computed properties
    const currentStep = state.problemSteps[state.currentStepIndex];
    const currentGoal = currentStep?.goal || "等待上传题目...";
    const currentKC = currentStep?.kc || "";
    const progress = state.problemSteps.length > 0
        ? ((state.currentStepIndex + (state.isComplete ? 1 : 0)) / state.problemSteps.length) * 100
        : 0;

    // Set active anchors for annotation layer
    const setActiveAnchors = useCallback((anchors: AnnotationAnchor[]) => {
        setState(prev => ({ ...prev, activeAnchors: anchors }));
    }, []);

    return {
        ...state,
        analyzeProblem,
        sendMessage,
        sendQuickAction,
        reset,
        currentGoal,
        currentKC,
        progress,
        logicMap: state.problemSteps,
        getStepLabel,
        setActiveAnchors,
    };
}
