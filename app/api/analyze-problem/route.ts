import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import {
    detectTextAnchors,
    formatVisualMapForLLM,
    lookupBoxesByIds,
    type VisualMapItem
} from "@/lib/google-vision";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Types for structured output
export interface VisualAnchor {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
}

export interface ProblemStep {
    id: number;
    goal: string;
    kc: string;
    difficulty: number;
    visual_anchor?: VisualAnchor[];
    related_ids?: string[]; // OCR element IDs from Gemini
    probe: string;
    hints: string[];
    board_content?: string; // Blackboard-style logical derivation (LaTeX supported)
}

export interface AnalyzedProblem {
    problemText: string;
    subject: string;
    totalDifficulty: number;
    steps: ProblemStep[];
    calibration_box?: {
        figure_area: { x: number; y: number; w: number; h: number };
        text_area: { x: number; y: number; w: number; h: number };
    };
}

// Gemini prompt for OCR-assisted mode
const OCR_ASSISTED_PROMPT = `# Role
你是一位资深数学教育专家，擅长将复杂题目拆解为逻辑步骤，并能像优秀的数学老师一样在黑板上书写清晰的推导过程。

# Context
我已经使用 OCR 技术预先识别了图片中所有文字元素的精确坐标。你不需要猜测坐标，只需要从 Visual Map 中选择**最关键**的元素。

# Visual Map (OCR Results)
以下是图片中检测到的文字元素及其位置：
\`\`\`json
{{VISUAL_MAP}}
\`\`\`

# Task
1. 分析题目逻辑，拆解为 3-5 个步骤
2. 对于每个步骤，从 Visual Map 中**只选择 5-6 个最关键的元素**
3. 在 related_ids 字段中返回这些 ID
4. 为每个步骤生成 board_content（黑板板书内容）

# ⚠️ 重要限制
- **每个步骤最多选择 6 个元素 ID**！不要选择太多
- 优先选择：关键数值（如 120°）、重要条件（如 BE=BC）、几何标签（如 A、B、C）
- 不要选择：普通文字、标点符号、重复内容

# board_content 字段说明
这是老师在黑板上写下的解题步骤，用于展示逻辑推导过程。

**格式要求**：
- 必须简洁、逻辑清晰，像数学老师的板书一样
- 必须使用 LaTeX 格式包裹公式（例如 $\\triangle ABC$, $\\angle BAC = 60°$）
- 使用 \\n 表示换行
- 重点结论可以使用 \\boxed{} 高亮

**与 visual_anchor 的区别**：
- visual_anchor / related_ids：告诉学生"看图上的哪里"
- board_content：告诉学生"脑子里的逻辑推导过程"

**示例**：
"由于 $\\triangle ACD$ 是等边三角形\\n$\\therefore AC = CD = AD$ (等边三角形性质)\\n$\\therefore \\angle CAD = 60°$"

# Output Format (JSON)
\`\`\`json
{
  "problemText": "完整题目描述",
  "subject": "知识点分类",
  "totalDifficulty": 6,
  "steps": [
    {
      "id": 1,
      "goal": "步骤目标",
      "kc": "涉及知识点",
      "difficulty": 3,
      "related_ids": ["txt_5", "txt_12"],
      "board_content": "由于 $\\\\triangle ABC$ 中 $\\\\angle BAC = 120°$\\\\n结合等边三角形性质...",
      "probe": "启发式提问",
      "hints": ["提示1", "提示2", "提示3"]
    }
  ]
}
\`\`\`

# Rules
- related_ids 必须是 Visual Map 中存在的 ID
- **每个步骤 2-3 个 ID，绝对不要超过 6 个！**
- board_content 必须包含该步骤的核心推导逻辑
- 优先选择数值和公式，而不是普通文字`;

// Fallback prompt when OCR is not available
const FALLBACK_PROMPT = `# Role
你是一位精通计算机视觉与空间几何的数学教育专家。

# Task
分析题目图片，将解题思路拆解成 3-5 个步骤。每个步骤需要包含板书内容（board_content）来展示逻辑推导过程。

# board_content 格式说明
- 必须使用 LaTeX 格式包裹公式（如 $\\triangle ABC$）
- 使用 \\n 表示换行
- 像数学老师在黑板上书写一样简洁清晰

# Output Format
严格按照以下 JSON 格式输出：

{
  "problemText": "完整题目描述",
  "subject": "知识点分类",
  "totalDifficulty": 6,
  "steps": [
    {
      "id": 1,
      "goal": "步骤目标",
      "kc": "涉及知识点",
      "difficulty": 3,
      "visual_anchor": [
        { "x": 100, "y": 80, "w": 200, "h": 30, "label": "关键条件" }
      ],
      "board_content": "由于 $\\\\triangle ABC$ 是等边三角形\\\\n$\\\\therefore AB = BC = AC$",
      "probe": "启发式提问",
      "hints": ["提示1", "提示2", "提示3"]
    }
  ]
}`;

export async function POST(request: NextRequest) {
    try {
        const { imageBase64, mimeType = "image/jpeg" } = await request.json();

        if (!imageBase64) {
            return NextResponse.json(
                { error: "Missing image data" },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY not configured" },
                { status: 500 }
            );
        }

        let visualMap: VisualMapItem[] = [];
        let useOcrMode = false;

        // Step 1: Try OCR detection first
        try {
            console.log("[Analyze] Attempting OCR detection...");
            visualMap = await detectTextAnchors(imageBase64);
            useOcrMode = visualMap.length > 0;
            console.log(`[Analyze] OCR detected ${visualMap.length} elements, using OCR mode: ${useOcrMode}`);
        } catch (ocrError) {
            console.warn("[Analyze] OCR failed, falling back to Gemini-only mode:", ocrError);
            useOcrMode = false;
        }

        // Step 2: Prepare Gemini prompt
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            },
        });

        const imagePart = {
            inlineData: {
                data: imageBase64.replace(/^data:.*?;base64,/, ""),
                mimeType: mimeType,
            },
        };

        let prompt: string;
        if (useOcrMode) {
            // OCR-assisted mode: include Visual Map in prompt
            const visualMapJson = formatVisualMapForLLM(visualMap);
            prompt = OCR_ASSISTED_PROMPT.replace("{{VISUAL_MAP}}", visualMapJson);
            console.log("[Analyze] Using OCR-assisted prompt with Visual Map");
        } else {
            // Fallback mode: let Gemini estimate coordinates
            prompt = FALLBACK_PROMPT;
            console.log("[Analyze] Using fallback prompt (Gemini estimates coordinates)");
        }

        // Step 3: Call Gemini
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        console.log("[Analyze] Gemini response length:", text.length);

        // Step 4: Parse Gemini response
        let analyzedProblem: AnalyzedProblem;
        try {
            analyzedProblem = JSON.parse(text);
        } catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    analyzedProblem = JSON.parse(jsonMatch[0]);
                } catch {
                    analyzedProblem = createFallbackProblem();
                }
            } else {
                analyzedProblem = createFallbackProblem();
            }
        }

        // Step 5: Fusion - Map related_ids back to OCR boxes
        if (useOcrMode && visualMap.length > 0) {
            console.log("[Analyze] Fusing OCR boxes with Gemini results...");
            const MAX_ANCHORS_PER_STEP = 6; // Hard limit to prevent visual clutter

            analyzedProblem.steps = analyzedProblem.steps.map(step => {
                if (step.related_ids && step.related_ids.length > 0) {
                    // Limit to first N IDs only
                    const limitedIds = step.related_ids.slice(0, MAX_ANCHORS_PER_STEP);
                    // Look up actual boxes from OCR results
                    const boxes = lookupBoxesByIds(visualMap, limitedIds);
                    if (boxes.length > 0) {
                        step.visual_anchor = boxes;
                        console.log(`[Analyze] Step ${step.id}: mapped ${limitedIds.length} IDs to ${boxes.length} boxes`);
                    }
                }
                return step;
            });
        }

        // Step 6: Normalize and validate
        analyzedProblem = normalizeAnalyzedProblem(analyzedProblem, visualMap);

        return NextResponse.json({
            success: true,
            data: analyzedProblem,
            ocrMode: useOcrMode,
            ocrElementCount: visualMap.length,
        });
    } catch (error) {
        console.error("Analyze problem error:", error);
        return NextResponse.json(
            {
                error: "分析题目时出错，请稍后重试",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// Create a fallback problem structure
function createFallbackProblem(): AnalyzedProblem {
    return {
        problemText: "请描述你看到的题目内容",
        subject: "待确定",
        totalDifficulty: 5,
        steps: [
            {
                id: 1,
                goal: "理解题目要求",
                kc: "阅读理解",
                difficulty: 2,
                visual_anchor: [{ x: 100, y: 100, w: 300, h: 100, label: "题目" }],
                probe: "这道题让你求什么？",
                hints: ["关注题目的最后一句话", "找到「求」或「证明」后面的内容", "确定已知条件和未知量"],
                board_content: "**第一步：理解题目**\n\n找出题目的关键词：\n- 「求」后面是什么？\n- 「已知」有哪些？",
            },
            {
                id: 2,
                goal: "提取关键信息",
                kc: "信息提取",
                difficulty: 3,
                visual_anchor: [{ x: 100, y: 300, w: 300, h: 100, label: "已知条件" }],
                probe: "题目给了哪些已知条件？",
                hints: ["列出所有数字和符号", "关注「已知」「设」「若」等关键词", "画个简图整理信息"],
                board_content: "**第二步：提取条件**\n\n已知条件列表：\n1. ...\n2. ...",
            },
        ],
    };
}

// Normalize and validate the analyzed problem
function normalizeAnalyzedProblem(
    problem: AnalyzedProblem,
    visualMap: VisualMapItem[]
): AnalyzedProblem {
    if (!problem.steps || !Array.isArray(problem.steps) || problem.steps.length === 0) {
        problem.steps = createFallbackProblem().steps;
    }

    problem.steps = problem.steps.map((step, index) => ({
        id: step.id || index + 1,
        goal: step.goal || `步骤 ${index + 1}`,
        kc: step.kc || "未分类",
        difficulty: Math.min(10, Math.max(1, step.difficulty || 5)),
        // If no visual_anchor and we have related_ids, try to look them up
        visual_anchor: step.visual_anchor && step.visual_anchor.length > 0
            ? step.visual_anchor
            : step.related_ids && step.related_ids.length > 0
                ? lookupBoxesByIds(visualMap, step.related_ids)
                : [{
                    x: 100,
                    y: 150 + index * 120,
                    w: 300,
                    h: 80,
                    label: step.kc || `步骤${index + 1}`
                }],
        probe: step.probe || "你对这一步有什么想法？",
        hints: Array.isArray(step.hints) && step.hints.length > 0
            ? step.hints
            : ["试着思考一下", "回顾相关知识点", "可以画个图帮助理解"],
        // Ensure board_content is always present
        board_content: step.board_content || `**${step.goal || `步骤 ${index + 1}`}**\n\n${step.kc || "知识点"}：...`,
    }));

    problem.problemText = problem.problemText || "题目内容待确认";
    problem.subject = problem.subject || "数学";
    problem.totalDifficulty = Math.min(10, Math.max(1, problem.totalDifficulty || 5));

    return problem;
}
