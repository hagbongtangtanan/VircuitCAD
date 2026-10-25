import blink from './uno-blink.vcc?raw'
import buttonLed from './uno-button-led.vcc?raw'
import temperature from './uno-temperature.vcc?raw'
import sevenSegment from './uno-seven-segment.vcc?raw'
import trafficLight from './uno-traffic-light.vcc?raw'
import buzzer from './uno-buzzer.vcc?raw'
import servo from './uno-servo.vcc?raw'
import motor from './uno-l293d-motor.vcc?raw'
import shiftRegister from './uno-shift-register.vcc?raw'
import lcdHello from './uno-lcd-hello.vcc?raw'
import millisTimer from './uno-millis-timer.vcc?raw'
import ultrasonic from './uno-ultrasonic.vcc?raw'
import irReceiver from './uno-ir-receiver.vcc?raw'
import pir from './uno-pir.vcc?raw'
import keypad from './uno-keypad.vcc?raw'
import neopixel from './uno-neopixel.vcc?raw'
import rgbLed from './uno-rgb-led.vcc?raw'
import ldr from './uno-ldr.vcc?raw'
import thermistor from './uno-thermistor.vcc?raw'
import dcMotor from './uno-dc-motor.vcc?raw'
import potentiometer from './uno-potentiometer.vcc?raw'
import slideSwitch from './uno-slide-switch.vcc?raw'
import tilt from './uno-tilt.vcc?raw'
import photodiode from './uno-photodiode.vcc?raw'
import soilMoisture from './uno-soil-moisture.vcc?raw'
import gasSensor from './uno-gas-sensor.vcc?raw'
import neopixelRing from './uno-neopixel-ring.vcc?raw'
import flexSensor from './uno-flex-sensor.vcc?raw'
import forceSensor from './uno-force-sensor.vcc?raw'

export type StarterCategory =
  | 'microcontrollers'
  | 'inputs'
  | 'sensors'
  | 'displays'
  | 'outputs'
  | 'actuators'
  | 'motor-drivers'
  | 'shift-registers'
  | 'timers'

export interface StarterCategoryInfo {
  readonly id: StarterCategory
  readonly label: string
  readonly blurb: string
}

export interface StarterDefinition {
  readonly id: string
  readonly title: string
  readonly category: StarterCategory
  readonly description: string
  readonly fileName: string
  readonly projectText: string
}

export const STARTER_CATEGORIES: readonly StarterCategoryInfo[] = [
  {
    id: 'microcontrollers',
    label: 'Microcontrollers',
    blurb: 'First sketches for the Arduino Uno.',
  },
  {
    id: 'inputs',
    label: 'Inputs',
    blurb: 'Read a button and react to it.',
  },
  {
    id: 'sensors',
    label: 'Sensors',
    blurb: 'Turn a physical reading into serial data.',
  },
  {
    id: 'displays',
    label: 'Displays',
    blurb: 'Show numbers on a seven-segment display.',
  },
  {
    id: 'outputs',
    label: 'Outputs',
    blurb: 'Light LEDs in a useful sequence.',
  },
  {
    id: 'actuators',
    label: 'Actuators',
    blurb: 'Make sound and motion.',
  },
  {
    id: 'motor-drivers',
    label: 'Motor drivers',
    blurb: 'Drive a motor through an H-bridge.',
  },
  {
    id: 'shift-registers',
    label: 'Shift registers',
    blurb: 'Control many outputs from a few pins.',
  },
  {
    id: 'timers',
    label: 'Timers',
    blurb: 'Blink without a microcontroller.',
  },
]

export const STARTERS: readonly StarterDefinition[] = [
  {
    id: 'uno-blink',
    title: 'Blink an LED',
    category: 'microcontrollers',
    description: 'The classic first circuit: D13, a 220 Ω resistor, and a red LED.',
    fileName: 'uno-blink.vcc',
    projectText: blink,
  },
  {
    id: 'uno-button-led',
    title: 'Button-controlled LED',
    category: 'inputs',
    description: 'Use the Uno’s internal pull-up to read a button and switch an LED.',
    fileName: 'uno-button-led.vcc',
    projectText: buttonLed,
  },
  {
    id: 'uno-temperature',
    title: 'Read a temperature',
    category: 'sensors',
    description: 'Connect a TMP36 to A0 and print degrees Celsius over serial.',
    fileName: 'uno-temperature.vcc',
    projectText: temperature,
  },
  {
    id: 'uno-seven-segment',
    title: '7-segment counter',
    category: 'displays',
    description: 'Drive all seven segments from D2–D8 and count from 0 to 9.',
    fileName: 'uno-seven-segment.vcc',
    projectText: sevenSegment,
  },
  {
    id: 'uno-lcd-hello',
    title: 'Hello on an LCD',
    category: 'displays',
    description: 'Print a greeting on a 16×2 LCD through a PCF8574 I2C backpack.',
    fileName: 'uno-lcd-hello.vcc',
    projectText: lcdHello,
  },
  {
    id: 'uno-traffic-light',
    title: 'Traffic light',
    category: 'outputs',
    description: 'Three LEDs and three resistors model a simple traffic sequence.',
    fileName: 'uno-traffic-light.vcc',
    projectText: trafficLight,
  },
  {
    id: 'uno-buzzer',
    title: 'Buzzer alarm',
    category: 'actuators',
    description: 'Play a two-tone alarm on a piezo buzzer connected to D8.',
    fileName: 'uno-buzzer.vcc',
    projectText: buzzer,
  },
  {
    id: 'uno-servo',
    title: 'Sweep a micro servo',
    category: 'actuators',
    description: 'Bit-bang a 50 Hz servo pulse on D9 without an extra library.',
    fileName: 'uno-servo.vcc',
    projectText: servo,
  },
  {
    id: 'uno-l293d-motor',
    title: 'Drive a DC motor',
    category: 'motor-drivers',
    description: 'Use an L293D H-bridge to reverse a DC motor from the Uno.',
    fileName: 'uno-l293d-motor.vcc',
    projectText: motor,
  },
  {
    id: 'uno-shift-register',
    title: 'Shift register LEDs',
    category: 'shift-registers',
    description: 'Control four LEDs from three pins with a 74HC595.',
    fileName: 'uno-shift-register.vcc',
    projectText: shiftRegister,
  },
  {
    id: 'uno-millis-timer',
    title: 'Millis timer',
    category: 'timers',
    description: 'Blink an LED with millis() so the loop never blocks.',
    fileName: 'uno-millis-timer.vcc',
    projectText: millisTimer,
  },
  {
    id: 'uno-ultrasonic',
    title: 'Measure distance with ultrasonic',
    category: 'sensors',
    description: 'Read distance in cm from an HC-SR04 ultrasonic sensor.',
    fileName: 'uno-ultrasonic.vcc',
    projectText: ultrasonic,
  },
  {
    id: 'uno-ir-receiver',
    title: 'Receive IR remote signals',
    category: 'sensors',
    description: 'Decode NEC/RC5/RC6 protocols from an IR receiver on D2.',
    fileName: 'uno-ir-receiver.vcc',
    projectText: irReceiver,
  },
  {
    id: 'uno-pir',
    title: 'Detect motion with PIR sensor',
    category: 'sensors',
    description: 'Trigger an LED when a PIR sensor detects motion.',
    fileName: 'uno-pir.vcc',
    projectText: pir,
  },
  {
    id: 'uno-keypad',
    title: 'Read 4x4 keypad input',
    category: 'inputs',
    description: 'Scan a 4×4 matrix keypad using 8 digital pins.',
    fileName: 'uno-keypad.vcc',
    projectText: keypad,
  },
  {
    id: 'uno-neopixel',
    title: 'Control NeoPixel LED strip',
    category: 'outputs',
    description: 'Animate an 8-pixel NeoPixel strip with color wipes.',
    fileName: 'uno-neopixel.vcc',
    projectText: neopixel,
  },
  {
    id: 'uno-rgb-led',
    title: 'Control RGB LED colors',
    category: 'outputs',
    description: 'Mix red, green, and blue channels to create any color.',
    fileName: 'uno-rgb-led.vcc',
    projectText: rgbLed,
  },
  {
    id: 'uno-ldr',
    title: 'Read light level with photoresistor',
    category: 'sensors',
    description: 'Measure ambient light with an LDR voltage divider.',
    fileName: 'uno-ldr.vcc',
    projectText: ldr,
  },
  {
    id: 'uno-thermistor',
    title: 'Read temperature with thermistor',
    category: 'sensors',
    description: 'Compute °C from an NTC thermistor using the Steinhart–Hart equation.',
    fileName: 'uno-thermistor.vcc',
    projectText: thermistor,
  },
  {
    id: 'uno-dc-motor',
    title: 'Control DC motor speed',
    category: 'actuators',
    description: 'PWM-drive a DC motor through a TIP120 transistor with flyback diode.',
    fileName: 'uno-dc-motor.vcc',
    projectText: dcMotor,
  },
  {
    id: 'uno-potentiometer',
    title: 'Control LED brightness with potentiometer',
    category: 'inputs',
    description: 'Use a 10 kΩ pot as a voltage divider to dim an LED.',
    fileName: 'uno-potentiometer.vcc',
    projectText: potentiometer,
  },
  {
    id: 'uno-slide-switch',
    title: 'Read slide switch state',
    category: 'inputs',
    description: 'Detect ON/OFF position of a slide switch with pull-down resistor.',
    fileName: 'uno-slide-switch.vcc',
    projectText: slideSwitch,
  },
  {
    id: 'uno-tilt',
    title: 'Detect tilt with tilt sensor',
    category: 'sensors',
    description: 'A mercury/ball tilt switch triggers an LED when tilted.',
    fileName: 'uno-tilt.vcc',
    projectText: tilt,
  },
  {
    id: 'uno-photodiode',
    title: 'Read light with photodiode',
    category: 'sensors',
    description: 'Reverse-biased photodiode measures light intensity on A0.',
    fileName: 'uno-photodiode.vcc',
    projectText: photodiode,
  },
  {
    id: 'uno-soil-moisture',
    title: 'Read soil moisture level',
    category: 'sensors',
    description: 'Capacitive soil moisture sensor outputs 0–100 % on A0.',
    fileName: 'uno-soil-moisture.vcc',
    projectText: soilMoisture,
  },
  {
    id: 'uno-gas-sensor',
    title: 'Detect gas with MQ sensor',
    category: 'sensors',
    description: 'MQ-series heater on 5V, analog output on A0 for gas concentration.',
    fileName: 'uno-gas-sensor.vcc',
    projectText: gasSensor,
  },
  {
    id: 'uno-neopixel-ring',
    title: 'Control NeoPixel ring',
    category: 'outputs',
    description: 'Animate a 12-pixel NeoPixel ring with a rotating color.',
    fileName: 'uno-neopixel-ring.vcc',
    projectText: neopixelRing,
  },
  {
    id: 'uno-flex-sensor',
    title: 'Measure bend with flex sensor',
    category: 'sensors',
    description: 'Flex sensor resistance changes with bend angle; read on A0.',
    fileName: 'uno-flex-sensor.vcc',
    projectText: flexSensor,
  },
  {
    id: 'uno-force-sensor',
    title: 'Measure force with FSR',
    category: 'sensors',
    description: 'Force-sensitive resistor voltage divider reads pressure on A0.',
    fileName: 'uno-force-sensor.vcc',
    projectText: forceSensor,
  },
]

export function starterById(id: string): StarterDefinition | undefined {
  return STARTERS.find((starter) => starter.id === id)
}

export function startersByCategory(category: StarterCategory): readonly StarterDefinition[] {
  return STARTERS.filter((starter) => starter.category === category)
}
