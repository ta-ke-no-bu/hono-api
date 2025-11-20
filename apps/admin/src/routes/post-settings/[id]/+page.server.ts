import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { extractErrorMessage } from '@lib/server/extract-error-message';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies, fetch, params }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw error(404, '投稿設定が見つかりません。');
    }
    throw error(response.status, '投稿設定の取得に失敗しました');
  }

  const postSetting = await response.json();

  return {
    postSetting,
    sessionToken: token,
  };
};

function parseJsonField(
  raw: FormDataEntryValue | null,
  action: string,
  field: string,
):
  | { value: undefined; error: undefined }
  | { value: unknown; error: undefined }
  | { value: undefined; error: ReturnType<typeof fail> } {
  if (raw === null || typeof raw !== 'string') {
    return { value: undefined, error: undefined };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined, error: undefined };
  }
  try {
    return { value: JSON.parse(trimmed), error: undefined };
  } catch (error) {
    console.error(`Failed to parse ${field} JSON for ${action}:`, error);
    return {
      value: undefined,
      error: fail(400, {
        action,
        message: `${field}の形式が不正です。JSON形式で入力してください。`,
      }),
    };
  }
}

function toOptionalNumber(
  value: FormDataEntryValue | null,
  action: string,
  field: string,
): { value: number | undefined; error?: ReturnType<typeof fail> } {
  if (value === null || typeof value !== 'string') {
    return { value: undefined };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: undefined };
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) {
    return {
      value: undefined,
      error: fail(400, {
        action,
        message: `${field}は数値で指定してください。`,
      }),
    };
  }
  return { value: parsed };
}

function normalizeParentId(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBooleanFlag(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed === 'true' || trimmed === '1' || trimmed === 'on' || trimmed === 'yes') {
    return true;
  }
  if (trimmed === 'false' || trimmed === '0' || trimmed === 'off' || trimmed === 'no') {
    return false;
  }
  return undefined;
}

export const actions: Actions = {
  update: async ({ request, locals, cookies, fetch, params }) => {
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

    const fields = {
      name,
      slug,
      status,
      description,
    };

    if (!name || !slug) {
      return fail(400, {
        action: 'update',
        message: '名称とスラッグは必須です。',
        fields,
      });
    }

    const payload = {
      name,
      slug,
      status,
      description,
    };

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${params.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response, '投稿設定の更新に失敗しました。');
      return fail(response.status, {
        action: 'update',
        message,
        fields,
      });
    }

    return { success: true, action: 'update', message: '投稿設定を更新しました。' };
  },

  createDefinition: async ({ request, cookies, fetch, params }) => {
    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const action = 'createDefinition';

    const type = String(formData.get('type') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();
    const label = String(formData.get('label') ?? '').trim();

    if (!type || !slug || !label) {
      return fail(400, {
        action,
        message: '種別・スラッグ・ラベルは必須です。',
      });
    }

    const basePayload: Record<string, unknown> = {
      postSettingId: params.id,
      type,
      slug,
      label,
      parentId: normalizeParentId(formData.get('parentId')),
    };

    const description = formData.get('description');
    if (typeof description === 'string') {
      const trimmed = description.trim();
      basePayload.description = trimmed.length > 0 ? trimmed : null;
    }

    const orderResult = toOptionalNumber(formData.get('order'), action, '表示順');
    if (orderResult.error) {
      return orderResult.error;
    }
    if (orderResult.value !== undefined) {
      basePayload.order = orderResult.value;
    }

    const validationResult = parseJsonField(formData.get('validation'), action, 'validation');
    if (validationResult.error) {
      return validationResult.error;
    }
    if (validationResult.value !== undefined) {
      basePayload.validation = validationResult.value;
    }

    const configResult = parseJsonField(formData.get('config'), action, 'config');
    if (configResult.error) {
      return configResult.error;
    }
    if (configResult.value !== undefined) {
      basePayload.config = configResult.value;
    }

    const repeatableFlag = parseBooleanFlag(formData.get('isRepeatable'));
    if (type === 'group') {
      basePayload.isRepeatable = repeatableFlag ?? false;
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${params.id}/definitions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basePayload),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response, 'フィールド定義の作成に失敗しました。');
      return fail(response.status, { action: 'createDefinition', message });
    }

    return { success: true, action: 'createDefinition', message: 'フィールド定義を作成しました。' };
  },

  updateDefinition: async ({ request, cookies, fetch }) => {
    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const id = formData.get('id');
    if (typeof id !== 'string' || !id) {
      return fail(400, { action: 'updateDefinition', message: '定義IDが必要です。' });
    }
    const action = 'updateDefinition';

    const payload: Record<string, unknown> = {};
    const type = String(formData.get('type') ?? '').trim();
    if (type) payload.type = type;

    const slug = formData.get('slug');
    if (typeof slug === 'string') {
      const trimmed = slug.trim();
      if (trimmed) {
        payload.slug = trimmed;
      }
    }

    const label = formData.get('label');
    if (typeof label === 'string') {
      const trimmed = label.trim();
      if (trimmed) {
        payload.label = trimmed;
      }
    }

    if (formData.has('description')) {
      const rawDescription = formData.get('description');
      if (typeof rawDescription === 'string') {
        const trimmed = rawDescription.trim();
        payload.description = trimmed.length > 0 ? trimmed : null;
      } else {
        payload.description = null;
      }
    }

    if (formData.has('parentId')) {
      payload.parentId = normalizeParentId(formData.get('parentId'));
    }

    if (formData.has('order')) {
      const orderResult = toOptionalNumber(formData.get('order'), action, '表示順');
      if (orderResult.error) {
        return orderResult.error;
      }
      payload.order = orderResult.value;
    }

    if (formData.has('validation')) {
      const validationResult = parseJsonField(formData.get('validation'), action, 'validation');
      if (validationResult.error) {
        return validationResult.error;
      }
      payload.validation = validationResult.value;
    }

    if (formData.has('config')) {
      const configResult = parseJsonField(formData.get('config'), action, 'config');
      if (configResult.error) {
        return configResult.error;
      }
      payload.config = configResult.value;
    }

    if (formData.has('isRepeatable')) {
      const repeatableFlag = parseBooleanFlag(formData.get('isRepeatable'));
      if (type === 'group') {
        payload.isRepeatable = repeatableFlag ?? false;
      } else if (repeatableFlag !== undefined) {
        payload.isRepeatable = false;
      }
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/definitions/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response, 'フィールド定義の更新に失敗しました。');
      return fail(response.status, { action: 'updateDefinition', message });
    }

    return { success: true, action: 'updateDefinition', message: 'フィールド定義を更新しました。' };
  },

  deleteDefinition: async ({ request, cookies, fetch }) => {
    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const id = formData.get('id');
    if (typeof id !== 'string' || !id) {
      return fail(400, { action: 'deleteDefinition', message: '削除対象のフィールドIDが不正です。' });
    }

    const confirmSlug = formData.get('confirmSlug');
    const expectedSlug = formData.get('expectedSlug');
    if (
      typeof confirmSlug !== 'string' ||
      typeof expectedSlug !== 'string' ||
      confirmSlug.trim() !== expectedSlug.trim()
    ) {
      return fail(422, { action: 'deleteDefinition', message: '確認用スラッグが一致しません。' });
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/definitions/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response, 'フィールド定義の削除に失敗しました。');
      return fail(response.status, { action: 'deleteDefinition', message });
    }

    return { success: true, action: 'deleteDefinition', message: 'フィールド定義を削除しました。' };
  },

  reorderDefinition: async ({ request, cookies, fetch }) => {
    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const orderedIdsRaw = formData.get('orderedIds');
    if (typeof orderedIdsRaw !== 'string') {
      return fail(400, { action: 'reorderDefinition', message: '並び替え内容が不正です。' });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(orderedIdsRaw);
    } catch (error) {
      console.error('Failed to parse orderedIds:', error);
      return fail(400, { action: 'reorderDefinition', message: '並び替え内容の解析に失敗しました。' });
    }

    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
      return fail(400, { action: 'reorderDefinition', message: '並び替え内容が不正です。' });
    }

    const payload = (parsed as string[]).map((id, order) => ({ id, order }));

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/definitions/reorder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response, '並び順の更新に失敗しました。');
      return fail(response.status, { action: 'reorderDefinition', message });
    }

    return { success: true, action: 'reorderDefinition', message: '並び順を更新しました。' };
  },
};
