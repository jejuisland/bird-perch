module.exports = function (api) {
  api.cache(true);
  return {
    presets: [require('babel-preset-expo')],
    plugins: [require('react-native-reanimated/plugin')],
  };
};
