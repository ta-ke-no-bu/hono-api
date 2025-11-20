import { error, fail, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies, fetch }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const apiBase = locals.apiBase;

  if (!apiBase) {
    throw error(500, 'APIベースURLが設定されていません。');
  }

  const response = await fetch(`${apiBase}/app/api/categories`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw error(response.status, 'カテゴリ一覧の取得に失敗しました');
  }

  const categories = await response.json();

  return {
    categories,
  };
};

function resolveToken(locals: App.Locals, cookies: Cookies) {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  return token;
}

function normalizeSlugInput(raw: string) {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const actions: Actions = {
  create: async ({ request, locals, cookies, fetch }) => {
    const token = resolveToken(locals, cookies);

    const formData = await request.formData();
    const rawName = String(formData.get('name') ?? '').trim();
    const rawSlug = String(formData.get('slug') ?? '').trim();

    if (rawName.length === 0) {
      return fail(400, {
        action: 'create',
        message: 'カテゴリ名は必須です。',
        fields: { name: rawName, slug: rawSlug },
      });
    }

    const payload: Record<string, string | undefined> = {
      name: rawName,
    };

    const normalizedSlug = normalizeSlugInput(rawSlug);
    if (normalizedSlug !== undefined) {
      payload.slug = normalizedSlug;
    }

    const apiBase = locals.apiBase;

    if (!apiBase) {
      throw error(500, 'APIベースURLが設定されていません。');
    }

    const response = await fetch(`${apiBase}/app/api/categories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('カテゴリの作成に失敗しました', response.status, message);
      return fail(response.status, {
        action: 'create',
        message: message || 'カテゴリの作成に失敗しました。',
        fields: { name: rawName, slug: rawSlug },
      });
    }

    return {
      action: 'create',
      success: true,
    };
  },
  update: async ({ request, locals, cookies, fetch }) => {
    const token = resolveToken(locals, cookies);

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    const rawName = String(formData.get('name') ?? '').trim();
    const rawSlug = String(formData.get('slug') ?? '').trim();

    if (!id) {
      return fail(400, {
        action: 'update',
        message: 'カテゴリIDが指定されていません。',
      });
    }
    if (rawName.length === 0) {
      return fail(400, {
        action: 'update',
        message: 'カテゴリ名は必須です。',
        updatedId: id,
      });
    }

    const payload: Record<string, string | null> = {
      name: rawName,
    };
    payload.slug = rawSlug.trim().length > 0 ? rawSlug.trim() : null;

    const apiBase = locals.apiBase;

    if (!apiBase) {
      throw error(500, 'APIベースURLが設定されていません。');
    }

    const response = await fetch(`${apiBase}/app/api/categories/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('カテゴリの更新に失敗しました', response.status, message);
      return fail(response.status, {
        action: 'update',
        message: message || 'カテゴリの更新に失敗しました。',
        updatedId: id,
      });
    }

    return {
      action: 'update',
      success: true,
      updatedId: id,
    };
  },
  delete: async ({ request, locals, cookies, fetch }) => {
    const token = resolveToken(locals, cookies);

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();

    if (!id) {
      return fail(400, {
        action: 'delete',
        message: 'カテゴリIDが指定されていません。',
      });
    }

    const apiBase = locals.apiBase;

    if (!apiBase) {
      throw error(500, 'APIベースURLが設定されていません。');
    }

    const response = await fetch(`${apiBase}/app/api/categories/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('カテゴリの削除に失敗しました', response.status, message);
      return fail(response.status, {
        action: 'delete',
        message: message || 'カテゴリの削除に失敗しました。',
        deletedId: id,
      });
    }

    return {
      action: 'delete',
      success: true,
      deletedId: id,
    };
  },
};
