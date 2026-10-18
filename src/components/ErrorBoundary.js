/* eslint-disable no-restricted-syntax -- Excepción deliberada a la regla de
   tokens: este boundary es la última red de la app y tiene que renderizar
   aunque lo que haya fallado sea el ThemeProvider, así que no puede llamar a
   useTheme(). Los hex de abajo replican darkColors de src/theme/tokens.js. */
import { Component } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { recordError } from '../lib/crashReporting';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    recordError(error, `ErrorBoundary: ${info?.componentStack?.slice(0, 200) || ''}`);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'Error inesperado'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Único lugar donde los colores van hardcodeados a propósito: este boundary
// tiene que poder renderizar aunque el que haya reventado sea el ThemeProvider,
// así que no puede depender de useTheme(). Los valores son los mismos de
// darkColors en src/theme/tokens.js — si cambian allá, cambiarlos acá también.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17131F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F7F4EF',
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: '#C6BFD6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#8B6BFF',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
  },
  buttonText: {
    color: '#F7F4EF',
    fontSize: 15,
    fontWeight: '600',
  },
});
