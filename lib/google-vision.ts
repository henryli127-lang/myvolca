import vision from "@google-cloud/vision";

// Define the client outside the function to reuse in serverless
const client = new vision.ImageAnnotatorClient();

export interface VisualMapItem {
    id: string;
    text: string;
    box: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}

export async function detectTextAnchors(imageBase64: string): Promise<VisualMapItem[]> {
    // Remove header if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const [result] = await client.textDetection(buffer);
    const annotations = result.textAnnotations;

    if (!annotations || annotations.length === 0) {
        console.log("[OCR] No text detected in image");
        return [];
    }

    // 1. Get image dimensions from fullTextAnnotation or fallback to max coordinates
    const fullText = result.fullTextAnnotation;
    let imgWidth = 1000;
    let imgHeight = 1000;

    if (fullText?.pages && fullText.pages.length > 0) {
        imgWidth = fullText.pages[0].width || 1000;
        imgHeight = fullText.pages[0].height || 1000;
        console.log(`[OCR] Image dimensions from API: ${imgWidth}x${imgHeight}`);
    } else {
        // Fallback: Find max coordinates from all vertices
        annotations.forEach(ann => {
            ann.boundingPoly?.vertices?.forEach(v => {
                if ((v.x || 0) > imgWidth) imgWidth = v.x || 0;
                if ((v.y || 0) > imgHeight) imgHeight = v.y || 0;
            });
        });
        console.log(`[OCR] Image dimensions from vertices: ${imgWidth}x${imgHeight}`);
    }

    // 2. Map annotations to normalized 0-1000 coordinates
    // Skip index 0 (full text summary)
    const visualMap = annotations.slice(1).map((ann, index) => {
        const vertices = ann.boundingPoly?.vertices;
        if (!vertices || vertices.length < 4) return null;

        const text = ann.description || "";
        if (!text.trim()) return null;

        // Vision API returns 4 points. Calculate bounding box.
        const xs = vertices.map(v => v.x || 0);
        const ys = vertices.map(v => v.y || 0);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        // Normalize to 0-1000 scale
        const box = {
            x: Math.round((minX / imgWidth) * 1000),
            y: Math.round((minY / imgHeight) * 1000),
            w: Math.round(((maxX - minX) / imgWidth) * 1000),
            h: Math.round(((maxY - minY) / imgHeight) * 1000),
        };

        // Filter out very small elements (noise)
        if (box.w < 5 || box.h < 5) return null;

        return {
            id: `txt_${index}`,
            text: text.trim(),
            box,
        };
    }).filter((item): item is VisualMapItem => item !== null);

    console.log(`[OCR] Generated ${visualMap.length} visual map items`);
    return visualMap;
}

/**
 * Format Visual Map for LLM context (simplified for token efficiency)
 */
export function formatVisualMapForLLM(items: VisualMapItem[]): string {
    // Only include id and text for token efficiency
    return JSON.stringify(items.map(i => ({ id: i.id, text: i.text })));
}

/**
 * Look up OCR boxes by IDs returned from Gemini
 */
export function lookupBoxesByIds(
    map: VisualMapItem[],
    ids: string[]
): Array<{ x: number; y: number; w: number; h: number; label: string }> {
    return ids
        .map(id => {
            const item = map.find(m => m.id === id);
            if (item) {
                return { ...item.box, label: item.text };
            }
            return null;
        })
        .filter((item): item is { x: number; y: number; w: number; h: number; label: string } => item !== null);
}
