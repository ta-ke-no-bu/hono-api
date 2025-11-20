import type { Meta, StoryObj } from '@storybook/svelte';
import Flex from './Flex.svelte';

const meta = {
  title: 'UI/Layout/Flex',
  component: Flex,
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: { type: 'select' },
      options: ['row', 'row-reverse', 'col', 'col-reverse'],
      description: 'フレックスの方向',
    },
    justify: {
      control: { type: 'select' },
      options: ['start', 'end', 'center', 'between', 'around', 'evenly'],
      description: '主軸方向の配置',
    },
    align: {
      control: { type: 'select' },
      options: ['start', 'end', 'center', 'baseline', 'stretch'],
      description: '交差軸方向の配置',
    },
    gap: {
      control: { type: 'select' },
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96],
      description: '子要素間の間隔',
    },
    wrap: {
      control: { type: 'select' },
      options: ['wrap', 'wrap-reverse', 'nowrap'],
      description: '折り返し',
    },
    items: { control: 'object', description: 'フレックスアイテムのHTML文字列配列' }, // 新しいargType
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Flex>;

export default meta;
type Story = StoryObj<typeof meta>;

const FlexItem = (text: string, height: string = 'h-12') => `<div class="bg-blue-500 text-white p-4 rounded flex items-center justify-center ${height}">${text}</div>`;

export const RowDirection: Story = {
  args: {
    direction: 'row',
    justify: 'start',
    align: 'center',
    gap: 4,
    items: [ // itemsプロパティでHTML文字列の配列を渡す
      FlexItem('アイテム 1'),
      FlexItem('アイテム 2'),
      FlexItem('アイテム 3'),
    ],
  },
};

export const ColumnDirection: Story = {
  args: {
    direction: 'col',
    justify: 'start',
    align: 'start',
    gap: 4,
    items: [
      FlexItem('アイテム A'),
      FlexItem('アイテム B'),
      FlexItem('アイテム C'),
    ],
  },
};

export const JustifyCenter: Story = {
  args: {
    direction: 'row',
    justify: 'center',
    align: 'center',
    gap: 4,
    items: [
      FlexItem('アイテム 1'),
      FlexItem('アイテム 2'),
    ],
  },
};

export const AlignEnd: Story = {
  args: {
    direction: 'row',
    justify: 'start',
    align: 'end',
    gap: 4,
    items: [
      FlexItem('アイテム 1', 'h-16'),
      FlexItem('アイテム 2', 'h-12'),
      FlexItem('アイテム 3', 'h-20'),
    ],
  },
};

export const WithWrap: Story = {
  args: {
    direction: 'row',
    wrap: 'wrap',
    gap: 4,
    customClass: 'w-64', // 親要素の幅を制限して折り返しをテスト
    items: [
      FlexItem('アイテム 1'),
      FlexItem('アイテム 2'),
      FlexItem('アイテム 3'),
      FlexItem('アイテム 4'),
      FlexItem('アイテム 5'),
      FlexItem('アイテム 6'),
    ],
  },
};