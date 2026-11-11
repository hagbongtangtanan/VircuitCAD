int n = 0;

void setup() {
  Serial.begin(9600);
  n = 0;
}

void loop() {
  Serial.println(n);
  n = (n + 1);
  delay(1000);
}
