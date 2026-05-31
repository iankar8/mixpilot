import type { MashupScene } from '../lib/types';

interface SceneStripProps {
  scenes: MashupScene[];
  activeSceneId: string | null;
  statusLabel?: string;
  onApplyScene: (scene: MashupScene) => void;
}

export default function SceneStrip({ scenes, activeSceneId, statusLabel, onApplyScene }: SceneStripProps) {
  if (scenes.length === 0) {
    return (
      <section className="scene-strip empty-scene-strip">
        <span>Load two songs, then auto sync to generate playable mashup scenes.</span>
      </section>
    );
  }

  return (
    <section className="scene-strip" aria-label="Generated mashup scenes">
      <div className="section-kicker">AI scenes{statusLabel ? ` · ${statusLabel}` : ''}</div>
      <div className="scene-grid">
        {scenes.map((scene) => {
          const active = activeSceneId === scene.id;
          return (
            <button
              key={scene.id}
              className={`scene-card ${active ? 'scene-card-active' : ''}`}
              onClick={() => onApplyScene(scene)}
            >
              <span className="scene-key">{scene.keyHint}</span>
              <span>
                <span className="scene-name">{scene.name}</span>
                <span className="scene-description">{scene.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
