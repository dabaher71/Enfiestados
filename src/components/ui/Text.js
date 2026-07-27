import { Text as RNText } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// Variantes: display | h1 | h2 | h3 | title | subtitle | body | bodyStrong |
//            label | caption | overline | tabLabel
// A partir de este componente, ningún Text crudo debe usar fontSize literal.

export default function Text({
  variant = 'body',
  color,        // token key e.g. 'text.primary' — por defecto text.primary
  align,
  numberOfLines,
  style,
  children,
  ...rest
}) {
  const { colors, font } = useTheme();
  const variantStyle = font[variant] ?? font.body;
  const resolvedColor = color ? (colors[color] ?? color) : colors['text.primary'];

  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[variantStyle, { color: resolvedColor }, align && { textAlign: align }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
