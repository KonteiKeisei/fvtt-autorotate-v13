# Changelog

All notable changes to this project will be documented in this file.

## [1.4.4] - 2025-11-02

### Added
- Core setting conflict detection: Module now warns users if Foundry's built-in automatic token rotation is enabled, which conflicts with this module's functionality
- Persistent warning notification displays on world load when core auto-rotate is detected

## [1.4.3] - 2025-11-02

### Fixed
- Token configuration settings now correctly appear in the **Appearance** tab 

## [1.3.18] - Previous Release

### Features (Existing)
- Automatic token rotation based on movement direction
- Token rotation when targeting other tokens
- Configurable rotation offset per token
- Global default rotation mode setting
- Per-token enable/disable controls
- Support for Shift + Arrow keys to rotate without moving
- Rideable module compatibility

---

## Migration Notes: V11/V12 → V13

### What Changed
1. **ApplicationV2 Architecture**: TokenConfig now uses Foundry's new ApplicationV2 system
2. **Data Access**: Token document accessed via `app.document` instead of `data.object`
3. **Form Injection**: Switched to direct jQuery DOM manipulation matching V13 patterns
4. **Tab Structure**: Updated selectors to work with V13's form structure

### Compatibility
- **V13+**: Use version 1.4.0 or later
- **V10-V12**: Use version 1.3.18 or earlier

### Known Issues
- None currently reported

---

## Fork Information

This V13-compatible fork is maintained at: https://github.com/KonteiKeisei/fvtt-autorotate-v13

Original module by Varriount: https://github.com/Varriount/fvtt-autorotate
