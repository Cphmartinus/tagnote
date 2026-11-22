# Privacy policy

**TagNote** is a desktop program that works on your own computer.

## Summary

- TagNote does **not** collect, store on a server, or transmit personal data.
- TagNote has **no telemetry, analytics, tracking, advertising or accounts**.
- TagNote checks GitHub for new versions at most once a day. You can turn this off on the Help tab.
- Your documents stay on your computer. TagNote only reads and writes files that you open or save.

## What is stored on your computer

| What | Where | Why |
| --- | --- | --- |
| Settings (theme, language, zoom, view mode, JavaScript choice per file) | Local browser storage inside the TagNote profile | To remember your preferences |
| List of recently opened files | A small file in the application data folder (`%APPDATA%`) | To show the recent files list |
| Automatic snapshots of your documents | The application data folder | For the version history (the 60 latest per document are kept) |

You can remove all of it by deleting the TagNote folder in `%APPDATA%`, or by uninstalling the program.

## Network access

TagNote does not contact any server of its own.

- **Update check:** At most once a day, and when you click *Search for updates*, TagNote asks GitHub's public API (`api.github.com`) which version is the newest. No document content or personal data is sent, but GitHub can see your IP address, as with any web request.
- **The page you are previewing:** A page can ask for stylesheets, fonts, images or scripts from the internet, for example from a CDN. The preview loads them like a browser does, and the owner of that server can see the request. This is how Bootstrap, Tailwind and Google Fonts links work.
- **JavaScript in the preview:** By default no script in the page runs. If you turn JavaScript on, the page's scripts may contact the internet. The page runs in an isolated frame and cannot read your other files.
- **Links:** When you Ctrl+click a web link in the preview, it is opened in your default browser.

## Export and conversion

Exporting to PDF, HTML, Markdown and text, and converting the page, happen entirely on your computer.

## Contact

Questions about this policy: open an [issue](https://github.com/Cphmartinus/tagnote/issues).
