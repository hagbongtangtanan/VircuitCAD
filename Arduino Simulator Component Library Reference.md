# Arduino Simulator Component Library Reference Manual

This document serves as the simulation specification manual for building an offline Arduino circuit simulator for Windows (inspired by Tinkercad Circuits).

---

## 1. General Passive & Basic Components

### Resistor
* **Description:** A passive two-terminal electrical component that implements electrical resistance as a circuit element. Limits current flow and drops voltage.
* **Wiring Configuration:**
  * Pin 1 (Terminal 1)
  * Pin 2 (Terminal 2)
  * Non-polarized.
* **Simulator Behavior:**
  * Obeyes Ohm's Law: $I = \frac{V}{R}$.
  * Calculates current and voltage drop dynamically based on user-configured resistance value ($\Omega, k\Omega, M\Omega$).

### Capacitor
* **Description:** A passive two-terminal electrical component that stores electrical energy in an electric field.
* **Wiring Configuration:**
  * Pin 1 (Terminal 1)
  * Pin 2 (Terminal 2)
  * Non-polarized in standard ceramic/film representation.
* **Simulator Behavior:**
  * Modeled using transient differential equations: $I(t) = C \frac{dV(t)}{dt}$.
  * Acts as an open circuit to steady DC and a low-impedance path to high-frequency AC/transients.

### Polarized Capacitor
* **Description:** An electrolytic capacitor that offers higher capacitance per volume but must be connected with correct polarity.
* **Wiring Configuration:**
  * Pin 1 (Anode / Positive `+`)
  * Pin 2 (Cathode / Negative `-`)
* **Simulator Behavior:**
  * Functions as a capacitor under correct polarity.
  * **Fault Condition:** If reverse-biased above threshold or over-voltage, triggers an explosive visual animation/error state.

### Diode
* **Description:** A semiconductor device that allows current to flow primarily in one direction (Anode to Cathode).
* **Wiring Configuration:**
  * Pin 1 (Anode)
  * Pin 2 (Cathode - marked with a band)
* **Simulator Behavior:**
  * Shockley diode equation model: $I = I_s \left( e^{\frac{V_D}{n V_T}} - 1 \right)$.
  * Forward voltage drop $\approx 0.7\text{V}$ for silicon. High resistance when reverse biased.

### Zener Diode
* **Description:** A special diode designed to reliably allow current to flow backwards when a set reverse breakdown voltage ($V_Z$) is reached.
* **Wiring Configuration:**
  * Pin 1 (Anode)
  * Pin 2 (Cathode)
* **Simulator Behavior:**
  * Behaves like a standard diode in forward bias ($\sim 0.7\text{V}$).
  * In reverse bias, maintains a constant voltage equal to $V_Z$ once breakdown voltage is exceeded.

### Inductor
* **Description:** A passive two-terminal electrical component that stores energy in a magnetic field when electric current flows through it.
* **Wiring Configuration:**
  * Pin 1 (Terminal 1)
  * Pin 2 (Terminal 2)
  * Non-polarized.
* **Simulator Behavior:**
  * Modeled using differential equation: $V(t) = L \frac{dI(t)}{dt}$.
  * Resists rapid changes in current; acts as a short circuit in steady DC.

---

## 2. Input Components & Sensors

### Pushbutton
* **Description:** A simple momentary switch mechanism for making or breaking an electrical connection.
* **Wiring Configuration:**
  * Pins 1A & 1B (Internally connected)
  * Pins 2A & 2B (Internally connected)
* **Simulator Behavior:**
  * Interactive click event toggle: Default open ($R \approx \infty$), Closed ($R \approx 0\,\Omega$) while pressed or clicked.

### Potentiometer
* **Description:** A three-terminal resistor with a sliding or rotating contact that forms an adjustable voltage divider.
* **Wiring Configuration:**
  * Terminal 1 ($V_{CC}$ or Ground)
  * Wiper (Signal output)
  * Terminal 2 (Ground or $V_{CC}$)
* **Simulator Behavior:**
  * Interactive UI slider (0°–270° or 0%–100%).
  * Resistance between Wiper and T1 is $R \times \text{ratio}$; Wiper and T2 is $R \times (1 - \text{ratio})$.

### Slideswitch
* **Description:** A mechanical switch that slides between two positions (SPDT - Single Pole Double Throw).
* **Wiring Configuration:**
  * Terminal 1
  * Common Pin (Center)
  * Terminal 2
* **Simulator Behavior:**
  * Interactive toggle switch connecting Common to either Terminal 1 or Terminal 2 with low contact resistance.

### Photoresistor (LDR)
* **Description:** A light-dependent resistor whose resistance decreases with increasing incident light intensity.
* **Wiring Configuration:**
  * Terminal 1
  * Terminal 2
* **Simulator Behavior:**
  * UI slider for lux level (0 lux to 10,000 lux).
  * Variable resistance curve: Dark $\approx 1\,\text{M}\Omega$, Bright $\approx 100\,\Omega - 1\,\text{k}\Omega$.

### Photodiode
* **Description:** A semiconductor device that converts light into an electrical current when reverse-biased.
* **Wiring Configuration:**
  * Anode
  * Cathode
* **Simulator Behavior:**
  * Reverse leakage current scales linearly with light intensity slider.

### Ambient Light Sensor [Phototransistor]
* **Description:** A NPN phototransistor whose base current is controlled by external light level.
* **Wiring Configuration:**
  * Collector
  * Emitter
* **Simulator Behavior:**
  * Light intensity control drives collector-emitter current ($I_{CE}$) proportionally.

### Flex Sensor
* **Description:** A sensor that measures bend or deflection. Resistance increases as the sensor bends.
* **Wiring Configuration:**
  * Terminal 1
  * Terminal 2
* **Simulator Behavior:**
  * UI bend slider (0° to 180°). Resistance shifts linearly/logarithmically (e.g., $10\,\text{k}\Omega$ flat to $30\,\text{k}\Omega$ fully bent).

### Force Sensor (FSR)
* **Description:** A force-sensitive resistor that changes resistance depending on applied pressure.
* **Wiring Configuration:**
  * Terminal 1
  * Terminal 2
* **Simulator Behavior:**
  * UI force slider (0N to 10N). Resistance ranges from $>1\,\text{M}\Omega$ (no force) down to $<1\,\text{k}\Omega$ (max force).

### IR Sensor
* **Description:** Infrared receiver module detecting $38\,\text{kHz}$ modulated IR light signals from remotes.
* **Wiring Configuration:**
  * OUT (Signal output to MCU)
  * GND
  * VCC
* **Simulator Behavior:**
  * Output defaults HIGH ($5\text{V}$). Outputs low digital pulse streams upon receiving IR codes from simulated IR remote control.

### Ultrasonic Distance Sensor (Parallax 28015 REV C - 3-pin)
* **Description:** Uses single SIG pin for trigger and echo pulse output.
* **Wiring Configuration:**
  * SIG (Signal)
  * VCC ($5\text{V}$)
  * GND
* **Simulator Behavior:**
  * UI distance slider (2 cm to 400 cm). MCU pulses SIG HIGH; sensor holds SIG HIGH proportional to distance ($t = \frac{\text{distance} \times 2}{343\,\text{m/s}}$).

### Ultrasonic Distance Sensor (HC-SR04 - 4-pin)
* **Description:** Ultrasonic range finder with separate trigger and echo pins.
* **Wiring Configuration:**
  * VCC ($5\text{V}$)
  * TRIG (Trigger input)
  * ECHO (Echo output)
  * GND
* **Simulator Behavior:**
  * UI distance slider. When TRIG receives $\ge 10\,\mu\text{s}$ pulse, ECHO goes HIGH for duration matching target distance duration.

### PIR Sensor REV B (555-28027)
* **Description:** Passive Infrared motion sensor detecting infrared thermal variance.
* **Wiring Configuration:**
  * VCC
  * OUT (Digital signal out)
  * GND
* **Simulator Behavior:**
  * UI "Simulate Motion" toggle/button. OUT goes HIGH ($3.3\text{V}/5\text{V}$) for a user-set hold time upon activation.

### Soil Moisture Sensor
* **Description:** Measures moisture content via capacitive or resistive conductivity between probes.
* **Wiring Configuration:**
  * VCC
  * SIG (Analog output)
  * GND
* **Simulator Behavior:**
  * UI moisture level slider (0% to 100%). SIG outputs proportional analog voltage ($0\text{V} - 5\text{V}$).

### Tilt Sensor SW-200D
* **Description:** Ball-contact tilt switch that opens or closes an electrical contact when tilted.
* **Wiring Configuration:**
  * Terminal 1
  * Terminal 2
* **Simulator Behavior:**
  * UI tilt angle slider or orientation toggle. Short circuit when level/upright, open circuit when tilted beyond angle threshold ($\sim 15^\circ$).

### Temperature Sensor [TMP36]
* **Description:** Precision analog temperature sensor providing voltage directly proportional to Celsius temperature.
* **Wiring Configuration:**
  * VCC ($2.7\text{V}-5.5\text{V}$)
  * VOUT (Analog output)
  * GND
* **Simulator Behavior:**
  * UI temperature slider ($-40^\circ\text{C}$ to $+125^\circ\text{C}$).
  * Output voltage formula: $V_{OUT} = (T_{^\circ\text{C}} \times 0.01\text{V}) + 0.5\text{V}$.

### Gas Sensor (MQ-2 style)
* **Description:** Chemiresistor sensor for detecting combustible gas/smoke.
* **Wiring Configuration:**
  * H1, H2 (Heater pins)
  * A1, A2 (Anodes)
  * B1, B2 (Outputs)
* **Simulator Behavior:**
  * UI gas concentration slider (PPM). Internal resistance drops as concentration increases, varying analog output voltage.

### Keypad 4x4
* **Description:** Matrix keyboard with 16 pushbuttons organized in 4 rows and 4 columns.
* **Wiring Configuration:**
  * Pins 1–4 (Rows R1–R4)
  * Pins 5–8 (Columns C1–C4)
* **Simulator Behavior:**
  * Pressing a button shorts the corresponding Row line to Column line.

### DIP Switch SPST x4 / x6
* **Description:** Bank of 4 or 6 independent Single-Pole Single-Throw switch toggles.
* **Wiring Configuration:**
  * Top Pins (1 to N)
  * Bottom Pins (1 to N)
* **Simulator Behavior:**
  * Interactive switch toggles opening/closing individual pin pairs independently.

---

## 3. Output Components

### Standard LED
* **Description:** Light Emitting Diode that lights up when forward biased.
* **Wiring Configuration:**
  * Anode (Long leg, `+`)
  * Cathode (Short leg, `-`)
* **Simulator Behavior:**
  * Illuminates visually based on forward current ($I_F > 2\,\text{mA}$). Color rendering intensity maps to current up to $20\,\text{mA}$.
  * **Overcurrent model:** Permanently damages ("burns out") if $I_F > 30\,\text{mA}$.

### LED RGB
* **Description:** Red-Green-Blue multi-color LED.
* **Wiring Configuration:**
  * Red Anode/Cathode
  * Common Cathode or Common Anode
  * Green Anode/Cathode
  * Blue Anode/Cathode
* **Simulator Behavior:**
  * Reads individual currents through R, G, and B lines; blends overall visible RGB canvas color dynamically.

### Light Bulb
* **Description:** Incandescent filament lamp display.
* **Wiring Configuration:**
  * Terminal 1
  * Terminal 2
* **Simulator Behavior:**
  * Non-polar. Glow brightness scales non-linearly with applied voltage up to rating ($12\text{V}$). Draws filament heating current.

### NeoPixel / NeoPixel Rings (12, 16, 24) / NeoPixel Strips (4, 6, 8, 10, 12, 16, 20)
* **Description:** Individually addressable RGB LEDs powered by WS2812B ICs.
* **Wiring Configuration:**
  * VDD ($5\text{V}$)
  * GND
  * DIN (Data In)
  * DOUT (Data Out to daisy-chain)
* **Simulator Behavior:**
  * Decodes $800\,\text{kHz}$ NRZ protocol timing pulses from DIN pin. Sets internal 24-bit RGB registers (8-bit per channel) and renders precise color on the component canvas. Passes overflow data to DOUT.

---

## 4. Motors & Actuators

### Vibration Motor
* **Description:** Small DC motor with an eccentric rotating mass producing vibration.
* **Wiring Configuration:**
  * Positive ($+$)
  * Negative ($-$)
* **Simulator Behavior:**
  * Rotates/vibrates visually (blur/shake animation) when differential DC voltage $\ge 1.5\text{V}$ is applied.

### DC Motor
* **Description:** Basic direct-current rotary electric motor.
* **Wiring Configuration:**
  * Terminal 1
  * Terminal 2
* **Simulator Behavior:**
  * Rotates clockwise/counterclockwise depending on voltage polarity. Visual RPM counter and rotational spinner graphic update according to back-EMF and load model.

### DC Motor with Encoder
* **Description:** DC Motor fitted with a quadrature magnetic/optical encoder to track rotational speed and direction.
* **Wiring Configuration:**
  * Motor Terminal 1 & 2
  * Encoder VCC & GND
  * Encoder Channel A & Channel B
* **Simulator Behavior:**
  * As motor spins, outputs two square waves offset by $90^\circ$ phase shift (Quadrature output) on Channel A and B.

### Micro Servo (e.g., SG90)
* **Description:** PWM-controlled positional rotary actuator ($0^\circ-180^\circ$).
* **Wiring Configuration:**
  * Signal (PWM input)
  * Power ($5\text{V}$)
  * Ground
* **Simulator Behavior:**
  * Evaluates incoming $50\,\text{Hz}$ PWM signal pulse width ($1\,\text{ms} = 0^\circ$, $1.5\,\text{ms} = 90^\circ$, $2\,\text{ms} = 180^\circ$). Smoothly rotates motor visual horn to corresponding angle.

### Hobby Gearmotor
* **Description:** DC motor geared down to yield higher torque and lower output speed.
* **Wiring Configuration:**
  * Terminal 1
  * Terminal 2
* **Simulator Behavior:**
  * High torque load simulation with lower top RPM calculation compared to raw DC motor.

---

## 5. Audio, Visual Displays & Accessories

### Piezo Buzzer / Speaker
* **Description:** Piezoelectric transducer capable of generating tones from square wave inputs.
* **Wiring Configuration:**
  * Positive Terminal (`+`)
  * Negative Terminal (`-`)
* **Simulator Behavior:**
  * Plays audio tone matching input signal frequency via Windows Web Audio API or system audio synthesizer.

### IR Remote
* **Description:** Handheld infrared transmitter with numeric/directional buttons.
* **Wiring Configuration:** Wireless transmitter UI widget.
* **Simulator Behavior:**
  * Clicking UI buttons broadcasts standard NEC or Sony protocol $38\,\text{kHz}$ IR light signal packets to simulated IR Receiver components.

### 7-Segment Display
* **Description:** Single digit LED display (8 segments including decimal point).
* **Wiring Configuration:**
  * Pins A, B, C, D, E, F, G, DP
  * Common Anode or Common Cathode pin(s)
* **Simulator Behavior:**
  * Individual segment LEDs light up when corresponding pins are biased relative to the common pin.

### LCD 16x2 (Parallel)
* **Description:** Alphanumeric liquid crystal display (16 characters $\times$ 2 lines) driven by HD44780 controller.
* **Wiring Configuration:**
  * VSS, VDD, V0 (Contrast)
  * RS, RW, E (Control)
  * D0–D7 (Data lines; 4-bit mode uses D4–D7)
  * LED+ / LED- (Backlight)
* **Simulator Behavior:**
  * Simulates HD44780 instruction state machine. Displays ASCII text characters on virtual dot-matrix screen.

### LCD 16x2 (I2C)
* **Description:** Standard 16x2 LCD piggybacked onto PCF8574 I2C backpack.
* **Wiring Configuration:**
  * GND, VCC
  * SDA (I2C Data)
  * SCL (I2C Clock)
* **Simulator Behavior:**
  * Listens to address `0x27` or `0x3F` over I2C bus; updates text pixels accordingly.

### 7-Segment Clock Display (HT16K33)
* **Description:** 4-digit 7-segment display with colon driven by HT16K33 I2C LED driver chip.
* **Wiring Configuration:**
  * VCC, GND
  * SDA, SCL
* **Simulator Behavior:**
  * Decodes HT16K33 I2C RAM registers to render digits and colon display elements.

---

## 6. Power Sources

### 9V Battery
* **Description:** Standard alkaline $9\text{V}$ DC power supply.
* **Wiring Configuration:** Positive (`+`), Negative (`-`).
* **Simulator Behavior:** Provides $9.0\text{V}$ nominal ideal voltage source with small internal resistance ($\sim 1-2\,\Omega$).

### 1.5V Battery (AA/AAA)
* **Description:** Single cell $1.5\text{V}$ power source.
* **Wiring Configuration:** Positive (`+`), Negative (`-`).
* **Simulator Behavior:** Provides $1.5\text{V}$ DC. Can be stacked in series/parallel configurations.

### Coin Cell 3V Battery (CR2032)
* **Description:** $3\text{V}$ lithium button cell battery.
* **Wiring Configuration:** Positive (`+`), Negative (`-`).
* **Simulator Behavior:** $3.0\text{V}$ supply with moderate internal resistance ($\sim 10-30\,\Omega$).

### Solar Cell
* **Description:** Photovoltaic cell converting light energy to electrical voltage.
* **Wiring Configuration:** Positive (`+`), Negative (`-`).
* **Simulator Behavior:** UI sunlight exposure slider. Open circuit voltage ($V_{oc}$) and short-circuit current ($I_{sc}$) scale with light input.

### Potato Battery / Lemon Battery
* **Description:** Galvanic cell using organic acid electrolyte with copper and zinc electrodes.
* **Wiring Configuration:** Anode (Zinc `-`), Cathode (Copper `+`).
* **Simulator Behavior:** Outputs $\approx 0.9\text{V}$ DC with high internal resistance ($\sim 1000\,\Omega$). Drops voltage heavily under load.

---

## 7. Breadboards & Prototyping

### Breadboards (Standard, Small, Mini)
* **Description:** Solderless breadboards for circuit prototyping.
* **Wiring Configuration:**
  * Power rails: Top/Bottom horizontal strips (Red `+`, Blue `-`).
  * Terminal strips: Vertical 5-pin connected columns separated by center divider ravine.
* **Simulator Behavior:**
  * Provides low-resistance virtual connectivity across connected terminal socket sets.

---

## 8. Microcontrollers

### Arduino Uno R3
* **Description:** ATmega328P-based microcontroller board.
* **Wiring Configuration:**
  * 14 Digital I/O (Pins 0–13, PWM on 3, 5, 6, 9, 10, 11)
  * 6 Analog Inputs (A0–A5)
  * Power: $5\text{V}$, $3.3\text{V}$, GND, Vin, RESET
* **Simulator Behavior:**
  * Runs compiled AVR binary hex code via internal emulator core (e.g., Avr8js). Drives digital I/O states, ADC sampling, PWM, UART, SPI, and I2C peripherals.

### micro:bit / micro:bit with Breakout
* **Description:** ARM Cortex-M0 based educational board with LED matrix, buttons, and edge connector.
* **Wiring Configuration:** Edge connector pins 0, 1, 2, 3V, GND, plus expansion breakout headers.
* **Simulator Behavior:**
  * Emulates ARM binary/MicroPython instructions; updates on-board 5x5 LED matrix and pin outputs.

### ATtiny (e.g., ATtiny85)
* **Description:** Compact 8-pin 8-bit AVR Microcontroller.
* **Wiring Configuration:**
  * Pin 1: PB5 / RESET
  * Pin 2: PB3 / Analog 3
  * Pin 3: PB4 / Analog 2
  * Pin 4: GND
  * Pin 5: PB0 / MOSI / PWM
  * Pin 6: PB1 / MISO / PWM
  * Pin 7: PB2 / SCK / Analog 1
  * Pin 8: VCC
* **Simulator Behavior:**
  * AVR execution engine simulating 8 KB Flash and 512 bytes SRAM memory space.

---

## 9. Instruments & Measurement Tools

### Multimeter
* **Description:** Virtual test instrument to measure Volts, Amperes, or Resistance.
* **Wiring Configuration:** Positive (Red), Negative (Black). Mode Selector switch.
* **Simulator Behavior:**
  * **Voltmeter Mode:** High input impedance ($\sim 10\,\text{M}\Omega$). Displays $V_{Red} - V_{Black}$.
  * **Ammeter Mode:** In-series low impedance ($\sim 0.01\,\Omega$). Displays inline current.
  * **Ohmmeter Mode:** Inject test voltage into unpowered sub-circuit to calculate $R$.

### Power Supply
* **Description:** Benchtop DC variable power supply.
* **Wiring Configuration:** Positive (`+`), Negative (`-`).
* **Simulator Behavior:**
  * Dial sliders for Voltage Setpoint and Current Limit. Supplies regulated DC voltage while limiting maximum current (Constant Voltage / Constant Current mode switching).

### Function Generator
* **Description:** Signal generator providing Sine, Square, and Triangle waveforms.
* **Wiring Configuration:** Output (`+`), Common (`-`).
* **Simulator Behavior:**
  * Generates time-variant voltage source $V(t)$ with configurable Frequency, Amplitude, and DC Offset settings.

### Oscilloscope
* **Description:** Visual display instrument plotting voltage waveforms over time.
* **Wiring Configuration:** Channel In (`+`), Ground (`-`).
* **Simulator Behavior:**
  * Buffers time-series voltage data samples and renders a 2D plot against time/div and volts/div scaling axes.

---

## 10. Integrated Circuits & Power Control

### 555 Timer / Dual Timer (556)
* **Description:** Precision timing/pulse IC.
* **Wiring Configuration (555):**
  * 1: GND, 2: TRIG, 3: OUT, 4: RESET, 5: CTRL, 6: THRES, 7: DISCH, 8: VCC
* **Simulator Behavior:**
  * Internal comparative flip-flop logic triggers output based on threshold ($2/3 V_{CC}$) and trigger ($1/3 V_{CC}$) pin levels.

### 741 Operational Amplifier
* **Description:** General-purpose single op-amp.
* **Wiring Configuration:**
  * 2: Inverting Input ($-$)
  * 3: Non-Inverting Input ($+$)
  * 4: $V_-$ (Negative supply)
  * 6: Output
  * 7: $V_+$ (Positive supply)
* **Simulator Behavior:**
  * Simulates $V_{out} = A_{OL} (V_+ - V_-)$ bounded between supply rails ($V_-$ to $V_+$).

### Quad / Dual Comparators (e.g., LM339 / LM393)
* **Description:** High precision voltage comparator array.
* **Wiring Configuration:** Non-inverting input, Inverting input, Open-collector output, Power/GND.
* **Simulator Behavior:**
  * Pulls output pin to GND if $V_{in-} > V_{in+}$; floats output (requires pull-up resistor) when $V_{in+} > V_{in-}$.

### Optocoupler (e.g., 4N35)
* **Description:** Galvanic isolation component combining an infrared LED and phototransistor.
* **Wiring Configuration:**
  * Pin 1: Anode, Pin 2: Cathode
  * Pin 4: Emitter, Pin 5: Collector, Pin 6: Base
* **Simulator Behavior:**
  * Input LED light intensity controls output phototransistor conduction state with complete electrical isolation between input/output loops.

### Transistors (NPN BJT, PNP BJT, TIP120 Darlington)
* **Description:** Bipolar junction current-controlled switches and amplifiers.
* **Wiring Configuration:** Base, Collector, Emitter.
* **Simulator Behavior:**
  * Eber-Moll / Gummel-Poon BJT model: Base current $I_B$ controls collector current $I_C = \beta \cdot I_B$.

### MOSFETs (Small Signal / Power nMOS, pMOS)
* **Description:** Voltage-controlled field-effect transistors.
* **Wiring Configuration:** Gate, Drain, Source.
* **Simulator Behavior:**
  * Conducts $I_{DS}$ based on $V_{GS}$ relative to threshold voltage $V_{th}$. Bounded by Ohmic and Saturation operational regions.

### Relays (SPDT, DPDT)
* **Description:** Electromechanical switch operated by an electromagnet coil.
* **Wiring Configuration:**
  * Coil Terminal 1 & 2
  * Common (COM)
  * Normally Closed (NC)
  * Normally Open (NO)
* **Simulator Behavior:**
  * When coil differential voltage exceeds pull-in threshold, internal mechanical contact toggles from NC to NO with audible click and visual state transition.

### Voltage Regulators (LM7805 - 5V, LD1117V33 - 3.3V)
* **Description:** Linear voltage regulators providing constant DC output.
* **Wiring Configuration:** Input, Ground, Output.
* **Simulator Behavior:**
  * Regulates output voltage to fixed $5.0\text{V}$ or $3.3\text{V}$ provided $V_{in} \ge V_{out} + V_{dropout}$. Dissipates excess voltage drop as thermal heat loss.

### H-Bridge Motor Driver (L293D)
* **Description:** Quadruple high-current half-H driver for bidirectional motor control.
* **Wiring Configuration:**
  * Enable 1,2 / Enable 3,4
  * Inputs 1–4
  * Outputs 1–4
  * $V_{CC1}$ (Logic), $V_{CC2}$ (Motor Power), GND
* **Simulator Behavior:**
  * Drives high current outputs corresponding to digital inputs when Enable pin is HIGH.

---

## 11. Connectors & Logic ICs

### Connectors (8 Pin Header, USB Standard A)
* **Description:** Mechanical connection interfaces for external wiring and signal access.
* **Wiring Configuration:** Individual pin terminals 1..N.
* **Simulator Behavior:** Ideal pass-through conductor nodes ($0\,\Omega$ resistance).

### 74HC Logic Gates Series
* **74HC00:** Quad 2-Input NAND Gate
* **74HC02:** Quad 2-Input NOR Gate
* **74HC08:** Quad 2-Input AND Gate
* **74HC32:** Quad 2-Input OR Gate
* **74HC86:** Quad 2-Input XOR Gate
* **74HC04:** Hex Inverter (NOT)
* **74HC14:** Hex Inverting Schmitt Trigger
* **74HC131 / 74HC132:** Quad 2-Input NAND Schmitt Trigger
* **74HC10:** Triple 3-Input NAND Gate
* **74HC11:** Triple 3-Input AND Gate
* **74HC27:** Triple 3-Input NOR Gate
* **74HC20:** Dual 4-Input NAND Gate
* **74HC21:** Dual 4-Input AND Gate
* **Wiring Configuration:** Standard DIP-14 pinouts ($V_{CC} = Pin 14, GND = Pin 7$).
* **Simulator Behavior:** Evaluates boolean truth tables for inputs ($V_{in} > 2.0\text{V} \rightarrow HIGH, V_{in} < 0.8\text{V} \rightarrow LOW$). Outputs $V_{CC}$ or $0\text{V}$ with propagation delay ($\sim 10-20\,\text{ns}$). Schmitt trigger variants feature hysteresis thresholding.

### Sequential Logic & Complex ICs
* **74HC73 (Dual J-K Flip-Flop):** Triggers state changes on falling clock edges according to J and K inputs.
* **74HC74 (Dual D Flip-Flop):** Latches D input data on rising clock edge.
* **74HC75 (4-Bit Latch):** Bistable transparent latch array controlled by enable line.
* **74HC93 (4-Bit Binary Counter):** 4-stage ripple counter incrementing on clock pulses.
* **74HC283 (4-Bit Binary Full Adder):** Performs binary addition ($A + B + C_{in}$) yielding 4 Sum outputs and Carry Out ($C_{out}$).
* **74HC595 (8-Bit Shift Register):** Serial-In Parallel-Out shift register with output storage latches.
* **74HC4017 (Johnson Decade Counter):** 10-stage decade counter driving 1 of 10 outputs HIGH sequentially on clock rising edges.
* **CD4511 (BCD to 7-Segment Decoder):** Decodes 4-bit Binary Coded Decimal input into 7-segment display control signals.
* **PCF8574 (8-Port I2C Expander):** Remote 8-bit I/O expander for I2C bus communicating at assigned address (`0x20-0x27`).