import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const region = process.env.ALIYUN_OSS_REGION;
    const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.ALIYUN_OSS_BUCKET;

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      return NextResponse.json(
        { error: 'OSS configuration missing' },
        { status: 500 }
      );
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成文件路径（使用时间戳和随机字符串确保唯一性）
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'png';
    const objectName = `story-images/${timestamp}-${randomStr}.${fileExtension}`;

    // 构建OSS endpoint
    const endpoint = process.env.ALIYUN_OSS_ENDPOINT || `https://${bucket}.${region}.aliyuncs.com`;
    const ossUrl = `${endpoint}/${objectName}`;

    // 构建签名（使用阿里云OSS签名算法）
    const date = new Date().toUTCString();
    const contentType = file.type || 'image/png';
    
    // 构建CanonicalizedResource
    const canonicalizedResource = `/${bucket}/${objectName}`;
    
    // 构建StringToSign
    const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalizedResource}`;
    
    // 生成签名
    const signature = crypto
      .createHmac('sha1', accessKeySecret)
      .update(stringToSign)
      .digest('base64');
    
    // 构建Authorization header
    const authorization = `OSS ${accessKeyId}:${signature}`;

    // 上传到OSS
    const uploadResponse = await fetch(ossUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Date': date,
        'Authorization': authorization,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('OSS upload error:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload to OSS', details: errorText },
        { status: uploadResponse.status }
      );
    }

    // 返回图片URL（使用公共读URL）
    const publicUrl = `${endpoint}/${objectName}`;
    
    return NextResponse.json({
      url: publicUrl,
      objectName: objectName,
    });
  } catch (error: any) {
    console.error('OSS upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload to OSS', details: error.message },
      { status: 500 }
    );
  }
}
