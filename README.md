# Daily Song Recommendation

A static website to recommend a song every day, hosted on GitHub Pages.

## How to Use

1. **Add Songs**:
   - Place your MP3 files in `assets/audio/`.
   - Place cover images in `assets/images/`.
   - Update `data/songs.json` with the file paths and metadata.

2. **Configuration**:
   - Edit `data/songs.json` to schedule songs for specific dates (YYYY-MM-DD).

3. **Deploy**:
   - Push this repository to GitHub.
   - Enable GitHub Pages in the repository settings (Source: `main` branch, root folder).
   - Share the generated link!

## Development

- Open `index.html` in your browser to test locally.
- Note: Due to browser security policies (CORS), some features might not work if you just double-click the HTML file. It's recommended to run a local server (e.g., `python3 -m http.server` or VS Code Live Server).

## File Structure

- `index.html`: Main player page.
- `history.html`: List of past songs.
- `css/`: Stylesheets.
- `js/`: Application logic.
- `assets/`: Media files.
- `data/`: JSON configuration.

## Credits

- Demo Audio: SoundHelix
- Demo Images: Picsum Photos
