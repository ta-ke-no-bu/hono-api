import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { extractErrorMessage } from '@lib/server/extract-error-message';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

interface ContactFormSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  description?: string | null;
}

/**
 * @description 認証済みセッションから API 用の Bearer トークンを取り出します。
 */
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

  const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/contact/forms`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw error(response.status, 'フォーム一覧の取得に失敗しました');
  }

  const forms: ContactFormSummary[] = await response.json();

  return {
    forms,
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, fetch }) => {
    const token = resolveSessionToken(locals, cookies);
    const formData = await request.formData();

    const rawName = String(formData.get('name') ?? '').trim();
    const rawSlug = String(formData.get('slug') ?? '').trim();

    if (rawName.length === 0 || rawSlug.length === 0) {
      return fail(400, {
        action: 'create',
        message: 'フォーム名とスラッグは必須です。',
        fields: {
          name: rawName,
          slug: rawSlug,
        },
      });
    }

    const payload = {
      name: rawName,
      slug: rawSlug,
    };

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/contact/forms`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(
        response,
        'フォームの作成に失敗しました。時間をおいて再度お試しください。',
      );
      console.error('フォームの新規作成に失敗しました', response.status, message);
      return fail(response.status, {
        action: 'create',
        message,
        fields: {
          name: rawName,
          slug: rawSlug,
        },
      });
    }

    return {
      action: 'create',
      success: true,
    };
  },
  delete: async ({ request, locals, cookies, fetch }) => {
    const token = resolveSessionToken(locals, cookies);
    const formData = await request.formData();

    const formId = String(formData.get('formId') ?? '').trim();

    if (formId.length === 0) {
      return fail(400, {
        action: 'delete',
        message: '削除対象のフォーム ID が指定されていません。',
      });
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/contact/forms/${formId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const message = await extractErrorMessage(
        response,
        'フォームの削除に失敗しました。時間をおいて再度お試しください。',
      );
      console.error('フォームの削除に失敗しました', response.status, message);
      return fail(response.status, {
        action: 'delete',
        message,
      });
    }

    return {
      action: 'delete',
      success: true,
    };
  },
};
