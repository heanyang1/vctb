import { LispNumber } from './tokenizer.js';
import { BuiltinSymbol, SpecialForm, SymbolType, makeSymbol, symbolToString } from './symbol.js';

export type Pattern =
  | { kind: 'symbol'; name: string }
  | { kind: 'pair'; car: string; cdr: Pattern }
  | { kind: 'nil' };

export function patternToString(p: Pattern): string {
  switch (p.kind) {
    case 'nil': return 'nil';
    case 'symbol': return p.name;
    case 'pair': return `(${p.car} . ${patternToString(p.cdr)})`;
  }
}

export type NodeData =
  | { type: 'symbol'; sym: SymbolType }
  | { type: 'number'; num: LispNumber }
  | { type: 'pair'; car: NodeRef; cdr: NodeRef }
  | { type: 'specialForm'; form: SpecialForm }
  | { type: 'procedure'; pattern: Pattern; body: NodeRef; env: NodeEnv };

export class NodeRef {
  constructor(public node: NodeData) {}
}

export function nilNode(): NodeData {
  return { type: 'symbol', sym: BuiltinSymbol.Nil };
}

export function nilRef(): NodeRef {
  return new NodeRef(nilNode());
}

export function ref(n: NodeData): NodeRef {
  return new NodeRef(n);
}

export function pairRef(car: NodeRef, cdr: NodeRef): NodeRef {
  return new NodeRef({ type: 'pair', car, cdr });
}

export class NodeEnv {
  map: Map<string, NodeRef> = new Map();
  outer: NodeEnv | null = null;
  name: string;

  constructor(name: string, outer: NodeEnv | null = null) {
    this.name = name;
    this.outer = outer;
  }

  static top(): NodeEnv {
    return new NodeEnv('Global');
  }

  define(key: string, value: NodeRef): void {
    this.map.set(key, value);
  }

  contains(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): NodeRef | null {
    if (this.map.has(key)) return this.map.get(key)!;
    if (this.outer) return this.outer.get(key);
    return null;
  }

  set(key: string, value: NodeRef): boolean {
    if (this.map.has(key)) {
      this.map.set(key, value);
      return true;
    }
    if (this.outer) return this.outer.set(key, value);
    return false;
  }
}

export function nodeToString(n: NodeData, visited: Map<any, number> = new Map(), id: number = 0): string {
  switch (n.type) {
    case 'number':
      return n.num.toString();
    case 'symbol':
      return symbolToString(n.sym);
    case 'specialForm':
      return n.form;
    case 'pair': {
      const cdrPtr = n.cdr;
      if (visited.has(cdrPtr)) return `#${visited.get(cdrPtr)}#`;
      visited.set(cdrPtr, id);

      const carPtr = n.car;
      let s = '';
      if (visited.has(carPtr)) {
        s = `(#${visited.get(carPtr)}#`;
      } else {
        s = '(';
        s += nodeToString(n.car.node, visited, id);
        visited.set(carPtr, id);
      }

      let current = n.cdr;
      let currentId = id;
      while (true) {
        const next = getNextPairElement(current, visited, currentId);
        if (next === null) break;
        if (next.done) { s += ` . ${next.repr}`; break; }
        s += ` ${next.repr}`;
        current = next.next!;
        currentId = next.nextId!;
      }
      s += ')';
      return s;
    }
    case 'procedure': {
      return `(λ ${patternToString(n.pattern)} ${nodeToString(n.body.node)})`;
    }
  }
}

function getNextPairElement(
  node: NodeRef,
  visited: Map<any, number>,
  currentId: number,
): { done: boolean; repr?: string; next?: NodeRef; nextId?: number } | null {
  const n = node.node;
  if (n.type === 'pair') {
    const cdrPtr = n.cdr;
    if (visited.has(cdrPtr)) return { done: true, repr: `#${visited.get(cdrPtr)}#` };

    const nextId = currentId + 1;
    visited.set(cdrPtr, nextId);

    const carPtr = n.car;
    let repr = '';
    if (visited.has(carPtr)) {
      repr = `#${visited.get(carPtr)}#`;
    } else {
      repr = nodeToString(n.car.node, visited, nextId);
      visited.set(carPtr, nextId);
    }
    return { done: false, repr, next: n.cdr, nextId };
  }
  if (n.type === 'symbol' && n.sym === BuiltinSymbol.Nil) return null;
  return { done: true, repr: nodeToString(n) };
}

export function nodeFromIter(items: NodeRef[]): NodeData {
  let cur: NodeData = nilNode();
  for (let i = items.length - 1; i >= 0; i--) {
    cur = { type: 'pair', car: items[i], cdr: ref(cur) };
  }
  return cur;
}

export function deepCopy(n: NodeData): NodeData {
  switch (n.type) {
    case 'number': return { type: 'number', num: n.num };
    case 'symbol': return { type: 'symbol', sym: n.sym };
    case 'specialForm': return { type: 'specialForm', form: n.form };
    case 'pair': return { type: 'pair', car: ref(deepCopy(n.car.node)), cdr: ref(deepCopy(n.cdr.node)) };
    case 'procedure': throw new Error('Cannot deep-copy procedure');
  }
}

export function replaceNode(node: NodeData, src: NodeData, dst: NodeData): void {
  if (nodeEqual(node, src)) {
    Object.assign(node, dst);
    return;
  }
  if (node.type === 'procedure') throw new Error('Cannot replace in procedure');
  if (node.type === 'pair') {
    replaceNode(node.car.node, src, dst);
    replaceNode(node.cdr.node, src, dst);
  }
}

export function nodeEqual(a: NodeData, b: NodeData): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'number': return (a as any).num.eq((b as any).num);
    case 'symbol': return symbolToString(a.sym) === symbolToString((b as typeof a).sym);
    case 'specialForm': return a.form === (b as typeof a).form;
    case 'pair': return nodeEqual(a.car.node, (b as typeof a).car.node) && nodeEqual(a.cdr.node, (b as typeof a).cdr.node);
    case 'procedure': return false;
  }
}

export function patternFromNode(node: NodeData): Pattern {
  if (node.type === 'symbol') {
    if (node.sym === BuiltinSymbol.Nil) return { kind: 'nil' };
    if (typeof node.sym === 'object' && node.sym.kind === 'user') {
      return { kind: 'symbol', name: node.sym.name };
    }
    throw new Error(`${symbolToString(node.sym)} is not a user defined symbol`);
  }
  if (node.type === 'pair') {
    const car = node.car.node;
    if (car.type === 'symbol' && typeof car.sym === 'object' && car.sym.kind === 'user') {
      return { kind: 'pair', car: car.sym.name, cdr: patternFromNode(node.cdr.node) };
    }
    throw new Error(`${nodeToString(node)} is not a list`);
  }
  throw new Error(`Can't transform node ${nodeToString(node)} to pattern`);
}

export function patternMatching(
  pattern: Pattern,
  actual: NodeRef[],
  bindings: Map<string, NodeRef>,
): void {
  if (pattern.kind === 'symbol') {
    bindings.set(pattern.name, ref(nodeFromIter(actual)));
    return;
  }
  if (pattern.kind === 'nil') {
    if (actual.length !== 0) throw new Error('Parameter mismatch');
    return;
  }
  if (pattern.kind === 'pair') {
    if (actual.length < 1) throw new Error('Parameter mismatch');
    bindings.set(pattern.car, actual[0]);
    patternMatching(pattern.cdr, actual.slice(1), bindings);
    return;
  }
}

export function vectorize(lst: NodeRef): NodeRef[] {
  const result: NodeRef[] = [];
  let cur = lst;
  while (true) {
    const n = cur.node;
    if (n.type === 'pair') {
      result.push(n.car);
      cur = n.cdr;
    } else {
      break;
    }
  }
  if (cur.node.type !== 'symbol' || cur.node.sym !== BuiltinSymbol.Nil) {
    throw new Error('Not a proper list');
  }
  return result;
}

export function getNParams(lst: NodeRef, n: number): NodeRef[] {
  const result = vectorize(lst);
  if (result.length > n) throw new Error('More parameters than requested');
  if (result.length < n) throw new Error('Fewer parameters than requested');
  return result;
}

export function nodeAsInt(n: NodeData): number {
  if (n.type === 'number' && n.num.isInt) return n.num.intVal;
  throw new Error(`${nodeToString(n)} is not an integer`);
}

export function nodeAsNum(n: NodeData): LispNumber {
  if (n.type === 'number') return n.num;
  throw new Error(`${nodeToString(n)} is not a number`);
}

export function nodeAsPair(n: NodeData): { car: NodeRef; cdr: NodeRef } {
  if (n.type === 'pair') return { car: n.car, cdr: n.cdr };
  throw new Error(`${nodeToString(n)} is not a pair`);
}

export function nodeAsUserSymbol(n: NodeData): string {
  if (n.type === 'symbol' && typeof n.sym === 'object' && n.sym.kind === 'user') {
    return n.sym.name;
  }
  throw new Error(`${nodeToString(n)} is not a user defined symbol`);
}

export function withBegin(body: NodeData): NodeData {
  return { type: 'pair', car: ref({ type: 'specialForm', form: SpecialForm.Begin }), cdr: ref(body) };
}
