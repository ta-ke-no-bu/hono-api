/**
 * @description APIレスポンスからエラーメッセージを抽出します。JSON本文に`message`フィールドがあればそれを返し、なければ本文テキストかフォールバックメッセージを返します。
 */
export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  let rawText = '';
  try {
    rawText = await response.text();
  } catch (error) {
    console.error('レスポンスのテキスト取得に失敗しました', error);
    return fallback;
  }

  if (contentType.includes('application/json') && rawText) {
    try {
      const body = JSON.parse(rawText) as { message?: unknown } | null;
      const message = body && typeof body === 'object' ? body.message : null;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    } catch (error) {
      console.error('レスポンスのJSON解析に失敗しました', error);
    }
  }

  const trimmed = rawText.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
