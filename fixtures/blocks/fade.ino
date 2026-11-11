int i = 0;

void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  for (int i = 0; i <= 255; i += 5) {
    analogWrite(9, i);
    delay(10);
  }
}
