import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function resolveErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = await response.json();
      if (body && typeof body === 'object' && typeof body.message === 'string') {
        return body.message;
      }
    } catch (error_) {
      console.error('レスポンスJSONの解析に失敗しました', error_);
    }
  }
  try {
    const text = await response.text();
    return text || fallback;
  } catch (error_) {
    console.error('レスポンステキストの取得に失敗しました', error_);
    return fallback;
  }
}

export const POST: RequestHandler = async ({ request, locals, fetch }) => {
  if (!locals.token) {
    throw error(401, '認証情報が無効です。再度ログインしてください。');
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return json({ message: '画像ファイルを選択してください。' }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return json({ message: '対応していないファイル形式です（PNG/JPEG/WebP/GIF/SVG）。' }, { status: 400 });
  }

  if (file.size === 0) {
    return json(
      {
        message: 'ファイルサイズが0バイトです。別のファイルを選択してください。',
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return json({ message: 'ファイルサイズが大きすぎます（最大5MB）。' }, { status: 400 });
  }

  const apiBase = locals.apiBase;

  if (!apiBase) {
    throw error(500, 'APIベースURLが設定されていません。管理者にお問い合わせください。');
  }

  const presignResponse = await fetch(`${apiBase}/app/api/uploads/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${locals.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name || 'image',
      contentType: file.type,
      contentLength: file.size,
    }),
  });

  if (!presignResponse.ok) {
    const message = await resolveErrorMessage(presignResponse, '署名付きURLの発行に失敗しました。');
    return json({ message }, { status: presignResponse.status });
  }

  const presigned: {
    uploadUrl: string;
    objectUrl: string;
    key: string;
    expiresIn: number;
  } = await presignResponse.json();

  const arrayBuffer = await file.arrayBuffer();

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'Content-Length': String(arrayBuffer.byteLength),
    },
    body: arrayBuffer,
  });

  if (!uploadResponse.ok) {
    return json(
      {
        message: '画像のアップロードに失敗しました。時間をおいて再度お試しください。',
      },
      { status: 502 },
    );
  }

  return json({
    url: presigned.objectUrl,
    key: presigned.key,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });
};
