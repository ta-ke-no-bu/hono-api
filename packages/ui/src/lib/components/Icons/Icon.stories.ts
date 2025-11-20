import type { Meta, StoryObj } from '@storybook/svelte';
import Icon from './Icon.svelte';

const meta = {
  title: 'UI/Icon',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: { type: 'select' },
      options: ['check', 'x', 'info', 'alert', 'home'],
      description: 'アイコンの名前',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'アイコンのサイズ',
    },
    color: {
      control: { type: 'select' },
      options: ['currentColor', 'text-blue-500', 'text-red-500', 'text-green-500'],
      description: 'アイコンの色 (Tailwindクラス)',
    },
    customClass: { control: 'text', description: '追加のCSSクラス' },
  },
} satisfies Meta<Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Check: Story = {
  args: {
    name: 'check',
    size: 'md',
    color: 'currentColor',
  },
};

export const X: Story = {
  args: {
    name: 'x',
    size: 'md',
    color: 'currentColor',
  },
};

export const Info: Story = {
  args: {
    name: 'info',
    size: 'md',
    color: 'text-blue-500',
  },
};

export const Alert: Story = {
  args: {
    name: 'alert',
    size: 'lg',
    color: 'text-red-500',
  },
};

export const Home: Story = {
  args: {
    name: 'home',
    size: 'sm',
    color: 'text-green-500',
  },
};
