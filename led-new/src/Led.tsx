import * as React from "react";
import { renderLedSvg, RenderLedSvgOptions } from "./renderLedSvg";

export interface LedProps extends RenderLedSvgOptions {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export function Led({ className, style, title, ...svgOptions }: LedProps) {
  const svg = renderLedSvg(svgOptions);
  return (
    <span
      className={className}
      style={style}
      data-led-wrapper="true"
      title={title}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default Led;
