import type { Meta, StoryObj } from '@storybook/svelte';
import Spinner from './Spinner.svelte';

const meta = {
  title: 'UI/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'スピナーのサイズ',
    },
    color: {
      control: { type: 'select' },
      options: ['text-blue-500', 'text-red-500', 'text-green-500', 'text-gray-500'],
      description: 'スピナーの色 (Tailwindクラス)',
    },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'md',
    color: 'text-blue-500',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    color: 'text-gray-500',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    color: 'text-green-500',
  },
};

export const Red: Story = {
  args: {
    size: 'md',
    color: 'text-red-500',
  },
};
