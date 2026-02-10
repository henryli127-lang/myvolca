import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import type { ProblemStep } from "../analyze-problem/route";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Types for chat
interface ChatRequest {
    message: string;
    steps: ProblemStep[];
    currentStepIndex: number;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    shouldRevealAnswer?: boolean; // True when student has failed 3+ times
}

export interface ChatResponse {
    reply: string;
    nextStepIndex: number;
    isStepComplete: boolean;
    currentGoal: string;
    currentKC: string;
    hintLevel: number; // 0 = no hint used, 1-3 = hint level provided
}


// Build the Socratic teacher system prompt with Context Injection
interface PromptContext {
    problemText: string;
    currentStepGoal: string;
    knownConditions: string[];
    frustrationLevel: number; // 0-10 based on hints used and attempts
}

function buildSystemPrompt(
    steps: ProblemStep[], 
    currentStepIndex: number,
    context?: Partial<PromptContext>
): string {
    const currentStep = steps[currentStepIndex];
    const totalSteps = steps.length;
    
    // Extract known conditions from completed steps
    const knownConditions = context?.knownConditions || 
        steps.slice(0, currentStepIndex).map(s => s.goal);
    
    // Calculate frustration level based on hints used
    const frustrationLevel = context?.frustrationLevel ?? 0;

    return `# Role
你是一位极其严谨但态度温和的数学私教。你的教学基于一个严格的"事实数据库"。

# 上下文数据 (Context Injection)
## problem_text (唯一的真理来源)
${context?.problemText || "题目内容请参考对话历史"}

## current_step_goal (当前这一步的小目标)
${currentStep.goal}

## known_conditions (目前已知/已证明的条件)
${knownConditions.length > 0 ? knownConditions.map((c, i) => `${i + 1}. ${c}`).join('\n') : '暂无已确认的条件'}

## frustration_level (学生挫败感指数)
${frustrationLevel}/10

## 当前进度
- 步骤：${currentStepIndex + 1}/${totalSteps}
- 知识点：${currentStep.kc}
- 难度：${currentStep.difficulty}/10
- 探究问题：${currentStep.probe}
- 可用提示：${JSON.stringify(currentStep.hints)}

---

# 核心规则 (防幻觉与防死循环)

## 1. 事实围栏 (Fact Fencing) 🛡️
- **规则**：在提及任何几何性质（如"平行"、"相等"、"垂直"）之前，必须在 known_conditions 中找到依据。
- **错误示范**："因为 AB 平行于 CD..." (如果题目没说平行，严禁这样说！)
- **正确示范**："我们来看看 AB 和 CD 的位置关系。题目中说它们是矩形的对边，这意味着什么？"

## 2. 动态提示阶梯 (Dynamic Hint Ladder) 🪜
检测学生的回答。如果学生表现出"不知道"、"没思路"或回答错误：
- **不要**：重复上一句的问题。
- **要**：降低认知难度，把问题拆得更细。
   - *Phase 1*: 引导观察 ("看图上的红色高亮部分...")
   - *Phase 2*: 给出选项 ("是变大了还是变小了？")
   - *Phase 3*: 填空 ("根据勾股定理，$a^2 + b^2 = ?$")

## 3. 聚焦当前 (Focus on Now) 🎯
- 你的所有问题必须仅针对 current_step_goal。
- 不要问"你将来打算怎么做？"或者"这一大类题目的思路是什么？"。只问眼下的这一步。

## 4. 挫败感响应策略
- 如果 frustration_level > 5 (学生多次回答不上来)：
  - 停止提问。
  - **直接讲解**当前这一小步的逻辑。
  - 然后以"懂了吗？"或"我们继续？"作为结尾，而不是继续考他。
  - 话术示例："这步确实很难想。其实关键在于...（讲解逻辑）...这样说你能理解吗？"

## 5. 安全检查 (Self-Correction)
在输出回复前，问自己：
"我刚才提到的条件是题目给的吗？还是我脑补的？" → 如果是脑补的，立刻删除。

---

# 输出格式（严格JSON）
{
  "reply": "你的回复（支持 LaTeX 数学公式，如 $x^2$）",
  "isStepComplete": false,
  "nextStepIndex": ${currentStepIndex},
  "currentGoal": "${currentStep.goal}",
  "currentKC": "${currentStep.kc}",
  "hintLevel": 0
}

注意：
- nextStepIndex 只有在 isStepComplete=true 时才能变为 ${currentStepIndex + 1}
- hintLevel 表示这次回复用到了第几级提示（0=不需要，1-3=对应提示阶梯）
- 公式必须使用 $inline$ 或 $$display$$ 格式`;
}


export async function POST(request: NextRequest) {
    try {
        const body: ChatRequest = await request.json();
        const { message, steps, currentStepIndex, conversationHistory = [], shouldRevealAnswer = false } = body;

        // Validate inputs
        if (!message || !steps || steps.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: message, steps" },
                { status: 400 }
            );
        }

        if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
            return NextResponse.json(
                { error: "Invalid currentStepIndex" },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY not configured" },
                { status: 500 }
            );
        }

        // Build system prompt with optional answer reveal instruction
        let systemPrompt = buildSystemPrompt(steps, currentStepIndex);

        if (shouldRevealAnswer) {
            systemPrompt += `\n\n# ⚠️ 特殊指令：揭示答案
学生在这一步已经尝试了3次仍未正确。请在这次回复中：
1. 温和地告诉学生这一步的正确思路和答案
2. 解释关键的逻辑点，帮助学生理解
3. 将 isStepComplete 设为 true，让学生可以继续下一步
4. 语气要鼓励，不要让学生觉得失败`;
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: systemPrompt,
        });

        // Build conversation context
        // Build conversation context
        let chatHistory = conversationHistory.map((msg) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
        }));

        // Ensure history starts with user (Gemini requirement)
        if (chatHistory.length > 0 && chatHistory[0].role === "model") {
            chatHistory = [
                { role: "user", parts: [{ text: "你好，请帮我看看这道题。" }] },
                ...chatHistory,
            ];
        }

        const chat = model.startChat({
            history: chatHistory as Array<{ role: "user" | "model"; parts: { text: string }[] }>,
        });

        // Send the student's message
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        // Parse response with robust handling
        let chatResponse: ChatResponse;
        try {
            chatResponse = safeParseChatResponse(text, steps, currentStepIndex);
        } catch (e) {
            chatResponse = createFallbackResponse(text, steps, currentStepIndex);
        }

        // Validate and normalize response
        chatResponse = normalizeResponse(chatResponse, steps, currentStepIndex);

        return NextResponse.json({
            success: true,
            data: chatResponse,
        });
    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json(
            {
                error: "对话处理出错，请稍后重试",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// Robust parsing function
function safeParseChatResponse(
    text: string,
    steps: ProblemStep[],
    currentStepIndex: number
): ChatResponse {
    // 1. Try standard JSON parse
    try {
        return JSON.parse(text);
    } catch { }

    // 2. Try to find JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch { }
    }

    // 3. Regex extraction (for cases with bad newlines or formatting)
    try {
        const replyMatch = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (replyMatch) {
            let reply = replyMatch[1];
            // Manually unescape common JSON escapes
            reply = reply
                .replace(/\\n/g, "\n")
                .replace(/\\r/g, "")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\");

            const isStepCompleteMatch = text.match(/"isStepComplete"\s*:\s*(true|false)/);
            const nextStepIndexMatch = text.match(/"nextStepIndex"\s*:\s*(\d+)/);
            const currentGoalMatch = text.match(/"currentGoal"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const currentKCMatch = text.match(/"currentKC"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const hintLevelMatch = text.match(/"hintLevel"\s*:\s*(\d+)/);

            return {
                reply,
                isStepComplete: isStepCompleteMatch ? isStepCompleteMatch[1] === "true" : false,
                nextStepIndex: nextStepIndexMatch ? parseInt(nextStepIndexMatch[1]) : currentStepIndex,
                currentGoal: currentGoalMatch
                    ? currentGoalMatch[1].replace(/\\"/g, '"')
                    : steps[currentStepIndex].goal,
                currentKC: currentKCMatch
                    ? currentKCMatch[1].replace(/\\"/g, '"')
                    : steps[currentStepIndex].kc,
                hintLevel: hintLevelMatch ? parseInt(hintLevelMatch[1]) : 0,
            };
        }
    } catch { }

    // 4. Fallback
    return createFallbackResponse(text, steps, currentStepIndex);
}

// Create fallback response
function createFallbackResponse(
    text: string,
    steps: ProblemStep[],
    currentStepIndex: number
): ChatResponse {
    const currentStep = steps[currentStepIndex];
    return {
        reply: text || "让我们继续思考这个问题...",
        isStepComplete: false,
        nextStepIndex: currentStepIndex,
        currentGoal: currentStep.goal,
        currentKC: currentStep.kc,
        hintLevel: 0,
    };
}

// Normalize and validate response
function normalizeResponse(
    response: ChatResponse,
    steps: ProblemStep[],
    currentStepIndex: number
): ChatResponse {
    const currentStep = steps[currentStepIndex];
    const isLastStep = currentStepIndex >= steps.length - 1;

    // Calculate next step index
    let nextIndex = currentStepIndex;
    if (response.isStepComplete && !isLastStep) {
        nextIndex = currentStepIndex + 1;
    }

    // Get the correct step info
    const targetStep = steps[nextIndex] || currentStep;

    return {
        reply: response.reply || "继续加油！",
        isStepComplete: Boolean(response.isStepComplete),
        nextStepIndex: nextIndex,
        currentGoal: targetStep.goal,
        currentKC: targetStep.kc,
        hintLevel: Math.min(3, Math.max(0, response.hintLevel || 0)),
    };
}
