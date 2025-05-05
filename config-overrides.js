module.exports = function override(config, env) {
    config.resolve = {
      ...config.resolve,
      fallback: {
        crypto: false,
        stream: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
        zlib: false,
      },
    };
  
    config.module.rules = config.module.rules.map(rule => {
      if (rule.loader && rule.loader.includes('source-map-loader')) {
        return {
          ...rule,
          exclude: [/node_modules/],
        };
      }
      return rule;
    });
  
    return config;
  };