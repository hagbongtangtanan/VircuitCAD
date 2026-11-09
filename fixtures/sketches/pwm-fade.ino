int brightness = 0;
int step = 5;

void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  analogWrite(9, brightness);
  brightness += step;
  if (brightness <= 0 || brightness >= 255) step = -step;
  delay(20);
}
