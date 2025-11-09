module.exports = ({ config }) => {
  // The `config` object is the original `app.json` contents.
  // We can dynamically modify it here.

  // If the GEMINI_API_KEY environment variable is set, add it to the app's extra config.
  if (process.env.GEMINI_API_KEY) {
    config.extra = {
      ...config.extra,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    };
  }

  // Return the modified config.
  return {
    ...config,
  };
};
