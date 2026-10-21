# TAYSSIR-BAC — preserved design

Arabic RTL examination correction dashboard. Preserve the supplied application's layout, navigation, and offline data while adding a manual supervisor assignment flow.

## Visual language

- Midnight `#0F172A` canvas, slate `#1E293B` panels and cyan `#38BDF8` action color; emerald for saved, amber for pending, red for conflicts.
- Arabic-friendly `Tajawal, Cairo, sans-serif`; compact 11–14px labels, bold headings and generous line height.
- Keep the existing right-side navigation and dense table/list style with 12–20px rounded corners; on mobile, controls wrap and lists scroll independently.

## Flow and architecture

- Web home (`packages/web/src/web/pages/index.tsx`) displays the supplied app unchanged inside a managed React shell.
- The new distribution interaction is rendered in the existing engine axis: committee → observer → manual capacity and eligible series grouped by branch → persist → run first distribution for remaining series only.
- The supplied application is retained under `packages/web/public/legacy/` with its destructive every-load data purge disabled and outdated automatic-supervisor text corrected. Integration and assignment logic live in managed React source. Existing localStorage keys stay compatible; no backend or login is needed.
