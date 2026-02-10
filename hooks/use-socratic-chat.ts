"use client";

import { useState, useCallback, useRef } from "react";
import type { AnalyzedProblem, ProblemStep } from "@/app/api/analyze-problem/route";

// Message type for the chat
export interface ChatMessage {
    id: string;
    type: "ai" | "student";
    content: string;
    timestamp: Date;
    isStepComplete?: boolean;
}

// Hook state
interface SocraticChatState {
    messages: ChatMessage[];
    problemSteps: ProblemStep[];
    currentStepIndex: number;
    isLoading: boolean;
    isAnalyzing: boolean;
    error: string | null;
    problemData: AnalyzedProblem | null;
    isComplete: boolean;
}

// Hook return type
interface UseSocraticChatReturn extends SocraticChatState {
    analyzeProblem: (imageBase64: string, mimeType?: string) => Promise<boolean>;
    sendMessage: (message: string) => Promise<void>;
    reset: () => void;
    currentGoal: string;
    progress: number;
}

const INITIAL_STATE: SocraticChatState = {
    messages: [],
    problemSteps: [],
    currentStepIndex: 0,
    isLoading: false,
    isAnalyzing: false,
    error: null,
    problemData: null,
    isComplete: false,
};

export function useSocraticChat(): UseSocraticChatReturn {
    const [state, setState] = useState<SocraticChatState>(INITIAL_STATE);
    const conversationHistoryRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);

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

            // Create initial AI message with the first probe
            const firstStep = problem.steps[0];
            const difficultyLabel = problem.totalDifficulty <= 3 ? "基础" : problem.totalDifficulty <= 7 ? "中等" : "挑战";
            const initialMessage: ChatMessage = {
                id: Date.now().toString(),
                type: "ai",
                content: `我已经理解了这道题！这是一道关于「${problem.subject}」的${difficultyLabel}题。\n\n让我们一步步来解决它 🎯\n\n首先，${firstStep.probe}`,
                timestamp: new Date(),
            };

            conversationHistoryRef.current = [
                { role: "assistant", content: initialMessage.content },
            ];

            setState((prev) => ({
                ...prev,
                isAnalyzing: false,
                problemData: problem,
                problemSteps: problem.steps,
                currentStepIndex: 0,
                messages: [initialMessage],
                isComplete: false,
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

    // Send a message to the chat
    const sendMessage = useCallback(async (message: string) => {
        if (!message.trim() || state.problemSteps.length === 0) return;

        // Add student message
        const studentMessage: ChatMessage = {
            id: Date.now().toString(),
            type: "student",
            content: message,
            timestamp: new Date(),
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
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message,
                    steps: state.problemSteps,
                    currentStepIndex: state.currentStepIndex,
                    conversationHistory: conversationHistoryRef.current,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "发送消息失败");
            }

            const chatResponse = data.data;

            // Create AI response message
            const aiMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: "ai",
                content: chatResponse.reply,
                timestamp: new Date(),
                isStepComplete: chatResponse.isStepComplete,
            };

            // If step is complete and there's a next step, add a follow-up message
            let nextStepMessage: ChatMessage | null = null;
            if (chatResponse.isStepComplete && chatResponse.nextStepIndex > state.currentStepIndex) {
                const nextStep = state.problemSteps[chatResponse.nextStepIndex];
                if (nextStep) {
                    nextStepMessage = {
                        id: (Date.now() + 2).toString(),
                        type: "ai",
                        content: `接下来，让我们进入下一步：${nextStep.probe}`,
                        timestamp: new Date(),
                    };
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
                currentStepIndex: chatResponse.nextStepIndex,
                isComplete,
            }));
        } catch (error) {
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : "发送消息时出错",
            }));
        }
    }, [state.problemSteps, state.currentStepIndex]);

    // Reset the chat
    const reset = useCallback(() => {
        conversationHistoryRef.current = [];
        setState(INITIAL_STATE);
    }, []);

    // Computed properties
    const currentGoal = state.problemSteps[state.currentStepIndex]?.goal || "等待上传题目...";
    const progress = state.problemSteps.length > 0
        ? ((state.currentStepIndex + (state.isComplete ? 1 : 0)) / state.problemSteps.length) * 100
        : 0;

    return {
        ...state,
        analyzeProblem,
        sendMessage,
        reset,
        currentGoal,
        progress,
    };
}
