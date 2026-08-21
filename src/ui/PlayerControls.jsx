const formatTime = (s) => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function PlayerControls({ audioApi }) {
  const { isPlaying, toggle, currentTime, duration, seek, loadFile, fileName, status } = audioApi;

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  return (
    <div className="player-controls">
      <label className="btn btn--ghost file-input">
        {fileName ? fileName : 'Upload audio (.mp3 / .wav)'}
        <input type="file" accept="audio/mpeg,audio/wav,audio/*" onChange={onFileChange} hidden />
      </label>

      <button className="btn btn--play" onClick={toggle} disabled={status !== 'ready' && status !== 'idle' ? false : !duration}>
        {isPlaying ? '❚❚ Pause' : '▶ Play'}
      </button>

      <span className="player-controls__time">{formatTime(currentTime)}</span>
      <input
        className="player-controls__scrub"
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => seek(parseFloat(e.target.value))}
        disabled={!duration}
      />
      <span className="player-controls__time">{formatTime(duration)}</span>

      {status === 'loading' && <span className="player-controls__status">Decoding audio…</span>}
      {status === 'error' && <span className="player-controls__status player-controls__status--error">Failed to decode file</span>}
    </div>
  );
}
