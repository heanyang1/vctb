import {
  NodeData, NodeRef, NodeEnv, nilNode, nilRef, ref, pairRef,
  Pattern, patternMatching, patternFromNode, vectorize, getNParams,
  nodeAsPair, nodeAsUserSymbol, nodeAsInt, nodeAsNum, nodeEqual,
  withBegin, nodeFromIter,
} from './node.js';
import { LispNumber, Lexer } from './tokenizer.js';
import { SpecialForm, BuiltinSymbol } from './symbol.js';
import { parse } from './parser.js';
import { preprocess } from './preprocess.js';

export interface EvalCallbacks {
  writeOutput(text: string): void;
  writeStdout(text: string): void;
  writeGraph(text: string, graphCount: number): void;
}

class EvalResult {
  node: NodeRef;
  callbacks: EvalCallbacks;
  graphCount: number;

  constructor(node: NodeRef, callbacks: EvalCallbacks, graphCount: number = 1) {
    this.node = node;
    this.callbacks = callbacks;
    this.graphCount = graphCount;
  }

  bindNode(newNode: NodeRef): EvalResult {
    this.node = newNode;
    return this;
  }

  bindDisplay(output: string): EvalResult {
    this.callbacks.writeStdout(output);
    return this;
  }

  bindGraph(env: NodeEnv): EvalResult {
    const output = `digraph graph_${this.graphCount} {\n${printEnvGraph(env)}\n}\n`;
    this.callbacks.writeGraph(output, this.graphCount);
    this.graphCount++;
    return this;
  }

  bindBreak(_env: NodeEnv): EvalResult {
    return this;
  }

  bindEval(_src: NodeRef, _dst: NodeRef, _env: NodeEnv): EvalResult {
    return this;
  }
}

function printEnvGraph(env: NodeEnv): string {
  let result = '';
  const visited = new Set<NodeEnv>();

  function walkEnv(e: NodeEnv): void {
    if (visited.has(e)) return;
    visited.add(e);

    result += `\tsubgraph cluster_${e.name} {\n`;
    result += `\t\tlabel="Env ${e.name}"\n`;
    result += `\t\tstyle=filled;\n`;
    result += `\t\tcolor=lightgrey;\n`;
    result += `\t\tenv_node_${e.name} [label="", shape=point, style=invis];\n\n`;

    for (const [key] of e.map) {
      const keyHash = key.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
      result += `\t\tkey_${keyHash}_${e.name} [label="${key}", shape=box];\n`;
      result += `\t\tkey_${keyHash}_${e.name} -> node_${e.name}_${key};\n`;
    }
    result += `\t}\n`;

    if (e.outer) {
      result += `\t\tenv_node_${e.name} -> env_node_${e.outer.name} [label="outer", style=dashed];\n`;
      walkEnv(e.outer);
    }
  }

  walkEnv(env);
  return result;
}

function nodeToStringDisplay(n: NodeData, visited: Map<any, number> = new Map(), id: number = 0): string {
  switch (n.type) {
    case 'number': return n.num.toString();
    case 'symbol': {
      if (typeof n.sym === 'object') return n.sym.name;
      return n.sym;
    }
    case 'specialForm': return n.form;
    case 'pair': {
      const cdrPtr = n.cdr;
      if (visited.has(cdrPtr)) return `#${visited.get(cdrPtr)}#`;
      visited.set(cdrPtr, id);
      let s = '(';
      s += nodeToStringDisplay(n.car.node, visited, id);
      let current = n.cdr;
      let currentId = id;
      while (true) {
        const next = getDisplayNext(current, visited, currentId);
        if (next === null) break;
        if (next.done) { s += ` . ${next.repr}`; break; }
        s += ` ${next.repr}`;
        current = next.next!;
        currentId = next.nextId!;
      }
      s += ')';
      return s;
    }
    case 'procedure': return `(λ ${patternString(n.pattern)} ${nodeToStringDisplay(n.body.node)})`;
  }
}

function getDisplayNext(node: NodeRef, visited: Map<any, number>, currentId: number): { done: boolean; repr?: string; next?: NodeRef; nextId?: number } | null {
  const n = node.node;
  if (n.type === 'pair') {
    const cdrPtr = n.cdr;
    if (visited.has(cdrPtr)) return { done: true, repr: `#${visited.get(cdrPtr)}#` };
    const nextId = currentId + 1;
    visited.set(cdrPtr, nextId);
    const repr = nodeToStringDisplay(n.car.node, visited, nextId);
    return { done: false, repr, next: n.cdr, nextId };
  }
  if (n.type === 'symbol' && n.sym === BuiltinSymbol.Nil) return null;
  return { done: true, repr: nodeToStringDisplay(n, visited, currentId) };
}

function patternString(p: Pattern): string {
  switch (p.kind) {
    case 'nil': return 'nil';
    case 'symbol': return p.name;
    case 'pair': return `(${p.car} . ${patternString(p.cdr)})`;
  }
}

export function evalNode(node: NodeData, env: NodeEnv, callbacks: EvalCallbacks): EvalResult {
  const result = new EvalResult(nilRef(), callbacks);

  function evalInner(n: NodeData, env: NodeEnv, res: EvalResult): EvalResult {
    const selfRef = ref(n);
    switch (n.type) {
      case 'symbol':
        return evalSymbol(n.sym, env, res);
      case 'number':
      case 'procedure':
      case 'specialForm':
        return res.bindNode(ref(n));
      case 'pair': {
        const carResult = evalInner(n.car.node, env, res);
        const applied = applyNode(carResult.node.node, n.cdr, env, carResult);
        return applied.bindEval(selfRef, applied.node, env);
      }
    }
  }

  function evalSymbol(sym: any, env: NodeEnv, res: EvalResult): EvalResult {
    if (typeof sym === 'object' && sym.kind === 'user') {
      const val = env.get(sym.name);
      if (val) return res.bindNode(val);
      throw new Error(`Symbol ${sym.name} not found`);
    }
    return res.bindNode(ref({ type: 'symbol', sym }));
  }

  function applySpecialForm(form: SpecialForm, cdr: NodeRef, env: NodeEnv, res: EvalResult): EvalResult {
    switch (form) {
      case SpecialForm.Quote: {
        const params = getNParams(cdr, 1);
        return res.bindNode(params[0]);
      }
      case SpecialForm.If: {
        const params = getNParams(cdr, 3);
        const condResult = evalInner(params[0].node, env, res);
        const body = (condResult.node.node.type !== 'symbol' || condResult.node.node.sym !== BuiltinSymbol.Nil)
          ? params[1] : params[2];
        return evalInner(body.node, env, condResult);
      }
      case SpecialForm.Define: {
        const params = getNParams(cdr, 2);
        const name = nodeAsUserSymbol(params[0].node);
        const valResult = evalInner(params[1].node, env, res);
        env.define(name, valResult.node);
        return res.bindNode(nilRef());
      }
      case SpecialForm.Set: {
        const params = getNParams(cdr, 2);
        const name = nodeAsUserSymbol(params[0].node);
        const valResult = evalInner(params[1].node, env, res);
        if (!env.set(name, valResult.node)) {
          throw new Error(`Symbol ${name} not defined`);
        }
        return res.bindNode(nilRef());
      }
      case SpecialForm.SetCar: {
        const params = getNParams(cdr, 2);
        const name = nodeAsUserSymbol(params[0].node);
        const valResult = evalInner(params[1].node, env, res);
        const target = env.get(name);
        if (!target) throw new Error(`${name} is not defined`);
        const p = nodeAsPair(target.node);
        target.node = { type: 'pair', car: valResult.node, cdr: p.cdr };
        return res.bindNode(nilRef());
      }
      case SpecialForm.SetCdr: {
        const params = getNParams(cdr, 2);
        const name = nodeAsUserSymbol(params[0].node);
        const valResult = evalInner(params[1].node, env, res);
        const target = env.get(name);
        if (!target) throw new Error(`${name} is not defined`);
        const p = nodeAsPair(target.node);
        target.node = { type: 'pair', car: p.car, cdr: valResult.node };
        return res.bindNode(nilRef());
      }
      case SpecialForm.Lambda: {
        const cdrPair = nodeAsPair(cdr.node);
        const pattern = patternFromNode(cdrPair.car.node);
        const body = withBegin(cdrPair.cdr.node);
        return res.bindNode(ref({ type: 'procedure', pattern, body: ref(body), env }));
      }
      case SpecialForm.Begin: {
        const params = vectorize(cdr);
        let curResult = res;
        for (const expr of params) {
          curResult = evalInner(expr.node, env, curResult);
        }
        return curResult;
      }
      case SpecialForm.Display: {
        const params = getNParams(cdr, 1);
        const valResult = evalInner(params[0].node, env, res);
        const output = nodeToStringDisplay(valResult.node.node);
        valResult.bindDisplay(output);
        return res.bindNode(nilRef());
      }
      case SpecialForm.NewLine: {
        getNParams(cdr, 0);
        res.bindDisplay('\n');
        return res.bindNode(nilRef());
      }
      case SpecialForm.Graphviz:
        return res.bindNode(nilRef()).bindGraph(env);
      case SpecialForm.BreakPoint:
        return res.bindNode(nilRef()).bindBreak(env);
      default:
        throw new Error(`Unknown special form: ${form}`);
    }
  }

  function applyBuiltinSymbol(sym: BuiltinSymbol, params: NodeRef[]): NodeRef {
    switch (sym) {
      case BuiltinSymbol.Add: {
        if (params.length < 2) throw new Error('Fewer parameters than requested');
        const nums = params.map(p => nodeAsNum(p.node));
        return ref({ type: 'number', num: nums.reduce((a, b) => a.add(b)) });
      }
      case BuiltinSymbol.Sub: {
        if (params.length < 2) throw new Error('Fewer parameters than requested');
        const nums = params.map(p => nodeAsNum(p.node));
        return ref({ type: 'number', num: nums.slice(1).reduce((a, b) => a.sub(b), nums[0]) });
      }
      case BuiltinSymbol.Mul: {
        if (params.length < 2) throw new Error('Fewer parameters than requested');
        const nums = params.map(p => nodeAsNum(p.node));
        return ref({ type: 'number', num: nums.reduce((a, b) => a.mul(b)) });
      }
      case BuiltinSymbol.Div: {
        if (params.length < 2) throw new Error('Fewer parameters than requested');
        const nums = params.map(p => nodeAsNum(p.node));
        return ref({ type: 'number', num: nums.slice(1).reduce((a, b) => a.div(b), nums[0]) });
      }
      case BuiltinSymbol.EqNum: {
        exactly2(params);
        const a = nodeAsNum(params[0].node);
        const b = nodeAsNum(params[1].node);
        return truthRef(a.eq(b));
      }
      case BuiltinSymbol.Lt: {
        exactly2(params);
        const a = nodeAsNum(params[0].node);
        const b = nodeAsNum(params[1].node);
        return truthRef(a.lt(b));
      }
      case BuiltinSymbol.Gt: {
        exactly2(params);
        const a = nodeAsNum(params[0].node);
        const b = nodeAsNum(params[1].node);
        return truthRef(a.gt(b));
      }
      case BuiltinSymbol.Le: {
        exactly2(params);
        const a = nodeAsNum(params[0].node);
        const b = nodeAsNum(params[1].node);
        return truthRef(a.le(b));
      }
      case BuiltinSymbol.Ge: {
        exactly2(params);
        const a = nodeAsNum(params[0].node);
        const b = nodeAsNum(params[1].node);
        return truthRef(a.ge(b));
      }
      case BuiltinSymbol.List:
        return ref(nodeFromIter(params));
      case BuiltinSymbol.Car:
        return exactly1(params, () => applyCar(params[0].node));
      case BuiltinSymbol.Cdr:
        return exactly1(params, () => applyCdr(params[0].node));
      case BuiltinSymbol.Cons:
        return exactly2(params, () => ref({ type: 'pair', car: params[0], cdr: params[1] }));
      case BuiltinSymbol.Atom:
        return exactly1(params, () => truthRef(params[0].node.type !== 'pair'));
      case BuiltinSymbol.Eq:
        return exactly2(params, () => truthRef(nodeEqual(params[0].node, params[1].node)));
      case BuiltinSymbol.Number:
        return exactly1(params, () => truthRef(params[0].node.type === 'number' && params[0].node.num.isInt));
      default:
        throw new Error(`${sym} can not be the head of a list`);
    }
  }

  function truthRef(val: boolean): NodeRef {
    return ref({ type: 'symbol', sym: val ? BuiltinSymbol.T : BuiltinSymbol.Nil });
  }

  function applyCar(n: NodeData): NodeRef {
    const p = nodeAsPair(n);
    return p.car;
  }

  function applyCdr(n: NodeData): NodeRef {
    const p = nodeAsPair(n);
    return p.cdr;
  }

  function exactly1(params: NodeRef[], fn: () => NodeRef): NodeRef {
    if (params.length !== 1) throw new Error('Expected 1 parameter');
    return fn();
  }

  function exactly2(params: NodeRef[], fn?: () => NodeRef): NodeRef {
    if (params.length !== 2) throw new Error('Expected 2 parameters');
    return fn ? fn() : undefined as any;
  }

  function applyNode(head: NodeData, cdr: NodeRef, env: NodeEnv, res: EvalResult): EvalResult {
    switch (head.type) {
      case 'number':
      case 'pair':
        throw new Error(`${nodeToStringDisplay(head)} can not be the head of a list`);
      case 'specialForm':
        return applySpecialForm(head.form, cdr, env, res);
      case 'symbol': {
        const params = vectorize(cdr);
        let curResult = res;
        const evaledParams: NodeRef[] = [];
        for (const param of params) {
          curResult = evalInner(param.node, env, curResult);
          evaledParams.push(curResult.node);
        }
        if (typeof head.sym === 'object' && head.sym.kind === 'user') {
          throw new Error('Should have been evaluated');
        }
        const nodeVal = applyBuiltinSymbol(head.sym as BuiltinSymbol, evaledParams);
        return curResult.bindNode(nodeVal);
      }
      case 'procedure': {
        const params = vectorize(cdr);
        let curResult = res;
        const evaledParams: NodeRef[] = [];
        for (const param of params) {
          curResult = evalInner(param.node, env, curResult);
          evaledParams.push(curResult.node);
        }
        const bindings = new Map<string, NodeRef>();
        patternMatching(head.pattern, evaledParams, bindings);
        const newEnv = new NodeEnv(nodeToStringDisplay(head), head.env);
        for (const [k, v] of bindings) newEnv.define(k, v);
        return evalInner(head.body.node, newEnv, curResult);
      }
    }
  }

  return evalInner(node, env, result);
}

export function evaluate(
  input: string,
  callbacks: EvalCallbacks,
  env?: NodeEnv,
  macros?: Map<string, any>,
): { env: NodeEnv; macros: Map<string, any> } {
  const tokens = new Lexer(input);
  const persistentEnv = env ?? NodeEnv.top();
  const persistentMacros = macros ?? new Map<string, any>();
  let lastResult: EvalResult | null = null;

  while (true) {
    const peek = tokens.peekNextToken();
    if (peek.token === null) break;
    const node = parse(tokens);
    const processed = preprocess(node, persistentMacros);
    if (processed.type === 'symbol' && processed.sym === BuiltinSymbol.Nil) continue;
    lastResult = evalNode(processed, persistentEnv, callbacks);
  }

  if (lastResult) {
    callbacks.writeOutput(nodeToStringDisplay(lastResult.node.node) + '\n');
  }
  return { env: persistentEnv, macros: persistentMacros };
}
