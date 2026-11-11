#include <Servo.h>

int angle = 0;
Servo servo_9;

void setup() {
  servo_9.attach(9);
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 1) {
    servo_9.write(angle);
    delay(15);
  }
}
