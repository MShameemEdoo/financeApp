import React from 'react';
import QuickAddFab from './QuickAddFab';
import ToastHost from './Toast';
import { layout } from '../theme';

// Drop <Overlays fab /> at the end of a screen: the floating "+" (main tabs) and the toast.
export default function Overlays({ fab = false }) {
  return (
    <>
      {fab && <QuickAddFab />}
      <ToastHost bottom={fab ? layout.fabBottom + layout.fabSize + 12 : 16} />
    </>
  );
}
