document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    const fileList = document.getElementById('fileList') as HTMLElement | null;
    const videoPlayer = document.getElementById('videoPlayer') as HTMLVideoElement | null;
    const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement | null;
    const playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement | null;
    const skipBackBtn = document.getElementById('skipBackBtn') as HTMLButtonElement | null;
    const skipForwardBtn = document.getElementById('skipForwardBtn') as HTMLButtonElement | null;
    const increaseRateBtn = document.getElementById('increaseRateBtn') as HTMLButtonElement | null;
    const decreaseRateBtn = document.getElementById('decreaseRateBtn') as HTMLButtonElement | null;
    const playlistItems = document.getElementById('playlistItems') as HTMLUListElement | null;
    const speedDisplay = document.getElementById('speedDisplay') as HTMLInputElement | null;
    const resetRateBtn = document.getElementById('resetRateBtn') as HTMLButtonElement | null;
    const timeDisplay = document.getElementById('timeDisplay') as HTMLElement | null;
    let currentMedia: HTMLVideoElement | HTMLAudioElement | null = null;
    let currentFileIndex = -1;
    let mediaFiles: File[] = [];

    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (skipBackBtn) skipBackBtn.addEventListener('click', () => skipTime(-15));
    if (skipForwardBtn) skipForwardBtn.addEventListener('click', () => skipTime(15));
    if (increaseRateBtn) increaseRateBtn.addEventListener('click', () => changePlaybackRate(0.1));
    if (decreaseRateBtn) decreaseRateBtn.addEventListener('click', () => changePlaybackRate(-0.1));
    if (resetRateBtn) resetRateBtn.addEventListener('click', () => resetPlaybackRate());

    function changePlaybackRate(delta: number): void {
        if (!currentMedia) return;
        let newRate = Math.round((currentMedia.playbackRate + delta) * 10) / 10;
        newRate = Math.max(0.5, Math.min(4.0, newRate));
        currentMedia.playbackRate = newRate;
        updateSpeedDisplay();
    }

    function resetPlaybackRate(): void {
        if (!currentMedia) return;
        currentMedia.playbackRate = 1.0;
        updateSpeedDisplay();
    }

    function updateSpeedDisplay(): void {
        if (speedDisplay) {
            speedDisplay.value = currentMedia ? currentMedia.playbackRate.toFixed(1) + 'x' : '1.0x';
        }
    }

    function handleFileSelect(event: Event): void {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        if (files.length === 0) return;

        const validFiles = files.filter(file => {
            return file.type.startsWith('audio/') || file.type.startsWith('video/');
        });

        if (validFiles.length === 0) {
            alert('Please select valid audio or video files.');
            return;
        }

        mediaFiles = [...mediaFiles, ...validFiles];
        updateFileList();
        updatePlaylist();

        if (mediaFiles.length > 0 && currentFileIndex === -1) {
            loadMedia(0);
        }
    }

    function updateFileList(): void {
        if (!fileList) return;
        fileList.innerHTML = '';
        if (mediaFiles.length === 0) {
            fileList.textContent = 'No files selected';
            return;
        }

        const list = document.createElement('ul');
        mediaFiles.forEach((file, index) => {
            const item = document.createElement('li');
            item.textContent = `${index + 1}. ${file.name}`;
            list.appendChild(item);
        });
        fileList.appendChild(list);
    }

    function updatePlaylist(): void {
        if (!playlistItems) return;
        playlistItems.innerHTML = '';
        mediaFiles.forEach((file, index) => {
            const li = document.createElement('li');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = file.name;
            nameSpan.style.cursor = 'pointer';
            nameSpan.onclick = () => loadMedia(index);
            li.appendChild(nameSpan);

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.className = 'remove-btn';
            removeBtn.style.marginLeft = '10px';
            removeBtn.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                removeFromPlaylist(index);
            };
            li.appendChild(removeBtn);

            li.className = index === currentFileIndex ? 'playing' : '';
            playlistItems.appendChild(li);
        });

        function removeFromPlaylist(idx: number): void {
            if (idx < 0 || idx >= mediaFiles.length) return;
            mediaFiles.splice(idx, 1);
            if (currentFileIndex > idx) {
                currentFileIndex--;
            } else if (currentFileIndex === idx) {
                if (currentMedia) {
                    currentMedia.pause();
                    currentMedia.currentTime = 0;
                    currentMedia.style.display = 'none';
                }
                currentFileIndex = -1;
                if (playPauseBtn) {
                    playPauseBtn.textContent = 'Play';
                    playPauseBtn.disabled = true;
                }
            }
            updateFileList();
            updatePlaylist();
        }
    }

    function loadMedia(index: number): void {
        if (index < 0 || index >= mediaFiles.length) return;

        const file = mediaFiles[index];
        const isVideo = file.type.startsWith('video/');

        if (videoPlayer) videoPlayer.style.display = 'none';
        if (audioPlayer) audioPlayer.style.display = 'none';

        if (currentMedia) {
            currentMedia.pause();
            currentMedia.currentTime = 0;
            currentMedia.removeEventListener('ended', handleMediaEnded);
            currentMedia.removeEventListener('timeupdate', updateTimeDisplay);
            currentMedia.removeEventListener('durationchange', updateTimeDisplay);
        }

        currentMedia = isVideo ? videoPlayer : audioPlayer;
        currentFileIndex = index;

        const fileURL = URL.createObjectURL(file);

        if (currentMedia) {
            currentMedia.addEventListener('ended', handleMediaEnded);
            currentMedia.addEventListener('timeupdate', updateTimeDisplay);
            currentMedia.addEventListener('durationchange', updateTimeDisplay);
            currentMedia.playbackRate = 1.0;
        }
        updateSpeedDisplay();

        if (isVideo && videoPlayer) {
            videoPlayer.src = fileURL;
            videoPlayer.style.display = 'block';
        } else if (audioPlayer) {
            audioPlayer.src = fileURL;
            audioPlayer.style.display = 'block';
        }

        updatePlaylist();
        if (playPauseBtn) {
            playPauseBtn.textContent = 'Pause';
            playPauseBtn.disabled = false;
        }
        updateTimeDisplay();

        if (currentMedia) {
            currentMedia.play().catch(error => {
                console.error('Error playing media:', error);
                if (playPauseBtn) playPauseBtn.textContent = 'Play';
            });
        }
    }

    function togglePlayPause(): void {
        if (!currentMedia) return;

        if (currentMedia.paused) {
            currentMedia.play();
            if (playPauseBtn) playPauseBtn.textContent = 'Pause';
        } else {
            currentMedia.pause();
            if (playPauseBtn) playPauseBtn.textContent = 'Play';
        }
    }

    function skipTime(seconds: number): void {
        if (!currentMedia) return;

        currentMedia.currentTime = Math.max(0, currentMedia.currentTime + seconds);

        if (currentMedia.paused && seconds < 0) {
            currentMedia.play();
            setTimeout(() => {
                if (currentMedia && !currentMedia.paused) {
                    currentMedia.pause();
                }
            }, 200);
        }
    }

    function handleMediaEnded(): void {
        if (playPauseBtn) playPauseBtn.textContent = 'Play';

        if (currentFileIndex < mediaFiles.length - 1) {
            loadMedia(currentFileIndex + 1);
        }
    }

    function formatTime(seconds: number): string {
        if (isNaN(seconds) || seconds === Infinity) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function updateTimeDisplay(): void {
        if (!timeDisplay) return;
        if (!currentMedia) {
            timeDisplay.textContent = '00:00 / 00:00';
            return;
        }
        const cur = formatTime(currentMedia.currentTime);
        const dur = formatTime(currentMedia.duration);
        timeDisplay.textContent = `${cur} / ${dur}`;
    }

    updateFileList();
    updateTimeDisplay();
    updateSpeedDisplay();
});
