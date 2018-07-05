import React from 'react';
import Router from './Router';
import { Provider } from './store';

export default function App() {
  return (
    <div>
      <Provider>
        <Router />
      </Provider>
    </div>
  );
}
