#include <Servo.h>

Servo servo;
int position = 0;

void setup() {
  servo.attach(9);
}

void loop() {
  for (position = 0; position <= 180; position += 1) {
    servo.write(position);
    delay(15);
  }
  for (position = 180; position >= 0; position -= 1) {
    servo.write(position);
    delay(15);
  }
}
