import type { Preview } from '@storybook/sveltekit'
import '../src/styles/global.css'; // global.css をインポート

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
