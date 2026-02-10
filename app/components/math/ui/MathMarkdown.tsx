"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MathMarkdownProps {
    content: string;
    className?: string;
}

export default function MathMarkdown({ content, className }: MathMarkdownProps) {
    // Pre-process content to ensure math blocks are handled correctly if needed
    // specific heuristics can be added here similar to SolutionBlackboard if we see issues
    const processedContent = useMemo(() => {
        return content;
    }, [content]);

    return (
        <div className={`markdown-content ${className || ""}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Override paragraph to avoid hydration errors if p is nested in p (though less likely with div wrapper)
                    // and to ensure inline style consistency
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}
