export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;

    constructor(factory: () => T, initialSize: number = 0) {
        this.factory = factory;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    get(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    return(obj: T): void {
        this.pool.push(obj);
    }

    get size(): number {
        return this.pool.length;
    }
}
