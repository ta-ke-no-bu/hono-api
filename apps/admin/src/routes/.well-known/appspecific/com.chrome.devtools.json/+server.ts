import type { RequestHandler } from './$types';

/**
 * Chrome DevTools 拡張が存在確認のためにアクセスするエンドポイント。
 * 明示的に空のJSONを返して404エラーを抑止する。
 */
export const GET: RequestHandler = () =>
  new Response('{}', {
    headers: {
      'cache-control': 'public, max-age=3600',
      'content-type': 'application/json; charset=utf-8',
    },
  });
