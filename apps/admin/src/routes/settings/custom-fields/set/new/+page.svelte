<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const pageStore = page;

  onMount(() => {
    const unsubscribe = pageStore.subscribe(() => {
      goto('/post-settings/new', { replaceState: true });
      unsubscribe();
    });
    return unsubscribe;
  });
</script>

<p class="p-8 text-sm text-gray-600">投稿設定作成ページへ移動しています…</p>
