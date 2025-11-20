import { PUBLIC_API_BASE_URL } from '$env/static/public';
import type { PostSettingSummary } from '@lib/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// 認証トークンを取得する共通関数
function resolveSessionToken(locals: App.Locals, cookies: Cookies) {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }
  return token;
}

// 投稿設定一覧を取得
export const load: PageServerLoad = async ({ locals, cookies, fetch }) => {
  const token = resolveSessionToken(locals, cookies);

  const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw error(response.status, message || '投稿設定の取得に失敗しました');
  }

  const postSettings = (await response.json()) as PostSettingSummary[];
  return { postSettings };
};

// フォームからのアクションを処理
export const actions: Actions = {
  // セットの削除アクション
  deleteSetting: async ({ request, locals, cookies, fetch }) => {
    const token = resolveSessionToken(locals, cookies);
    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();

    if (!id) {
      return fail(400, {
        action: 'deleteSetting' as const,
        success: false,
        message: 'ID is required.',
      });
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      return fail(response.status, {
        action: 'deleteSetting' as const,
        success: false,
        message: message || '投稿設定の削除に失敗しました。',
      });
    }

    return {
      action: 'deleteSetting' as const,
      success: true,
      message: '投稿設定を削除しました。',
    };
  },
};
