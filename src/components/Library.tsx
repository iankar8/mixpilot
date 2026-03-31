import { useState } from 'react';
import type { Track, DeckId } from './types';

interface LibraryProps {
  onLoadTrack: (track: Track, targetDeck: DeckId) => void;
  deckALoaded: boolean;
  deckBLoaded: boolean;
}

const TRACKS: Track[] = [
  { id: '1', name: 'Princess Going Digital', artist: 'Amaarae', filename: 'Amaarae - Princess Going Digital.mp3' },
  { id: '2', name: 'Birds and the Bees', artist: 'Baby Keem', filename: 'Baby Keem - Birds and the Bees.mp3' },
  { id: '3', name: 'Casino', artist: 'Baby Keem', filename: 'Baby Keem - Casino.mp3' },
  { id: '4', name: 'Circus Circus Freestyle', artist: 'Baby Keem', filename: 'Baby Keem - Circus Circus Freestyle.mp3' },
  { id: '5', name: 'Good Flirts', artist: 'Baby Keem', filename: 'Baby Keem - Good Flirts.mp3' },
  { id: '6', name: 'House Money', artist: 'Baby Keem', filename: 'Baby Keem - House Money.mp3' },
  { id: '7', name: 'Sunsleeper', artist: 'Barry Cant Swim', filename: 'Barry Cant Swim - Sunsleeper.mp3' },
  { id: '8', name: 'WE ON GO', artist: 'BIA', filename: 'BIA - WE ON GO.mp3' },
  { id: '9', name: 'Glue', artist: 'Bicep', filename: 'Bicep - Glue.mp3' },
  { id: '10', name: 'Never Gonna Forget', artist: 'Black Coffee', filename: 'Black Coffee - Never Gonna Forget.mp3' },
  { id: '11', name: 'Breathe', artist: 'CamelPhat', filename: 'CamelPhat - Breathe.mp3' },
  { id: '12', name: 'Controller', artist: 'Channel Tres', filename: 'Channel Tres - Controller.mp3' },
  { id: '13', name: 'Fuego', artist: 'Channel Tres', filename: 'Channel Tres - Fuego.mp3' },
  { id: '14', name: 'Medicine', artist: 'Channel Tres', filename: 'Channel Tres - Medicine.mp3' },
  { id: '15', name: 'Sexy Black Timberlake', artist: 'Channel Tres', filename: 'Channel Tres - Sexy Black Timberlake.mp3' },
  { id: '16', name: 'Topdown', artist: 'Channel Tres', filename: 'Channel Tres - Topdown.mp3' },
  { id: '17', name: 'Lose My Mind', artist: 'Chris Lake', filename: 'Chris Lake - Lose My Mind.mp3' },
  { id: '18', name: 'POP DAT THANG', artist: 'DaBaby', filename: 'DaBaby - POP DAT THANG.mp3' },
  { id: '19', name: 'Around The World', artist: 'Daft Punk', filename: 'Daft Punk - Around The World.mp3' },
  { id: '20', name: 'One More Time', artist: 'Daft Punk', filename: 'Daft Punk - One More Time.mp3' },
  { id: '21', name: 'fine shyt', artist: 'DDG', filename: 'DDG - fine shyt.mp3' },
  { id: '22', name: 'Deeper Rudimental Remix', artist: 'Disclosure', filename: 'Disclosure - Deeper Rudimental Remix.mp3' },
  { id: '23', name: 'Latch', artist: 'Disclosure', filename: 'Disclosure - Latch.mp3' },
  { id: '24', name: 'When A Fire Starts To Burn', artist: 'Disclosure', filename: 'Disclosure - When A Fire Starts To Burn.mp3' },
  { id: '25', name: 'White Noise', artist: 'Disclosure', filename: 'Disclosure - White Noise.mp3' },
  { id: '26', name: 'You and Me Flume Remix', artist: 'Disclosure', filename: 'Disclosure - You and Me Flume Remix.mp3' },
  { id: '27', name: 'Rhyme Dust', artist: 'Dom Dolla', filename: 'Dom Dolla - Rhyme Dust.mp3' },
  { id: '28', name: 'San Frandisco', artist: 'Dom Dolla', filename: 'Dom Dolla - San Frandisco.mp3' },
  { id: '29', name: 'ATM', artist: 'Don Toliver', filename: 'Don Toliver - ATM.mp3' },
  { id: '30', name: 'Body', artist: 'Don Toliver', filename: 'Don Toliver - Body.mp3' },
  { id: '31', name: 'Call Back', artist: 'Don Toliver', filename: 'Don Toliver - Call Back.mp3' },
  { id: '32', name: 'OPPOSITE', artist: 'Don Toliver', filename: 'Don Toliver - OPPOSITE.mp3' },
  { id: '33', name: 'Rendezvous', artist: 'Don Toliver', filename: 'Don Toliver - Rendezvous.mp3' },
  { id: '34', name: 'Losing It', artist: 'Fisher', filename: 'Fisher - Losing It.mp3' },
  { id: '35', name: 'Baby', artist: 'Four Tet', filename: 'Four Tet - Baby.mp3' },
  { id: '36', name: 'Delilah', artist: 'Fred again', filename: 'Fred again - Delilah.mp3' },
  { id: '37', name: 'Marea', artist: 'Fred again', filename: 'Fred again - Marea.mp3' },
  { id: '38', name: '712PM', artist: 'Future', filename: 'Future - 712PM.mp3' },
  { id: '39', name: 'endless', artist: 'Gunna', filename: 'Gunna - endless.mp3' },
  { id: '40', name: 'Misirlou', artist: 'Guy Gerber', filename: 'Guy Gerber - Misirlou.mp3' },
  { id: '41', name: 'Buggin', artist: 'Hot Since 82', filename: 'Hot Since 82 - Buggin.mp3' },
  { id: '42', name: 'Two Six', artist: 'J Cole', filename: 'J Cole - Two Six.mp3' },
  { id: '43', name: 'WHO TF IZ U', artist: 'J Cole', filename: 'J Cole - WHO TF IZ U.mp3' },
  { id: '44', name: 'Gosh', artist: 'Jamie XX', filename: 'Jamie XX - Gosh.mp3' },
  { id: '45', name: 'La Danza', artist: 'John Summit', filename: 'John Summit - La Danza.mp3' },
  { id: '46', name: 'Fuck It Up', artist: 'Kamaiyah', filename: 'Kamaiyah - Fuck It Up.mp3' },
  { id: '47', name: '10 Percent', artist: 'Kaytranada', filename: 'Kaytranada - 10 Percent.mp3' },
  { id: '48', name: 'Bubba', artist: 'Kaytranada', filename: 'Kaytranada - Bubba.mp3' },
  { id: '49', name: 'Bus Ride', artist: 'Kaytranada', filename: 'Kaytranada - Bus Ride.mp3' },
  { id: '50', name: 'Glowed Up', artist: 'Kaytranada', filename: 'Kaytranada - Glowed Up.mp3' },
  { id: '51', name: 'Go DJ', artist: 'Kaytranada', filename: 'Kaytranada - Go DJ.mp3' },
  { id: '52', name: 'Intimidated', artist: 'Kaytranada', filename: 'Kaytranada - Intimidated.mp3' },
  { id: '53', name: 'TRACK UNO', artist: 'Kaytranada', filename: 'Kaytranada - TRACK UNO.mp3' },
  { id: '54', name: 'Worst In Me', artist: 'Kaytranada', filename: 'Kaytranada - Worst In Me.mp3' },
  { id: '55', name: 'Youre The One', artist: 'Kaytranada', filename: 'Kaytranada - Youre The One.mp3' },
  { id: '56', name: 'Yale', artist: 'Ken Carson', filename: 'Ken Carson - Yale.mp3' },
  { id: '57', name: 'Ambition For Cash', artist: 'Key Glock', filename: 'Key Glock - Ambition For Cash.mp3' },
  { id: '58', name: 'Dough', artist: 'Key Glock', filename: 'Key Glock - Dough.mp3' },
  { id: '59', name: 'Mr Glock', artist: 'Key Glock', filename: 'Key Glock - Mr Glock.mp3' },
  { id: '60', name: 'NO JUMPER', artist: 'Lackville', filename: 'Lackville - NO JUMPER.mp3' },
  { id: '61', name: 'Drive Alone', artist: 'Larry June', filename: 'Larry June - Drive Alone.mp3' },
  { id: '62', name: 'Business and Personal', artist: 'Latto', filename: 'Latto - Business and Personal.mp3' },
  { id: '63', name: 'What You Saying', artist: 'Lil Uzi Vert', filename: 'Lil Uzi Vert - What You Saying.mp3' },
  { id: '64', name: 'Pardon Me', artist: 'Lil Yachty', filename: 'Lil Yachty - Pardon Me.mp3' },
  { id: '65', name: 'Superhero', artist: 'Metro Boomin', filename: 'Metro Boomin - Superhero.mp3' },
  { id: '66', name: 'OFG', artist: 'Mike WiLL Made-It', filename: 'Mike WiLL Made-It - OFG.mp3' },
  { id: '67', name: '17', artist: 'MK', filename: 'MK - 17.mp3' },
  { id: '68', name: 'Lady', artist: 'Modjo', filename: 'Modjo - Lady.mp3' },
  { id: '69', name: 'Putting Ya Dine', artist: 'Monaleo', filename: 'Monaleo - Putting Ya Dine.mp3' },
  { id: '70', name: 'So U Kno', artist: 'Overmono', filename: 'Overmono - So U Kno.mp3' },
  { id: '71', name: 'FREAK IN YOU', artist: 'PARTYNEXTDOOR', filename: 'PARTYNEXTDOOR - FREAK IN YOU.mp3' },
  { id: '72', name: 'Not Nice', artist: 'PARTYNEXTDOOR', filename: 'PARTYNEXTDOOR - Not Nice.mp3' },
  { id: '73', name: 'It Goes Like Nanana', artist: 'Peggy Gou', filename: 'Peggy Gou - It Goes Like Nanana.mp3' },
  { id: '74', name: 'Stateside', artist: 'PinkPantheress', filename: 'PinkPantheress - Stateside.mp3' },
  { id: '75', name: '1942', artist: 'PlaqueBoyMax', filename: 'PlaqueBoyMax - 1942.mp3' },
  { id: '76', name: 'Meh', artist: 'Playboi Carti', filename: 'Playboi Carti - Meh.mp3' },
  { id: '77', name: 'Innerbloom', artist: 'Rufus Du Sol', filename: 'Rufus Du Sol - Innerbloom.mp3' },
  { id: '78', name: 'Hang Wit a Bad Bitch', artist: 'Sexyy Red', filename: 'Sexyy Red - Hang Wit a Bad Bitch.mp3' },
  { id: '79', name: 'Quickest Routes', artist: 'Shoreline Mafia', filename: 'Shoreline Mafia - Quickest Routes.mp3' },
  { id: '80', name: 'keep steady', artist: 'sosocamono', filename: 'sosocamono - keep steady.mp3' },
  { id: '81', name: 'A COLD PLAY', artist: 'The Kid LAROI', filename: 'The Kid LAROI - A COLD PLAY.mp3' },
  { id: '82', name: 'NIGHTS LIKE THIS', artist: 'The Kid LAROI', filename: 'The Kid LAROI - NIGHTS LIKE THIS.mp3' },
  { id: '83', name: 'Tina Turner', artist: 'Vintage Culture', filename: 'Vintage Culture - Tina Turner.mp3' },
  { id: '84', name: 'Flawless', artist: 'Yeat', filename: 'Yeat - Flawless.mp3' },
  { id: '85', name: 'Let King Tonka Talk', artist: 'Yeat', filename: 'Yeat - Let King Tonka Talk.mp3' },
  { id: '86', name: 'LOCO', artist: 'Yeat', filename: 'Yeat - LOCO.mp3' },
  { id: '87', name: 'Made It On Our Own', artist: 'Yeat', filename: 'Yeat - Made It On Our Own.mp3' },
  { id: '88', name: 'More', artist: 'Yeat', filename: 'Yeat - More.mp3' },
  { id: '89', name: 'Poppin', artist: 'Yeat', filename: 'Yeat - Poppin.mp3' },
  { id: '90', name: 'Jugg', artist: 'Young Nudy', filename: 'Young Nudy - Jugg.mp3' },
];

export default function Library({ onLoadTrack, deckALoaded, deckBLoaded }: LibraryProps) {
  const [search, setSearch] = useState('');

  const filtered = TRACKS.filter((track) => {
    const q = search.toLowerCase();
    return (
      track.name.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q)
    );
  });

  const handleClick = (track: Track) => {
    const targetDeck: DeckId = !deckALoaded ? 'A' : !deckBLoaded ? 'B' : 'A';
    onLoadTrack(track, targetDeck);
  };

  return (
    <div
      style={{
        width: '240px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
          }}
        >
          Library
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search tracks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px 6px 28px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          />
        </div>
      </div>

      {/* Track list */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {filtered.map((track) => (
          <button
            key={track.id}
            onClick={() => handleClick(track)}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '6px 14px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
              }}
            >
              {track.name}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
              }}
            >
              {track.artist}
            </span>
          </button>
        ))}
      </div>

      {/* Track count */}
      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {filtered.length} / {TRACKS.length} tracks
      </div>
    </div>
  );
}
