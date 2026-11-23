# Changelog

## 0.2.0

TagNote can now be used without knowing HTML, CSS or JavaScript.

- **Simple mode (new default):** the page is shown without code, the ribbon uses plain words, and technical tools are hidden. Advanced mode has everything from 0.1.0. Switch in the status bar or under Settings.
- **Templates:** New gives a choice of an empty page, a personal page, a café or shop, a club, and a portfolio.
- **Insert in the page:** heading, text, list, quote, picture, video, button, link, two and three columns, cards, table, divider and space, placed below what you clicked.
- **Small toolbar** next to the selected part: bold, italic, size, colour, alignment, look, move, copy, delete.
- **Look panel** for the selected part, and **Design** for the whole page: colour themes, fonts, space, corners, shadow and page width.
- **Effects** are applied to the selected part, without CSS selectors.
- **Save as a website folder:** the first save creates a folder with index.html; pictures are copied into a billeder folder, also on Save as.
- **Check the page** in plain language, with Fix buttons for missing title, language, description, picture descriptions and more.
- **Help on the spot:** a short tour on first start, a ? on each ribbon group, friendly names (Button, Heading, Picture) in the selection and breadcrumbs, and a plain-language message when a page needs to run to work.
- New pages start as a valid HTML5 page.
- Fixes: a redraw no longer overwrites code changes or keystrokes; pictures no longer overflow small screens in templates; AltGr characters always type; Ctrl+/ comments on Nordic keyboards.

## 0.1.0

First version.

- Word-style HTML editor and viewer, built on the MarkNote shell (ribbon, tabs, themes, find and replace, version history, 13 interface languages for the shared texts).
- Source view with colour highlighting, live preview in an isolated frame, side-by-side and view-only modes, device widths.
- JavaScript in the preview in three modes: off (default), known libraries only, on.
- Visual editing in the preview, written back to the code. Style panel for the selected element.
- Framework tabs for Bootstrap, Tailwind CSS, Bulma and Pico: components, class pickers, breakpoints.
- Effects: scroll animations, hover transitions, keyframe animations, gradients, shadows, glass, scroll snap, sticky, reading progress.
- Design tools: colour palette (OKLCH), fluid sizes with clamp(), CSS variables, font pairs, page check.
- Export to PDF, clean HTML, Markdown and plain text.
- Electron 45. Windows installer and portable build from GitHub Actions.
