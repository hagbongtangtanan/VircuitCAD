unsigned long previous = 0;
bool state = false;

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  if (millis() - previous >= 500) {
    previous = millis();
    state = !state;
    digitalWrite(13, state ? HIGH : LOW);
  }
}
