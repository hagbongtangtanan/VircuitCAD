# SCHEMATIC — read-only auto-layout

The schematic is a **projection of the netlist**, like the breadboard view. It never owns
connectivity: it is derived from `extractNetlist` and cannot be edited.

## Layout

`layoutSchematic(circuit, netlist, registry)` (in `@vircuitcad/core`) places every part on a
deterministic grid and labels each pin with the name of the net it belongs to:

- ground nets are labelled `GND`;
- unconnected pins are labelled `FLOATING`;
- everything else uses the net name.

Parts are drawn using their manifest `schematicSymbol` (e.g. `resistor`, `led`, `battery`,
`source`, `ic`), falling back to `generic` when a manifest does not set one. Routing uses **net
labels** rather than drawn wires, so crossings never imply a connection.

`schematicToSvg(layout)` renders a standalone SVG string for export.

## Guarantees

- **Netlist equivalence is not negotiable.** A test asserts the schematic nets (name, ground
  flag, pin membership) are identical to the breadboard netlist. Auto-layout may draw messy
  labels; it must never change connectivity.

## Limitations

- **Read-only.** No placing, moving or rewiring parts in the schematic; no manual wire routing.
- **Auto-layout only.** Positions are deterministic but not hand-tuned; net labels are used
  where routing would be ambiguous.
- **Selection cross-highlight** with the breadboard is planned but not yet wired into the UI.
- Export is SVG only.
