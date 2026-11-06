// Bundle de la landing (public/assets/landing.js). Se compila con:
//   npm run build:web
// Monta los teléfonos y entradas animados del diseño "Enfiestados Web" de
// Claude Design en los <div data-live-phone> / <div data-live-ticket> de
// public/index.html. Sin JavaScript la página se ve igual, solo sin esas
// animaciones.
import './setup-react.js';
import { createRoot } from 'react-dom/client';
import './design/promo-core.jsx';
import './design/promo-scenes-a.jsx';
import './design/promo-scenes-b.jsx';
import './design/promo-scenes-c.jsx';
import './design/promo-app.jsx';
import './design/web-live.jsx';

const React = window.React;
const { LivePhone, LiveTicket } = window.EW;
const num = (v, d) => (v == null || v === '' ? d : Number(v));

document.querySelectorAll('[data-live-phone]').forEach((el) => {
  createRoot(el).render(React.createElement(LivePhone, {
    mode: el.dataset.livePhone || 'feed',
    offset: num(el.dataset.offset, 0),
  }));
});
document.querySelectorAll('[data-live-ticket]').forEach((el) => {
  createRoot(el).render(React.createElement(LiveTicket, {
    idx: num(el.dataset.liveTicket, 0),
    offset: num(el.dataset.offset, 0),
    notch: el.dataset.notch || '#FBFAF7',
  }));
});
