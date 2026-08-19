# HoloSpace Centralized Theme Engine Architecture (HW-DS)

All themes are single-source-of-truth defined in `modules/themes/themes.json` and consumed by:
1. `server.js` (Multi-Tenant & User Theme Endpoint: `/api/theme`)
2. `public/app.js` (Web Client Design Engine)
3. `modules/scanner/src/store/useThemeStore.ts` (Mobile Client Design Engine)

## The 5 Official Platform Themes:
1. **Omarchy Tiling** (`omarchy_tiling`) - Default
2. **Omarchy Aetheriall** (`omarchy_aetheria`)
3. **Soft Pastel** (`soft_minimal_pastel`)
4. **Dark Glass** (`dark_glassmorphism`)
5. **Cyberpunk Glass** (`cyberpunk_glassmorphism`)
