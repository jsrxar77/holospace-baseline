const themes = require('./themes.json');

module.exports = {
  THEMES: themes,
  DEFAULT_THEME: themes.omarchy_tiling,
  getTheme: (key) => themes[key] || themes.omarchy_tiling,
  listThemes: () => Object.values(themes)
};
