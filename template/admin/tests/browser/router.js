const router = { calls: [], replace(value) { this.calls.push(value); return Promise.resolve(); }, push(value) { this.calls.push(value); }, go(value) { this.calls.push(value); } };
export default router;
