# Daily Song Recommendation

A static website to recommend a song every day, hosted on GitHub Pages.

## How to Use

1. **Add Songs**:
   - Put audio files in `assets/audio/` (recommended: `.mp3`).
   - Put cover/background images in `assets/images/`.
   - Update `data/songs.json` to point to your files (relative paths), or keep using remote URLs.

2. **Configuration**:
   - **Likes Feature**:
     - Uses free [CountAPI](https://countapi.xyz/). No registration or configuration required.
     - Just works out of the box.

   - **Songs**:
     - Edit `data/songs.json` to schedule songs for specific dates (YYYY-MM-DD).
   - Example (local files):

     ```json
     {
       "date": "2026-02-27",
       "title": "My Song",
       "artist": "Me",
       "album": "My Album",
       "audioFile": "assets/audio/2026-02-27.mp3",
       "coverImage": "assets/images/2026-02-27-cover.jpg",
       "backgroundImage": "assets/images/2026-02-27-bg.jpg",
       "recommendation": "Why I picked this song"
     }
     ```

3. **Notes about audio files**:
   - GitHub has a per-file limit (100MB). Prefer smaller MP3s.
   - If you hit repository size/performance limits, consider hosting audio elsewhere and keep `audioFile` as an `https://...` URL.

4. **Deploy**:
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
