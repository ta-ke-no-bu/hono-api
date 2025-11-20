import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Assuming CustomFieldDefinition and CustomFieldSet are defined elsewhere or here
// For brevity, let's assume they are available.

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

export const load: PageServerLoad = async ({ params, locals, cookies, fetch }) => {
  const token = resolveSessionToken(locals, cookies);
  const [definitionRes, setsRes] = await Promise.all([
    fetch(`${PUBLIC_API_BASE_URL}/app/api/custom-fields/definitions/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${PUBLIC_API_BASE_URL}/app/api/custom-fields/sets`, {
      // Fetch all sets for the parent selection
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!definitionRes.ok) {
    throw error(definitionRes.status, 'Failed to fetch custom field definition');
  }
  if (!setsRes.ok) {
    throw error(setsRes.status, 'Failed to fetch custom field sets');
  }

  const definition = await definitionRes.json();
  const sets = await setsRes.json();

  // ToDo: Fetch definitions for the parent field dropdown as well

  return { definition, sets };
};

export const actions: Actions = {
  updateDefinition: async ({ request, params, locals, cookies, fetch }) => {
    const token = resolveSessionToken(locals, cookies);
    const formData = await request.formData();

    const payload = {
      label: String(formData.get('label') ?? '').trim(),
      slug: String(formData.get('slug') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || undefined,
      // Add other fields like config, validation etc.
    };

    if (!payload.label || !payload.slug) {
      return fail(400, {
        success: false,
        message: 'Label and slug are required.',
      });
    }

    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/custom-fields/definitions/${params.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await response.text();
      return fail(response.status, {
        success: false,
        message: message || 'Failed to update definition.',
      });
    }

    throw redirect(303, '/settings/custom-fields');
  },
};
