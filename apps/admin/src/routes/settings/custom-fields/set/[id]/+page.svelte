<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const pageStore = page;

  onMount(() => {
    const unsubscribe = pageStore.subscribe(($page) => {
      goto(`/post-settings/${$page.params.id}`, { replaceState: true });
      unsubscribe();
    });
    return unsubscribe;
  });
</script>

<p class="p-8 text-sm text-gray-600">投稿設定ページへ移動しています…</p>
