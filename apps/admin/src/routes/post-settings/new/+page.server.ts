import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { extractErrorMessage } from '@lib/server/extract-error-message';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, fetch }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }
    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();

    const name = String(formData.get('name') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();
    const status = String(formData.get('status') ?? 'INACTIVE').trim();
    const description = String(formData.get('description') ?? '').trim();
    const definitionsRaw = formData.get('definitions');

    let definitionsPayload: unknown = [];
    if (typeof definitionsRaw === 'string' && definitionsRaw.trim().length > 0) {
      try {
        const parsed = JSON.parse(definitionsRaw);
        if (!Array.isArray(parsed)) {
          return fail(400, {
            action: 'create',
            message: 'カスタムフィールド定義の形式が不正です。',
            fields: {
              name,
              slug,
              status,
              description,
              definitions: definitionsRaw,
            },
          });
        }
        definitionsPayload = parsed;
      } catch {
        return fail(400, {
          action: 'create',
          message: 'カスタムフィールド定義の解析に失敗しました。',
          fields: {
            name,
            slug,
            status,
            description,
            definitions: definitionsRaw,
          },
        });
      }
    }

    const fields = {
      name,
      slug,
      status,
      description,
      definitions: typeof definitionsRaw === 'string' ? definitionsRaw : '[]',
    };

    if (!name || !slug) {
      return fail(400, {
        action: 'create',
        message: '名称とスラッグは必須です。',
        fields,
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[post-settings:create] incoming fields', {
        name,
        slug,
        status,
        descriptionLength: description.length,
        definitionsCount: Array.isArray(definitionsPayload) ? definitionsPayload.length : 0,
      });
    }

    const payload = {
      name,
      slug,
      status,
      description,
      definitions: definitionsPayload,
    };

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (process.env.NODE_ENV !== 'production') {
        try {
          const cloned = response.clone();
          const errorText = await cloned.text();
          console.error('[post-settings:create] API error', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
        } catch (error) {
          console.error('[post-settings:create] failed to read API error body', error);
        }
      }
      const message = await extractErrorMessage(response, '投稿設定の作成に失敗しました。');
      return fail(response.status, {
        action: 'create',
        message,
        fields,
      });
    }

    throw redirect(303, '/post-settings');
  },
};
