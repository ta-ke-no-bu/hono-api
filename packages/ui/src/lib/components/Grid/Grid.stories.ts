import type { Meta, StoryObj } from '@storybook/svelte';
import Grid from './Grid.svelte';

const meta = {
  title: 'UI/Layout/Grid',
  component: Grid,
  tags: ['autodocs'],
  argTypes: {
    cols: {
      control: { type: 'select' },
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      description: 'グリッドの列数',
    },
    gap: {
      control: { type: 'select' },
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96],
      description: 'グリッド間の間隔 (Tailwindのgapスケール)',
    },
    items: { control: 'object', description: 'グリッドアイテムのHTML文字列配列' }, // 新しいargType
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

const GridItem = (text: string) => `<div class="bg-blue-500 text-white p-4 rounded flex items-center justify-center h-20">${text}</div>`;

export const TwoColumns: Story = {
  args: {
    cols: 2,
    gap: 4,
    items: [ // itemsプロパティでHTML文字列の配列を渡す
      GridItem('アイテム 1'),
      GridItem('アイテム 2'),
      GridItem('アイテム 3'),
      GridItem('アイテム 4'),
    ],
  },
};

export const ThreeColumns: Story = {
  args: {
    cols: 3,
    gap: 6,
    items: [
      GridItem('アイテム A'),
      GridItem('アイテム B'),
      GridItem('アイテム C'),
      GridItem('アイテム D'),
      GridItem('アイテム E'),
      GridItem('アイテム F'),
    ],
  },
};

export const ResponsiveColumns: Story = {
  args: {
    cols: 1, // デフォルトは1列
    gap: 4,
    customClass: 'md:grid-cols-2 lg:grid-cols-3', // レスポンシブクラス
    items: [
      GridItem('レスポンシブ 1'),
      GridItem('レスポンシブ 2'),
      GridItem('レスポンシブ 3'),
      GridItem('レスポンシブ 4'),
      GridItem('レスポンシブ 5'),
      GridItem('レスポンシブ 6'),
    ],
  },
};
