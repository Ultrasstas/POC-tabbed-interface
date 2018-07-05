import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div>
      <h1>Not found page</h1>
      <hr />
      <Link to="/">Go home</Link>
    </div>
  );
}
