var ledDefinition = {
  type: "led",
  label: "LED",
  category: "outputs",
  size: {
    width: 20,
    height: 30
  },
  defaultProps: { color: "red" },
  pins: [
    pin("anode", "A", {
      x: 10,
      y: 40
    }),
    pin("cathode", "K", {
      x: 20,
      y: 40
    })
  ],
  propFields: [{
    kind: "select",
    key: "color",
    label: "Color",
    options: [
      "red",
      "green",
      "blue",
      "yellow",
      "white"
    ]
  }]
};