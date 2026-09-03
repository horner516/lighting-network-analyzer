import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <div role="status" className="border-b border-amber-300/20 bg-amber-950 px-4 py-2 text-center text-sm text-amber-200">Demo data — automatic device discovery is not connected in this version.</div>
  <Home />
</React.StrictMode>);
