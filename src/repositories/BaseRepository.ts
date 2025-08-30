export interface IEntity {
  id: string;
  toJSON(): Record<string, unknown>;
}

export abstract class BaseRepository<T extends IEntity> {
  protected items: T[] = [];

  public findAll(): T[] {
    return [...this.items];
  }

  public findById(id: string): T | null {
    return this.items.find((item) => item.id === id) || null;
  }

  public create(item: T): T {
    this.items.push(item);
    return item;
  }

  public update(id: string, item: T): T | null {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) {
      return null;
    }
    this.items[index] = item;
    return item;
  }

  public delete(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    return true;
  }

  public exists(id: string): boolean {
    return this.items.some((item) => item.id === id);
  }

  public count(): number {
    return this.items.length;
  }

  public clear(): void {
    this.items = [];
  }

  public findWhere(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  public findFirst(predicate: (item: T) => boolean): T | null {
    return this.items.find(predicate) || null;
  }
}
