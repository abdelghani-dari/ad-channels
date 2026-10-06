import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules", "ferrite.js");
const dest = join(root, "public", "ferrite");

mkdirSync(dest, { recursive: true });

const files = [
  ["dist/index.js", "player.js"],
  ["assets/ferrite.mjs", "ferrite.mjs"],
  ["assets/ferrite.wasm", "ferrite.wasm"],
  ["dist/worker.js", "worker.js"],
  ["dist/present-worker.js", "present-worker.js"],
  ["dist/audio-worker.js", "audio-worker.js"],
  ["dist/demux-worker.js", "demux-worker.js"],
];

for (const [from, to] of files) {
  copyFileSync(join(pkg, from), join(dest, to));
}

const presentPath = join(dest, "present-worker.js");
let present = readFileSync(presentPath, "utf8");
present = present.replace(
  'getContext("webgl2",{alpha:!1,antialias:!1})',
  'getContext("webgl2",{alpha:!1,antialias:!1,preserveDrawingBuffer:!0})'
);
if (!present.includes("ferriteSnapshot")) {
  present += `
;(()=>{const prev=self.onmessage;self.onmessage=function(ev){const d=ev.data;if(d&&d.type==="ferriteSnapshot"){const c=self.__ferritePresentCanvas;if(!c||typeof c.convertToBlob!=="function"){self.postMessage({type:"ferriteSnapshot",ok:false});return}c.convertToBlob({type:"image/jpeg",quality:.62}).then(b=>b.arrayBuffer()).then(buf=>self.postMessage({type:"ferriteSnapshot",ok:true,bytes:buf},[buf])).catch(()=>self.postMessage({type:"ferriteSnapshot",ok:false}));return}if(d&&d.type==="present-init"&&d.canvas)self.__ferritePresentCanvas=d.canvas;return prev&&prev.call(self,ev)};})();
`;
}
writeFileSync(presentPath, present);

