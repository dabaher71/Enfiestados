// Regla: ningún hex literal fuera de src/theme/
export default [
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
