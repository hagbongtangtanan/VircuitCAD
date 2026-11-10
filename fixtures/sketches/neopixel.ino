#include <Adafruit_NeoPixel.h>

#define PIN 6
#define COUNT 8

Adafruit_NeoPixel strip(COUNT, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.show();
}

void loop() {
  for (int i = 0; i < COUNT; i += 1) {
    strip.setPixelColor(i, strip.Color(0, 64, 0));
  }
  strip.show();
  delay(500);
  strip.clear();
  strip.show();
  delay(500);
}
