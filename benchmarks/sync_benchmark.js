import { performance } from 'perf_hooks';

// Mock submitScore
const submitScoreMock = async (entry) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true); // Simulate success
    }, 50); // 50ms delay
  });
};

const runSerial = async (pendingToUpload) => {
  const successIndices = [];
  const start = performance.now();

  for (let i = 0; i < pendingToUpload.length; i++) {
    const entry = pendingToUpload[i];
    const success = await submitScoreMock(entry);
    if (success) {
      successIndices.push(i);
    }
  }

  const end = performance.now();
  console.log(`Serial execution time: ${(end - start).toFixed(2)}ms`);
  return successIndices;
};

const runParallel = async (pendingToUpload) => {
  const successIndices = [];
  const start = performance.now();

  const results = await Promise.all(pendingToUpload.map(entry => submitScoreMock(entry)));
  results.forEach((success, i) => {
    if (success) {
      successIndices.push(i);
    }
  });

  const end = performance.now();
  console.log(`Parallel execution time: ${(end - start).toFixed(2)}ms`);
  return successIndices;
};

const main = async () => {
  const pendingToUpload = Array(10).fill({ name: 'Test', score: 100 });

  console.log('--- Benchmarking Sync Logic ---');
  await runSerial(pendingToUpload);
  await runParallel(pendingToUpload);
};

main();
