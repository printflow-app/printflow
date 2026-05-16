// Empty stub for Node's `stream` module — used to silence Vite's externalization
// warning from xlsx-js-style. Only the Node-only code paths in xlsx-js-style touch
// `stream.Readable`; the browser `writeFile` path we use never hits them.
export class Readable {}
export class Writable {}
export class Transform {}
export class PassThrough {}
export default { Readable, Writable, Transform, PassThrough };
