import os
import json
import requests
import shutil
import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from git import Repo

app = Flask(__name__, template_folder='templates', static_folder='static')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
SONGS_JSON_PATH = os.path.join(DATA_DIR, 'songs.json')
AUDIO_DIR = os.path.join(BASE_DIR, 'assets', 'audio')
COOKIE_FILE = os.path.join(BASE_DIR, 'admin', 'cookie.txt')

# NetEase API (Unofficial endpoints)
NETEASE_SONG_API = "http://music.163.com/api/song/detail/?id={}&ids=[{}]"
NETEASE_LYRIC_API = "http://music.163.com/api/song/lyric?os=pc&id={}&lv=-1&kv=-1&tv=-1"

def get_netease_headers():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Referer': 'https://music.163.com/'
    }
    if os.path.exists(COOKIE_FILE):
        with open(COOKIE_FILE, 'r') as f:
            cookie = f.read().strip()
            if cookie:
                headers['Cookie'] = cookie
    return headers

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/cookie', methods=['GET', 'POST'])
def handle_cookie():
    if request.method == 'POST':
        cookie = request.json.get('cookie', '')
        # Clean up cookie: remove newlines and extra spaces
        cookie = cookie.replace('\n', '').replace('\r', '').strip()
        with open(COOKIE_FILE, 'w') as f:
            f.write(cookie)
        return jsonify({'success': True})
    else:
        cookie = ''
        if os.path.exists(COOKIE_FILE):
            with open(COOKIE_FILE, 'r') as f:
                cookie = f.read().strip()
        return jsonify({'cookie': cookie})

@app.route('/api/songs', methods=['GET'])
def get_songs():
    try:
        with open(SONGS_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Sort by date descending
        data['songs'].sort(key=lambda x: x.get('date', ''), reverse=True)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/songs', methods=['POST'])
def save_songs():
    try:
        new_data = request.json
        # Format dates properly if needed
        with open(SONGS_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/netease/parse', methods=['POST'])
def parse_netease():
    """Parse song info from Netease Cloud Music ID or URL"""
    query = request.json.get('query', '')
    if not query:
        return jsonify({'error': 'Missing query'}), 400

    # Extract ID from URL or string
    song_id = query
    match = re.search(r'id=(\d+)', query)
    if match:
        song_id = match.group(1)
    
    # Check if pure number
    if not song_id.isdigit():
        return jsonify({'error': 'Invalid Song ID'}), 400

    try:
        # Fetch metadata
        headers = get_netease_headers()
        resp = requests.get(NETEASE_SONG_API.format(song_id, song_id), headers=headers)
        data = resp.json()
        
        if not data.get('songs'):
            return jsonify({'error': 'Song not found'}), 404
            
        song_info = data['songs'][0]
        title = song_info['name']
        artist = song_info['artists'][0]['name']
        album = song_info['album']['name']
        cover_url = song_info['album']['picUrl']
        
        # Construct filename
        filename = f"{artist} - {title}.mp3".replace('/', '_') # Sanitize
        
        # Try to get audio URL
        # Method 1: Standard player URL (sometimes redirected to 404 for VIP)
        # audio_url = f"http://music.163.com/song/media/outer/url?id={song_id}.mp3"
        
        # Method 2: Use API to get real download URL (Supports VIP if cookie is present)
        # Endpoint: /api/song/enhance/player/url
        try:
            # Need csrf_token in params if cookie is present
            csrf_token = ''
            if 'csrf_token=' in headers.get('Cookie', ''):
                csrf_token = headers['Cookie'].split('csrf_token=')[1].split(';')[0]
             
            player_api = "https://music.163.com/api/song/enhance/player/url"
            params = {
                "ids": f"[{song_id}]",
                "br": 320000,  # High quality
                "csrf_token": csrf_token
            }
            player_resp = requests.get(player_api, params=params, headers=headers)
            player_data = player_resp.json()
             
            if player_data.get('data') and player_data['data'][0].get('url'):
                audio_url = player_data['data'][0]['url']
            else:
                # Fallback to outer url
                audio_url = f"http://music.163.com/song/media/outer/url?id={song_id}.mp3"
        except:
            audio_url = f"http://music.163.com/song/media/outer/url?id={song_id}.mp3"

        return jsonify({
            'success': True,
            'id': song_id,
            'title': title,
            'artist': artist,
            'album': album,
            'cover': cover_url,
            'filename': filename,
            'audio_url': audio_url
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download_audio():
    """Download audio from URL or handle uploaded file"""
    data = request.json
    url = data.get('url')
    filename = data.get('filename')
    
    if not url or not filename:
        return jsonify({'error': 'Missing parameters'}), 400
        
    target_path = os.path.join(AUDIO_DIR, filename)
    
    try:
        # Ensure directory exists
        os.makedirs(AUDIO_DIR, exist_ok=True)
        
        headers = get_netease_headers()
        r = requests.get(url, headers=headers, stream=True)
        if r.status_code == 200:
            # Check content type or size to verify it's audio, not a 404 html page
            content_type = r.headers.get('Content-Type', '')
            if 'text/html' in content_type:
                 return jsonify({'error': 'Download failed (likely VIP/Copyright restriction). Please upload file manually.'}), 403

            with open(target_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return jsonify({'success': True, 'path': f"assets/audio/{filename}"})
        else:
            return jsonify({'error': f'HTTP {r.status_code}'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    filename = request.form.get('filename') # User provided standard filename
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file and filename:
        target_path = os.path.join(AUDIO_DIR, filename)
        file.save(target_path)
        return jsonify({'success': True, 'path': f"assets/audio/{filename}"})
    
    return jsonify({'error': 'Upload failed'}), 500

@app.route('/api/files/delete', methods=['POST'])
def delete_file():
    filepath = request.json.get('path')
    if not filepath:
        return jsonify({'error': 'Missing path'}), 400
    
    # Security check: ensure path is within assets/audio
    if not filepath.startswith('assets/audio/'):
        return jsonify({'error': 'Invalid path'}), 403
        
    full_path = os.path.join(BASE_DIR, filepath)
    try:
        if os.path.exists(full_path):
            os.remove(full_path)
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/git/push', methods=['POST'])
def git_push():
    try:
        repo = Repo(BASE_DIR)
        if repo.is_dirty() or repo.untracked_files:
            repo.git.add(all=True)
            repo.index.commit(f"Update songs via Admin Panel {datetime.now().strftime('%Y-%m-%d %H:%M')}")
            origin = repo.remote(name='origin')
            origin.push()
            return jsonify({'success': True, 'message': 'Pushed to remote successfully'})
        else:
            return jsonify({'success': True, 'message': 'Nothing to commit'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = 5001
    print(f"Admin Server running at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
