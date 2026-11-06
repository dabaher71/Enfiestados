// Los componentes del diseño (web-src/design/*.jsx) son IIFEs que usan React
// global, como en Claude Design. Este módulo va primero en landing.jsx para
// que window.React exista antes de que se evalúen.
import * as React from 'react';
window.React = React;
