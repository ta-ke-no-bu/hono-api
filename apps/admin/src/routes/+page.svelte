<script lang="ts">
  import { Button } from '@repo/ui';
</script>

<svelte:head>
  <title>SvelteKit</title>
</svelte:head>

<h1 class="text-purple">Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<div style="margin-top: 2rem;">
  <Button label="Shared Button" variant="primary" />
  <!-- primary={true} を variant="primary" に変更 -->
</div>
