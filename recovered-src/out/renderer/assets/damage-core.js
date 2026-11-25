(() => {
  const ratings = window.__DAMAGE_RATINGS__;
  const ambient = ratings.ambientC;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;
  const settings = {
    effects: true,
    particleQuality: "medium",
    damageTimeScale: "demo",
    pauseOnFailure: false,
    sound: false,
    reducedMotion:
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  const states = new Map();
  const events = [];
  const failedParts = new Set();
  const failedAt = new Map();
  const failedSegments = new Set();
  const deadPins = new Set();
  const failedWires = new Set();
  const listeners = new Set();
  const staticMeta = new Map();
  const scratchByKey = new Map();
  const overlayCache = { revision: -1, value: null };
  let overlayRevision = 0;
  let rngState = 0x1a2b3c4d;
  let fuseTrippedUntilMs = -1;
  let fuseTripCount = 0;
  let lastSimMs = 0;
  let revision = 0;
  const random = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  };
  const emit = (event) => {
    const entry = {
      id: `damage-${events.length + 1}`,
      simMs: Math.round(lastSimMs),
      ...event,
    };
    events.push(entry);
    if (events.length > 200) events.shift();
    const serial = window.__LCD_SERIAL_STORE__;
    serial?.getState?.().appendText?.(
      `[damage] ${entry.message}\n`,
    );
    revision += 1;
    overlayRevision += 1;
    const current = snapshot();
    for (const listener of listeners) listener(current);
    return entry;
  };
  const metaFor = (key, factory) => {
    const cached = staticMeta.get(key);
    if (cached !== void 0) return cached;
    if (staticMeta.size > 512) staticMeta.clear();
    const meta = factory();
    staticMeta.set(key, meta);
    return meta;
  };
  const metaResistor = { rating: ratings.resistor };
  const metaPin = { rating: ratings.arduinoPin };
  const metaMotor = { rating: ratings.dcMotor };
  const metaServo = { rating: ratings.servo };
  const metaBuzzer = { rating: ratings.buzzer };
  const metaWire = { rating: ratings.wire };
  const stateFor = (key, reading) => {
    let state = states.get(key);
    if (state === void 0) {
      state = {
        key,
        partId: reading.partId,
        subId: reading.subId,
        kind: reading.kind,
        label: reading.label,
        heatC: ambient,
        stress: 0,
        status: "ok",
        reason: "",
        failed: false,
        failureReason: "",
        peak: 0,
        voltage: 0,
        current: 0,
        power: 0,
      };
      states.set(key, state);
    }
    return state;
  };
  const netVoltage = (netlist, netVoltages, partId, pinId) => {
    const net = netlist?.netIdOf?.({ partId, pinId });
    if (net === void 0) return 0;
    return finite(netVoltages?.get(net), 0);
  };
  const sourceCurrent = (solve, partId, pinId) =>
    Math.abs(finite(solve?.sourceCurrents?.get(`${partId}:${pinId}`), 0));
  const probe = (document, solve, netlist, drivers, inputs = {}) => {
    const readings = new Map();
    const netVoltages = solve?.netVoltages ?? new Map();
    const add = (key, data) => {
      const previous = readings.get(key);
      if (previous === void 0) {
        readings.set(key, data);
        return;
      }
      previous.current = Math.max(previous.current, data.current);
      previous.power = Math.max(previous.power, data.power);
      previous.voltage = Math.max(previous.voltage, data.voltage);
    };
    for (const part of document.parts) {
      const type = part.type;
      if (type === "resistor") {
        const a = netVoltage(netlist, netVoltages, part.id, "lead1");
        const b = netVoltage(netlist, netVoltages, part.id, "lead2");
        const resistance = Math.max(finite(part.props.resistanceOhms, 1), 0.001);
        const voltage = a - b;
        const current = voltage / resistance;
        add(`part:${part.id}`, {
          partId: part.id,
          kind: "resistor",
          label: `R ${part.id}`,
          voltage,
          current,
          power: current * voltage,
          meta: metaResistor,
        });
      } else if (type === "led" || type === "rgb-led") {
        const channels =
          type === "led"
            ? [""]
            : ["red", "green", "blue"];
        const a = netVoltage(netlist, netVoltages, part.id, type === "led" ? "anode" : channels[0]);
        const b = netVoltage(netlist, netVoltages, part.id, "cathode");
        for (const channel of channels) {
          const key = channel === "" ? part.id : `${part.id}:${channel}`;
          const current = Math.max(
            0,
            finite(solve?.ledCurrents?.get(key), 0),
          );
          const color = part.props.color ?? channel;
          add(`part:${key}`, {
            partId: part.id,
            subId: channel || void 0,
            kind: "led",
            label: `LED ${key}`,
            voltage: a - b,
            current,
            power: Math.abs(a - b) * current,
            meta: metaFor(`led:${part.id}:${channel}:${color}`, () => ({
              rating: ratings.led,
              color,
            })),
          });
        }
      } else if (type === "seven-segment") {
        const common = netVoltage(netlist, netVoltages, part.id, "common");
        for (const segment of ["a", "b", "c", "d", "e", "f", "g", "dp"]) {
          const net = netVoltage(netlist, netVoltages, part.id, segment);
          const current = Math.max(
            0,
            finite(solve?.ledCurrents?.get(`${part.id}:${segment}`), 0),
          );
          add(`segment:${part.id}:${segment}`, {
            partId: part.id,
            subId: segment,
            kind: "sevenSegment",
            label: `Segment ${part.id}:${segment}`,
            voltage: net - common,
            current,
            power: Math.abs(net - common) * current,
            meta: metaFor(
              `segment:${part.id}:${segment}:${part.props.color}`,
              () => ({
                rating: ratings.sevenSegment.segment,
                color: part.props.color,
              }),
            ),
          });
        }
      } else if (type === "arduino-uno") {
        const supplyCurrent = sourceCurrent(solve, part.id, "5V");
        const vinCurrent = sourceCurrent(solve, part.id, "VIN");
        const threeVoltCurrent = sourceCurrent(solve, part.id, "3V3");
        const vin = finite(part.props.inputVoltage, NaN);
        add(`board:${part.id}`, {
          partId: part.id,
          kind: "arduinoBoard",
          label: `Arduino ${part.id}`,
          voltage: Number.isFinite(vin) ? vin : 5,
          current: supplyCurrent + vinCurrent,
          power: supplyCurrent * 5 + Math.max(0, vin - 5) * vinCurrent,
          meta: {
            rating: ratings.arduinoBoard,
            supplyCurrent,
            vinCurrent,
            threeVoltCurrent,
            inputVoltage: vin,
          },
        });
        for (const [key] of drivers ?? []) {
          const separator = key.lastIndexOf(":");
          if (separator < 0) continue;
          const partId = key.slice(0, separator);
          const pinId = key.slice(separator + 1);
          if (partId !== part.id || ["5V", "3V3", "GND", "GND2", "VIN"].includes(pinId))
            continue;
          const voltage = netVoltage(netlist, netVoltages, partId, pinId);
          const current = sourceCurrent(solve, partId, pinId);
          add(`pin:${partId}:${pinId}`, {
            partId,
            subId: pinId,
            kind: "arduinoPin",
            label: `Pin ${partId}:${pinId}`,
            voltage,
            current,
            power: Math.abs(voltage) * current,
            meta: metaPin,
          });
        }
      } else if (
        type === "lcd-16x2" ||
        type === "lcd-16x2-i2c"
      ) {
        const vccPin = type === "lcd-16x2-i2c" ? "vcc" : "VDD";
        const gndPin = type === "lcd-16x2-i2c" ? "gnd" : "VSS";
        const voltage =
          netVoltage(netlist, netVoltages, part.id, vccPin) -
          netVoltage(netlist, netVoltages, part.id, gndPin);
        const backlightCurrent = Math.max(
          0,
          finite(solve?.ledCurrents?.get(`${part.id}:backlight`), 0),
        );
        add(`part:${part.id}`, {
          partId: part.id,
          kind: "lcd",
          label: `LCD ${part.id}`,
          voltage,
          current: backlightCurrent,
          power: Math.abs(voltage) * backlightCurrent,
          meta: { rating: ratings.lcd, backlightCurrent },
        });
      } else if (type === "push-button") {
        const a = netVoltage(netlist, netVoltages, part.id, "1A");
        const b = netVoltage(netlist, netVoltages, part.id, "2A");
        const pressedParts = inputs.pressedParts;
        const pressed =
          pressedParts instanceof Set
            ? pressedParts.has(part.id)
            : Array.isArray(pressedParts)
              ? pressedParts.includes(part.id)
              : false;
        const current = pressed ? Math.abs(a - b) / 0.5 : 0;
        add(`part:${part.id}`, {
          partId: part.id,
          kind: "pushButton",
          label: `Button ${part.id}`,
          voltage: a - b,
          current,
          power: Math.abs(a - b) * current,
          meta: { rating: ratings.pushButton, pressed },
        });
      } else if (type === "capacitor" || type === "electrolytic-capacitor") {
        const a = netVoltage(netlist, netVoltages, part.id, "1");
        const b = netVoltage(netlist, netVoltages, part.id, "2");
        const ratedVoltage = finite(part.props.voltageRatingV, 16);
        const electrolytic =
          type === "electrolytic-capacitor" || part.props.electrolytic === true;
        add(`part:${part.id}`, {
          partId: part.id,
          kind: "capacitor",
          label: `Capacitor ${part.id}`,
          voltage: a - b,
          current: 0,
          power: 0,
          meta: metaFor(
            `capacitor:${part.id}:${ratedVoltage}:${electrolytic}`,
            () => ({
              rating: ratings.capacitor,
              ratedVoltage,
              electrolytic,
            }),
          ),
        });
      } else if (
        type === "dc-motor" ||
        type === "vibration-motor" ||
        type === "gear-motor" ||
        type === "encoder-motor"
      ) {
        const a = netVoltage(netlist, netVoltages, part.id, "plus");
        const b = netVoltage(netlist, netVoltages, part.id, "minus");
        const current = Math.abs(finite(solve?.motorCurrents?.get(part.id), 0));
        add(`part:${part.id}`, {
          partId: part.id,
          kind: "dcMotor",
          label: `Motor ${part.id}`,
          voltage: a - b,
          current,
          power: Math.abs(a - b) * current,
          meta: metaMotor,
        });
      } else if (type === "servo") {
        const voltage =
          netVoltage(netlist, netVoltages, part.id, "vcc") -
          netVoltage(netlist, netVoltages, part.id, "gnd");
        add(`part:${part.id}`, {
          partId: part.id,
          kind: "servo",
          label: `Servo ${part.id}`,
          voltage,
          current: sourceCurrent(solve, part.id, "vcc"),
          power: Math.abs(voltage) * sourceCurrent(solve, part.id, "vcc"),
          meta: metaServo,
        });
      } else if (type === "buzzer") {
        const a = netVoltage(netlist, netVoltages, part.id, "plus");
        const b = netVoltage(netlist, netVoltages, part.id, "minus");
        const current = Math.abs(finite(solve?.buzzerCurrents?.get(part.id), 0));
        add(`part:${part.id}`, {
          partId: part.id,
          kind: "buzzer",
          label: `Buzzer ${part.id}`,
          voltage: a - b,
          current,
          power: Math.abs(a - b) * current,
          meta: metaBuzzer,
        });
      }
    }
    const sourceTotal = [...(solve?.sourceCurrents?.values() ?? [])].reduce(
      (sum, value) => sum + Math.abs(finite(value, 0)),
      0,
    );
    for (const wire of document.wires) {
      const a = netVoltage(netlist, netVoltages, wire.from.partId, wire.from.pinId);
      const b = netVoltage(netlist, netVoltages, wire.to.partId, wire.to.pinId);
      const powerPin =
        /^(5V|3V3|VIN|VCC|VDD|vcc|plus)$/.test(wire.from.pinId) ||
        /^(5V|3V3|VIN|VCC|VDD|vcc|plus)$/.test(wire.to.pinId);
      const groundPin =
        /^(GND|GND2|ground|gnd|minus)$/.test(wire.from.pinId) ||
        /^(GND|GND2|ground|gnd|minus)$/.test(wire.to.pinId);
      add(`wire:${wire.id}`, {
        partId: wire.id,
        kind: "wire",
        label: `Wire ${wire.id}`,
        voltage: a - b,
        current: powerPin && groundPin ? sourceTotal : Math.abs(a - b) / 0.05,
        power: Math.abs(a - b) * sourceTotal,
        meta: metaWire,
      });
    }
    return readings;
  };
  const instantFailure = (reading, state) => {
    const rating = reading.meta.rating;
    const meta = reading.meta;
    if (reading.kind === "led" || reading.kind === "sevenSegment") {
      const max = rating.absoluteMaxCurrentA * rating.instantCurrentFactor;
      if (reading.current > max)
        return `I = ${Math.round(reading.current * 1000)} mA > ${Math.round(max * 1000)} mA`;
      if (reading.voltage < -rating.reverseVoltageMaxV)
        return `Vreverse = ${reading.voltage.toFixed(1)} V < -${rating.reverseVoltageMaxV} V`;
    }
    if (reading.kind === "resistor") {
      const max = rating.ratedPowerW * rating.instantPowerFactor;
      if (reading.power > max)
        return `P = ${reading.power.toFixed(2)} W > ${max.toFixed(2)} W`;
    }
    if (reading.kind === "arduinoPin") {
      if (reading.voltage > rating.overVoltageV)
        return `Vpin = ${reading.voltage.toFixed(1)} V > ${rating.overVoltageV} V`;
      if (reading.voltage < rating.underVoltageV)
        return `Vpin = ${reading.voltage.toFixed(1)} V < ${rating.underVoltageV} V`;
      const max = rating.absoluteMaxCurrentA * rating.instantCurrentFactor;
      if (reading.current > max)
        return `Ipin = ${Math.round(reading.current * 1000)} mA > ${Math.round(max * 1000)} mA`;
    }
    if (reading.kind === "arduinoBoard") {
      const board = meta.rating;
      if (Number.isFinite(meta.inputVoltage)) {
        if (meta.inputVoltage > board.vinAbsoluteMaxV)
          return `VIN = ${meta.inputVoltage.toFixed(1)} V > ${board.vinAbsoluteMaxV} V`;
        if (meta.inputVoltage < board.vinReverseMaxV)
          return `VIN = ${meta.inputVoltage.toFixed(1)} V < ${board.vinReverseMaxV} V`;
      }
      if (meta.threeVoltCurrent > board.pin3v3MaxA)
        return `3V3 = ${Math.round(meta.threeVoltCurrent * 1000)} mA > ${Math.round(board.pin3v3MaxA * 1000)} mA`;
      if (reading.power > board.regulatorThermalLimitW * 3)
        return `Regulator P = ${reading.power.toFixed(2)} W`;
    }
    if (reading.kind === "lcd") {
      const board = meta.rating;
      if (reading.voltage > board.supplyAbsoluteMaxV)
        return `Vcc = ${reading.voltage.toFixed(1)} V > ${board.supplyAbsoluteMaxV} V`;
      if (reading.voltage < board.supplyReverseMaxV)
        return `Vcc = ${reading.voltage.toFixed(1)} V < ${board.supplyReverseMaxV} V`;
      if (meta.backlightCurrent > board.backlightMaxA * 2)
        return `Backlight = ${Math.round(meta.backlightCurrent * 1000)} mA`;
    }
    if (reading.kind === "capacitor") {
      const limit = meta.ratedVoltage * meta.rating.voltageDerating;
      if (reading.voltage > limit)
        return `V = ${reading.voltage.toFixed(1)} V > ${limit.toFixed(1)} V`;
      if (meta.electrolytic && reading.voltage < -0.5)
        return `Vreverse = ${reading.voltage.toFixed(1)} V`;
    }
    if (reading.kind === "wire") {
      const max = rating.sustainedCurrentA * rating.instantCurrentFactor;
      if (reading.current > max)
        return `I = ${Math.round(reading.current * 1000)} mA > ${Math.round(max * 1000)} mA`;
    }
    return null;
  };
  const markFailed = (reading, state, reason) => {
    if (state.failed) return false;
    state.failed = true;
    state.status = "failed";
    state.reason = reason;
    state.failureReason = reason;
    if (reading.kind === "sevenSegment")
      failedSegments.add(`${reading.partId}:${reading.subId}`);
    else if (reading.kind === "arduinoPin") deadPins.add(`${reading.partId}:${reading.subId}`);
    else if (reading.kind === "wire") failedWires.add(reading.partId);
    else if (reading.kind === "arduinoBoard") {
      deadPins.add(`${reading.partId}:5V`);
      deadPins.add(`${reading.partId}:3V3`);
    }
    failedParts.add(reading.partId);
    failedAt.set(reading.partId, Date.now());
    emit({
      severity: "error",
      partId: reading.partId,
      subId: reading.subId,
      kind: reading.kind,
      message: `${reading.label} burnt: ${reason}`,
    });
    return true;
  };
  const step = (context) => {
    lastSimMs = finite(context.simMs, lastSimMs);
    const scale = ratings.timeScales[settings.damageTimeScale] ?? 1;
    const dt = clamp(finite(context.deltaSeconds, 0), 0, 0.05) * scale;
    const readings = context.readings ??
      probe(context.document, context.solve, context.netlist, context.drivers, context.inputs);
    let changedTopology = false;
    const readingsByKey = scratchByKey;
    readingsByKey.clear();
    for (const [key, reading] of readings) {
      const state = stateFor(key, reading);
      readingsByKey.set(key, state);
      if (state.failed) continue;
      const rating = reading.meta.rating;
      const limitCurrent =
        rating.continuousCurrentA ??
        rating.recommendedCurrentA ??
        rating.sustainedCurrentA ??
        rating.ratedCurrentA ??
        rating.maxCurrentA ??
        rating.backlightMaxA ??
        0;
      const limitPower =
        rating.ratedPowerW ??
        (rating.regulatorThermalLimitW !== void 0
          ? rating.regulatorThermalLimitW
          : 0);
      const limitVoltage =
        rating.supplyAbsoluteMaxV ??
        rating.vinAbsoluteMaxV ??
        rating.maxVoltageV ??
        (rating.ratedVoltage !== void 0
          ? reading.meta.ratedVoltage * rating.voltageDerating
          : 0);
      let stress = 0;
      if (limitCurrent > 0) stress = Math.abs(reading.current) / limitCurrent;
      if (limitPower > 0)
        stress = Math.max(stress, Math.abs(reading.power) / limitPower);
      if (limitVoltage > 0)
        stress = Math.max(stress, Math.abs(reading.voltage) / limitVoltage);      state.voltage = reading.voltage;
      state.current = reading.current;
      state.power = reading.power;
      state.stress = stress;
      state.peak = Math.max(state.peak, stress);
      const rth = finite(rating.rthCW, 200);
      const cth = finite(rating.cthJsPerC, 0.02);
      const cooling = (state.heatC - ambient) / rth;
      state.heatC = Math.max(
        ambient,
        state.heatC + ((Math.abs(reading.power) - cooling) / cth) * dt,
      );
      const instant = instantFailure(reading, state);
      if (instant !== null && markFailed(reading, state, instant)) {
        changedTopology = true;
        continue;
      }
      const failC = finite(rating.failC, 125);
      if (state.heatC >= failC && markFailed(reading, state, `T = ${state.heatC.toFixed(0)} C`)) {
        changedTopology = true;
        continue;
      }
      const warnC = finite(rating.warnC, failC * 0.6);
      const warning = stress > 1 || state.heatC > warnC;
      const nextStatus = warning ? "warning" : "ok";
      if (nextStatus !== state.status) {
        state.status = nextStatus;
        state.reason = warning
          ? limitCurrent > 0 && Math.abs(reading.current) > limitCurrent
            ? `I = ${(reading.current * 1000).toFixed(0)} mA > ${(limitCurrent * 1000).toFixed(0)} mA`
            : `T = ${state.heatC.toFixed(0)} C > ${warnC.toFixed(0)} C`
          : "";
        if (warning)
          emit({
            severity: "warning",
            partId: reading.partId,
            subId: reading.subId,
            kind: reading.kind,
            message: `${reading.label} stressed: ${state.reason}`,
          });
      }
    }
    for (const [key, reading] of readings) {
      if (reading.kind !== "arduinoBoard") continue;
      const state = readingsByKey.get(key);
      if (state === void 0) continue;
      const board = reading.meta.rating;
      const supply = reading.meta.supplyCurrent;
      if (supply > board.usb5vHoldA && fuseTrippedUntilMs < 0) {
        const immediate = supply >= board.usb5vTripA;
        fuseTrippedUntilMs =
          lastSimMs +
          board.fuseCooldownS * 1000 *
            (settings.damageTimeScale === "demo" ? 0.4 : 1);
        fuseTripCount += 1;
        emit({
          severity: "error",
          partId: reading.partId,
          kind: "polyfuse",
          message: `USB overcurrent protection tripped: ${(supply * 1000).toFixed(0)} mA${immediate ? " (hard trip)" : ""}`,
        });
        changedTopology = true;
      }
      if (reading.power > board.regulatorThermalLimitW && state.status !== "warning") {
        state.status = "warning";
        state.reason = `Regulator P = ${reading.power.toFixed(2)} W`;
      }
    }
    for (const [key, state] of states) {
      if (!readingsByKey.has(key) && state.status === "warning") {
        state.status = "ok";
        state.reason = "";
        state.heatC = Math.max(
          ambient,
          state.heatC - ((state.heatC - ambient) / 200) * dt * 4,
        );
      }
    }
    return {
      changedTopology,
      readings,
      failedParts: new Set(failedParts),
      failedSegments: new Set(failedSegments),
      deadPins: new Set(deadPins),
      failedWires: new Set(failedWires),
    };
  };
  const applyProtection = (drivers, simMs) => {
    lastSimMs = finite(simMs, lastSimMs);
    let changed = false;
    const tripped = fuseTrippedUntilMs > lastSimMs;
    if (!tripped && fuseTrippedUntilMs >= 0) {
      fuseTrippedUntilMs = -1;
      emit({
        severity: "info",
        kind: "polyfuse",
        message: "USB overcurrent protection recovered",
      });
      changed = true;
    }
    for (const key of [...(drivers?.keys() ?? [])]) {
      const separator = key.lastIndexOf(":");
      if (separator < 0) continue;
      const partId = key.slice(0, separator);
      const pinId = key.slice(separator + 1);
      const boardDead = failedParts.has(partId) &&
        states.get(`board:${partId}`)?.failed === true;
      const cut =
        (tripped && pinId === "5V") ||
        deadPins.has(key) ||
        boardDead;
      if (cut && drivers.delete(key)) changed = true;
    }
    return { changed, tripped };
  };
  const repair = (partId) => {
    let removed = 0;
    const prefix = (key) =>
      key === `part:${partId}` ||
      key === `board:${partId}` ||
      key.startsWith(`part:${partId}:`) ||
      key.startsWith(`segment:${partId}:`) ||
      key.startsWith(`pin:${partId}:`) ||
      key === `wire:${partId}`;
    for (const key of [...states.keys()]) {
      if (prefix(key)) {
        states.delete(key);
        removed += 1;
      }
    }
    for (const key of [...failedSegments]) {
      if (key.startsWith(`${partId}:`) || key === partId) {
        failedSegments.delete(key);
        removed += 1;
      }
    }
    for (const key of [...deadPins]) {
      if (key.startsWith(`${partId}:`) || key === partId) {
        deadPins.delete(key);
        removed += 1;
      }
    }
    for (const key of [...failedWires]) {
      if (key === partId) {
        failedWires.delete(key);
        removed += 1;
      }
    }
    if (failedParts.delete(partId)) removed += 1;
    failedAt.delete(partId);
    if (removed > 0) {
      emit({
        severity: "info",
        partId,
        kind: "repair",
        message: `${partId} repaired`,
      });
    }
    return removed;
  };
  const repairAll = () => {
    const count = states.size + failedParts.size + failedSegments.size + deadPins.size + failedWires.size;
    states.clear();
    failedParts.clear();
    failedAt.clear();
    failedSegments.clear();
    deadPins.clear();
    failedWires.clear();
    fuseTrippedUntilMs = -1;
    emit({
      severity: "info",
      kind: "repair",
      message: "All damage repaired",
    });
    return count;
  };
  const reset = () => {
    states.clear();
    events.length = 0;
    failedParts.clear();
    failedAt.clear();
    failedSegments.clear();
    deadPins.clear();
    failedWires.clear();
    fuseTrippedUntilMs = -1;
    fuseTripCount = 0;
    lastSimMs = 0;
    rngState = 0x1a2b3c4d;
    revision += 1;
    overlayRevision += 1;
    for (const listener of listeners) listener(snapshot());
  };
  const snapshot = () => ({
    revision,
    settings: { ...settings },
    ambientC: ambient,
    fuse: {
      tripped: fuseTrippedUntilMs > lastSimMs,
      untilMs: fuseTrippedUntilMs,
      tripCount: fuseTripCount,
    },
    failedParts: [...failedParts],
    failedAt: Object.fromEntries(failedAt),
    failedSegments: [...failedSegments],
    deadPins: [...deadPins],
    failedWires: [...failedWires],
    events: events.map((event) => ({ ...event })),
    states: [...states.values()].map((state) => ({ ...state })),
  });
  const overlaySnapshot = () => {
    if (overlayCache.value !== null && overlayCache.revision === overlayRevision)
      return overlayCache.value;
    const value = {
      revision: overlayRevision,
      settings: { ...settings },
      failedAt: Object.fromEntries(failedAt),
      events: events.slice(),
      states: [...states.values()]
        .filter((state) => state.failed)
        .map((state) => ({ ...state })),
    };
    overlayCache.revision = overlayRevision;
    overlayCache.value = value;
    return value;
  };
  const setSettings = (next) => {
    Object.assign(settings, next);
    overlayRevision += 1;
    for (const listener of listeners) listener(snapshot());
    return { ...settings };
  };
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  window.__LCD_DAMAGE_ENGINE__ = {
    ratings,
    settings,
    random,
    probe,
    step,
    applyProtection,
    repair,
    repairAll,
    reset,
    snapshot,
    overlaySnapshot,
    setSettings,
    subscribe,
    isBoardDead: (partId) =>
      failedParts.has(partId) && states.get(`board:${partId}`)?.failed === true,
    isSegmentFailed: (key) => failedSegments.has(key),
    isWireFailed: (id) => failedWires.has(id),
    isPinDead: (key) => deadPins.has(key),
  };
})();
