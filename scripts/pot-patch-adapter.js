(function () {
  /**
   * Renders the shared potentiometer drawing (the same SVG the standalone
   * module produces) as Konva shapes inside the app canvas.
   *
   * The design frame puts the middle pin at (0, 0) and one breadboard pitch
   * is 10 design units. The app's three pins are at (10,30), (20,30) and
   * (30,30) world units, so adjacent pins are 10 world units apart and the
   * design frame is drawn at DESIGN_SCALE = 1 with its origin on the middle
   * pin (20, 30).
   */
  const DESIGN_SCALE = 0.9013878188659973;
  const ORIGIN_X = 30;
  const ORIGIN_Y = 40;
  globalThis.POT_PATCH_DESIGN_SCALE = DESIGN_SCALE;
  globalThis.POT_PATCH_ORIGIN_X = ORIGIN_X;
  globalThis.POT_PATCH_ORIGIN_Y = ORIGIN_Y;

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
      return [
        { offset: 0, color: "#FFFFFF", opacity: 1 },
        { offset: 1, color: "#000000", opacity: 1 },
      ];
    }
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
            stops: stopsOf(child),
            start: { x: number(child.getAttribute("x1"), 0), y: number(child.getAttribute("y1"), 0) },
            end: { x: number(child.getAttribute("x2"), 0), y: number(child.getAttribute("y2"), 0) },
          });
        } else if (tag === "radialgradient") {
          const units = child.getAttribute("gradientUnits") || "objectBoundingBox";
          map.set(id, {
            type: "radial",
            stops: stopsOf(child),
            userSpace: units === "userSpaceOnUse",
            center: {
              x: number(child.getAttribute("cx"), 0),
              y: number(child.getAttribute("cy"), 0),
            },
            radius: number(child.getAttribute("r"), 1),
          });
        }
      }
    } catch {
    }
    return map;
  }

  function colorWithOpacity(color, opacity) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  function paintProps(element, gradients, geometry) {
    const origin = (geometry && geometry.origin) || { x: 0, y: 0 };
    const local = (point) => ({ x: point.x - origin.x, y: point.y - origin.y });
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
        if (gradient.type === "linear") {
          props.fillLinearGradientColorStops = gradient.stops.flatMap((stop) => [
            stop.offset,
            colorWithOpacity(stop.color, stop.opacity),
          ]);
          props.fillLinearGradientStartPoint = local(gradient.start);
          props.fillLinearGradientEndPoint = local(gradient.end);
        } else if (gradient.userSpace) {
          props.fillRadialGradientColorStops = gradient.stops.flatMap((stop) => [
            stop.offset,
            colorWithOpacity(stop.color, stop.opacity),
          ]);
          props.fillRadialGradientStartPoint = local(gradient.center);
          props.fillRadialGradientEndPoint = local(gradient.center);
          props.fillRadialGradientStartRadius = 0;
          props.fillRadialGradientEndRadius = gradient.radius;
        } else {
          const center = geometry.center || { x: 0, y: 0 };
          const radius = geometry.radius || 1;
          props.fillRadialGradientColorStops = gradient.stops.flatMap((stop) => [
            stop.offset,
            colorWithOpacity(stop.color, stop.opacity),
          ]);
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
      const lineCap = element.getAttribute("stroke-linecap");
      if (lineCap) props.lineCap = lineCap;
      const lineJoin = element.getAttribute("stroke-linejoin");
      if (lineJoin) props.lineJoin = lineJoin;
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
      return {
        x,
        y,
        radius: number(element.getAttribute("r"), 1),
        center: { x, y },
        origin: { x, y },
      };
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
        origin: { x, y },
      };
    }
    return {};
  }

  function commonProps(element, gradients, geometry, key) {
    const props = paintProps(element, gradients, geometry);
    const name = element.getAttribute("data-layer") || element.getAttribute("data-hit") || element.tagName;
    props.name = `pot-patch-${name}`;
    if (element.hasAttribute("data-hit")) {
      props.name = `pot-patch-hit-${element.getAttribute("data-hit")}`;
    }
    const transform = element.getAttribute("transform") || "";
    const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
    if (rotateMatch) {
      const parts = rotateMatch[1].trim().split(/\s+/);
      props.rotation = number(parts[0], 0);
      if (parts.length >= 3) {
        const centreX = number(parts[1], 0);
        const centreY = number(parts[2], 0);
        const tag = String(element.tagName || "").toLowerCase();
        if (tag === "circle" || tag === "ellipse") {
          props.offsetX = 0;
          props.offsetY = 0;
        } else {
          props.offsetX = centreX;
          props.offsetY = centreY;
        }
      }
    }
    props.key = key;
    return props;
  }

  /** Reads a path that only moves and draws straight lines into point pairs. */
  function polygonPoints(data) {
    const text = String(data || "").trim();
    if (!text.endsWith("Z") && !text.endsWith("z")) return null;
    const commands = text.match(/[ML][^MLZ]*/g);
    if (!commands || commands.length < 2) return null;
    const points = [];
    for (const command of commands) {
      const values = command
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map((value) => Number.parseFloat(value));
      if (values.length !== 2 || values.some((value) => !Number.isFinite(value))) return null;
      points.push(values[0], values[1]);
    }
    return points;
  }

  /** React needs the keyed factory for elements with an array of children. */
  function factory(runtime, props) {
    return Array.isArray(props.children) ? runtime.jsxs : runtime.jsx;
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
      const data = element.getAttribute("d") || "";
      const polygon = polygonPoints(data);
      if (polygon) {
        // Konva does not redraw a path when only its data changes, so simple
        // polygons are drawn as closed lines instead.
        props.points = polygon;
        props.closed = true;
        return factory(runtime, props)("Line", props, key);
      }
      props.data = data;
      return factory(runtime, props)("Path", props, key);
    }
    if (tag === "circle") {
      props.x = geometry.x;
      props.y = geometry.y;
      props.radius = geometry.radius;
      return factory(runtime, props)("Circle", props, key);
    }
    if (tag === "ellipse") {
      props.x = geometry.x;
      props.y = geometry.y;
      props.radiusX = geometry.radiusX;
      props.radiusY = geometry.radiusY;
      return factory(runtime, props)("Ellipse", props, key);
    }
    if (tag === "rect") {
      props.x = number(element.getAttribute("x"), 0);
      props.y = number(element.getAttribute("y"), 0);
      geometry.origin = { x: props.x, y: props.y };
      props.width = number(element.getAttribute("width"), 0);
      props.height = number(element.getAttribute("height"), 0);
      const radius = number(element.getAttribute("rx"), 0);
      if (radius) props.cornerRadius = radius;
      return factory(runtime, props)("Rect", props, key);
    }
    if (tag === "line") {
      props.points = [
        number(element.getAttribute("x1"), 0),
        number(element.getAttribute("y1"), 0),
        number(element.getAttribute("x2"), 0),
        number(element.getAttribute("y2"), 0),
      ];
      return factory(runtime, props)("Line", props, key);
    }
    if (tag === "text") {
      props.x = number(element.getAttribute("x"), 0);
      props.y = number(element.getAttribute("y"), 0);
      props.text = element.textContent || "";
      props.fontFamily = element.getAttribute("font-family") || "sans-serif";
      props.fontSize = number(element.getAttribute("font-size"), 10);
      props.align = element.getAttribute("text-anchor") === "middle" ? "center" : "left";
      props.verticalAlign = "middle";
      return factory(runtime, props)("Text", props, key);
    }
    if (tag === "g" || tag === "svg") return factory(runtime, props)("Group", props, key);
    return null;
  }

  function parseSvg(svg) {
    const documentObject = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (documentObject.getElementsByTagName("parsererror").length) {
      throw new Error("pot patch SVG parse error");
    }
    return documentObject.documentElement;
  }

  const bodyCache = new Map();

  function buildBody(runtime, options) {
    const svg = globalThis.PotSvg.renderPotSvg({
      value: options.value,
      theme: options.lightMode ? "light" : "dark",
      burnt: options.burnt === true,
      selected: options.selected === true,
      showLabels: false,
    });
    const root = parseSvg(svg);
    const gradients = gradientMap(root.querySelector("defs"));
    const children = Array.from(root.children)
      .map((child, index) => convert(child, gradients, runtime, `pot-${index}`))
      .filter(Boolean);
    return { children };
  }

  globalThis.POT_PATCH_renderPotBody = function (options) {
    const runtime = options.runtime;
    const value = number(options.value, 0.5);
    const selected = options.selected === true;
    const lightMode = options.lightMode === true;
    const burnt = options.burnt === true;
    const cacheKey = `${value.toFixed(4)}|${selected ? 1 : 0}|${lightMode ? 1 : 0}|${burnt ? 1 : 0}`;
    let entry = bodyCache.get(cacheKey);
    if (entry === undefined) {
      entry = buildBody(runtime, { value, selected, lightMode, burnt });
      if (bodyCache.size > 256) bodyCache.clear();
      bodyCache.set(cacheKey, entry);
    }
    const children = entry.children;
    const rootProps = {
      name: "pot-patch-root",
      x: ORIGIN_X,
      y: ORIGIN_Y,
      scaleX: DESIGN_SCALE,
      scaleY: DESIGN_SCALE,
      listening: true,
      children,
    };
    return factory(runtime, rootProps)(
      "Group",
      rootProps,
      "pot-patch-root",
    );
  };
})();
