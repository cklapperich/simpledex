// Pure iteration
console.time('loop');
let x = 0;
for (let i = 0; i < 20000; i++) x++;
console.timeEnd('loop');
// => 0.1ms

console.time('search');
const embeddings = new Float32Array(20000 * 512); // pretend data
const query = new Float32Array(512);

for (let i = 0; i < 20000; i++) {
  let dot = 0;
  const offset = i * 512;
  for (let j = 0; j < 512; j++) {
    dot += query[j] * embeddings[offset + j];
  }
}
console.timeEnd('search');
// => ~15-40ms depending on device