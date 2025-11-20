import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const DASHBOARD_LIMIT = 5;
const DASHBOARD_POST_LIMIT = 5;

export const load: PageServerLoad = async ({ locals, cookies, fetch }) => {
  // hooks.server.tsで認証済みでなければリダイレクトされるので、ここではuserが必ず存在する
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const token = cookies.get('session');
  if (!token) {
    throw redirect(303, '/login');
  }

  let contacts: {
    id: string;
    formId: string;
    formName: string;
    formSlug: string;
    displayName: string | null;
    displayEmail: string | null;
    displaySubject: string | null;
    emailStatus: string;
    createdAt: string;
    updatedAt: string;
  }[] = [];

  let posts: {
    id: string;
    title: string;
    format: string;
    categoryName: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
  }[] = [];

  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/contact?limit=${DASHBOARD_LIMIT}&page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.data) && typeof data?.meta === 'object') {
        contacts = data.data;
      } else if (Array.isArray(data)) {
        contacts = data.slice(0, DASHBOARD_LIMIT);
      }
    } else {
      console.error('Failed to fetch contacts:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Error fetching contacts:', error);
  }

  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/app/api/posts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        posts = data.slice(0, DASHBOARD_POST_LIMIT);
      }
    } else {
      console.error('Failed to fetch posts:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
  }

  return {
    contacts,
    posts,
  };
};
