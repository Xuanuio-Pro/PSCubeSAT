// Code suggestions for the C++ editor: only functions and variables. Monaco's default
// word list (every word in the file, Vietnamese comments included), keywords and
// snippets are switched off in MonacoEditor; this provider is the only source.

const fn = (name, signature) => ({ name, signature, kind: 'function' });
const fns = list => list.map(([name, signature]) => fn(name, signature));

// Arduino-ESP32 core functions students use in the labs.
const ARDUINO_FUNCTIONS = fns([
  ['pinMode', 'void pinMode(uint8_t pin, uint8_t mode)'], ['digitalWrite', 'void digitalWrite(uint8_t pin, uint8_t val)'],
  ['digitalRead', 'int digitalRead(uint8_t pin)'], ['analogRead', 'uint16_t analogRead(uint8_t pin)'],
  ['analogWrite', 'void analogWrite(uint8_t pin, int value)'], ['analogReadMilliVolts', 'uint32_t analogReadMilliVolts(uint8_t pin)'],
  ['delay', 'void delay(uint32_t ms)'], ['delayMicroseconds', 'void delayMicroseconds(uint32_t us)'],
  ['millis', 'unsigned long millis()'], ['micros', 'unsigned long micros()'],
  ['map', 'long map(long x, long in_min, long in_max, long out_min, long out_max)'], ['constrain', 'constrain(x, low, high)'],
  ['abs', 'abs(x)'], ['min', 'min(a, b)'], ['max', 'max(a, b)'], ['pow', 'double pow(double base, double exponent)'],
  ['sqrt', 'double sqrt(double x)'], ['random', 'long random(long min, long max)'], ['randomSeed', 'void randomSeed(unsigned long seed)'],
  ['attachInterrupt', 'void attachInterrupt(uint8_t pin, void (*isr)(), int mode)'], ['detachInterrupt', 'void detachInterrupt(uint8_t pin)'],
  ['digitalPinToInterrupt', 'int digitalPinToInterrupt(uint8_t pin)'], ['tone', 'void tone(uint8_t pin, unsigned int frequency, unsigned long duration = 0)'],
  ['noTone', 'void noTone(uint8_t pin)'], ['shiftOut', 'void shiftOut(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder, uint8_t val)'],
  // Arduino-ESP32 2.x LEDC API (platform espressif32@6.10.0), as used by Lab1-03_PWM_LED.
  ['ledcSetup', 'uint32_t ledcSetup(uint8_t channel, uint32_t freq, uint8_t resolution_bits)'], ['ledcAttachPin', 'void ledcAttachPin(uint8_t pin, uint8_t channel)'],
  ['ledcWrite', 'void ledcWrite(uint8_t channel, uint32_t duty)'],
  ['isnan', 'bool isnan(x)'], ['isfinite', 'bool isfinite(x)'],
  // PTITCube global helpers (CDH/WDT.h, CDH/CDH.h).
  ['wdtInit', 'bool wdtInit(uint32_t timeoutSec = 3, bool panic = true)'], ['wdtAdd', 'void wdtAdd()'], ['wdtFeed', 'void wdtFeed()'],
  ['wasWatchdogReset', 'bool wasWatchdogReset()'], ['taskDelayMs', 'void taskDelayMs(uint32_t ms)'],
  ['createTask', 'bool createTask(TaskFunction_t taskFn, const char* name, uint32_t stackSize = 2048, UBaseType_t priority = 1, BaseType_t core = 1, void* param = NULL)'],
]);

// Global objects provided by the Arduino core / libraries (they are variables).
const GLOBAL_OBJECTS = { Serial: 'HardwareSerial', Serial1: 'HardwareSerial', Serial2: 'HardwareSerial', Wire: 'TwoWire', SD: 'SDFS', WiFi: 'WiFiClass' };

const STREAM = fns([
  ['begin', 'void begin(unsigned long baud, uint32_t config = SERIAL_8N1, int8_t rxPin = -1, int8_t txPin = -1)'], ['end', 'void end()'],
  ['available', 'int available()'], ['read', 'int read()'], ['peek', 'int peek()'], ['flush', 'void flush()'],
  ['print', 'size_t print(value)'], ['println', 'size_t println(value)'], ['printf', 'size_t printf(const char* format, ...)'],
  ['write', 'size_t write(uint8_t c)'], ['readString', 'String readString()'], ['readStringUntil', 'String readStringUntil(char terminator)'],
  ['setTimeout', 'void setTimeout(unsigned long ms)'], ['parseInt', 'long parseInt()'], ['parseFloat', 'float parseFloat()'],
]);

const SCHEDULER = fns([['addTask', 'void addTask(const char* name, TaskFunction fn, uint32_t intervalMs, uint8_t core = 1, uint8_t priority = 2, uint16_t stackSize = 4096)'],
  ['enableWatchdog', 'void enableWatchdog(uint32_t timeoutSeconds = 30)'], ['start', 'void start()'],
  ['lock', 'static bool lock(uint8_t bus, uint32_t timeoutMs = 100)'], ['unlock', 'static void unlock(uint8_t bus)']]);

// Public API of PTITCube-Library 74065b6 (src/*/*.h), same names the compiler image installs.
export const MEMBERS = {
  HardwareSerial: [...STREAM, ...fns([['updateBaudRate', 'void updateBaudRate(unsigned long baud)']])],
  PTIT_CDH: [...STREAM, ...SCHEDULER, ...fns([['init', 'void init()'], ['update', 'void update()'], ['publishData', 'void publishData(const char* topic, const char* payload)'],
    ['extractCommand', 'String extractCommand(const String& cmd)'], ['wdtInit', 'bool wdtInit(uint32_t timeoutSec = 3, bool panic = true)'], ['wdtAdd', 'void wdtAdd()'],
    ['wdtFeed', 'void wdtFeed()'], ['wdtReset', 'void wdtReset()'], ['wasWatchdogReset', 'bool wasWatchdogReset()'], ['logData', 'void logData(const char* data)'],
    ['handleStorageCommand', 'String handleStorageCommand(const String& cmd)'], ['delayMs', 'void delayMs(uint32_t ms)'],
    ['createTask', 'bool createTask(TaskFunction_t taskFn, const char* name, uint32_t stackSize = 2048, UBaseType_t priority = 1, BaseType_t core = 1, void* param = NULL)']])],
  PTIT_EPS: fns([['init', 'bool init()'], ['update', 'void update()'], ['getBatteryVoltage', 'float getBatteryVoltage()'], ['getBatteryPercent', 'float getBatteryPercent()'],
    ['getBatteryPercentage', 'float getBatteryPercentage()'], ['getChargeRate', 'float getChargeRate()'], ['isConnected', 'bool isConnected()'],
    ['setBuckState', 'static void setBuckState(bool enable)'], ['getBuckState', 'static bool getBuckState()'], ['enableBuck', 'static void enableBuck()'], ['disableBuck', 'static void disableBuck()']]),
  PTIT_COM: fns([['init', 'void init()'], ['update', 'String update()'], ['sendPing', 'void sendPing()'], ['sendMessage', 'void sendMessage(String msg)'],
    ['setChannel', 'bool setChannel(uint8_t channel)'], ['setAddress', 'bool setAddress(uint8_t addh, uint8_t addl)'], ['setTransmissionMode', 'bool setTransmissionMode(uint8_t mode)']]),
  PTIT_Sensor: fns([['init', 'void init(bool initBMP = true, bool initMPU = true, bool initQMC = true)'], ['update', 'void update()'],
    ['getTemperature', 'float getTemperature()'], ['getPressure', 'float getPressure()'],
    ['getAccX', 'float getAccX()'], ['getAccY', 'float getAccY()'], ['getAccZ', 'float getAccZ()'],
    ['getGyroX', 'float getGyroX()'], ['getGyroY', 'float getGyroY()'], ['getGyroZ', 'float getGyroZ()'],
    ['getMagX', 'float getMagX() // µT'], ['getMagY', 'float getMagY() // µT'], ['getMagZ', 'float getMagZ() // µT'],
    ['getAltitude', 'float getAltitude()'], ['getRoll', 'float getRoll()'], ['getPitch', 'float getPitch()'], ['getHeading', 'float getHeading()']]),
  PTIT_GPS: fns([['init', 'void init(uint8_t gpsSelectPin = 12, uint8_t camSelectPin = 14)'], ['update', 'void update()'], ['hasFix', 'bool hasFix()'],
    ['selectGPS', 'void selectGPS()'], ['selectCamera', 'void selectCamera()'], ['getLatitude', 'float getLatitude()'], ['getLongitude', 'float getLongitude()'],
    ['getLat', 'float getLat()'], ['getLng', 'float getLng()'], ['getAltitude', 'float getAltitude()'], ['getSatellites', 'int getSatellites()'],
    ['getSpeed', 'float getSpeed()'], ['getCourse', 'float getCourse()'], ['getHDOP', 'float getHDOP()'], ['getTimeString', 'String getTimeString()'],
    ['readSentence', 'String readSentence()'], ['verifyChecksum', 'static bool verifyChecksum(const char* sentence)'],
    ['getNMEAType', 'static const char* getNMEAType(const char* sentence)']]),
  PTIT_Camera: fns([['init', 'bool init(uint8_t gpsSelectPin = 12, uint8_t camSelectPin = 14)'], ['selectCamera', 'void selectCamera()'], ['selectGPS', 'void selectGPS()'],
    ['captureToFile', 'bool captureToFile(const char* path)'], ['capture', 'bool capture()'], ['isReady', 'bool isReady()']]),
  PTIT_MUX: fns([['init', 'static void init(uint8_t gpsSelectPin = 12, uint8_t camSelectPin = 14)'], ['selectGPS', 'static void selectGPS()'],
    ['selectCamera', 'static void selectCamera()'], ['isGPSSelected', 'static bool isGPSSelected()'], ['isCameraSelected', 'static bool isCameraSelected()']]),
  PTIT_WDT: fns([['init', 'static bool init(uint32_t timeoutSec = 3, bool panic = true)'], ['add', 'static void add()'], ['feed', 'static void feed()'],
    ['reset', 'static void reset()'], ['wasReset', 'static bool wasReset()']]),
  PTIT_Queue: fns([['init', 'bool init(size_t length = 10)'], ['send', 'bool send(const T& item, uint32_t waitMs = 0)'], ['sendFromISR', 'bool sendFromISR(const T& item)'],
    ['receive', 'bool receive(T* item, uint32_t waitMs = portMAX_DELAY)'], ['isEmpty', 'bool isEmpty()'], ['available', 'UBaseType_t available()']]),
  PTIT_Storage: fns([['init', 'void init()'], ['isReady', 'bool isReady()'], ['logData', 'void logData(const char* data)'],
    ['writeFile', 'bool writeFile(const char* path, const char* content)'], ['appendFile', 'bool appendFile(const char* path, const char* content)'],
    ['readFile', 'String readFile(const char* path)'], ['exists', 'bool exists(const char* path)'], ['removeFile', 'bool removeFile(const char* path)'],
    ['renameFile', 'bool renameFile(const char* from, const char* to)'], ['fileSize', 'long fileSize(const char* path)'],
    ['createDir', 'bool createDir(const char* path)'], ['removeDir', 'bool removeDir(const char* path)'], ['listDir', 'void listDir(const char* dirname, uint8_t levels = 0)'],
    ['totalBytes', 'uint64_t totalBytes()'], ['usedBytes', 'uint64_t usedBytes()'], ['handleCommand', 'String handleCommand(const String& cmd)']]),
  PTIT_Scheduler: [...SCHEDULER, ...fns([['print', 'static void print(const String& msg)'], ['println', 'static void println(const String& msg)']])],
  String: fns([['length', 'unsigned int length()'], ['substring', 'String substring(unsigned int from, unsigned int to)'], ['indexOf', 'int indexOf(char/String value)'],
    ['lastIndexOf', 'int lastIndexOf(char/String value)'], ['startsWith', 'bool startsWith(const String& prefix)'], ['endsWith', 'bool endsWith(const String& suffix)'],
    ['trim', 'void trim()'], ['toInt', 'long toInt()'], ['toFloat', 'float toFloat()'], ['toLowerCase', 'void toLowerCase()'], ['toUpperCase', 'void toUpperCase()'],
    ['c_str', 'const char* c_str()'], ['equals', 'bool equals(const String& other)'], ['charAt', 'char charAt(unsigned int index)'],
    ['replace', 'void replace(const String& find, const String& replace)'], ['isEmpty', 'bool isEmpty()']]),
  File: fns([['name', 'const char* name()'], ['path', 'const char* path()'], ['size', 'size_t size()'], ['isDirectory', 'bool isDirectory()'],
    ['openNextFile', 'File openNextFile()'], ['available', 'int available()'], ['read', 'int read()'], ['write', 'size_t write(uint8_t c)'],
    ['print', 'size_t print(value)'], ['println', 'size_t println(value)'], ['close', 'void close()']]),
  TwoWire: fns([['begin', 'bool begin(int sda = -1, int scl = -1, uint32_t frequency = 0)'], ['setClock', 'bool setClock(uint32_t frequency)'],
    ['beginTransmission', 'void beginTransmission(uint8_t address)'], ['endTransmission', 'uint8_t endTransmission(bool sendStop = true)'],
    ['requestFrom', 'uint8_t requestFrom(uint8_t address, uint8_t quantity)'], ['write', 'size_t write(uint8_t data)'], ['available', 'int available()'], ['read', 'int read()']]),
  SDFS: fns([['begin', 'bool begin(uint8_t ssPin = SS)'], ['open', 'File open(const char* path, const char* mode = FILE_READ)'], ['exists', 'bool exists(const char* path)'],
    ['mkdir', 'bool mkdir(const char* path)'], ['rmdir', 'bool rmdir(const char* path)'], ['remove', 'bool remove(const char* path)'],
    ['totalBytes', 'uint64_t totalBytes()'], ['usedBytes', 'uint64_t usedBytes()']]),
  WiFiClass: fns([['begin', 'wl_status_t begin(const char* ssid, const char* passphrase)'], ['status', 'wl_status_t status()'], ['localIP', 'IPAddress localIP()'],
    ['softAP', 'bool softAP(const char* ssid, const char* passphrase = NULL)'], ['softAPIP', 'IPAddress softAPIP()'], ['disconnect', 'bool disconnect()'], ['mode', 'bool mode(wifi_mode_t mode)']]),
};

const NOT_NAMES = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return', 'break', 'continue', 'goto', 'new', 'delete', 'sizeof', 'typedef', 'using', 'namespace', 'class', 'struct', 'enum', 'public', 'private', 'protected', 'template', 'operator', 'throw', 'default', 'const', 'static', 'volatile', 'unsigned', 'signed', 'inline', 'extern', 'void', 'true', 'false', 'nullptr', 'NULL']);

/** Comments and string/char literals become spaces so their words are never suggested. */
export function stripNonCode(code) {
  return code.replace(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/g, match => match.replace(/[^\n]/g, ' '));
}

/** Functions and variables the student declared in this file, with their declared type. */
export function declaredSymbols(code) {
  const text = stripNonCode(code).replace(/^\s*#.*$/gm, '');
  const symbols = new Map();
  const add = (name, symbol) => { if (!NOT_NAMES.has(name) && !symbols.has(name)) symbols.set(name, symbol); };
  const type = '((?:[A-Za-z_]\\w*::)*[A-Za-z_]\\w*(?:\\s*<[^<>;{}()]*>)?)';
  // Function definitions "<type> name(...) {" and void prototypes. "Type name(args);" is an
  // object constructed with arguments (e.g. PTIT_CDH cdh(Serial);), handled as a variable below.
  for (const match of text.matchAll(new RegExp(`\\b${type}[\\s*&]+([A-Za-z_]\\w*)\\s*\\(([^;{}()]*)\\)\\s*(?:const\\s*)?(\\{|;)`, 'g'))) {
    if (NOT_NAMES.has(match[1]) && match[1] !== 'void') continue;
    if (match[4] === ';' && match[1] !== 'void') continue;
    add(match[2], { name: match[2], kind: 'function', signature: `${match[1]} ${match[2]}(${match[3].replace(/\s+/g, ' ').trim()})` });
  }
  // Variables, parameters and objects: <type> name = / ; / , / ) / [ / (args);
  for (const match of text.matchAll(new RegExp(`\\b${type}(?:\\s*[*&]\\s*|\\s+)([A-Za-z_]\\w*)\\s*(?=[=;,\\[)]|\\([^()]*\\)\\s*;|\\{[^{}]*\\}\\s*;)`, 'g'))) {
    if (NOT_NAMES.has(match[1]) || /^\d/.test(match[1])) continue;
    add(match[2], { name: match[2], kind: 'variable', type: match[1].replace(/\s+/g, ''), signature: `${match[1]} ${match[2]}` });
  }
  return [...symbols.values()];
}

/**
 * Suggestions at the cursor. After "obj." / "obj->" only that object's methods;
 * otherwise Arduino functions, global objects and the file's own functions/variables.
 */
export function completionsAt(code, linePrefix) {
  const symbols = declaredSymbols(code);
  const member = /([A-Za-z_]\w*)\s*(?:\.|->)\s*\w*$/.exec(linePrefix);
  if (member) {
    const object = member[1];
    const declared = symbols.find(symbol => symbol.name === object && symbol.kind === 'variable');
    // Template arguments do not change the member list: PTIT_Queue<SystemEvent> -> PTIT_Queue.
    const typeName = (declared?.type ?? GLOBAL_OBJECTS[object] ?? '').replace(/^(?:const|static)+/, '').replace(/<.*>$/, '');
    return (MEMBERS[typeName] ?? []).map(item => ({ ...item, kind: 'method' }));
  }
  // A number literal like "3." or text after "::" gets nothing rather than unrelated names.
  if (/(?:\d\.|::)\w*$/.test(linePrefix)) return [];
  const seen = new Set();
  return [
    ...symbols,
    ...Object.entries(GLOBAL_OBJECTS).map(([name, type]) => ({ name, kind: 'variable', signature: `${type} ${name}` })),
    ...ARDUINO_FUNCTIONS,
  ].filter(item => !seen.has(item.name) && seen.add(item.name));
}

let registered = false;
/** Registers the provider once per page; Monaco keeps providers global per language. */
export function registerCppCompletions(monaco) {
  if (registered) return;
  registered = true;
  const kinds = monaco.languages.CompletionItemKind;
  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['.', '>'],
    provideCompletionItems(model, position) {
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      if (linePrefix.endsWith('>') && !linePrefix.endsWith('->')) return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const suggestions = completionsAt(model.getValue(), linePrefix).map(item => ({
        label: item.name,
        kind: item.kind === 'method' ? kinds.Method : item.kind === 'function' ? kinds.Function : kinds.Variable,
        detail: item.signature,
        insertText: item.name,
        range,
      }));
      return { suggestions };
    },
  });
}
