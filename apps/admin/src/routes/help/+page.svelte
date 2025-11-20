<!--
  ヘルプページ
  - カテゴリ管理、投稿手順、カスタムフィールドについて解説します。
  - 左にナビゲーション、右にコンテンツの2カラムレイアウトを採用します。
-->
<script lang="ts">
  import { onMount } from 'svelte';

  let activeSection = 'overview';
  const sections = [
    { id: 'overview', title: 'はじめに' },
    { id: 'categories', title: 'カテゴリの整理' },
    { id: 'post-settings', title: '投稿設定（テンプレート）' },
    { id: 'posts', title: '投稿の作成と公開' },
    { id: 'custom-fields', title: 'カスタムフィールドの使い方' },
    { id: 'support', title: '困ったときは' },
  ];

  // スクロールに応じてアクティブなセクションを更新するロジック（IntersectionObserver）
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeSection = entry.target.id;
          }
        });
      },
      { rootMargin: '-50% 0px -50% 0px' }, // 画面の中央に来たものをアクティブにする
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  });
</script>

<div class="p-8">
  <header class="mb-10 border-b pb-4">
    <h1 class="text-3xl font-bold">管理画面ヘルプ</h1>
    <p class="mt-2 text-sm text-gray-600">このページでは、管理画面の基本的な使い方について解説します。</p>
  </header>

  <div class="grid grid-cols-1 gap-12 md:grid-cols-4">
    <!-- サイドナビゲーション -->
    <aside class="md:col-span-1 md:sticky md:top-8 self-start">
      <nav>
        <ul class="space-y-2">
          {#each sections as section}
            <li>
              <a
                href="#{section.id}"
                class="block rounded-md px-3 py-2 text-sm font-medium transition"
                class:bg-indigo-50={activeSection === section.id}
                class:text-indigo-700={activeSection === section.id}
                class:text-gray-600={activeSection !== section.id}
                class:hover:bg-gray-100={activeSection !== section.id}
              >
                {section.title}
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    </aside>

    <!-- メインコンテンツ -->
    <main class="prose prose-indigo max-w-none md:col-span-3">
      <section id="overview" class="scroll-mt-20">
        <h2>1. はじめに</h2>
        <p>
          この管理画面では、Webサイトに掲載する情報をまとめて管理できます。画面の構成と役割を最初に押さえておきましょう。
        </p>
        <ul>
          <li><strong>左側メニュー</strong>: 「投稿」「カテゴリ」「投稿設定」などの機能へ移動できます。</li>
          <li><strong>ページ上部の案内</strong>: 表示中の画面名と説明文があり、作業の目的を再確認できます。</li>
          <li>
            <strong>右上のボタン</strong>: 「新規投稿」や「新規投稿設定を作成」など、よく使う操作がまとまっています。
          </li>
        </ul>
        <p>以下では、よく利用する機能の手順を順番にご紹介します。</p>
      </section>

      <section id="categories" class="scroll-mt-20 pt-12">
        <h2>2. カテゴリの整理</h2>
        <p>
          カテゴリは投稿を大まかなテーマごとに分けるためのラベルです。まずは必要なカテゴリを整えておくと、投稿が探しやすくなります。
        </p>

        <h3>カテゴリを追加する</h3>
        <ol>
          <li>左メニューの<strong>「カテゴリ」</strong>を開きます。</li>
          <li>
            ページ上部の<strong>「カテゴリを追加」</strong>欄に、<strong>カテゴリ名</strong>（例:
            お知らせ）を入力します。
          </li>
          <li>
            必要に応じて<strong>スラッグ（任意）</strong
            >も入力します。英数字とハイフンのみ利用でき、URLの一部になります。
          </li>
          <li><strong>「カテゴリを作成」</strong>ボタンを押すと、一覧に追加されます。</li>
        </ol>
        <div class="rounded-md border border-l-4 border-indigo-500 bg-indigo-50 p-4">
          <p class="text-sm text-indigo-700">
            スラッグを未入力のまま保存すると、システムが自動で分かりやすい文字列を生成します。迷った場合は空欄のままで問題ありません。
          </p>
        </div>

        <h3>既存カテゴリの更新・削除</h3>
        <p>
          一覧に表示される各カテゴリには入力欄が並んでいます。名前やスラッグを修正したら<strong>「更新」</strong
          >を押して保存します。不要になった場合は<strong>「削除」</strong
          >を押すと確認メッセージが表示され、安全に削除できます。
        </p>
      </section>

      <section id="post-settings" class="scroll-mt-20 pt-12">
        <h2>3. 投稿設定（テンプレート）</h2>
        <p>
          投稿設定は「どんな項目を入力するか」を決めるテンプレートです。イベント情報や製品紹介など、用途ごとに入力欄をカスタマイズできます。
        </p>

        <h3>新しい投稿設定を作成する</h3>
        <ol>
          <li>左メニューの<strong>「投稿設定」</strong>を開きます。</li>
          <li>右上の<strong>「新規投稿設定を作成」</strong>を押します。</li>
          <li>テンプレート名とスラッグを入力し、必要な項目（カスタムフィールド）を追加します。</li>
          <li>保存すると一覧に表示され、投稿作成時に選べるようになります。</li>
        </ol>

        <h3>状態の切り替えと管理</h3>
        <ul>
          <li><strong>有効</strong>にすると、投稿作成画面で利用できるようになります。</li>
          <li><strong>無効</strong>にすると、既存の投稿には影響せず、新規投稿では選べなくなります。</li>
          <li>テンプレートが不要になった場合は<strong>「削除」</strong>で整理できます。</li>
        </ul>
      </section>

      <section id="posts" class="scroll-mt-20 pt-12">
        <h2>4. 投稿の作成と公開</h2>
        <p>
          投稿はWebサイトに掲載する記事やお知らせです。テンプレート（投稿設定）を選ぶことで、必要な入力欄が自動で表示されます。
        </p>

        <h3>基本の入力項目</h3>
        <ol>
          <li>左メニューの<strong>「投稿」</strong>を開き、右上の<strong>「新規投稿」</strong>を押します。</li>
          <li>
            画面上部に表示される<strong>投稿設定</strong
            >を確認します。切り替えたい場合は一覧画面のフィルターから選び直してください。
          </li>
          <li><strong>タイトル</strong>と<strong>カテゴリ</strong>を入力します。</li>
          <li>
            <strong>状態</strong
            >では「下書き」「公開」「アーカイブ」から選べます。公開を選ぶ場合は、後述の公開日も設定してください。
          </li>
          <li><strong>投稿日</strong>はサイト上の表示順に使われます。過去の日付も指定できます。</li>
          <li>
            <strong>公開日</strong>はカレンダーから選択できます。公開状態にする際は空欄にしないようご注意ください。
          </li>
          <li>本文は画面中央の編集エリアで作成します。太字や見出しなど簡単な装飾が使えます。</li>
        </ol>

        <h3>詳細ページを活用する</h3>
        <p>
          <strong>「詳細ページを生成」</strong
          >にチェックを付けると、個別ページが作成されます。スラッグには半角英数字とハイフンのみ入力でき、例として
          <code>spring-update</code> のように短く分かりやすい名前にします。
        </p>

        <h3>投稿後の操作</h3>
        <ul>
          <li>投稿一覧で各行の<strong>「編集」</strong>を押すと内容を修正できます。</li>
          <li>不要になった投稿は一覧から<strong>「削除」</strong>を選び、表示される確認で決定します。</li>
          <li>一覧上部の絞り込みで、カテゴリや投稿設定ごとに表示する投稿を切り替えられます。</li>
        </ul>
      </section>

      <section id="custom-fields" class="scroll-mt-20 pt-12">
        <h2>5. カスタムフィールドの使い方</h2>
        <p>
          カスタムフィールドは、テンプレートごとに自由な入力欄を追加できる仕組みです。数値や日付、複数の選択肢など、必要な情報を漏れなく集められます。
        </p>

        <h3>よく使うフィールド例</h3>
        <ul>
          <li><strong>テキスト</strong>: 短いメモや補足を入力するときに使います。</li>
          <li><strong>リッチテキスト</strong>: 太字やリストを含む長めの文章を入力します。</li>
          <li><strong>日付</strong>: イベント日や受付期限など、日付の入力に向いています。</li>
          <li><strong>ファイル</strong>: 画像や資料（PDF など）をアップロードできます。</li>
          <li>
            <strong>セレクト / チェックボックス</strong>: あらかじめ用意した選択肢から一つ、または複数を選べます。
          </li>
        </ul>

        <h3>繰り返しやグループを使うとき</h3>
        <ol>
          <li>テンプレート作成画面で<strong>「グループ」</strong>や<strong>「繰り返し」</strong>を追加します。</li>
          <li>グループの中に必要な項目（例: 「日時」「場所」「参加費」など）を追加します。</li>
          <li>投稿作成画面では、必要な数だけグループを増やして入力できます。</li>
        </ol>
      </section>

      <section id="support" class="scroll-mt-20 pt-12">
        <h2>6. 困ったときは</h2>
        <ul>
          <li>
            投稿設定が表示されない場合は、対象のテンプレートが<strong>有効</strong>になっているか確認してください。
          </li>
          <li>
            メールが届かないときは、左メニューの<strong>「設定」→「contact」</strong
            >で送信元メールや通知先を見直します。
          </li>
          <li>フォームから届いたお問い合わせは、左メニューの<strong>「問い合わせ」</strong>で内容を確認できます。</li>
          <li>
            解決しない場合は、管理画面右上のプロフィールメニューまたは社内窓口からシステム担当者へご連絡ください。
          </li>
        </ul>
      </section>
    </main>
  </div>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  /* proseのスタイルを一部上書き */
  :global(.prose h2) {
    @apply mb-4 text-2xl font-bold tracking-tight text-gray-900 border-b pb-2;
  }
  :global(.prose h3) {
    @apply mt-8 mb-3 text-xl font-semibold tracking-tight text-gray-800;
  }
  :global(.prose p, .prose ul, .prose ol) {
    @apply text-base text-gray-700;
  }
  :global(.prose strong) {
    @apply font-semibold text-gray-800;
  }
  :global(.prose a) {
    @apply text-indigo-600 no-underline hover:underline;
  }
  :global(.prose ol) {
    @apply list-decimal list-outside pl-6;
  }
  :global(.prose ul) {
    @apply list-disc list-outside pl-6;
  }
  :global(.prose li) {
    @apply my-2;
  }
</style>
