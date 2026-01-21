## Card Scanner Plan

**Stack:** MobileCLIP-S0 (ONNX) + Transformers.js + WebGPU + Static files

### Assets
- Model: 46MB (HuggingFace CDN or self-hosted)
- Embeddings: ~15MB (Float16 gzipped binary)
- Card metadata: 3MB (already have)

### UX
1. User clicks "Download Scanner (~50MB)"
2. Fetch model + embeddings, cache in browser
3. Set `localStorage.scanner = true`
4. Future visits: scanner ready instantly

### Search (Web Workers)
```
User photo → MobileCLIP → 512-d embedding
                              ↓
         Split 20k embeddings across 4 workers
                              ↓
         Each worker: cosine similarity on 5k vectors
                              ↓
              Merge results, return top N
```

### Files to Create
```
/public/embeddings.bin      # Float16, all 20k cards
/workers/search-worker.js   # Cosine similarity chunk search
```

### Build Step (one-time)
```python
for card in cards:
    emb = mobileclip.encode_image(card.image)
    write_float16(emb)  # append to embeddings.bin
```

### Later (if needed)
- Supabase for user collections / cross-device sync
- Move model to HuggingFace CDN if Vercel complains