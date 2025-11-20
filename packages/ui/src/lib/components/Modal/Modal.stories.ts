import type { Meta, StoryObj } from '@storybook/svelte';
import Modal from './Modal.svelte';
import Button from '../Button/Button.svelte'; // Buttonコンポーネントをインポート

const meta = {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    isOpen: { control: 'boolean', description: 'モーダルの表示/非表示' },
    title: { control: 'text', description: 'モーダルのタイトル' },
    bodyContent: { control: 'text', description: 'モーダルのボディコンテンツ (HTML)' }, // 新しいargType
    footerContent: { control: 'text', description: 'モーダルのフッターコンテンツ (HTML)' }, // 新しいargType
    closeOnOverlayClick: { control: 'boolean', description: 'オーバーレイクリックで閉じるか' },
    customClass: { control: 'text', description: '追加のCSSクラス' },
    onClose: { action: 'close', description: 'モーダルが閉じられたときのイベント' },
  },
  parameters: {
    backgrounds: { disable: true },
  },
} satisfies Meta<Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    title: 'デフォルトモーダル',
    bodyContent: `
      <p>これはモーダルのコンテンツです。</p>
      <p>ここに様々な情報やフォーム要素を配置できます。</p>
    `,
    footerContent: `
      <Button variant="secondary" label="キャンセル" />
      <Button variant="primary" label="保存" />
    `,
    closeOnOverlayClick: true,
  },
};

export const NoTitle: Story = {
  args: {
    isOpen: true,
    title: '', // タイトルなし
    bodyContent: `
      <p>タイトルなしのモーダルです。</p>
      <p>コンテンツのみが表示されます。</p>
    `,
    footerContent: '', // フッターなし
    closeOnOverlayClick: true,
  },
};

export const NoOverlayClose: Story = {
  args: {
    isOpen: true,
    title: 'オーバーレイで閉じないモーダル',
    bodyContent: `
      <p>このモーダルは、オーバーレイをクリックしても閉じません。</p>
      <p>閉じるには、右上のXボタンか、フッターのボタンを使用してください。</p>
    `,
    footerContent: `
      <Button variant="primary" label="閉じる" />
    `,
    closeOnOverlayClick: false,
  },
};