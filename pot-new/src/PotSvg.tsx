import React from "react";
import { renderPotSvg, type PotPinNames } from "./renderPotSvg.ts";
import type { PotTheme } from "./potSpec.ts";

export interface PotSvgProps {
  value: number;
  theme: PotTheme;
  burnt?: boolean;
  showLabels?: boolean;
  pinNames?: PotPinNames;
  resistanceText?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Thin DOM wrapper around the shared potentiometer drawing. The markup comes
 * from renderPotSvg so the canvas and every DOM surface show the same part.
 */
export function PotSvg(props: PotSvgProps): React.ReactElement {
  const markup = renderPotSvg({
    value: props.value,
    theme: props.theme,
    burnt: props.burnt,
    showLabels: props.showLabels,
    pinNames: props.pinNames,
    resistanceText: props.resistanceText,
  });
  return React.createElement("div", {
    className: props.className,
    style: props.style,
    dangerouslySetInnerHTML: { __html: markup },
  });
}

export default PotSvg;
