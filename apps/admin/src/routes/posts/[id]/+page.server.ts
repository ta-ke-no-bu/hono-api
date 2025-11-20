import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { extractErrorMessage } from '@lib/server/extract-error-message';
import type { PostSettingSummary, PostWithCategory } from '@lib/types';
import { normalizeSpanColorAttributes } from '@lib/utils/normalizeRichTextColor';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

interface CategorySummary {
  id: string;
  name: string;
}

type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

function normalizeDateInput(raw: string): string | undefined | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  let candidate = trimmed.replace(' ', 'T');
  if (!candidate.includes('T')) {
    candidate = `${candidate}T00:00:00`;
  }
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function resolveStatus(raw: string): PostStatus {
  if (raw === 'PUBLISHED' || raw === 'ARCHIVED') {
    return raw;
  }
  return 'DRAFT';
}

export const load: PageServerLoad = async ({ params, locals, cookies, fetch }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const [categoriesResponse, postResponse, postSettingsResponse] = await Promise.all([
    fetch(`${PUBLIC_API_BASE_URL}/app/api/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${PUBLIC_API_BASE_URL}/app/api/posts/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!categoriesResponse.ok) {
    throw error(categoriesResponse.status, 'カテゴリ一覧の取得に失敗しました');
  }

  if (!postResponse.ok) {
    if (postResponse.status === 404) {
      throw error(404, '投稿が見つかりません');
    }
    throw error(postResponse.status, '投稿の取得に失敗しました');
  }

  if (!postSettingsResponse.ok) {
    throw error(postSettingsResponse.status, '投稿設定の取得に失敗しました');
  }

  const [categories, post, postSettings] = await Promise.all([
    categoriesResponse.json() as Promise<CategorySummary[]>,
    postResponse.json() as Promise<PostWithCategory & { customFields: string | null }>,
    postSettingsResponse.json() as Promise<PostSettingSummary[]>,
  ]);

  console.warn('[posts/load] post.detailBody:', post.detailBody);

  let detailedPostSetting: PostSettingSummary | null = null;
  if (post.postSettingId) {
    const detailResponse = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${post.postSettingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (detailResponse.ok) {
      detailedPostSetting = (await detailResponse.json()) as PostSettingSummary;
    }
  }

  let parsedCustomFields: Record<string, unknown> | null = null;
  if (typeof post.customFields === 'string' && post.customFields.trim().length > 0) {
    try {
      const data = JSON.parse(post.customFields);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        parsedCustomFields = data as Record<string, unknown>;
      }
    } catch (parseError) {
      console.warn('カスタムフィールドの解析に失敗しました:', parseError);
    }
  }

  return {
    post: {
      ...post,
      customFields: parsedCustomFields ?? {},
    },
    categories,
    postSettings: Array.isArray(postSettings)
      ? postSettings.map((setting) =>
          detailedPostSetting && setting.id === detailedPostSetting.id
            ? { ...setting, definitions: detailedPostSetting.definitions ?? setting.definitions }
            : setting,
        )
      : postSettings,
    selectedPostSetting: detailedPostSetting,
    sessionToken: token,
  };
};

export const actions: Actions = {
  update: async ({ request, params, cookies, fetch }) => {
    const token = cookies.get('session');
    if (!token) {
      throw redirect(303, '/login');
    }
    const formData = await request.formData();

    const title = String(formData.get('title') ?? '').trim();
    const categoryId = String(formData.get('categoryId') ?? '').trim() || undefined;
    const publishedAtRaw = String(formData.get('publishedAt') ?? '').trim();
    const postedAtRaw = String(formData.get('postedAt') ?? '').trim();
    const statusRaw = String(formData.get('status') ?? '').trim();
    const detailBodyRaw = String(formData.get('detailBody') ?? '').trim();
    let detailBody: string;
    if (detailBodyRaw.startsWith('{')) {
      try {
        const parsed = JSON.parse(detailBodyRaw);
        detailBody = typeof parsed.html === 'string' ? normalizeSpanColorAttributes(parsed.html) : '';
      } catch {
        detailBody = normalizeSpanColorAttributes(detailBodyRaw);
      }
    } else {
      detailBody = normalizeSpanColorAttributes(detailBodyRaw);
    }
    const detailEnabled = formData.get('detailEnabled') === 'on';
    const detailSlug = String(formData.get('detailSlug') ?? '').trim();
    const postSettingId = String(formData.get('postSettingId') ?? '').trim();
    const customFields = String(formData.get('customFields') ?? '').trim();

    const fields = {
      title,
      categoryId,
      publishedAt: publishedAtRaw,
      postedAt: postedAtRaw,
      status: statusRaw || 'DRAFT',
      detailBody,
      detailEnabled,
      detailSlug,
      postSettingId,
      customFields,
    };

    if (!title || !postSettingId) {
      return fail(400, {
        action: 'update',
        message: 'タイトルと投稿設定は必須です。',
        fields,
      });
    }

    const payload: Record<string, unknown> = {
      title,
      postSettingId,
      detailEnabled,
    };

    if (categoryId) {
      payload.categoryId = categoryId;
    }

    const publishedAt = normalizeDateInput(publishedAtRaw);
    if (publishedAt === null) {
      return fail(400, {
        action: 'update',
        message: '公開日はYYYY-MM-DD形式で入力してください。',
        fields,
      });
    }
    if (publishedAt) {
      payload.publishedAt = publishedAt;
    }

    const status = resolveStatus(statusRaw);
    payload.status = status;

    const postedAt = normalizeDateInput(postedAtRaw);
    if (postedAt === null) {
      return fail(400, {
        action: 'update',
        message: '投稿日はYYYY-MM-DD形式で入力してください。',
        fields,
      });
    }
    if (postedAt) {
      payload.postedAt = postedAt;
    }

    if (status === 'PUBLISHED' && !publishedAt) {
      return fail(400, {
        action: 'update',
        message: '公開状態にする場合は公開日を指定してください。',
        fields,
      });
    }

    if (detailEnabled) {
      payload.detailEnabled = true;
      const trimmedDetailBody = detailBody.trim();
      if (trimmedDetailBody.length > 0) {
        payload.detailBody = normalizeSpanColorAttributes(detailBody);
      }
      payload.detailSlug = detailSlug.length > 0 ? detailSlug : null;
    } else {
      payload.detailEnabled = false;
      const trimmedDetailBody = detailBody.trim();
      if (trimmedDetailBody.length > 0) {
        payload.detailBody = normalizeSpanColorAttributes(detailBody);
      }
      payload.detailSlug = null;
    }
    if (customFields) {
      try {
        JSON.parse(customFields);
      } catch {
        return fail(400, { action: 'update', message: 'カスタムフィールドの形式が不正です。', fields });
      }
      payload.customFields = customFields;
    }

    console.warn('[posts/update] payload', payload);
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/posts/${params.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response, '投稿の更新に失敗しました。');
      console.warn('[posts/update] API error', response.status, message, fields);
      return fail(response.status, {
        action: 'update',
        message,
        fields,
      });
    }

    throw redirect(303, '/posts');
  },
};
