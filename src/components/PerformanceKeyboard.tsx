import type { MashupScene } from '../lib/types';

interface PerformanceKeyboardProps {
  scenes: MashupScene[];
  activeSceneId: string | null;
  onApplyScene: (scene: MashupScene) => void;
}

const WHITE_KEYS = [
  { key: 'Q', label: 'A vox' },
  { key: 'W', label: 'A drums' },
  { key: 'E', label: 'A bass' },
  { key: 'R', label: 'A other' },
  { key: 'U', label: 'B vox' },
  { key: 'I', label: 'B drums' },
  { key: 'O', label: 'B bass' },
  { key: 'P', label: 'B other' },
];

export default function PerformanceKeyboard({
  scenes,
  activeSceneId,
  onApplyScene,
}: PerformanceKeyboardProps) {
  return (
    <section className="performance-panel" aria-label="Performance keyboard">
      <div className="panel-header">
        <div>
          <div className="section-kicker">performance keyboard</div>
          <div className="panel-title">Stem Player mode</div>
        </div>
        <div className="micro-label">space A · enter B · arrows fade</div>
      </div>

      <div className="keybed">
        <div className="black-key-row">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              className={`black-key ${activeSceneId === scene.id ? 'black-key-active' : ''}`}
              onClick={() => onApplyScene(scene)}
            >
              <span>{scene.keyHint}</span>
              <small>{scene.name}</small>
            </button>
          ))}
        </div>
        <div className="white-key-row">
          {WHITE_KEYS.map((item) => (
            <div key={item.key} className="white-key">
              <span>{item.key}</span>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
