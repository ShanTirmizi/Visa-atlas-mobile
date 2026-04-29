module.exports = {
  get Image() {
    // Lazy-load React to avoid circular dependencies
    const React = require('react');
    const { Image: RNImage } = require('react-native');
    return React.forwardRef((props, ref) => {
      const { source, placeholder, contentFit, transition, style, ...rest } = props;
      return React.createElement(RNImage, { ref, source, style, ...rest });
    });
  },
};
