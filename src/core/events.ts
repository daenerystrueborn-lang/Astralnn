export class EventBus<T extends object> {
  private listeners = new Map<keyof T,Set<(value: any)=>void>>();
  on<K extends keyof T>(event:K, listener:(value:T[K])=>void):()=>void {
    const group = this.listeners.get(event) ?? new Set(); group.add(listener); this.listeners.set(event, group);
    return () => { group.delete(listener); };
  }
  emit<K extends keyof T>(event:K, value:T[K]):void { this.listeners.get(event)?.forEach(listener=>listener(value)); }
}
