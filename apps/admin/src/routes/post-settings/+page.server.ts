import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { extractErrorMessage } from '@lib/server/extract-error-message';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ locals, cookies, fetch }) => {
  const token = resolveSessionToken(locals, cookies);

  const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw error(response.status, '投稿設定一覧の取得に失敗しました');
  }

  const postSettings = await response.json();

  return {
    postSettings,
  };
};

export const actions: Actions = {
  delete: async ({ request, cookies, locals, fetch }) => {
    const token = resolveSessionToken(locals, cookies);
    const formData = await request.formData();
    const idRaw = formData.get('id');
    const slugRaw = formData.get('slug');

    const id = typeof idRaw === 'string' ? idRaw.trim() : '';
    const slug = typeof slugRaw === 'string' ? slugRaw.trim() : '';

    if (!id && !slug) {
      return fail(400, { message: 'IDが不正です。' });
    }

    const identifiers = Array.from(
      new Set([id, slug].filter((value): value is string => Boolean(value) && value.length > 0)),
    );

    try {
      for (const identifier of identifiers) {
        const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${encodeURIComponent(identifier)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          return { success: true, message: '投稿設定を削除しました。' };
        }

        if (response.status !== 404) {
          const message = await extractErrorMessage(
            response,
            '投稿設定の削除に失敗しました。時間をおいて再度お試しください。',
          );
          return fail(response.status, { message });
        }
      }

      return {
        success: true,
        message: '指定された投稿設定は見つかりませんでしたが一覧を更新しました。',
      };
    } catch (e) {
      console.error('投稿設定削除中にエラーが発生しました:', e);
      return fail(500, { message: 'サーバーエラーが発生しました。' });
    }
  },
};
