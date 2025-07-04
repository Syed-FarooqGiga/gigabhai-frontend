module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Handle path aliases
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@components': './src/components',
            '@utils': './src/utils',
            '@contexts': './src/contexts',

          },
        },
      ],
      // Support for react-native-reanimated
      'react-native-reanimated/plugin',
    ],
  };
};
