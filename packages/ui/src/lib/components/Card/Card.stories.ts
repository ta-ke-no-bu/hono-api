import type { Meta, StoryObj } from '@storybook/svelte';
import Card from './Card.svelte';
import Button from '../Button/Button.svelte'; // フッターにボタンを使用する例のため

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text', description: 'カードのタイトル' },
    imageSrc: { control: 'text', description: '画像のURL' },
    bodyContent: { control: 'text', description: '本文コンテンツ (HTML)' },
    footerContent: { control: 'text', description: 'フッターコンテンツ (HTML)' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'カードタイトル',
    bodyContent: '<p>これはカードの本文です。ここに詳細な情報や説明が入ります。</p>',
  },
};

export const WithImage: Story = {
  args: {
    title: '美しい風景',
    imageSrc: 'https://placehold.jp/600x400.png', // 仮の画像URL
    bodyContent: '<p>このカードには美しい風景の画像が含まれています。</p>',
  },
};

export const WithFooter: Story = {
  args: {
    title: 'アクションカード',
    bodyContent: '<p>このカードにはフッターにアクションボタンがあります。</p>',
    footerContent: `<Button label="詳細を見る" variant="primary" />`,
  },
};

export const FullContent: Story = {
  args: {
    title: '完全なカード',
    imageSrc: 'https://placehold.jp/600x300.png',
    bodyContent: `
      <p>これは画像、タイトル、本文、フッターを含む完全なカードの例です。</p>
      <ul>
        <li>リストアイテム1</li>
        <li>リストアイテム2</li>
      </ul>
    `,
    footerContent: `<Button label="もっと読む" variant="secondary" />`,
  },
};

export const OnlyBody: Story = {
  args: {
    bodyContent: '<p>タイトルも画像もフッターもない、本文だけのシンプルなカードです。</p>',
  },
};
