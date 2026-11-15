import '@vircuitcad/ui/tokens.css';
import '@vircuitcad/ui/base.css';

import { createRoot } from 'react-dom/client';

import { App } from './App';

document.documentElement.dataset.theme = 'dark';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
