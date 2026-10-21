"""Execute the actual portable Lab6 anomaly rules on the host, without a board."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / "fastapi-backend/app/firmware/curriculum/Lab6-02_Watchdog_And_Event.cpp").read_text(encoding="utf-8")
rules = source.split("// BEGIN PORTABLE ANOMALY RULES\n", 1)[1].split("// END PORTABLE ANOMALY RULES", 1)[0]
folder = ROOT / "build_cache/firmware-logic"
folder.mkdir(parents=True, exist_ok=True)
test_source = folder / "anomaly.cpp"
test_source.write_text("#include <cmath>\n#include <cstdint>\n#include <limits>\n#include <cassert>\n" + rules + r'''
int main() {
    FallDetector stationary;
    for (uint32_t now = 0; now < 1000; now += 100) {
        assert(!stationary.update(0, 0, 9.80665f, now));
        assert(!stationary.update(9.80665f, 0, 0, now));
        assert(!stationary.update(0, -9.80665f, 0, now));
    }
    FallDetector falling;
    assert(!falling.update(0, 0, 0, 0));
    assert(!falling.update(0.1f, 0.1f, 0.1f, 100));
    assert(falling.update(0, 0, 0, 200));
    assert(!falling.update(0, 0, 9.80665f, 300));
    assert(!falling.update(0, 0, 0, 400));
    const float nan = std::numeric_limits<float>::quiet_NaN();
    const float infinity = std::numeric_limits<float>::infinity();
    assert(!falling.update(nan, 0, 0, 500));
    assert(!falling.update(0, 0, 0, 600));
    assert(!falling.update(0, 0, 0, 700));
    assert(falling.update(0, 0, 0, 800));
    assert(!falling.update(0, infinity, 0, 900));
    FallDetector wrapping;
    assert(!wrapping.update(0, 0, 0, UINT32_MAX - 99));
    assert(wrapping.update(0, 0, 0, 100));
    assert(!isOverheating(45.0f));
    assert(isOverheating(45.1f));
    assert(!isOverheating(nan));
    assert(!isOverheating(infinity));
}
''', encoding="utf-8")
compiler = shutil.which("g++")
if not compiler:
    raise SystemExit("g++ is required for the native firmware logic test")
executable = folder / "anomaly-test.exe"
subprocess.run([compiler, "-std=c++11", "-Wall", "-Wextra", "-Werror", str(test_source), "-o", str(executable)], check=True)
subprocess.run([str(executable)], check=True)
print("PASS actual Lab6 C++ rules: three stationary orientations, sustained/transient fall, NaN/Inf, recovery, timer wrap and heat threshold")
