import React from 'react';
import { Router as BrowserRouter, Route, Switch } from 'react-router-dom';
import history from './services/history';
import { MainContainer, NotFound } from './components';

export default function Router() {
  return (
    <BrowserRouter history={history}>
      <Switch>
        <Route exact path="/" component={MainContainer} />
        <Route component={NotFound} />
      </Switch>
    </BrowserRouter>
  );
}
