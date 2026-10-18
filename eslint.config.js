// Regla: ningún hex literal fuera de src/theme/
//
// languageOptions es obligatorio: sin ecmaFeatures.jsx el parser por defecto
// (espree) revienta con "Unexpected token <" en el primer return de cualquier
// componente, y entonces la regla de abajo nunca llega a evaluarse. Estuvo así
// un tiempo, y por eso pasaron desapercibidos los hex de la paleta vieja en
// LoadingScreen, ErrorBoundary y App.js.
export default [
  // El parser se configura aparte de la regla, y SIN `ignores`: src/theme/ está
  // exento de la regla de hex (es donde viven los tokens), pero igual necesita
  // parsearse — si no, ThemeProvider.js vuelve a fallar con "Unexpected token <".
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ['src/**/*.js'],
    ignores: ['src/theme/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/#([0-9a-fA-F]{3,8})/]",
          message: "Color hex hardcodeado. Usá colors['token'] vía useTheme() — los tokens viven en src/theme/tokens.js.",
        },
      ],
    },
  },
];
