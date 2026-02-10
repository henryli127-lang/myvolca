"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./card";
import { Button } from "./button";
import { Upload, X, Maximize2, RotateCcw, Loader2 } from "lucide-react";
import DynamicAnnotationLayer, { type AnnotationAnchor } from "./DynamicAnnotationLayer";

interface ProblemUploaderProps {
    onAnalyzeComplete?: (imageBase64: string, mimeType?: string) => void;
    isAnalyzing?: boolean;
    activeAnchors?: AnnotationAnchor[];
}

export default function ProblemUploader({
    onAnalyzeComplete,
    isAnalyzing = false,
    activeAnchors = [],
}: ProblemUploaderProps) {
    const [image, setImage] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    const [isConverting, setIsConverting] = useState(false);
    const [previewError, setPreviewError] = useState(false);

    // 给图片添加黑色边框，帮助 Vision 模型识别边界
    const addBorderToImage = (base64: string, borderWidth: number = 5): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(base64); // Fallback to original
                    return;
                }

                // Set canvas size with border
                const newWidth = img.width + borderWidth * 2;
                const newHeight = img.height + borderWidth * 2;
                canvas.width = newWidth;
                canvas.height = newHeight;

                // Draw black border (fill entire canvas first)
                ctx.fillStyle = "#000000";
                ctx.fillRect(0, 0, newWidth, newHeight);

                // Draw original image in center
                ctx.drawImage(img, borderWidth, borderWidth);

                // Export as base64
                const borderedBase64 = canvas.toDataURL("image/jpeg", 0.92);
                resolve(borderedBase64);
            };
            img.onerror = () => resolve(base64); // Fallback to original
            img.src = base64;
        });
    };

    // 处理图片上传
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsConverting(true);
        setPreviewError(false);
        let processedFile = file;

        // HEIC 转换逻辑
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
                    quality: 0.8
                });

                const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                processedFile = new File([blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
            } catch (error) {
                console.warn("HEIC conversion failed, proceeding with original file:", error);
                setPreviewError(true);
                // Fallback to original file
            }
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setImage(base64);
            setIsConverting(false);
            // 触发扫描动画
            startScanning(base64, processedFile.type);
        };
        reader.readAsDataURL(processedFile);
    };

    // 触发扫描动画并调用分析
    const startScanning = async (imageBase64: string, mimeType?: string) => {
        setIsScanning(true);

        // 调用父组件的分析回调
        if (onAnalyzeComplete) {
            // 添加黑色边框，帮助 Vision 模型识别图片边界
            const borderedImage = await addBorderToImage(imageBase64, 5);
            onAnalyzeComplete(borderedImage, "image/jpeg");
        }

        // 最少显示3秒扫描动画
        setTimeout(() => {
            setIsScanning(false);
        }, 3500);
    };

    const resetImage = () => {
        setImage(null);
        setIsScanning(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const showScanEffect = isScanning || isAnalyzing;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-100/50">
            <Card className="relative w-full max-w-2xl aspect-[4/3] overflow-hidden rounded-2xl border-dashed border-2 border-slate-300 bg-white shadow-xl flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                    {!image ? (
                        isConverting ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 size={40} className="animate-spin text-indigo-500" />
                                <p className="text-lg font-medium text-slate-700">正在处理图片...</p>
                            </div>
                        ) : (
                            // 上传前状态
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-4 cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="p-4 rounded-full bg-indigo-50 text-indigo-600">
                                    <Upload size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-medium text-slate-700">
                                        点击或拖拽上传题目照片
                                    </p>
                                    <p className="text-sm text-slate-500">支持 HEIC, JPG, PNG 格式</p>
                                </div>
                            </motion.div>
                        )
                    ) : (
                        // 上传后展示图片
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative w-full h-full flex items-center justify-center"
                        >
                            {previewError ? (
                                <div className="flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-2 p-8">
                                    <div className="p-4 bg-white rounded-full shadow-sm">
                                        <Upload className="w-8 h-8 text-indigo-500" />
                                    </div>
                                    <p className="font-medium text-slate-700">图片已上传 (HEIC)</p>
                                    <p className="text-xs">预览不可用，但 AI 可以分析</p>
                                </div>
                            ) : (
                                // 图片容器：紧贴图片实际渲染尺寸
                                <div
                                    ref={imageContainerRef}
                                    className="relative"
                                    style={{ width: 'fit-content', height: 'fit-content', maxWidth: '100%', maxHeight: '100%' }}
                                >
                                    <img
                                        src={image}
                                        alt="Uploaded problem"
                                        className="max-w-full max-h-[65vh] object-contain block"
                                    />

                                    {/* 动态标注层 - 严格贴合图片边界 */}
                                    {!showScanEffect && activeAnchors.length > 0 && (
                                        <DynamicAnnotationLayer
                                            activeAnchors={activeAnchors}
                                            containerRef={imageContainerRef}
                                        />
                                    )}
                                </div>
                            )}

                            {/* 核心：扫描线动画 */}
                            <AnimatePresence>
                                {showScanEffect && (
                                    <motion.div
                                        className="absolute inset-0 pointer-events-none"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        {/* 扫描激光线 */}
                                        <motion.div
                                            className="absolute left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_2px_rgba(79,70,229,0.8)] z-10"
                                            initial={{ top: "0%" }}
                                            animate={{ top: "100%" }}
                                            transition={{
                                                duration: 1.8,
                                                repeat: Infinity,
                                                ease: "linear",
                                            }}
                                        />
                                        {/* 扫描后的淡蓝色遮罩效果 */}
                                        <motion.div
                                            className="absolute inset-0 bg-indigo-500/5"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: [0, 0.2, 0] }}
                                            transition={{ duration: 1.8, repeat: Infinity }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 悬浮工具栏 */}
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="rounded-full shadow-lg"
                                    onClick={resetImage}
                                    disabled={showScanEffect}
                                >
                                    <RotateCcw size={18} />
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="rounded-full shadow-lg"
                                    disabled={showScanEffect}
                                >
                                    <Maximize2 size={18} />
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="rounded-full shadow-lg"
                                    onClick={resetImage}
                                    disabled={showScanEffect}
                                >
                                    <X size={18} />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                    accept="image/*"
                />
            </Card>

            {/* 提示文案 */}
            <div className="mt-6 text-slate-500 text-sm flex items-center gap-2">
                <div
                    className={`w-2 h-2 rounded-full ${showScanEffect ? "bg-indigo-500 animate-pulse" : "bg-slate-300"
                        }`}
                />
                {showScanEffect ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        正在识别题目逻辑链条...
                    </span>
                ) : image ? (
                    "题目已上传，开始对话吧！"
                ) : (
                    "待上传题目图片"
                )}
            </div>
        </div>
    );
}