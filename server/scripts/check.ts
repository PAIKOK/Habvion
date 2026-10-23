let failures = 0;
let assertions = 0;
export function check(label: string, condition: boolean, detail = "") {
  assertions++;
  if (!condition) failures++;
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}
export function finish() {
  console.log(`\n${assertions} checks; ${failures} failures.`);
  if (failures) process.exitCode = 1;
}
