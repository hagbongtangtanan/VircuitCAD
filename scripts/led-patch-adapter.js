(function () {
  const DESIGN_SCALE = 0.5;
  const ORIGIN_X = 20;
  const ORIGIN_Y = 40;
  globalThis.LED_PATCH_DESIGN_SCALE = DESIGN_SCALE;
  globalThis.LED_PATCH_ORIGIN_X = ORIGIN_X;
  globalThis.LED_PATCH_ORIGIN_Y = ORIGIN_Y;

  function number(value, fallback) {
    if (value === null || value === undefined) return fallback;
    const str = String(value).trim();
    if (str === "") return fallback;
    const parsed = Number.parseFloat(str);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseStop(stop) {
    const rawOffset = stop.getAttribute("offset");
    let parsedOffset = 0;
    if (rawOffset !== null) {
      const trimmed = String(rawOffset).trim();
      if (trimmed === "") {
        parsedOffset = 0;
      } else if (trimmed.endsWith("%")) {
        const num = Number.parseFloat(trimmed);
        if (Number.isFinite(num)) {
          parsedOffset = Math.max(0, Math.min(1, num / 100));
        }
      } else {
        const num = Number.parseFloat(trimmed);
        if (Number.isFinite(num)) {
          parsedOffset = Math.max(0, Math.min(1, num));
        }
      }
    }
    const color = stop.getAttribute("stop-color") || "#FFFFFF";
    const opacityAttr = stop.getAttribute("stop-opacity");
    const opacity = opacityAttr !== null ? number(opacityAttr, 1) : 1;
    return { offset: parsedOffset, color, opacity };
  }

  function stopsOf(gradient) {
    try {
      return Array.from(gradient.children)
        .filter((child) => child.tagName.toLowerCase() === "stop")
        .map(parseStop);
    } catch {
      return [{ offset: 0, color: "#FF0000", opacity: 1 }, { offset: 1, color: "#8B0000", opacity: 1 }];
    }
  }

  function buildRadialGradientStops(stops) {
    return stops.map(({ offset, color, opacity }) => [offset, color, opacity]);
  }

  function gradientMap(defsElement) {
    const map = new Map();
    if (!defsElement) return map;
    try {
      for (const child of defsElement.children) {
        const id = child.getAttribute("id");
        if (!id) continue;
        const tag = child.tagName.toLowerCase();
        if (tag === "lineargradient") {
          map.set(id, {
            type: "linear",
            stops: stopsOf(child).map(s => [s.offset, s.color, s.opacity]),
            start: { x: number(child.getAttribute("x1"), 0), y: number(child.getAttribute("y1"), 0) },
            end: { x: number(child.getAttribute("x2"), 0), y: number(child.getAttribute("y2"), 0) },
          });
        } else if (tag === "radialgradient") {
          const stops = stopsOf(child);
          const isGlow = id && id.includes("glow");
          const processedStops = isGlow ? buildRadialGradientStops(stops) : stops.map(s => [s.offset, s.color, s.opacity]);
          map.set(id, {
            type: "radial",
            stops: processedStops,
            isGlow,
          });
        }
      }
    } catch {
    }
    return map;
  }

  function paintProps(element, gradients, geometry) {
    const props = {};
    const fill = element.getAttribute("fill");
    const fillOpacity = element.getAttribute("fill-opacity");
    const strokeOpacity = element.getAttribute("stroke-opacity");
    if (fillOpacity !== null) props.fillOpacity = number(fillOpacity, 1);
    if (strokeOpacity !== null) props.strokeOpacity = number(strokeOpacity, 1);
    if (fill && fill.startsWith("url(#")) {
      const id = fill.slice(5, -1);
      const gradient = gradients.get(id);
      if (gradient && gradient.stops && gradient.stops.length > 0) {
        function colorWithOpacity(color, opacity) {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        if (gradient.type === "linear") {
          props.fillLinearGradientColorStops = gradient.stops.flatMap(s => [s[0], colorWithOpacity(s[1], s[2])]);
          props.fillLinearGradientStartPoint = gradient.start || { x: 0, y: 0 };
          props.fillLinearGradientEndPoint = gradient.end || { x: 0, y: 0 };
        } else {
          const center = gradient.isGlow ? { x: 0, y: 0 } : geometry.center || { x: 0, y: 0 };
          const radius = geometry.radius || 1;
          props.fillRadialGradientColorStops = gradient.stops.flatMap(s => [s[0], colorWithOpacity(s[1], s[2])]);
          props.fillRadialGradientStartPoint = center;
          props.fillRadialGradientEndPoint = center;
          props.fillRadialGradientStartRadius = 0;
          props.fillRadialGradientEndRadius = radius;
        }
      } else {
        props.fill = "#FF0000";
      }
    } else if (fill && fill !== "none") {
      props.fill = fill === "transparent" ? "rgba(0,0,0,0.001)" : fill;
    }
    const stroke = element.getAttribute("stroke");
    if (stroke && stroke !== "none") {
      props.stroke = stroke;
      props.strokeWidth = number(element.getAttribute("stroke-width"), 1);
    }
    const opacity = element.getAttribute("opacity");
    if (opacity !== null) props.opacity = number(opacity, 1);
    props.listening = element.getAttribute("pointer-events") !== "none";
    return props;
  }

  function geometryOf(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "circle") {
      const x = number(element.getAttribute("cx"), 0);
      const y = number(element.getAttribute("cy"), 0);
      return { x, y, radius: number(element.getAttribute("r"), 1), center: { x, y } };
    }
    if (tag === "ellipse") {
      const x = number(element.getAttribute("cx"), 0);
      const y = number(element.getAttribute("cy"), 0);
      const radiusX = number(element.getAttribute("rx"), 1);
      const radiusY = number(element.getAttribute("ry"), 1);
      return {
        x,
        y,
        radiusX,
        radiusY,
        center: { x, y },
        radius: Math.max(radiusX, radiusY),
      };
    }
    return {};
  }

  function commonProps(element, gradients, geometry, key) {
    const props = paintProps(element, gradients, geometry);
    const name = element.getAttribute("data-layer") || element.getAttribute("data-hit") || element.tagName;
    props.name = `led-patch-${name}`;
    if (element.hasAttribute("data-hit")) props.name = `led-patch-hit-${element.getAttribute("data-hit")}`;
    const transform = element.getAttribute("transform") || "";
    const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) props.rotation = number(rotateMatch[1].trim().split(/\s+/)[0], 0);
    props.key = key;
    return props;
  }

  function convert(element, gradients, runtime, key) {
    const tag = element.tagName.toLowerCase();
    if (tag === "defs" || tag === "style" || tag === "title" || tag === "desc") return null;
    const geometry = geometryOf(element);
    const props = commonProps(element, gradients, geometry, key);
    const children = Array.from(element.children)
      .map((child, index) => convert(child, gradients, runtime, `${key}-${index}`))
      .filter(Boolean);
    if (children.length) props.children = children;
    if (tag === "path") {
      props.data = element.getAttribute("d") || "";
      return runtime.jsx("Path", props, key);
    }
    if (tag === "circle") {
      props.x = geometry.x;
      props.y = geometry.y;
      props.radius = geometry.radius;
      return runtime.jsx("Circle", props, key);
    }
    if (tag === "ellipse") {
      props.x = geometry.x;
      props.y = geometry.y;
      props.radiusX = geometry.radiusX;
      props.radiusY = geometry.radiusY;
      return runtime.jsx("Ellipse", props, key);
    }
    if (tag === "rect") {
      props.x = number(element.getAttribute("x"), 0);
      props.y = number(element.getAttribute("y"), 0);
      props.width = number(element.getAttribute("width"), 0);
      props.height = number(element.getAttribute("height"), 0);
      const radius = number(element.getAttribute("rx"), 0);
      if (radius) props.cornerRadius = radius;
      return runtime.jsx("Rect", props, key);
    }
    if (tag === "text") {
      props.x = number(element.getAttribute("x"), 0);
      props.y = number(element.getAttribute("y"), 0);
      props.text = element.textContent || "";
      props.fontFamily = element.getAttribute("font-family") || "monospace";
      props.fontSize = number(element.getAttribute("font-size"), 10);
      props.align = element.getAttribute("text-anchor") === "middle" ? "center" : "left";
      props.verticalAlign = "middle";
      return runtime.jsx("Text", props, key);
    }
    if (tag === "g" || tag === "svg") return runtime.jsx("Group", props, key);
    return null;
  }

  function parseSvg(svg) {
    const documentObject = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (documentObject.getElementsByTagName("parsererror").length) {
      throw new Error("LED patch SVG parse error");
    }
    return documentObject.documentElement;
  }

  const bodyCache = new Map();

  function buildBody(runtime, options, lit) {
    const svg = globalThis.LedSvg.renderLedSvg({
      color: options.color || "red",
      lit,
      burnt: options.burnt === true,
      theme: options.lightMode ? "light" : "dark",
      selected: options.selected === true,
      brightness: lit ? 1 : 0,
      showLabels: false,
      idPrefix: `led-${options.part.id}`,
    });
    const root = parseSvg(svg);
    const gradients = gradientMap(root.querySelector("defs"));
    const children = Array.from(root.children)
      .map((child, index) => convert(child, gradients, runtime, `led-${index}`))
      .filter(Boolean);
    const glowIndex = children.findIndex(
      (child) => child && child.props && child.props.name === "led-patch-glow",
    );
    return { children, glowIndex };
  }

  globalThis.LED_PATCH_renderLedBody = function (options) {
    const runtime = options.runtime;
    const brightness = number(options.brightness, 0);
    const lit = brightness > 0.01;
    const burnt = options.burnt === true;
    const theme = options.lightMode ? "light" : "dark";
    const color = options.color || "red";
    const selected = options.selected === true;
    const cacheKey = `${options.part.id}|${color}|${lit ? 1 : 0}|${burnt ? 1 : 0}|${theme}|${selected ? 1 : 0}`;
    let entry = bodyCache.get(cacheKey);
    if (entry === undefined) {
      entry = buildBody(runtime, options, lit);
      if (bodyCache.size > 256) bodyCache.clear();
      bodyCache.set(cacheKey, entry);
    }
    let children = entry.children;
    if (entry.glowIndex >= 0 && brightness !== 1) {
      const glow = children[entry.glowIndex];
      children = children.slice();
      children[entry.glowIndex] = runtime.jsx(
        glow.type,
        { ...glow.props, opacity: brightness },
        glow.key,
      );
    }
    return runtime.jsx(
      "Group",
      {
        name: "led-patch-root",
        x: ORIGIN_X,
        y: ORIGIN_Y,
        scaleX: DESIGN_SCALE,
        scaleY: DESIGN_SCALE,
        listening: true,
        children,
      },
      "led-patch-root",
    );
  };
})();