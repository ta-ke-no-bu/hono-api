import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const { token } = locals;
  if (!token) {
    throw redirect(303, '/login');
  }

  const { id } = params;
  if (!id) {
    throw error(400, 'ID is required');
  }

  const response = await fetch(`${locals.apiBase}/app/api/contact/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch contact details' }));
    throw error(response.status, errorData.message || 'Failed to fetch contact details');
  }

  const contact = await response.json();

  return {
    contact,
  };
};
