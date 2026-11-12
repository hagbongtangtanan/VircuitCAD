import '@vircuitcad/ui/tokens.css';
import '@vircuitcad/ui/base.css';
import './gallery.css';

import { createDefaultPartRegistry } from '@vircuitcad/core';
import { breadboardSvg, resolvePartArt, toSvg } from '@vircuitcad/parts/art';
import { createRoot } from 'react-dom/client';

function Art({ svg }: { svg: string }) {
  return <span className="gallery-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Gallery() {
  const manifests = createDefaultPartRegistry().list();
  return (
    <main className="gallery" data-testid="gallery">
      <h1>Part art gallery</h1>

      <section className="gallery-section">
        <h2>Breadboard</h2>
        <figure className="gallery-card" data-testid="gallery-breadboard">
          <figcaption>Breadboard (full)</figcaption>
          <div className="gallery-art">
            <Art svg={breadboardSvg('full')} />
          </div>
        </figure>
      </section>

      <section className="gallery-section">
        <h2>Parts at 1× and 2×</h2>
        <div className="gallery-grid">
          {manifests.map((manifest) => {
            const art = resolvePartArt(manifest);
            const svg = toSvg(art);
            return (
              <figure className="gallery-card" key={manifest.id} data-testid={`gallery-part-${manifest.id}`}>
                <figcaption>
                  {manifest.name} <small>{manifest.id}</small>
                </figcaption>
                <div className="gallery-art" data-scale="1x">
                  <Art svg={svg} />
                </div>
                <div
                  className="gallery-art gallery-art--2x"
                  data-scale="2x"
                  style={{ width: art.width * 2, height: art.height * 2 }}
                >
                  <Art svg={svg} />
                </div>
                <p className="gallery-pins">
                  pins: {manifest.pins.map((pin) => pin.name).join(', ')}
                </p>
              </figure>
            );
          })}
        </div>
      </section>
    </main>
  );
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Gallery />);
