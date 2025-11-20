import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { prepareCustomFieldsPayload } from '@lib/custom-fields/valueHelpers';
import { extractErrorMessage } from '@lib/server/extract-error-message';
import type { CustomFieldDefinition, PostSettingSummary } from '@lib/types';
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

export const load: PageServerLoad = async ({ locals, cookies, fetch, url }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  const postSettingId = (url.searchParams.get('postSettingId') ?? '').trim();

  const categoriesResponse = await fetch(`${PUBLIC_API_BASE_URL}/app/api/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!categoriesResponse.ok) {
    throw error(categoriesResponse.status, 'カテゴリ一覧の取得に失敗しました');
  }
  const categories: CategorySummary[] = await categoriesResponse.json();

  let postSetting: (PostSettingSummary & { definitions: PostSettingSummary['definitions'] }) | null = null;

  if (postSettingId) {
    const postSettingResponse = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${postSettingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (postSettingResponse.status === 404) {
      throw redirect(303, '/post-settings');
    }

    if (!postSettingResponse.ok) {
      throw error(postSettingResponse.status, '投稿設定の取得に失敗しました');
    }

    const rawSetting = await postSettingResponse.json();
    const normalizedDefinitions = Array.isArray(rawSetting?.definitions) ? rawSetting.definitions : [];
    postSetting = {
      ...(rawSetting as PostSettingSummary),
      definitions: normalizedDefinitions,
    };

    if (postSetting.status !== 'ACTIVE') {
      throw redirect(303, '/post-settings');
    }
  }

  return {
    categories,
    postSetting,
    sessionToken: token,
  };
};

export const actions: Actions = {
  create: async ({ request, cookies, fetch }) => {
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
    const detailBody = normalizeSpanColorAttributes(detailBodyRaw);
    const detailEnabled = formData.get('detailEnabled') === 'on';
    const detailSlug = String(formData.get('detailSlug') ?? '').trim();
    const postSettingId = String(formData.get('postSettingId') ?? '').trim();
    const customFieldsRaw = formData.get('customFields');

    const baseFields = {
      title,
      categoryId,
      publishedAt: publishedAtRaw,
      postedAt: postedAtRaw,
      status: statusRaw || 'DRAFT',
      detailBody,
      detailEnabled,
      detailSlug,
      postSettingId,
    };

    type PostSettingWithDefinitions = PostSettingSummary & { definitions: PostSettingSummary['definitions'] };
    let customFieldsPayload: string | undefined;
    let normalizedCustomFields: Record<string, unknown> | undefined;
    let postSettingSnapshot: PostSettingWithDefinitions | null | undefined;
    let customFieldsParseError: string | null = null;

    const ensurePostSettingSnapshot = async () => {
      if (postSettingSnapshot !== undefined) {
        return postSettingSnapshot;
      }
      if (!postSettingId) {
        postSettingSnapshot = null;
        return postSettingSnapshot;
      }
      try {
        const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/post-settings/${postSettingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          postSettingSnapshot = null;
          return postSettingSnapshot;
        }
        const rawSetting = await response.json();
        const normalizedDefinitions = Array.isArray(rawSetting?.definitions) ? rawSetting.definitions : [];
        postSettingSnapshot = {
          ...(rawSetting as PostSettingSummary),
          definitions: normalizedDefinitions,
        };
        return postSettingSnapshot;
      } catch (error) {
        console.error('postSetting snapshot fetch failed', error);
        postSettingSnapshot = null;
        return postSettingSnapshot;
      }
    };

    const readCustomFieldsText = async (raw: FormDataEntryValue | null): Promise<string | undefined> => {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      if (raw instanceof Blob) {
        const text = (await raw.text()).trim();
        return text.length > 0 ? text : undefined;
      }
      return undefined;
    };

    const customFieldsText = await readCustomFieldsText(customFieldsRaw);

    if (customFieldsText) {
      try {
        const parsed = JSON.parse(customFieldsText) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const snapshot = await ensurePostSettingSnapshot();
          const definitions = Array.isArray(snapshot?.definitions)
            ? (snapshot?.definitions as CustomFieldDefinition[])
            : [];
          const normalized = prepareCustomFieldsPayload(definitions, parsed);
          normalizedCustomFields = normalized;
          try {
            customFieldsPayload = JSON.stringify(normalized);
          } catch (error) {
            console.error('customFields stringify failed, fallback to raw string', error);
            customFieldsPayload = undefined;
            customFieldsParseError = 'カスタムフィールドの形式が不正です。';
          }
        } else {
          customFieldsPayload = undefined;
          customFieldsParseError = 'カスタムフィールドの形式が不正です。';
        }
      } catch (error) {
        console.error('customFields parse failed', error);
        customFieldsPayload = undefined;
        customFieldsParseError = 'カスタムフィールドの形式が不正です。';
      }
    }

    await ensurePostSettingSnapshot();
    const effectivePostSettingId = postSettingSnapshot?.id ?? postSettingId;

    const fields = {
      ...baseFields,
      postSettingId: effectivePostSettingId,
      customFields: normalizedCustomFields ?? undefined,
    };

    const failWith = async (status: number, message: string, overrideFields = fields) => {
      if (postSettingSnapshot === undefined) {
        await ensurePostSettingSnapshot();
      }
      return fail(status, {
        action: 'create',
        message,
        fields: overrideFields,
        postSetting: postSettingSnapshot ?? undefined,
      });
    };

    if (!title) {
      return await failWith(400, 'タイトルは必須です。');
    }

    if (customFieldsParseError) {
      return await failWith(400, customFieldsParseError);
    }

    const payload: Record<string, unknown> = {
      title,
      postSettingId: effectivePostSettingId,
      detailEnabled,
    };

    if (categoryId) {
      payload.categoryId = categoryId;
    }

    const publishedAt = normalizeDateInput(publishedAtRaw);
    if (publishedAt === null) {
      return await failWith(400, '公開日はYYYY-MM-DD形式で入力してください。');
    }
    if (publishedAt) {
      payload.publishedAt = publishedAt;
    }

    const status = resolveStatus(statusRaw);
    payload.status = status;

    const postedAt = normalizeDateInput(postedAtRaw);
    if (postedAt === null) {
      return await failWith(400, '投稿日はYYYY-MM-DD形式で入力してください。');
    }
    if (postedAt) {
      payload.postedAt = postedAt;
    }

    if (status === 'PUBLISHED' && !publishedAt) {
      return await failWith(400, '公開状態にする場合は公開日を指定してください。');
    }

    if (detailBody) {
      payload.detailBody = normalizeSpanColorAttributes(detailBody);
    }
    if (detailSlug) {
      payload.detailSlug = detailSlug;
    }

    if (customFieldsPayload !== undefined) {
      payload.customFields = customFieldsPayload;
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response, '投稿の作成に失敗しました。');
      return await failWith(response.status, message);
    }

    throw redirect(303, '/posts');
  },
};
